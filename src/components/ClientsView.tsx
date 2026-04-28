import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Filter, RefreshCw, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ANONYMOUS_USER_ID } from '../constants';
import type { NotionClientRow } from '../types';
import { sortKeysForClientsTable } from '../constants/notionClientsTable';
import { findTitlePropertyKey, notionPageUrl } from '../lib/notionClientsFlatten';
import {
  getNotionStatusLabel,
  matchesClientsViewStatusFilter,
  notionClientStatusSortRank,
} from '../lib/notionClientStatusFilter';
import { NotionClientPropertyCell } from './NotionClientPropertyCell';
import { cn } from '../utils';

function formatSyncedAt(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pl-PL');
  } catch {
    return iso;
  }
}

export function ClientsView() {
  const [rows, setRows] = useState<NotionClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  /** Domyślnie włączone: In progress na górze; w filtrze też „procesuje się…” / „martwy punkt”. */
  const [filterStalledStatuses, setFilterStalledStatuses] = useState(true);

  const notionDbUrl = useMemo(() => {
    const raw = (import.meta as { env?: { VITE_NOTION_CLIENTS_DATABASE_URL?: string } }).env
      ?.VITE_NOTION_CLIENTS_DATABASE_URL;
    if (raw?.trim()) return raw.trim();
    const id = (import.meta as { env?: { VITE_NOTION_CLIENTS_DATABASE_ID?: string } }).env
      ?.VITE_NOTION_CLIENTS_DATABASE_ID?.replace(/-/g, '');
    if (id && /^[a-f0-9]{32}$/i.test(id)) {
      return `https://www.notion.so/${id}`;
    }
    return null;
  }, []);

  const loadFromSupabase = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from('notion_clients')
      .select('*')
      .eq('user_id', ANONYMOUS_USER_ID)
      .order('title', { ascending: true });
    if (qErr) {
      setError(qErr.message);
      setRows([]);
    } else {
      setRows((data ?? []) as NotionClientRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadFromSupabase();
  }, [loadFromSupabase]);

  const titlePropertyKey = useMemo(() => {
    for (const row of rows) {
      const props = row.notion_properties as Record<string, unknown> | null | undefined;
      const k = findTitlePropertyKey(props);
      if (k) return k;
    }
    return null;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const filtered = filterStalledStatuses
      ? rows.filter(row => {
          const props = row.notion_properties as Record<string, unknown> | null | undefined;
          return matchesClientsViewStatusFilter(getNotionStatusLabel(props));
        })
      : rows;
    return [...filtered].sort((a, b) => {
      const la = getNotionStatusLabel(a.notion_properties as Record<string, unknown>);
      const lb = getNotionStatusLabel(b.notion_properties as Record<string, unknown>);
      const ra = notionClientStatusSortRank(la);
      const rb = notionClientStatusSortRank(lb);
      if (ra !== rb) return ra - rb;
      return (a.title || '').localeCompare(b.title || '', 'pl', { sensitivity: 'base' });
    });
  }, [rows, filterStalledStatuses]);

  const columnKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of rows) {
      const props = row.notion_properties as Record<string, unknown> | null | undefined;
      if (props && typeof props === 'object') {
        for (const k of Object.keys(props)) keys.add(k);
      }
    }
    return sortKeysForClientsTable(keys, titlePropertyKey);
  }, [rows, titlePropertyKey]);

  const handleSync = async () => {
    setSyncing(true);
    setLastSyncMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/notion-clients/sync', { method: 'POST' });
      const text = await res.text();
      let body: { ok?: boolean; error?: string; synced?: number; removedStale?: number };
      try {
        body = JSON.parse(text) as typeof body;
      } catch {
        setLastSyncMessage(
          'Odpowiedź serwera nie jest JSON (endpoint działa tylko przy `npm run dev` z uzupełnionym .env).'
        );
        setSyncing(false);
        return;
      }
      if (!res.ok || !body.ok) {
        setError(body.error || `HTTP ${res.status}`);
      } else {
        setLastSyncMessage(
          `Zsynchronizowano ${body.synced ?? 0} wierszy. Usunięto przestarzałe: ${body.removedStale ?? 0}.`
        );
        await loadFromSupabase();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setSyncing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
            <Users className="h-7 w-7" />
          </div>
          <div>
            {notionDbUrl && (
              <a
                href={notionDbUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
              >
                Otwórz bazę w Notion
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
              'bg-slate-900 text-white hover:bg-slate-800',
              'dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200',
              syncing && 'opacity-60 pointer-events-none'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
            {syncing ? 'Synchronizacja…' : 'Synchronizuj z Notion'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}
      {lastSyncMessage && !error && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          {lastSyncMessage}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-white/6 dark:bg-tp-surface dark:text-slate-400">
          Wczytywanie z Supabase…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-white/6 dark:bg-tp-surface">
          <p className="font-medium text-slate-600 dark:text-slate-400">Brak klientów w kopii lokalnej.</p>
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-tp-surface">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 dark:border-white/20"
              checked={filterStalledStatuses}
              onChange={e => setFilterStalledStatuses(e.target.checked)}
            />
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Filter className="h-4 w-4 text-slate-500" />
              Filtr: aktywne
            </span>
          </label>
          <div className="rounded-2xl border border-dashed border-amber-200/80 bg-amber-50/80 p-10 text-center dark:border-amber-900/40 dark:bg-amber-950/25">
            <p className="font-medium text-amber-950 dark:text-amber-100">Brak wyników.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-tp-surface">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 dark:border-white/20"
              checked={filterStalledStatuses}
              onChange={e => setFilterStalledStatuses(e.target.checked)}
            />
            <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Filter className="h-4 w-4 flex-shrink-0 text-slate-500" />
              Filtr: aktywne ({visibleRows.length}/{rows.length})
            </span>
          </label>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/6 dark:bg-[#191919]">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/[0.08] dark:bg-[#202020]">
                <th className="sticky left-0 z-20 w-12 bg-slate-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-[#202020] dark:text-[#9b9b9b]">
                  #
                </th>
                <th className="sticky left-12 z-10 bg-slate-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-[#202020] dark:text-[#9b9b9b]">
                  {titlePropertyKey ?? 'Klient'}
                </th>
                {columnKeys.map(k => (
                  <th
                    key={k}
                    className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9b9b9b]"
                  >
                    {k}
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9b9b9b]">
                  Ostatnia edycja
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9b9b9b]">
                  Skopiowano
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, idx) => {
                const props = (row.notion_properties ?? {}) as Record<string, unknown>;
                return (
                  <tr
                    key={row.notion_page_id}
                    className="h-14 border-b border-slate-100 last:border-0 hover:bg-slate-50/80 dark:border-white/[0.06] dark:hover:bg-white/[0.03]"
                  >
                    <td className="sticky left-0 z-20 h-14 w-12 bg-white px-3 py-2 align-middle text-xs font-semibold tabular-nums text-slate-500 dark:bg-[#191919] dark:text-[#9b9b9b]">
                      {idx + 1}
                    </td>
                    <td className="sticky left-12 z-10 h-14 bg-white px-3 py-2 align-middle font-medium text-slate-900 dark:bg-[#191919] dark:text-[#e6e6e6]">
                      <a
                        href={notionPageUrl(row.notion_page_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-[18rem] items-center gap-1.5 rounded px-1 -mx-1 text-slate-900 hover:bg-slate-100 dark:text-[#e6e6e6] dark:hover:bg-white/[0.06]"
                      >
                        <span
                          className="inline-block h-4 w-4 flex-shrink-0 rounded-sm bg-slate-200 dark:bg-white/15"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">{row.title || 'Bez tytułu'}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />
                      </a>
                    </td>
                    {columnKeys.map(k => {
                      const raw = props[k];
                      const isOpis = k === 'opis(co chce)';
                      return (
                        <td
                          key={k}
                          className={cn(
                            'h-14 px-3 py-2 align-middle text-slate-700 dark:text-[#d4d4d4]',
                            isOpis ? 'max-w-[min(22rem,40vw)]' : 'max-w-[16rem]'
                          )}
                        >
                          <div
                            className={cn(
                              'max-h-10 overflow-hidden',
                              isOpis ? 'whitespace-normal break-words line-clamp-2' : 'whitespace-nowrap truncate'
                            )}
                            title={typeof raw === 'string' ? raw : undefined}
                          >
                            <NotionClientPropertyCell columnKey={k} raw={raw} />
                          </div>
                        </td>
                      );
                    })}
                    <td className="h-14 whitespace-nowrap px-3 py-2 align-middle text-slate-500 tabular-nums dark:text-[#9b9b9b]">
                      {formatSyncedAt(row.last_edited_time)}
                    </td>
                    <td className="h-14 whitespace-nowrap px-3 py-2 align-middle text-slate-500 tabular-nums dark:text-[#9b9b9b]">
                      {formatSyncedAt(row.synced_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
