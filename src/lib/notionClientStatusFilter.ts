/**
 * Odczyt etykiety pola typu `status` w właściwościach strony Notion.
 * Szuka najpierw klucza „Status”, potem pierwszego pola z typem status.
 */
export function getNotionStatusLabel(properties: Record<string, unknown> | null | undefined): string | null {
  if (!properties || typeof properties !== 'object') return null;
  const tryKey = (key: string) => {
    const raw = properties[key];
    if (!raw || typeof raw !== 'object') return null;
    if ((raw as { type?: string }).type !== 'status') return null;
    const name = (raw as { status?: { name?: string } | null }).status?.name?.trim();
    return name || null;
  };
  const fromStatus = tryKey('Status') ?? tryKey('status');
  if (fromStatus) return fromStatus;
  for (const raw of Object.values(properties)) {
    if (!raw || typeof raw !== 'object') continue;
    if ((raw as { type?: string }).type !== 'status') continue;
    const name = (raw as { status?: { name?: string } | null }).status?.name?.trim();
    if (name) return name;
  }
  return null;
}

function normalizeStatus(statusName: string): string {
  return statusName
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Czy status to „In progress” (z tolerancją na „in progres”). */
export function matchesInProgressStatus(statusName: string | null | undefined): boolean {
  if (!statusName?.trim()) return false;
  const s = normalizeStatus(statusName);
  return s.includes('in progress') || s.includes('in progres');
}

/**
 * Czy wiersz ma być widoczny przy włączonym filtrze: In progress, „procesuje się…”, „martwy punkt”.
 */
export function matchesClientsViewStatusFilter(statusName: string | null | undefined): boolean {
  if (!statusName?.trim()) return false;
  if (matchesInProgressStatus(statusName)) return true;
  const s = normalizeStatus(statusName);
  if (s.includes('procesuje') || s.includes('processuje')) return true;
  if (s.includes('martwy') && (s.includes('punkt') || s.includes('pukt'))) return true;
  return false;
}

/**
 * Kolejność sortowania: najpierw In progress (0), potem pozostałe dopasowane (1).
 */
export function notionClientStatusSortRank(statusName: string | null | undefined): number {
  if (matchesInProgressStatus(statusName)) return 0;
  return 1;
}

