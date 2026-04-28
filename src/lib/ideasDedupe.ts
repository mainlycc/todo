import type { IdeaRow } from '../types';

/**
 * Jednolity klucz dla `notion_page_id`, żeby dopasować ten sam dokument
 * niezależnie od formatu UUID (np. z/bez myślników) i unikać podwójnych wpisów.
 */
export function notionPageIdKey(id: string | null | undefined): string | null {
  const s = id?.trim();
  if (!s) return null;
  const clean = s.replace(/-/g, '').toLowerCase();
  if (/^[a-f0-9]{32}$/.test(clean)) return clean;
  return s.toLowerCase();
}

/** Zostaw jeden wiersz na stronę Notion (przy kilku rekordach — najnowszy po `created_at`). */
export function dedupeIdeasByNotionPage(rows: IdeaRow[]): IdeaRow[] {
  const bestByNotion = new Map<string, IdeaRow>();
  const withoutNotion: IdeaRow[] = [];

  for (const row of rows) {
    const k = notionPageIdKey(row.notion_page_id);
    if (!k) {
      withoutNotion.push(row);
      continue;
    }
    const prev = bestByNotion.get(k);
    if (
      !prev ||
      new Date(row.created_at).getTime() >= new Date(prev.created_at).getTime()
    ) {
      bestByNotion.set(k, row);
    }
  }

  return [...withoutNotion, ...bestByNotion.values()];
}
