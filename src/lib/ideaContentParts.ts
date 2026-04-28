/**
 * Parsowanie pola `content` pomysłu: pierwsza linia = nagłówek (tytuł),
 * reszta = treść notatki (bez powielania tytułu na karcie).
 */

function firstNonEmptyLine(content: string): string {
  const line = (content || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  return line ?? '';
}

/** Skrócony tytuł z pierwszej linii treści (jak wcześniej w Tinderze). */
export function ideaHeadlineFromContent(content: string, maxLen = 120): string {
  const firstLine = firstNonEmptyLine(content);
  if (!firstLine) return '';
  const clipped = firstLine.length > maxLen ? `${firstLine.slice(0, maxLen - 3)}…` : firstLine;
  return clipped;
}

/** Treść pod nagłówkiem — bez pierwszej linii (żeby nie dublować tytułu na karcie). */
export function ideaBodyAfterHeadline(content: string): string {
  const raw = content.replace(/^\uFEFF?/, '');
  const nl = raw.search(/\r?\n/);
  if (nl === -1) return '';
  return raw.slice(nl + 1).replace(/^\r?\n+/, '').trimEnd();
}

/** Łączy tytuł z bazy z treścią bloków strony (bez dublowania pierwszej linii treści). */
export function mergeNotionTitleAndBody(title: string, bodyFromBlocks: string): string {
  const t = title.trim();
  const b = bodyFromBlocks.trim();
  if (!t && !b) return '';
  if (!b) return t;
  if (!t) return b;
  const firstBodyLine = b.split(/\r?\n/).map((s) => s.trim()).find(Boolean) ?? '';
  if (firstBodyLine === t) return b;
  return `${t}\n\n${b}`;
}
