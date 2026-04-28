function normalizeText(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

const SECTION_TITLE = 'Tematy do przemyślenia';

function isTargetHeading(el: Element) {
  if (el.tagName.toLowerCase() !== 'h2') return false;
  const t = normalizeText(el.textContent || '').toLowerCase();
  return (
    t === SECTION_TITLE.toLowerCase() ||
    // migracja ze starej nazwy
    t === 'polubione pomysły' ||
    t === 'polubione pomysly'
  );
}

export function upsertLikedIdeaIntoDailyNoteHtml(
  html: string,
  idea: { title: string; content?: string | null; notionPageId?: string | null }
): string {
  const title = normalizeText(idea.title);
  const fullContent = String(idea.content || '').trim();
  const restContent = fullContent
    ? fullContent
        .split(/\r?\n/)
        .slice(1)
        .join('\n')
        .trim()
    : '';
  if (!title) return html || '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '<div></div>', 'text/html');
  const body = doc.body;

  // 1) Find (or create) the section heading.
  let heading: Element | null = null;
  for (const el of Array.from(body.querySelectorAll('h2'))) {
    if (isTargetHeading(el)) {
      heading = el;
      break;
    }
  }

  if (!heading) {
    heading = doc.createElement('h2');
    heading.textContent = SECTION_TITLE;
    body.appendChild(heading);
  } else {
    // Jeśli znaleźliśmy starą nazwę, podmień na nową.
    if (normalizeText(heading.textContent || '').toLowerCase() !== SECTION_TITLE.toLowerCase()) {
      heading.textContent = SECTION_TITLE;
    }
  }

  // 2) Find (or create) the UL right after heading (skip empty nodes).
  let next: ChildNode | null = heading.nextSibling;
  while (next && next.nodeType === Node.TEXT_NODE && normalizeText(next.textContent || '') === '') {
    next = next.nextSibling;
  }

  let ul: HTMLUListElement | null = null;
  if (next && next.nodeType === Node.ELEMENT_NODE && (next as Element).tagName.toLowerCase() === 'ul') {
    ul = next as HTMLUListElement;
  } else {
    ul = doc.createElement('ul');
    heading.insertAdjacentElement('afterend', ul);
  }

  // 3) Avoid duplicates.
  const existing = Array.from(ul.querySelectorAll('li')).some((li) => {
    const t = normalizeText(li.textContent || '');
    // porównujemy po tytule (pierwsza linia), bo w li może być też treść
    return t.toLowerCase().startsWith(title.toLowerCase());
  });
  if (existing) return body.innerHTML;

  // 4) Append new LI.
  const li = doc.createElement('li');
  const strong = doc.createElement('strong');
  strong.textContent = title;
  li.appendChild(strong);

  if (restContent) {
    li.appendChild(doc.createElement('br'));
    const span = doc.createElement('span');
    span.textContent = restContent;
    li.appendChild(span);
  }
  ul.appendChild(li);

  return body.innerHTML;
}

