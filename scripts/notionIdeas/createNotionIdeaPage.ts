import { APIErrorCode, APIResponseError, Client } from '@notionhq/client';
import { findTitlePropertyKey } from '../../src/lib/notionClientsFlatten';

function normalizeNotionUuid(id: string): string {
  const clean = id.replace(/-/g, '').trim();
  if (!/^[a-f0-9]{32}$/i.test(clean)) return id.trim();
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

type NoteTypePropKind = 'select' | 'multi_select' | 'status';

function getNoteTypePropKind(raw: unknown): NoteTypePropKind | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = (raw as { type?: string }).type;
  if (t === 'select' || t === 'multi_select' || t === 'status') return t;
  return null;
}

function listOptionNamesForProperty(
  schema: Record<string, unknown>,
  key: string,
  kind: NoteTypePropKind
): string[] {
  const raw = schema[key];
  if (!raw || typeof raw !== 'object') return [];
  if (kind === 'select') {
    return ((raw as { select?: { options?: { name: string }[] } }).select?.options ?? []).map(o => o.name);
  }
  if (kind === 'multi_select') {
    return (
      (raw as { multi_select?: { options?: { name: string }[] } }).multi_select?.options ?? []
    ).map(o => o.name);
  }
  return ((raw as { status?: { options?: { name: string }[] } }).status?.options ?? []).map(o => o.name);
}

/** Dokładna zgodność, potem ta sama wartość bez rozróżniania wielkości liter (Notion bywa niespójny). */
function resolveCanonicalOptionName(available: string[], requested: string): string | null {
  if (available.includes(requested)) return requested;
  const rl = requested.trim().toLowerCase();
  const found = available.find(o => o.trim().toLowerCase() === rl);
  return found ?? null;
}

/**
 * Kolejność: najpierw dokładna nazwa „Typ notatki”, potem hint z .env, potem aliasy.
 * Dzięki temu zły NOTION_POMYSLY_NOTE_TYPE_PROPERTY nie „kradnie” wartości — i tak trafi do właściwej kolumny,
 * jeśli istnieje i zawiera wybraną opcję.
 */
function collectNoteTypePropertyCandidates(
  schema: Record<string, unknown>,
  propertyHint?: string | null
): { key: string; kind: NoteTypePropKind; priority: number }[] {
  const out: { key: string; kind: NoteTypePropKind; priority: number }[] = [];
  const seen = new Set<string>();

  for (const [name, raw] of Object.entries(schema)) {
    const kind = getNoteTypePropKind(raw);
    if (!kind) continue;
    const n = name.trim().toLowerCase();
    if (n === 'typ notatki') {
      out.push({ key: name, kind, priority: 100 });
      seen.add(name);
    }
  }

  if (propertyHint?.trim()) {
    const k = propertyHint.trim();
    const raw = schema[k];
    const kind = getNoteTypePropKind(raw);
    if (kind && !seen.has(k)) {
      out.push({ key: k, kind, priority: 80 });
      seen.add(k);
    }
  }

  const ALIASES = new Set(['rodzaj notatki', 'kategoria notatki', 'note type', 'type']);
  for (const [name, raw] of Object.entries(schema)) {
    if (seen.has(name)) continue;
    const kind = getNoteTypePropKind(raw);
    if (!kind) continue;
    const n = name.trim().toLowerCase();
    let priority = 0;
    if (ALIASES.has(n)) priority = 60;
    else if (n.includes('typ') && n.includes('notat')) priority = 50;
    if (priority > 0) {
      out.push({ key: name, kind, priority });
      seen.add(name);
    }
  }

  out.sort((a, b) => b.priority - a.priority);
  return out;
}

function noteTypePropertyValue(kind: NoteTypePropKind, optionName: string): unknown {
  switch (kind) {
    case 'select':
      return { select: { name: optionName } };
    case 'multi_select':
      return { multi_select: [{ name: optionName }] };
    case 'status':
      return { status: { name: optionName } };
  }
}

export interface CreateNotionIdeaPageConfig {
  notionToken: string;
  /** ID bazy lub strony z URL Notion (z myślnikami lub bez) */
  parentTargetId: string;
  content: string;
  /** Dokładna nazwa opcji z pola „Typ notatki” w Notion (Select / Status / Multi-select) */
  noteType?: string;
  /** Opcjonalnie: dokładna nazwa kolumny z API Notion (gdy autowykrycie zawiedzie) */
  noteTypePropertyHint?: string | null;
}

export interface CreateNotionIdeaPageResult {
  notionPageId: string;
}

type ResolvedNoteType = { key: string; optionName: string; propType: NoteTypePropKind };

function resolveNoteTypeForDatabase(
  schema: Record<string, unknown>,
  noteType: string | undefined,
  propertyHint?: string | null
): ResolvedNoteType | null {
  const trimmed = noteType?.trim();
  if (!trimmed) return null;

  const candidates = collectNoteTypePropertyCandidates(schema, propertyHint);
  if (!candidates.length) {
    throw new Error(
      'Nie znaleziono w bazie Notion pola „Typ notatki” (typ Select, Status lub Multi-select). ' +
        'Sprawdź nazwę kolumny lub ustaw NOTION_POMYSLY_NOTE_TYPE_PROPERTY w .env (dokładna nazwa z API).'
    );
  }

  const errors: string[] = [];
  for (const c of candidates) {
    const opts = listOptionNamesForProperty(schema, c.key, c.kind);
    const canonical = resolveCanonicalOptionName(opts, trimmed);
    if (canonical) {
      return { key: c.key, optionName: canonical, propType: c.kind };
    }
    errors.push(`„${c.key}”: ${opts.length ? opts.join(', ') : '(brak opcji)'}`);
  }

  throw new Error(
    `Opcja „${trimmed}” nie występuje w żadnym polu typu notatki. Próbowano: ${errors.join('; ')}`
  );
}

/**
 * Uzupełnia typowe pola wymagane przez szablon bazy (status, select, checkbox),
 * gdy sam tytuł nie wystarcza do utworzenia wiersza.
 */
function buildDatabaseRowPropertiesWithFallbacks(
  schema: Record<string, unknown>,
  titleKey: string,
  text: string,
  noteTypeResolved: ResolvedNoteType | null
): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    [titleKey]: {
      title: [{ type: 'text', text: { content: text } }],
    },
  };

  for (const [name, raw] of Object.entries(schema)) {
    if (name === titleKey) continue;
    if (!raw || typeof raw !== 'object') continue;
    const t = (raw as { type?: string }).type;
    if (t === 'checkbox') {
      properties[name] = { checkbox: false };
    } else if (t === 'select') {
      if (noteTypeResolved && name === noteTypeResolved.key && noteTypeResolved.propType === 'select') {
        properties[name] = { select: { name: noteTypeResolved.optionName } };
      } else {
        const options = (raw as { select?: { options?: { name: string }[] } }).select?.options;
        if (options?.length) properties[name] = { select: { name: options[0].name } };
      }
    } else if (t === 'multi_select') {
      if (noteTypeResolved && name === noteTypeResolved.key && noteTypeResolved.propType === 'multi_select') {
        properties[name] = { multi_select: [{ name: noteTypeResolved.optionName }] };
      } else {
        const options = (raw as { multi_select?: { options?: { name: string }[] } }).multi_select?.options;
        if (options?.length) properties[name] = { multi_select: [{ name: options[0].name }] };
      }
    } else if (t === 'status') {
      if (noteTypeResolved && name === noteTypeResolved.key && noteTypeResolved.propType === 'status') {
        properties[name] = { status: { name: noteTypeResolved.optionName } };
      } else {
        const options = (raw as { status?: { options?: { name: string }[] } }).status?.options;
        if (options?.length) properties[name] = { status: { name: options[0].name } };
      }
    }
  }

  return properties;
}

/**
 * Dodaje wpis do bazy Notion (jeśli parent to database) albo podstronę ze stroną nadrzędną (page_id).
 */
export async function createNotionIdeaPage(
  cfg: CreateNotionIdeaPageConfig
): Promise<CreateNotionIdeaPageResult> {
  const notion = new Client({ auth: cfg.notionToken });
  const id = normalizeNotionUuid(cfg.parentTargetId);
  const text = cfg.content.trim();
  if (!text) throw new Error('Pusty pomysł');

  let dbMeta: Awaited<ReturnType<typeof notion.databases.retrieve>> | null = null;
  try {
    dbMeta = await notion.databases.retrieve({ database_id: id });
  } catch (e) {
    if (APIResponseError.isAPIResponseError(e) && e.code === APIErrorCode.ObjectNotFound) {
      dbMeta = null;
    } else {
      throw e;
    }
  }

  if (dbMeta) {
    const schema = dbMeta.properties as Record<string, unknown>;
    const titleKey = findTitlePropertyKey(schema);
    if (!titleKey) throw new Error('Baza Notion nie ma pola typu title');

    const noteTypeResolved = resolveNoteTypeForDatabase(
      schema,
      cfg.noteType,
      cfg.noteTypePropertyHint ?? null
    );

    const minimal: Record<string, unknown> = {
      [titleKey]: {
        title: [{ type: 'text', text: { content: text } }],
      },
    };
    if (noteTypeResolved) {
      minimal[noteTypeResolved.key] = noteTypePropertyValue(
        noteTypeResolved.propType,
        noteTypeResolved.optionName
      );
    }

    try {
      const created = await notion.pages.create({
        parent: { database_id: id },
        properties: minimal as Parameters<Client['pages']['create']>[0]['properties'],
      });
      return { notionPageId: created.id };
    } catch (e) {
      if (
        APIResponseError.isAPIResponseError(e) &&
        e.code === APIErrorCode.ValidationError
      ) {
        const withDefaults = buildDatabaseRowPropertiesWithFallbacks(
          schema,
          titleKey,
          text,
          noteTypeResolved
        );
        const created = await notion.pages.create({
          parent: { database_id: id },
          properties: withDefaults as Parameters<Client['pages']['create']>[0]['properties'],
        });
        return { notionPageId: created.id };
      }
      throw e;
    }
  }

  const created = await notion.pages.create({
    parent: { page_id: id },
    properties: {
      title: {
        title: [{ type: 'text', text: { content: text } }],
      },
    },
  });
  return { notionPageId: created.id };
}
