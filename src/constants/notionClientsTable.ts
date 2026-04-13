/**
 * Kolejność kolumn jak w widoku Notion „Obecni” (bez kolumny tytułu — renderowane osobno).
 * Nazwy muszą odpowiadać nazwom pól w API Notion.
 */
const AFTER_SERVICE_TYPES = ['Ceny netto', 'Brutto', 'Ile zostało do zapłaty'] as const;

const CORE_ORDER = [
  'opis(co chce)',
  'Ważność',
  'Status',
  'ruch',
  'Rodzaj usługi',
] as const;

/** Znajdź kolumnę typu „Zapł…” / zaliczka — w UI Notion bywa skrócona. */
export function findPaymentStatusColumnKey(keys: string[]): string | undefined {
  const fromZap = keys.find(k => /^Zapł/i.test(k));
  if (fromZap) return fromZap;
  return keys.find(k => /zalicz/i.test(k));
}

/**
 * Kolejność kluczy właściwości (bez pola tytułu), potem pozostałe alfabetycznie.
 */
export function sortKeysForClientsTable(allKeys: Iterable<string>, titlePropertyKey: string | null): string[] {
  const keys = [...new Set(allKeys)].filter(k => k && k !== titlePropertyKey);
  const ordered: string[] = [];
  const used = new Set<string>();

  const push = (k: string | undefined) => {
    if (!k || used.has(k) || !keys.includes(k)) return;
    ordered.push(k);
    used.add(k);
  };

  for (const k of CORE_ORDER) push(k);

  const zapKey = findPaymentStatusColumnKey(keys);
  push(zapKey);
  push('Zapłacono');

  for (const k of AFTER_SERVICE_TYPES) push(k);

  const rest = keys.filter(k => !used.has(k)).sort((a, b) => a.localeCompare(b, 'pl'));
  return [...ordered, ...rest];
}
