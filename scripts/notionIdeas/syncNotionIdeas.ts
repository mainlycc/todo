import { Client, isFullPage } from '@notionhq/client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  PageObjectResponse,
  PartialPageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { ANONYMOUS_USER_ID } from '../../src/constants';
import { extractNotionTitle, findTitlePropertyKey } from '../../src/lib/notionClientsFlatten';
import { mergeNotionTitleAndBody } from '../../src/lib/ideaContentParts';
import { notionPageIdKey } from '../../src/lib/ideasDedupe';
import { fetchNotionPageBodyPlainText } from '../../src/lib/notionPagePlainText';

export interface NotionIdeasSyncConfig {
  notionToken: string;
  /** UUID bazy (z URL Notion), z myślnikami lub bez */
  databaseId: string;
  supabaseUrl: string;
  supabaseKey: string;
  userId?: string;
  /** Opcjonalnie: dokładna nazwa kolumny typu notatki (z API Notion). */
  noteTypePropertyHint?: string | null;
}

export interface NotionIdeasSyncResult {
  synced: number;
  inserted: number;
  updated: number;
  skippedNoTitle: number;
}

function normalizeNotionUuid(id: string): string {
  const clean = id.replace(/-/g, '').trim();
  if (!/^[a-f0-9]{32}$/i.test(clean)) return id.trim();
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

function getNoteTypeFromProperties(
  props: Record<string, unknown>,
  hint?: string | null
): string | null {
  const pick = (key: string): string | null => {
    const raw = props[key];
    if (!raw || typeof raw !== 'object') return null;
    const t = (raw as { type?: string }).type;
    if (t === 'select') return (raw as { select?: { name?: string } | null }).select?.name ?? null;
    if (t === 'status') return (raw as { status?: { name?: string } | null }).status?.name ?? null;
    if (t === 'multi_select') {
      const first = ((raw as { multi_select?: { name?: string }[] }).multi_select ?? [])[0]?.name;
      return first ?? null;
    }
    return null;
  };

  if (hint?.trim()) {
    const v = pick(hint.trim());
    if (v) return v;
  }

  // Prefer exact "Typ notatki"
  for (const k of Object.keys(props)) {
    if (k.trim().toLowerCase() === 'typ notatki') {
      const v = pick(k);
      if (v) return v;
    }
  }

  // Fallback: any property containing "typ" and "notat"
  for (const k of Object.keys(props)) {
    const n = k.trim().toLowerCase();
    if (n.includes('typ') && n.includes('notat')) {
      const v = pick(k);
      if (v) return v;
    }
  }
  return null;
}

export async function syncNotionIdeasToSupabase(cfg: NotionIdeasSyncConfig): Promise<NotionIdeasSyncResult> {
  const notion = new Client({ auth: cfg.notionToken });
  const dbId = normalizeNotionUuid(cfg.databaseId);
  const supabase: SupabaseClient = createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const userId = cfg.userId ?? ANONYMOUS_USER_ID;

  // Retrieve DB schema to ensure we can read title correctly (and to allow hinting if needed later).
  const db = await notion.databases.retrieve({ database_id: dbId });
  const schema = db.properties as Record<string, unknown>;
  const titleKey = findTitlePropertyKey(schema);
  if (!titleKey) {
    throw new Error('Baza Notion dla pomysłów nie ma pola typu title.');
  }

  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  for (;;) {
    const res = await notion.databases.query({
      database_id: dbId,
      start_cursor: cursor,
    });
    for (const p of res.results) {
      if (isFullPage(p as PageObjectResponse | PartialPageObjectResponse)) {
        pages.push(p as PageObjectResponse);
      }
    }
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }

  const notionItems: {
    notion_page_id: string;
    content: string;
    note_type: string | null;
    created_at: string;
  }[] = [];

  for (const page of pages) {
    const props = page.properties as Record<string, unknown>;
    const title = extractNotionTitle(props) || '';
    let bodyPlain = '';
    try {
      bodyPlain = await fetchNotionPageBodyPlainText(notion, page.id);
    } catch (e) {
      console.warn(`[notion-ideas/sync] bloki strony ${page.id}:`, e);
    }
    const content = mergeNotionTitleAndBody(title, bodyPlain);
    const noteType = getNoteTypeFromProperties(props, cfg.noteTypePropertyHint ?? null);
    notionItems.push({
      notion_page_id: page.id,
      content,
      note_type: noteType,
      created_at: page.created_time,
    });
  }

  const { data: existing, error: selErr } = await supabase
    .from('ideas')
    .select('id, notion_page_id')
    .eq('user_id', userId)
    .not('notion_page_id', 'is', null);
  if (selErr) throw new Error(`Supabase select ideas: ${selErr.message}`);

  const existingByNotionId = new Map<string, string>();
  for (const r of (existing ?? []) as { id: string; notion_page_id: string | null }[]) {
    const nk = notionPageIdKey(r.notion_page_id);
    if (nk) existingByNotionId.set(nk, r.id);
  }

  const toInsert: any[] = [];
  const toUpdate: { id: string; patch: any }[] = [];
  let skippedNoTitle = 0;

  for (const item of notionItems) {
    const trimmed = (item.content || '').trim();
    if (!trimmed) {
      skippedNoTitle += 1;
      continue;
    }
    const nk = notionPageIdKey(item.notion_page_id);
    const existingId = nk ? existingByNotionId.get(nk) : undefined;
    if (existingId) {
      toUpdate.push({
        id: existingId,
        patch: {
          content: trimmed,
          note_type: item.note_type,
          notion_page_id: item.notion_page_id,
          created_at: item.created_at,
        },
      });
    } else {
      toInsert.push({
        user_id: userId,
        content: trimmed,
        note_type: item.note_type,
        notion_page_id: item.notion_page_id,
        created_at: item.created_at,
      });
    }
  }

  // Insert in chunks
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { error } = await supabase.from('ideas').insert(chunk);
    if (error) throw new Error(`Supabase insert ideas: ${error.message}`);
    inserted += chunk.length;
  }

  // Update in chunks (best-effort sequential; avoids requiring unique constraints for upsert)
  let updated = 0;
  for (const u of toUpdate) {
    const { error } = await supabase.from('ideas').update(u.patch).eq('id', u.id).eq('user_id', userId);
    if (error) throw new Error(`Supabase update ideas: ${error.message}`);
    updated += 1;
  }

  return {
    synced: inserted + updated,
    inserted,
    updated,
    skippedNoTitle,
  };
}

