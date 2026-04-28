import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Heart, Loader2, Pencil, Shuffle, X } from 'lucide-react';
import { ANONYMOUS_USER_ID } from '../constants';
import { DailyNotePanel } from './DailyNotePanel';
import { supabase } from '../lib/supabase';
import { ideaBodyAfterHeadline, ideaHeadlineFromContent } from '../lib/ideaContentParts';
import { dedupeIdeasByNotionPage } from '../lib/ideasDedupe';
import { upsertLikedIdeaIntoDailyNoteHtml } from '../lib/dailyNoteLikedIdeas';
import type { IdeaRow } from '../types';
import { cn } from '../utils';

/** Fisher–Yates — nowa tablica (nie mutuje wejścia). */
function shuffleArray<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type IdeasListOrder = 'newest' | 'oldest' | 'random';

type SwipeDecision = 'like' | 'pass';

export function TinderIdeasView({
  dailyNotes,
  onSaveDailyNote,
}: {
  dailyNotes: Record<string, string>;
  onSaveDailyNote: (date: string, content: string) => Promise<void> | void;
}) {
  const [sourceIdeas, setSourceIdeas] = useState<IdeaRow[]>([]);
  const [listOrder, setListOrder] = useState<IdeasListOrder>('newest');
  const [randomSeed, setRandomSeed] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [isUpdatingIdea, setIsUpdatingIdea] = useState(false);
  const pendingDecisionRef = useRef<SwipeDecision | null>(null);

  const loadIdeas = useCallback(async () => {
    // Best-effort: jeśli działa dev/preview middleware, dociągnij pomysły z Notion do Supabase.
    // W produkcyjnym statycznym hostingu ten endpoint może nie istnieć — wtedy po prostu czytamy z Supabase.
    try {
      await fetch('/api/notion-ideas/sync', { method: 'POST' });
    } catch {
      // ignore
    }

    const { data, error } = await supabase
      .from('ideas')
      .select('id, user_id, content, note_type, notion_page_id, created_at')
      .eq('user_id', ANONYMOUS_USER_ID)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ideas fetch:', error);
      setSourceIdeas([]);
      setLoaded(true);
      return;
    }

    setSourceIdeas(dedupeIdeasByNotionPage((data ?? []) as IdeaRow[]));
    setLoaded(true);
    setIndex(0);
  }, []);

  useEffect(() => {
    void loadIdeas();
  }, [loadIdeas]);

  const ideas = useMemo(() => {
    const rows = [...sourceIdeas];
    if (rows.length <= 1) return rows;
    if (listOrder === 'newest') {
      rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      return rows;
    }
    if (listOrder === 'oldest') {
      rows.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      return rows;
    }
    return shuffleArray(rows);
  }, [sourceIdeas, listOrder, randomSeed]);

  const current = ideas[index] ?? null;

  useEffect(() => {
    setIsEditing(false);
    setEditDraft('');
  }, [current?.id]);

  const openEdit = () => {
    if (!current || isSaving || isAnimating || isUpdatingIdea) return;
    setEditDraft(current.content);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditDraft('');
  };

  const saveEdit = async () => {
    if (!current || isUpdatingIdea) return;
    const next = editDraft.trim();
    if (!next) return;

    setIsUpdatingIdea(true);
    try {
      const { error } = await supabase
        .from('ideas')
        .update({ content: next })
        .eq('id', current.id)
        .eq('user_id', ANONYMOUS_USER_ID);

      if (error) {
        console.error('ideas update:', error);
        return;
      }

      setSourceIdeas((prev) =>
        prev.map((row) => (row.id === current.id ? { ...row, content: next } : row))
      );
      setIsEditing(false);
    } finally {
      setIsUpdatingIdea(false);
    }
  };
  const remainingCount = Math.max(0, ideas.length - index - (current ? 1 : 0));

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const todayNoteHtml = dailyNotes[todayStr] || '';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    dx: number;
    dy: number;
    pointerId: number | null;
  }>({ active: false, startX: 0, startY: 0, dx: 0, dy: 0, pointerId: null });

  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const resetDrag = () => {
    dragState.current = { active: false, startX: 0, startY: 0, dx: 0, dy: 0, pointerId: null };
    setDx(0);
    setDy(0);
    setIsDragging(false);
  };

  const applyListOrder = (next: IdeasListOrder) => {
    setListOrder(next);
    setIndex(0);
    resetDrag();
    setIsEditing(false);
    setEditDraft('');
    if (next === 'random') setRandomSeed((s) => s + 1);
  };

  const reshuffleQueue = () => {
    if (listOrder !== 'random') setListOrder('random');
    setRandomSeed((s) => s + 1);
    setIndex(0);
    resetDrag();
    setIsEditing(false);
    setEditDraft('');
  };

  const applyDecisionSideEffects = async (decision: SwipeDecision) => {
    if (!current) return;
    if (isSaving) return;

    if (decision === 'like') {
      const title = ideaHeadlineFromContent(current.content);
      if (title) {
        setIsSaving(true);
        try {
          const nextHtml = upsertLikedIdeaIntoDailyNoteHtml(todayNoteHtml, {
            title,
            content: current.content,
            notionPageId: current.notion_page_id,
          });
          await onSaveDailyNote(todayStr, nextHtml);
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  const finishAndAdvance = () => {
    // Kluczowe: najpierw reset transformu, dopiero potem przełącz kartę.
    // Inaczej następna karta może na moment odziedziczyć translateX i wygląda jak "wracanie".
    pendingDecisionRef.current = null;
    setIsAnimating(false);
    resetDrag();
    queueMicrotask(() => {
      setIndex((prev) => Math.min(prev + 1, ideas.length));
    });
  };

  const flyOut = (decision: SwipeDecision) => {
    if (!current) return;
    if (isEditing || isUpdatingIdea) return;
    if (isSaving || isAnimating) return;
    pendingDecisionRef.current = decision;
    setIsAnimating(true);

    const w = containerRef.current?.getBoundingClientRect().width ?? 640;
    const outX = (decision === 'like' ? 1 : -1) * (w * 1.25);
    // Small vertical movement so it feels less robotic.
    setDy((prev) => prev * 0.2);
    setDx(outX);
    setIsDragging(false);
  };

  const decide = async (decision: SwipeDecision) => {
    if (!current) return;
    if (isSaving || isAnimating) return;
    flyOut(decision);
  };

  const threshold = 110;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!current) return;
    if (isEditing) return;
    if (isSaving) return;
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
      pointerId: e.pointerId,
    };
    setIsDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.active) return;
    const s = dragState.current;
    const ndx = e.clientX - s.startX;
    const ndy = e.clientY - s.startY;
    s.dx = ndx;
    s.dy = ndy;
    setDx(ndx);
    setDy(ndy);
  };

  const onPointerUp = async () => {
    const s = dragState.current;
    if (!s.active) return;
    const finalDx = s.dx;
    if (finalDx > threshold) {
      await decide('like');
      return;
    }
    if (finalDx < -threshold) {
      await decide('pass');
      return;
    }
    resetDrag();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditing) {
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelEdit();
          return;
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          void saveEdit();
          return;
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        void decide('pass');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        void decide('like');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, index, isSaving, isAnimating, current, isEditing, editDraft]);

  const rotation = Math.max(-12, Math.min(12, dx / 18));
  const opacity = Math.max(0.25, 1 - Math.abs(dx) / 520);

  const likeHintOpacity = Math.max(0, Math.min(1, (dx - 30) / 120));
  const passHintOpacity = Math.max(0, Math.min(1, (-dx - 30) / 120));

  return (
    <div className="h-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tinder dla pomysłów</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Przesuń w prawo, żeby dopisać do <span className="font-semibold">dzisiejszej</span> notatki dnia (
            <span className="tabular-nums">{todayStr}</span>). W lewo — pomiń.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end sm:justify-end">
          <label htmlFor="tinder-ideas-order" className="sr-only">
            Kolejność kart
          </label>
          <select
            id="tinder-ideas-order"
            value={listOrder}
            onChange={(e) => applyListOrder(e.target.value as IdeasListOrder)}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm font-medium min-w-0 max-w-full sm:max-w-[220px]',
              'border-slate-200 dark:border-white/10 bg-white dark:bg-tp-muted',
              'text-slate-800 dark:text-slate-100',
              'focus:outline-none focus:ring-2 focus:ring-tp-accent/35'
            )}
          >
            <option value="newest">Kolejność: najnowsze</option>
            <option value="oldest">Kolejność: najstarsze</option>
            <option value="random">Kolejność: losowa</option>
          </select>
          <button
            type="button"
            onClick={reshuffleQueue}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-100 dark:bg-tp-muted text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-tp-raised transition-colors"
            title="Losuj kolejność od nowa"
          >
            <Shuffle className="w-4 h-4 shrink-0" aria-hidden />
            Wymieszaj
          </button>
          <button
            type="button"
            onClick={() => void loadIdeas()}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-100 dark:bg-tp-muted text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-tp-raised transition-colors"
            title="Odśwież pomysły"
          >
            <ChevronRight className="w-4 h-4 opacity-0" aria-hidden />
            Odśwież
          </button>
        </div>
      </div>

      {!loaded ? (
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Ładowanie…
        </div>
      ) : !current ? (
        <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-tp-raised p-8 shadow-sm">
          <div className="text-slate-900 dark:text-white font-semibold">Koniec kolejki.</div>
          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Nie ma więcej pomysłów do przesuwania. Zostało: <span className="font-semibold tabular-nums">{remainingCount}</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIndex(0);
                resetDrag();
              }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-tp-accent text-white hover:opacity-90 transition-opacity"
            >
              Od początku
            </button>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Dzisiaj: {format(new Date(), 'EEEE, d MMM yyyy', { locale: pl })}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)] gap-8 items-start">
          <div ref={containerRef} className="relative min-h-[460px]">
            <div
              className="absolute inset-0 rounded-3xl border border-slate-200 dark:border-white/8 bg-white/60 dark:bg-tp-raised/40"
              aria-hidden
            />

            <div
              role="region"
              aria-label="Karta pomysłu"
              className={cn(
                'relative',
                isEditing ? 'select-text touch-auto' : 'select-none touch-none',
                (isSaving || isUpdatingIdea) && 'pointer-events-none opacity-80'
              )}
            >
              <div
                key={current.id}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => void onPointerUp()}
                onPointerCancel={resetDrag}
                className={cn(
                  'flex flex-col h-[440px] max-h-[70vh]',
                  'rounded-3xl border shadow-sm p-6 bg-gradient-to-br from-white via-amber-50/60 to-orange-50/30',
                  'dark:from-tp-raised dark:via-amber-950/25 dark:to-tp-surface',
                  'border-slate-200 dark:border-white/8',
                  isEditing ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
                  (isAnimating || !isDragging) && 'transition-transform duration-200 ease-out'
                )}
                style={{
                  transform: `translate3d(${dx}px, ${dy * 0.15}px, 0) rotate(${rotation}deg)`,
                  opacity,
                }}
                onTransitionEnd={() => {
                  if (!isAnimating) return;
                  const decision = pendingDecisionRef.current;
                  if (!decision) {
                    finishAndAdvance();
                    return;
                  }
                  // Run side effects (like = append to daily note) AFTER the fly-out feels complete.
                  void (async () => {
                    try {
                      await applyDecisionSideEffects(decision);
                    } finally {
                      finishAndAdvance();
                    }
                  })();
                }}
              >
                <div className="flex shrink-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Pomysł {index + 1} / {ideas.length}
                    </div>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white leading-snug">
                      {ideaHeadlineFromContent(isEditing ? editDraft : current.content) || 'Pomysł'}
                    </h3>
                    {current.note_type && (
                      <div className="mt-2 inline-flex items-center rounded-lg border border-amber-200/80 dark:border-amber-700/40 bg-amber-100 dark:bg-amber-900/45 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                        {current.note_type}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!isSaving && !isUpdatingIdea && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isEditing) cancelEdit();
                          else openEdit();
                        }}
                        className={cn(
                          'inline-flex items-center justify-center rounded-xl p-2.5 text-sm font-semibold transition-colors',
                          'border border-slate-200 dark:border-white/10',
                          'bg-white/90 dark:bg-tp-muted text-slate-700 dark:text-slate-200',
                          'hover:bg-slate-50 dark:hover:bg-tp-raised',
                          isEditing && 'border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
                        )}
                        title={isEditing ? 'Zamknij edycję' : 'Edytuj treść pomysłu'}
                        aria-label={isEditing ? 'Anuluj edycję' : 'Edytuj pomysł'}
                      >
                        {isEditing ? <X className="w-4 h-4" aria-hidden /> : <Pencil className="w-4 h-4" aria-hidden />}
                      </button>
                    )}
                    {isSaving && (
                      <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                        zapis…
                      </div>
                    )}
                    {isUpdatingIdea && (
                      <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                        aktualizacja…
                      </div>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-4 min-h-0 flex-1 flex flex-col gap-2">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      disabled={isUpdatingIdea}
                      rows={8}
                      className={cn(
                        'w-full flex-1 min-h-[160px] resize-none rounded-2xl border px-3 py-2.5 text-sm leading-relaxed',
                        'border-slate-200 dark:border-white/10 bg-white/90 dark:bg-tp-muted/80',
                        'text-slate-900 dark:text-slate-100 placeholder:text-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-tp-accent/35 focus:border-tp-accent/50',
                        'disabled:opacity-60'
                      )}
                      aria-label="Treść pomysłu"
                      autoFocus
                    />
                    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEdit();
                        }}
                        disabled={isUpdatingIdea}
                        className="inline-flex items-center rounded-xl px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-tp-raised text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-tp-muted disabled:opacity-50"
                      >
                        Anuluj
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void saveEdit();
                        }}
                        disabled={isUpdatingIdea || !editDraft.trim()}
                        className="inline-flex items-center rounded-xl px-3 py-2 text-xs font-semibold bg-tp-accent text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Zapisz
                      </button>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                        Ctrl+Enter — zapis · Esc — anuluj
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {(() => {
                      const raw = isEditing ? editDraft : current.content;
                      const body = ideaBodyAfterHeadline(raw);
                      if (body.trim()) return body;
                      return (
                        <span className="text-slate-500 dark:text-slate-400 italic">
                          Brak treści pod tytułem — zsynchronizuj z Notion (Odśwież) albo dopisz treść w edycji karty.
                        </span>
                      );
                    })()}
                  </div>
                )}

                <div className="mt-6 shrink-0 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <div className="tabular-nums">
                    {format(new Date(current.created_at), 'd MMM yyyy, HH:mm', { locale: pl })}
                  </div>
                  <div>
                    Zostało: <span className="font-semibold tabular-nums">{ideas.length - index - 1}</span>
                  </div>
                </div>

                <div
                  className={cn(
                    'pointer-events-none absolute inset-0 flex items-start justify-between p-6',
                    isEditing && 'opacity-0'
                  )}
                  aria-hidden={isEditing}
                >
                  <div
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/60 dark:border-emerald-500/35 bg-emerald-50/90 dark:bg-emerald-950/30 px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300"
                    style={{ opacity: likeHintOpacity }}
                  >
                    <Heart className="w-4 h-4" aria-hidden />
                    Like
                  </div>
                  <div
                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-300/60 dark:border-rose-500/35 bg-rose-50/90 dark:bg-rose-950/30 px-3 py-2 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300"
                    style={{ opacity: passHintOpacity }}
                  >
                    <X className="w-4 h-4" aria-hidden />
                    Pass
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void decide('pass')}
                  disabled={isSaving || isEditing || isUpdatingIdea}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-tp-raised text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-tp-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  title="Pomiń (lewo)"
                >
                  <X className="w-4 h-4" aria-hidden />
                  Lewo
                </button>
                <button
                  type="button"
                  onClick={() => void decide('like')}
                  disabled={isSaving || isEditing || isUpdatingIdea}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold bg-tp-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:pointer-events-none"
                  title="Polub (prawo)"
                >
                  <Heart className="w-4 h-4" aria-hidden />
                  Prawo
                </button>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 dark:border-white/8 bg-white dark:bg-tp-raised p-6 shadow-sm">
            <DailyNotePanel
              date={todayStr}
              content={todayNoteHtml}
              onChange={onSaveDailyNote}
              disableInnerScroll
            />
          </aside>
        </div>
      )}
    </div>
  );
}

