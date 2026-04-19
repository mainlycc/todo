import type { Project } from '../types';

/**
 * Wynik pierwszego SELECT-a z Supabase może przyjść PO dodaniu projektu w UI — wtedy serwer
 * zwraca stare snapshoty (bez nowego wiersza). Bez tego merge `setProjects` z fetcha kasuje
 * świeżo dodane pozycje tylko w pamięci; po odświeżeniu użytkownik widzi „znika”.
 *
 * Serwer wygrywa przy kolizji tego samego `id`; lokalnie zostają tylko wpisy, których nie było w odpowiedzi.
 */
export function mergeProjectsAfterFetch(prev: Project[], fetched: Project[]): Project[] {
  const map = new Map<string, Project>();
  for (const p of fetched) map.set(p.id, p);
  for (const p of prev) {
    if (!map.has(p.id)) map.set(p.id, p);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
