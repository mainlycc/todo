/** Spłaszczenie wartości właściwości Notion (API) do stringów do tabeli w UI. */

type RichText = { plain_text?: string }[];

function richTextToPlain(rich: RichText | undefined): string {
  if (!rich?.length) return '';
  return rich.map(t => t.plain_text ?? '').join('');
}

export function extractNotionTitle(properties: Record<string, unknown>): string {
  for (const val of Object.values(properties)) {
    if (val && typeof val === 'object' && (val as { type?: string }).type === 'title') {
      return richTextToPlain((val as { title?: RichText }).title);
    }
  }
  return 'Bez tytułu';
}

/** Nazwa pola typu `title` w danej bazie (np. „client”, „Name”). */
export function findTitlePropertyKey(properties: Record<string, unknown> | null | undefined): string | null {
  if (!properties || typeof properties !== 'object') return null;
  for (const [name, val] of Object.entries(properties)) {
    if (val && typeof val === 'object' && (val as { type?: string }).type === 'title') {
      return name;
    }
  }
  return null;
}

export function flattenNotionProperties(properties: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, raw] of Object.entries(properties)) {
    if (!raw || typeof raw !== 'object') {
      out[name] = '';
      continue;
    }
    const prop = raw as { type?: string; id?: string };
    const t = prop.type;
    switch (t) {
      case 'title':
        out[name] = richTextToPlain((raw as { title?: RichText }).title);
        break;
      case 'rich_text':
        out[name] = richTextToPlain((raw as { rich_text?: RichText }).rich_text);
        break;
      case 'number': {
        const n = (raw as { number?: number | null }).number;
        out[name] = n != null ? String(n) : '';
        break;
      }
      case 'select':
        out[name] = (raw as { select?: { name?: string } | null }).select?.name ?? '';
        break;
      case 'multi_select':
        out[name] = ((raw as { multi_select?: { name?: string }[] }).multi_select ?? [])
          .map(s => s.name)
          .filter(Boolean)
          .join(', ');
        break;
      case 'date': {
        const d = (raw as { date?: { start?: string; end?: string } | null }).date;
        if (!d?.start) out[name] = '';
        else out[name] = d.end ? `${d.start} → ${d.end}` : d.start;
        break;
      }
      case 'checkbox':
        out[name] = (raw as { checkbox?: boolean }).checkbox ? 'Tak' : 'Nie';
        break;
      case 'url':
        out[name] = (raw as { url?: string | null }).url ?? '';
        break;
      case 'email':
        out[name] = (raw as { email?: string | null }).email ?? '';
        break;
      case 'phone_number':
        out[name] = (raw as { phone_number?: string | null }).phone_number ?? '';
        break;
      case 'formula': {
        const f = (raw as { formula?: { type?: string; string?: string; number?: number; boolean?: boolean } })
          .formula;
        if (!f?.type) out[name] = '';
        else if (f.type === 'string') out[name] = f.string ?? '';
        else if (f.type === 'number') out[name] = f.number != null ? String(f.number) : '';
        else if (f.type === 'boolean') out[name] = f.boolean ? 'Tak' : 'Nie';
        else out[name] = '';
        break;
      }
      case 'relation':
        out[name] = ((raw as { relation?: { id?: string }[] }).relation ?? []).map(r => r.id).filter(Boolean).join(', ');
        break;
      case 'rollup':
        out[name] = '…';
        break;
      case 'people':
        out[name] = ((raw as { people?: { name?: string; id?: string }[] }).people ?? [])
          .map(p => p.name || p.id)
          .filter(Boolean)
          .join(', ');
        break;
      case 'files':
        out[name] = ((raw as { files?: { name?: string; file?: { url?: string }; external?: { url?: string } }[] }).files ?? [])
          .map(f => f.name || f.file?.url || f.external?.url || '')
          .filter(Boolean)
          .join(', ');
        break;
      case 'status':
        out[name] = (raw as { status?: { name?: string } | null }).status?.name ?? '';
        break;
      case 'created_time':
        out[name] = String((raw as { created_time?: string }).created_time ?? '');
        break;
      case 'last_edited_time':
        out[name] = String((raw as { last_edited_time?: string }).last_edited_time ?? '');
        break;
      case 'created_by':
        out[name] =
          (raw as { created_by?: { name?: string; id?: string } }).created_by?.name ??
          (raw as { created_by?: { id?: string } }).created_by?.id ??
          '';
        break;
      case 'last_edited_by':
        out[name] =
          (raw as { last_edited_by?: { name?: string; id?: string } }).last_edited_by?.name ??
          (raw as { last_edited_by?: { id?: string } }).last_edited_by?.id ??
          '';
        break;
      case 'unique_id': {
        const u = (raw as { unique_id?: { prefix?: string | null; number?: number } }).unique_id;
        out[name] = u ? `${u.prefix ?? ''}${u.number ?? ''}` : '';
        break;
      }
      case 'verification':
        out[name] = '';
        break;
      default:
        out[name] = '';
    }
  }
  return out;
}

export function notionPageUrl(pageId: string): string {
  const id = pageId.replace(/-/g, '');
  return `https://www.notion.so/${id}`;
}
