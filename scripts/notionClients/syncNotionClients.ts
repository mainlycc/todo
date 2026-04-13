import { Client, isFullPage } from '@notionhq/client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  PageObjectResponse,
  PartialPageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { ANONYMOUS_USER_ID } from '../../src/constants';
import { extractNotionTitle } from '../../src/lib/notionClientsFlatten';

export interface NotionClientsSyncConfig {
  notionToken: string;
  /** UUID bazy (z URL Notion), z myślnikami lub bez */
  databaseId: string;
  supabaseUrl: string;
  supabaseKey: string;
  userId?: string;
}

export interface NotionClientsSyncResult {
  synced: number;
  removedStale: number;
}

function normalizeNotionUuid(id: string): string {
  const clean = id.replace(/-/g, '').trim();
  if (!/^[a-f0-9]{32}$/i.test(clean)) return id.trim();
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

export async function syncNotionClientsToSupabase(
  cfg: NotionClientsSyncConfig
): Promise<NotionClientsSyncResult> {
  const notion = new Client({ auth: cfg.notionToken });
  const dbId = normalizeNotionUuid(cfg.databaseId);
  const supabase: SupabaseClient = createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const userId = cfg.userId ?? ANONYMOUS_USER_ID;

  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  for (;;) {
    const res = await notion.databases.query({
      database_id: dbId,
      start_cursor: cursor,
    });
    for (const p of res.results) {
      // Typ wyniku query jest szerszy niż parametr isFullPage — w praktyce to strony z properties.
      if (isFullPage(p as PageObjectResponse | PartialPageObjectResponse)) {
        pages.push(p as PageObjectResponse);
      }
    }
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }

  const nowIso = new Date().toISOString();
  const notionIds = new Set<string>();

  const rows = pages.map(page => {
    notionIds.add(page.id);
    const title = extractNotionTitle(page.properties as Record<string, unknown>);
    return {
      notion_page_id: page.id,
      user_id: userId,
      title,
      notion_properties: page.properties as Record<string, unknown>,
      last_edited_time: page.last_edited_time,
      synced_at: nowIso,
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase.from('notion_clients').upsert(rows, { onConflict: 'notion_page_id' });
    if (error) throw new Error(`Supabase upsert: ${error.message}`);
  }

  const { data: existing, error: selErr } = await supabase
    .from('notion_clients')
    .select('notion_page_id')
    .eq('user_id', userId);
  if (selErr) throw new Error(`Supabase select: ${selErr.message}`);

  let removedStale = 0;
  for (const r of existing ?? []) {
    if (!notionIds.has(r.notion_page_id)) {
      const { error: delErr } = await supabase.from('notion_clients').delete().eq('notion_page_id', r.notion_page_id);
      if (delErr) throw new Error(`Supabase delete: ${delErr.message}`);
      removedStale += 1;
    }
  }

  return { synced: rows.length, removedStale };
}
