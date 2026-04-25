import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';
import {
  Brain,
  Briefcase,
  Calendar,
  ExternalLink,
  GraduationCap,
  Lightbulb,
  Loader2,
  MessageSquareCode,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ANONYMOUS_USER_ID, IDEA_NOTE_TYPE_OPTIONS, type IdeaNoteType } from '../constants';
import { supabase } from '../lib/supabase';
import type { IdeaRow } from '../types';
import { cn } from '../utils';

/** Ikony dopasowane semantycznie do wartości w Notion (IDEA_NOTE_TYPE_OPTIONS). */
const IDEA_NOTE_TYPE_ICONS: Record<IdeaNoteType, LucideIcon> = {
  Pomysł: Lightbulb,
  Inspiracja: Sparkles,
  'Pomysł na biznes': Briefcase,
  'Przemyślenia osobiste': Brain,
  Prompt: MessageSquareCode,
  'Notatka edukacyjna': GraduationCap,
};

function noteTypeIcon(noteType: string | null | undefined): LucideIcon | null {
  if (!noteType) return null;
  return IDEA_NOTE_TYPE_ICONS[noteType as IdeaNoteType] ?? null;
}

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

function IdeaCard({
  row,
  onDelete,
  deleting,
  deleteLocked,
}: {
  row: IdeaRow;
  onDelete: () => void;
  deleting: boolean;
  /** Inna karta jest w trakcie usuwania */
  deleteLocked: boolean;
}) {
  const BadgeIcon = noteTypeIcon(row.note_type);
  return (
    <article
      className={cn(
        'rounded-2xl border shadow-sm hover:shadow-md transition-all p-3 flex flex-col gap-2 relative overflow-hidden group',
        'h-44 w-full max-w-[260px]',
        'border-slate-200 dark:border-white/8',
        'hover:border-amber-400/70 dark:hover:border-amber-600/45',
        'bg-gradient-to-br from-amber-50/95 via-white to-orange-50/40',
        'dark:from-amber-950/35 dark:via-tp-raised dark:to-tp-surface'
      )}
    >
      <div className="flex justify-between items-start gap-2 min-h-0 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {row.note_type ? (
            <span className="inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/55 dark:text-amber-200 border border-amber-200/80 dark:border-amber-700/40 truncate max-w-full">
              {BadgeIcon && <BadgeIcon className="w-3 h-3 shrink-0 opacity-90" aria-hidden />}
              <span className="truncate">{row.note_type}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400">
              <Lightbulb className="w-3 h-3 shrink-0 opacity-80" aria-hidden />
              Pomysł
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void onDelete();
          }}
          disabled={deleting || deleteLocked}
          className={cn(
            'shrink-0 p-1.5 rounded-lg transition-colors',
            'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50',
            'disabled:opacity-40 disabled:pointer-events-none'
          )}
          title="Usuń z aplikacji"
          aria-label="Usuń pomysł"
        >
          {deleting ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="w-4 h-4" aria-hidden />
          )}
        </button>
      </div>

      <p
        className={cn(
          'text-sm text-slate-800 dark:text-slate-100 leading-snug flex-1 min-h-0 overflow-hidden',
          'line-clamp-6 break-words'
        )}
      >
        {row.content}
      </p>

      <div className="mt-auto pt-2 border-t border-slate-200/80 dark:border-white/8 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
        <div className="flex items-center gap-1 min-w-0 font-medium">
          <Calendar className="w-3 h-3 shrink-0 opacity-70" aria-hidden />
          <time dateTime={row.created_at} className="truncate tabular-nums">
            {format(new Date(row.created_at), 'd MMM yyyy, HH:mm', { locale: pl })}
          </time>
        </div>
        {row.notion_page_id ? (
          <a
            href={notionPageUrl(row.notion_page_id)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 font-semibold text-tp-accent hover:underline shrink-0"
          >
            Notion
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 shrink-0">—</span>
        )}
      </div>
    </article>
  );
}

export function PomyslyView() {
  const [ideas, setIdeas] = useState<IdeaRow[]>([]);
  const [draft, setDraft] = useState('');
  const [noteType, setNoteType] = useState<IdeaNoteType>(IDEA_NOTE_TYPE_OPTIONS[0]);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadIdeas = useCallback(async () => {
    const { data, error } = await supabase
      .from('ideas')
      .select('id, user_id, content, note_type, notion_page_id, created_at')
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
        body: JSON.stringify({ text, noteType }),
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
        note_type: noteType,
        notion_page_id: notionPageId,
      })
      .select('id, user_id, content, note_type, notion_page_id, created_at')
      .single();

    if (insErr) {
      setMessage({
        type: 'err',
        text: `Supabase: ${insErr.message}. Uruchom migracje sql/13_ideas.sql oraz sql/14_ideas_note_type.sql w Supabase.`,
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

  const handleDeleteIdea = async (row: IdeaRow) => {
    if (deletingId) return;
    if (
      !window.confirm(
        'Usunąć ten pomysł z listy w aplikacji? Wpis w Notion (jeśli był utworzony) pozostanie — usuń go ręcznie w Notion, jeśli chcesz.',
      )
    ) {
      return;
    }
    setDeletingId(row.id);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('ideas')
        .delete()
        .eq('id', row.id)
        .eq('user_id', ANONYMOUS_USER_ID);

      if (error) throw error;

      setIdeas((prev) => prev.filter((p) => p.id !== row.id));
      setMessage({ type: 'ok', text: 'Pomysł usunięty z aplikacji.' });
    } catch (err) {
      console.error('ideas delete:', err);
      setMessage({
        type: 'err',
        text: `Nie udało się usunąć: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setDeletingId(null);
    }
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
          <fieldset className="space-y-2">
            <legend className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Typ notatki
            </legend>
            <div
              role="radiogroup"
              aria-label="Typ notatki"
              className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-3xl"
            >
              {IDEA_NOTE_TYPE_OPTIONS.map((opt) => {
                const Icon = IDEA_NOTE_TYPE_ICONS[opt];
                const selected = noteType === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setNoteType(opt)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all',
                      'min-h-[4.25rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-tp-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-tp-raised',
                      selected
                        ? 'border-tp-accent bg-amber-50 shadow-sm ring-2 ring-tp-accent/35 dark:bg-amber-950/40 dark:border-amber-500/80'
                        : 'border-slate-200 bg-slate-50/80 hover:border-amber-300 hover:bg-amber-50/50 dark:border-white/10 dark:bg-tp-canvas dark:hover:border-amber-600/50 dark:hover:bg-amber-950/25'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-5 h-5 shrink-0',
                        selected
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-slate-500 dark:text-slate-400'
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'text-[11px] font-medium leading-tight',
                        selected
                          ? 'text-slate-900 dark:text-amber-100'
                          : 'text-slate-600 dark:text-slate-400'
                      )}
                    >
                      {opt}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-0.5">
              Wybrana wartość trafia do kolumny „Typ notatki” w Notion.
            </p>
          </fieldset>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 justify-items-start">
            {ideas.map((row) => (
              <IdeaCard
                key={row.id}
                row={row}
                onDelete={() => handleDeleteIdea(row)}
                deleting={deletingId === row.id}
                deleteLocked={deletingId !== null && deletingId !== row.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
