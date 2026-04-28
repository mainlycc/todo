import type { Client } from '@notionhq/client';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

function richToPlain(rich: { plain_text?: string }[] | undefined): string {
  if (!rich?.length) return '';
  return rich.map((t) => t.plain_text ?? '').join('');
}

/** Tekst z bloku Notion (paragraph, nagłówki, lista, callout, code itd.). */
function richTextFromBlock(block: BlockObjectResponse): string {
  const raw = block as unknown as Record<string, { rich_text?: { plain_text?: string }[] } | undefined>;
  const payload = raw[block.type];
  if (payload && typeof payload === 'object' && 'rich_text' in payload && payload.rich_text) {
    return richToPlain(payload.rich_text);
  }
  return '';
}

async function listChildren(notion: Client, blockId: string): Promise<BlockObjectResponse[]> {
  const out: BlockObjectResponse[] = [];
  let cursor: string | undefined;
  for (;;) {
    const res = await notion.blocks.children.list({ block_id: blockId, start_cursor: cursor });
    for (const b of res.results) {
      if (typeof b === 'object' && b !== null && 'type' in b && (b as { type?: string }).type !== 'unsupported') {
        out.push(b as BlockObjectResponse);
      }
    }
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return out;
}

/**
 * Spłaszcza drzewo bloków strony Notion do zwykłego tekstu (jak „treść notatki”).
 * Wywołaj z `page_id` strony (tego samego co wiersz bazy).
 */
export async function fetchNotionPageBodyPlainText(
  notion: Client,
  pageId: string
): Promise<string> {
  const lines: string[] = [];

  async function walk(block: BlockObjectResponse, depth: number): Promise<void> {
    const indent = '  '.repeat(depth);
    const text = richTextFromBlock(block);

    switch (block.type) {
      case 'paragraph':
        if (text.trim()) lines.push(`${indent}${text}`);
        break;
      case 'heading_1':
        if (text.trim()) lines.push(`${indent}# ${text}`);
        break;
      case 'heading_2':
        if (text.trim()) lines.push(`${indent}## ${text}`);
        break;
      case 'heading_3':
        if (text.trim()) lines.push(`${indent}### ${text}`);
        break;
      case 'bulleted_list_item':
      case 'numbered_list_item':
        if (text.trim()) lines.push(`${indent}• ${text}`);
        break;
      case 'to_do': {
        const td = block as unknown as {
          to_do?: { rich_text?: { plain_text?: string }[]; checked?: boolean };
        };
        const cb = td.to_do?.checked ? '[x]' : '[ ]';
        const t = richToPlain(td.to_do?.rich_text);
        if (t.trim()) lines.push(`${indent}${cb} ${t}`);
        break;
      }
      case 'quote':
        if (text.trim()) lines.push(`${indent}> ${text}`);
        break;
      case 'callout':
        if (text.trim()) lines.push(`${indent}${text}`);
        break;
      case 'code': {
        const c = block as unknown as { code?: { rich_text?: { plain_text?: string }[] } };
        const codeText = richToPlain(c.code?.rich_text);
        if (codeText.trim()) lines.push(`${indent}\`\`\`\n${codeText}\n\`\`\``);
        break;
      }
      case 'divider':
        lines.push(`${indent}---`);
        break;
      case 'toggle':
        if (text.trim()) lines.push(`${indent}▸ ${text}`);
        break;
      default:
        if (text.trim()) lines.push(`${indent}${text}`);
    }

    if (block.has_children) {
      const kids = await listChildren(notion, block.id);
      for (const k of kids) {
        await walk(k, depth + 1);
      }
    }
  }

  const top = await listChildren(notion, pageId);
  for (const b of top) {
    await walk(b, 0);
  }

  return lines.join('\n').trim();
}
