import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ExternalLink, Lightbulb, Loader2, Send } from 'lucide-react';
import { ANONYMOUS_USER_ID } from '../constants';
import { supabase } from '../lib/supabase';
import type { IdeaRow } from '../types';
import { cn } from '../utils';

const NOTION_INBOX_URL =
  'https://www.notion.so/8c93b9a454f946978cc1cdfa3de6046c?v=179d56c29ec34097b238fab9d9f08955&source=copy_link';

function notionPageUrl(pageId: string): string {
  const compact = pageId.replace(/-/g, '');
  return `https://www.notion.so/${compact}`;
}

/** API Notion często zwraca „Could not find…” także przy braku dostępu integracji. */
function polishNotionCreateError(apiMessage: string): string {
  const m = apiMessage.toLowerCase();
  if (
    m.includes('shared with your integration') ||
    m.includes('could not find page') ||
    m.includes('could not find database')
  ) {
    return (
      'Notion: brak dostępu integracji do tej bazy (albo zły ID). W Notion otwórz bazę → Udostępnij (Share) → ' +
      'dodaj swoją integrację wewnętrzną (np. „gemini”) albo Connections / Połączenia → Connect. ' +
      '`NOTION_TOKEN` w `.env` musi pochodzić z tej samej integracji. Potem zrestartuj `npm run dev`.'
    );
  }
  return `Notion: ${apiMessage}`;
}

export function PomyslyView() {
  const [ideas, setIdeas] = useState<IdeaRow[]>([]);
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadIdeas = useCallback(async () => {
    const { data, error } = await supabase
      .from('ideas')
      .select('id, user_id, content, notion_page_id, created_at')
      .eq('user_id', ANONYMOUS_USER_ID)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ideas fetch:', error);
      setIdeas([]);
      setLoaded(true);
      return;
    }
    setIdeas((data ?? []) as IdeaRow[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void loadIdeas();
  }, [loadIdeas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setMessage(null);

    let notionPageId: string | null = null;
    let notionError: string | null = null;

    try {
      const res = await fetch('/api/notion-ideas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = (await res.json()) as { ok?: boolean; notionPageId?: string; error?: string };
      if (res.ok && json.ok && json.notionPageId) {
        notionPageId = json.notionPageId;
      } else {
        notionError = json.error ?? `HTTP ${res.status}`;
      }
    } catch (err) {
      notionError = err instanceof Error ? err.message : String(err);
    }

    const { data: inserted, error: insErr } = await supabase
      .from('ideas')
      .insert({
        user_id: ANONYMOUS_USER_ID,
        content: text,
        notion_page_id: notionPageId,
      })
      .select('id, user_id, content, notion_page_id, created_at')
      .single();

    if (insErr) {
      setMessage({
        type: 'err',
        text: `Supabase: ${insErr.message}. Uruchom migrację sql/13_ideas.sql w projekcie Supabase.`,
      });
      setSubmitting(false);
      return;
    }

    setIdeas((prev) => [inserted as IdeaRow, ...prev]);
    setDraft('');

    if (notionError) {
      setMessage({
        type: 'err',
        text: `Zapisano lokalnie w Supabase. ${polishNotionCreateError(notionError)}`,
      });
    } else {
      setMessage({ type: 'ok', text: 'Dodano do Notion i Supabase.' });
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-tp-raised p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Nowy pomysł</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Wpis trafia do{' '}
              <a
                href={NOTION_INBOX_URL}
                target="_blank"
                rel="noreferrer"
                className="text-tp-accent hover:underline inline-flex items-center gap-0.5"
              >
                bazy w Notion
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>{' '}
              oraz do tabeli <code className="text-xs bg-slate-100 dark:bg-white/10 px-1 rounded">ideas</code> w
              Supabase.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            rows={4}
            placeholder="Wpisz pomysł…"
            className={cn(
              'w-full rounded-xl border border-slate-200 dark:border-white/10',
              'bg-slate-50 dark:bg-tp-canvas px-4 py-3 text-sm text-slate-900 dark:text-slate-100',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-tp-accent/40 resize-y min-h-[6rem]'
            )}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting || !draft.trim()}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                'bg-tp-accent text-white hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none'
              )}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Wyślij
            </button>
            {message && (
              <p
                className={cn(
                  'text-sm',
                  message.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                )}
              >
                {message.text}
              </p>
            )}
          </div>
        </form>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Ostatnie
        </h3>
        {!loaded ? (
          <p className="text-sm text-slate-500">Ładowanie…</p>
        ) : ideas.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Brak zapisanych pomysłów.</p>
        ) : (
          <ul className="space-y-2">
            {ideas.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-slate-200 dark:border-white/8 bg-white dark:bg-tp-raised px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap flex-1">{row.content}</p>
                <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                  <time dateTime={row.created_at}>
                    {format(new Date(row.created_at), 'd MMM yyyy, HH:mm', { locale: pl })}
                  </time>
                  {row.notion_page_id && (
                    <a
                      href={notionPageUrl(row.notion_page_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-tp-accent hover:underline"
                    >
                      Notion
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
