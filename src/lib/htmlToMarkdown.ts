import TurndownService from 'turndown';

const getTurndown = () => {
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    hr: '---',
  });

  // TipTap can emit <p></p> and <br>; keep output tidy.
  td.keep(['mark']);

  // Preserve line breaks inside paragraphs more predictably.
  td.addRule('lineBreak', {
    filter: 'br',
    replacement: () => '\n',
  });

  // Reduce double-empty paragraphs to single blank lines.
  td.addRule('emptyParagraph', {
    filter: (node) => node.nodeName === 'P' && (node.textContent || '').trim() === '',
    replacement: () => '\n',
  });

  return td;
};

let cached: TurndownService | null = null;

export function htmlToMarkdown(html: string): string {
  const src = (html || '').trim();
  if (!src) return '';
  if (!cached) cached = getTurndown();
  const md = cached.turndown(src);
  // Normalize excessive blank lines.
  return md.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

