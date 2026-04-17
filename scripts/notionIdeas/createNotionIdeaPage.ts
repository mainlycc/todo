import { Client } from '@notionhq/client';
import { findTitlePropertyKey } from '../../src/lib/notionClientsFlatten';

function normalizeNotionUuid(id: string): string {
  const clean = id.replace(/-/g, '').trim();
  if (!/^[a-f0-9]{32}$/i.test(clean)) return id.trim();
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

export interface CreateNotionIdeaPageConfig {
  notionToken: string;
  /** ID bazy lub strony z URL Notion (z myślnikami lub bez) */
  parentTargetId: string;
  content: string;
}

export interface CreateNotionIdeaPageResult {
  notionPageId: string;
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
  } catch {
    dbMeta = null;
  }

  if (dbMeta) {
    const titleKey = findTitlePropertyKey(dbMeta.properties as Record<string, unknown>);
    if (!titleKey) throw new Error('Baza Notion nie ma pola typu title');
    const created = await notion.pages.create({
      parent: { database_id: id },
      properties: {
        [titleKey]: {
          title: [{ type: 'text', text: { content: text } }],
        },
      },
    });
    return { notionPageId: created.id };
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
