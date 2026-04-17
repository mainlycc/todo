import { useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getISOWeek,
  getISOWeekYear,
} from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle2, CalendarPlus, Trash2, Download, Dumbbell } from 'lucide-react';
import { DailyTimeline, DailyTimelineEvent, Project, Task } from '../types';
import { cn } from '../utils';
import { DailyNotePanel } from './DailyNotePanel';
import { computeDayLog, minutesToHumanText } from '../lib/dailyLog';
import { downloadTextFile } from '../lib/downloadTextFile';
import { renderDayMarkdown, renderRangeMarkdown } from '../lib/markdownExport';

interface CalendarViewProps {
  tasks: Task[];
  dailyNotes: Record<string, string>;
  onSaveDailyNote: (date: string, content: string) => void;
  dailyTimelines: Record<string, DailyTimeline>;
  onSaveDailyTimeline: (date: string, timeline: DailyTimeline) => void;
  projects: Project[];
  completionDates?: Record<string, string | undefined>;
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

function sortTimeAsc(a: { time: string }, b: { time: string }) {
  return a.time.localeCompare(b.time);
}

function minutesToCompactHours(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m <= 0) return '';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  const dec = Math.round((mm / 60) * 10) / 10;
  return `${h + dec}h`;
}

export function CalendarView({
  tasks,
  dailyNotes,
  onSaveDailyNote,
  dailyTimelines,
  onSaveDailyTimeline,
  projects,
  completionDates,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showPlanned, setShowPlanned] = useState(true);
  const [showDone, setShowDone] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [dayTab, setDayTab] = useState<'planned' | 'done' | 'notes'>('planned');

  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEventTime, setNewEventTime] = useState('09:00');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDuration, setNewEventDuration] = useState<number>(60);
  const [newEventProjectId, setNewEventProjectId] = useState<string>('');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const monthStats = useMemo(() => {
    const monthStartLocal = startOfMonth(currentMonth);
    const monthEndLocal = endOfMonth(monthStartLocal);
    const monthDays = eachDayOfInterval({ start: monthStartLocal, end: monthEndLocal }).map(d => format(d, 'yyyy-MM-dd'));

    const perDay = new Map<string, { gym: boolean; workMinutes: number }>();
    let gymDays = 0;
    let workMinutesTotal = 0;

    for (const date of monthDays) {
      const log = computeDayLog({
        date,
        tasks,
        completionDates,
        dailyNotes,
        dailyTimeline: dailyTimelines[date] || null,
      });
      perDay.set(date, { gym: log.gym, workMinutes: log.workMinutes });
      if (log.gym) gymDays += 1;
      workMinutesTotal += log.workMinutes;
    }

    return { perDay, gymDays, workMinutesTotal };
  }, [currentMonth, tasks, completionDates, dailyNotes, dailyTimelines]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;

  const handleExportDay = () => {
    if (!selectedDateStr) return;
    const timeline = dailyTimelines[selectedDateStr] || null;
    const log = computeDayLog({
      date: selectedDateStr,
      tasks,
      completionDates,
      dailyNotes,
      dailyTimeline: timeline,
    });
    const md = renderDayMarkdown(log);
    downloadTextFile(`dzien-${selectedDateStr}.md`, md);
  };

  const handleExportWeek = () => {
    if (!selectedDate) return;
    const from = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const to = endOfWeek(selectedDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: from, end: to }).map(d => format(d, 'yyyy-MM-dd'));
    const logs = days.map(dateStr =>
      computeDayLog({
        date: dateStr,
        tasks,
        completionDates,
        dailyNotes,
        dailyTimeline: dailyTimelines[dateStr] || null,
      })
    );
    const week = getISOWeek(selectedDate);
    const weekYear = getISOWeekYear(selectedDate);
    const md = renderRangeMarkdown({
      title: `Tydzień ${weekYear}-W${String(week).padStart(2, '0')}`,
      from: format(from, 'yyyy-MM-dd'),
      to: format(to, 'yyyy-MM-dd'),
      days: logs,
    });
    downloadTextFile(`tydzien-${weekYear}-W${String(week).padStart(2, '0')}.md`, md);
  };

  const handleExportMonth = () => {
    const monthStartLocal = startOfMonth(currentMonth);
    const monthEndLocal = endOfMonth(monthStartLocal);
    const days = eachDayOfInterval({ start: monthStartLocal, end: monthEndLocal }).map(d => format(d, 'yyyy-MM-dd'));
    const logs = days.map(dateStr =>
      computeDayLog({
        date: dateStr,
        tasks,
        completionDates,
        dailyNotes,
        dailyTimeline: dailyTimelines[dateStr] || null,
      })
    );
    const ym = format(monthStartLocal, 'yyyy-MM');
    const md = renderRangeMarkdown({
      title: `Miesiąc ${format(monthStartLocal, 'LLLL yyyy', { locale: pl })}`,
      from: format(monthStartLocal, 'yyyy-MM-dd'),
      to: format(monthEndLocal, 'yyyy-MM-dd'),
      days: logs,
    });
    downloadTextFile(`miesiac-${ym}.md`, md);
  };

  const completedTasksForSelected = useMemo(() => {
    if (!selectedDateStr) return [];
    return tasks.filter(t => t.date === selectedDateStr && t.completed);
  }, [tasks, selectedDateStr]);

  const selectedTimeline = useMemo(() => {
    if (!selectedDateStr) return null;
    return dailyTimelines[selectedDateStr] || null;
  }, [dailyTimelines, selectedDateStr]);

  const selectedEvents = useMemo(() => {
    const events = selectedTimeline?.events || [];
    return [...events].sort(sortTimeAsc);
  }, [selectedTimeline]);

  const getProjectBadge = (projectId: string | null | undefined) => {
    if (!projectId) return null;
    const p = projects.find(pr => pr.id === projectId);
    if (!p) return null;
    const c = p.color || '';
    return (
      <span
        className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0"
        style={{
          backgroundColor: c ? `${c}15` : 'transparent',
          color: c || 'inherit',
          borderColor: c ? `${c}30` : 'transparent',
        }}
        title="Projekt"
      >
        {p.emoji ? `${p.emoji} ` : ''}{p.title}
      </span>
    );
  };

  const ensureTimelineForSelected = (): DailyTimeline | null => {
    if (!selectedDateStr) return null;
    const existing = dailyTimelines[selectedDateStr];
    if (existing) return existing;
    return {
      id: generateId(),
      user_id: '',
      date: selectedDateStr,
      wake_up_time: '',
      sleep_time: '',
      events: [],
    };
  };

  const upsertEventsForSelected = (events: DailyTimelineEvent[]) => {
    const base = ensureTimelineForSelected();
    if (!base || !selectedDateStr) return;
    onSaveDailyTimeline(selectedDateStr, { ...base, events });
  };

  const handleAddEvent = () => {
    if (!selectedDateStr) return;
    if (!newEventTitle.trim()) return;
    const base = ensureTimelineForSelected();
    if (!base) return;
    const nextEvents: DailyTimelineEvent[] = [
      ...(base.events || []),
      {
        id: generateId(),
        type: 'other',
        time: newEventTime,
        title: newEventTitle.trim(),
        duration: Number.isFinite(newEventDuration) ? Math.max(0, Math.round(newEventDuration)) : undefined,
        color: 'indigo',
        project_id: newEventProjectId || null,
      },
    ].sort(sortTimeAsc);
    onSaveDailyTimeline(selectedDateStr, { ...base, events: nextEvents });
    setNewEventTitle('');
    setIsAddingEvent(false);
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Month grid (full width) */}
      <div className="bg-white dark:bg-tp-surface rounded-3xl border border-slate-200 dark:border-white/6 p-6 shadow-sm transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: pl })}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-black/10">
                Siłownia: {monthStats.gymDays} dni
              </span>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-black/10">
                Praca: {minutesToHumanText(monthStats.workMinutesTotal)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="flex items-center bg-slate-100 dark:bg-tp-muted rounded-xl p-1 border border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowPlanned(v => !v)}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-colors",
                    showPlanned ? "bg-white dark:bg-tp-surface text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  )}
                  title="Pokaż/ukryj zaplanowane wydarzenia"
                >
                  Zaplanowane
                </button>
                <button
                  type="button"
                  onClick={() => setShowDone(v => !v)}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-colors",
                    showDone ? "bg-white dark:bg-tp-surface text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  )}
                  title="Pokaż/ukryj ukończone zadania"
                >
                  Zrobione
                </button>
                <button
                  type="button"
                  onClick={() => setShowNotes(v => !v)}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-colors",
                    showNotes ? "bg-white dark:bg-tp-surface text-slate-700 dark:text-slate-200 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  )}
                  title="Pokaż/ukryj notatki dnia"
                >
                  Notatki
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-tp-muted rounded-xl transition-colors text-slate-600 dark:text-slate-400">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-tp-muted rounded-xl transition-colors text-slate-600 dark:text-slate-400">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mt-6">
          {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const doneCount = showDone ? tasks.filter(t => t.date === dateStr && t.completed).length : 0;
            const plannedCount = showPlanned ? (dailyTimelines[dateStr]?.events?.length || 0) : 0;
            const hasNote = showNotes ? !!dailyNotes[dateStr] : false;
            const perDay = monthStats.perDay.get(dateStr);
            const hasGym = !!perDay?.gym;
            const workMinutes = perDay?.workMinutes ?? 0;
            const workCompact = minutesToCompactHours(workMinutes);

            const isSelected = !!(selectedDate && isSameDay(day, selectedDate));
            const isCurrentMonth = isSameMonth(day, monthStart);

            return (
              <button
                key={day.toString()}
                onClick={() => {
                  setSelectedDate(day);
                  setIsAddingEvent(false);
                  // domyślnie przełącz na tab zgodny z aktywnymi filtrami
                  if (showPlanned) setDayTab('planned');
                  else if (showDone) setDayTab('done');
                  else setDayTab('notes');
                }}
                className={cn(
                  "h-20 sm:h-24 lg:h-28 flex flex-col items-center justify-center rounded-2xl text-sm transition-all relative border",
                  !isCurrentMonth && "text-slate-300 dark:text-slate-700 border-transparent",
                  isCurrentMonth && !isSelected && "hover:bg-slate-50 dark:hover:bg-tp-muted text-slate-700 dark:text-slate-300 border-slate-100 dark:border-white/6",
                  isSelected && "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none font-bold border-indigo-600"
                )}
              >
                <div className="text-lg leading-none">{format(day, dateFormat)}</div>
                {(hasGym || workMinutes > 0) && (
                  <div className={cn("mt-1 flex items-center gap-1.5 text-[10px] font-bold", isSelected ? "text-white/95" : "text-slate-500 dark:text-slate-400")}>
                    {hasGym && (
                      <span className="inline-flex items-center gap-1" title="Siłownia / trening">
                        <Dumbbell className={cn("w-3 h-3", isSelected ? "text-white" : "text-emerald-600 dark:text-emerald-400")} />
                      </span>
                    )}
                    {workMinutes > 0 && (
                      <span title={`Praca: ${minutesToHumanText(workMinutes)}`}>
                        {workCompact}
                      </span>
                    )}
                  </div>
                )}
                <div className="absolute bottom-2 flex gap-1.5">
                  {plannedCount > 0 && (
                    <div className={cn("w-2 h-2 rounded-full", isSelected ? "bg-white" : "bg-indigo-500 dark:bg-indigo-400")} title={`${plannedCount} wydarzeń`} />
                  )}
                  {doneCount > 0 && (
                    <div className={cn("w-2 h-2 rounded-full", isSelected ? "bg-white" : "bg-emerald-500 dark:bg-emerald-400")} title={`${doneCount} zrobionych`} />
                  )}
                  {hasNote && (
                    <div className={cn("w-2 h-2 rounded-full", isSelected ? "bg-white" : "bg-slate-500 dark:bg-slate-400")} title="Notatka" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day details (full width, tabbed) */}
      <div className="bg-white dark:bg-tp-surface rounded-3xl border border-slate-200 dark:border-white/6 shadow-sm transition-colors overflow-visible">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-white/6 bg-gradient-to-b from-slate-50/80 to-white dark:from-tp-surface dark:to-tp-surface">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  Dzień
                </span>
                {selectedDate ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/6 bg-white/80 dark:bg-black/10 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                    {format(selectedDate, 'EEE', { locale: pl })}
                  </span>
                ) : null}
              </div>
              <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white truncate mt-1">
                {selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: pl }) : 'Wybierz dzień'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Przełącz widok dnia i zarządzaj wydarzeniami z godziną.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Export */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportDay}
                  disabled={!selectedDateStr}
                  className={cn(
                    "px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all",
                    !selectedDateStr ? "opacity-50 cursor-not-allowed" : "hover:translate-y-[-1px] hover:shadow-md",
                    "bg-white dark:bg-tp-surface text-slate-900 dark:text-white border-slate-200 dark:border-white/6 hover:bg-slate-50 dark:hover:bg-tp-muted"
                  )}
                  title="Eksportuj dzień do pliku Markdown"
                >
                  <Download className="w-4 h-4" />
                  Eksport dnia
                </button>
                <button
                  type="button"
                  onClick={handleExportWeek}
                  disabled={!selectedDate}
                  className={cn(
                    "px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all",
                    !selectedDate ? "opacity-50 cursor-not-allowed" : "hover:translate-y-[-1px] hover:shadow-md",
                    "bg-white dark:bg-tp-surface text-slate-900 dark:text-white border-slate-200 dark:border-white/6 hover:bg-slate-50 dark:hover:bg-tp-muted"
                  )}
                  title="Eksportuj tydzień (pon–nd) do pliku Markdown"
                >
                  <Download className="w-4 h-4" />
                  Eksport tygodnia
                </button>
                <button
                  type="button"
                  onClick={handleExportMonth}
                  className={cn(
                    "px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all",
                    "hover:translate-y-[-1px] hover:shadow-md",
                    "bg-white dark:bg-tp-surface text-slate-900 dark:text-white border-slate-200 dark:border-white/6 hover:bg-slate-50 dark:hover:bg-tp-muted"
                  )}
                  title="Eksportuj miesiąc z aktualnie wyświetlanego kalendarza do pliku Markdown"
                >
                  <Download className="w-4 h-4" />
                  Eksport miesiąca
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center bg-white dark:bg-tp-surface rounded-2xl p-1 border border-slate-200 dark:border-white/6 shadow-sm">
                <button
                  type="button"
                  onClick={() => setDayTab('planned')}
                  disabled={!showPlanned}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-xl transition-all",
                    dayTab === 'planned'
                      ? "bg-indigo-600 text-white shadow-[0_8px_24px_rgba(99,102,241,0.25)]"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-tp-muted",
                    !showPlanned && "opacity-40 cursor-not-allowed"
                  )}
                >
                  Wydarzenia
                </button>
                <button
                  type="button"
                  onClick={() => setDayTab('done')}
                  disabled={!showDone}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-xl transition-all",
                    dayTab === 'done'
                      ? "bg-emerald-600 text-white shadow-[0_8px_24px_rgba(16,185,129,0.25)]"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-tp-muted",
                    !showDone && "opacity-40 cursor-not-allowed"
                  )}
                >
                  Zrobione
                </button>
                <button
                  type="button"
                  onClick={() => setDayTab('notes')}
                  disabled={!showNotes}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-xl transition-all",
                    dayTab === 'notes'
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-tp-muted",
                    !showNotes && "opacity-40 cursor-not-allowed"
                  )}
                >
                  Notatka
                </button>
              </div>

              {/* Primary action */}
              {dayTab === 'planned' && (
                <button
                  type="button"
                  onClick={() => setIsAddingEvent(v => !v)}
                  disabled={!selectedDateStr}
                  className={cn(
                    "px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all",
                    !selectedDateStr ? "opacity-50 cursor-not-allowed" : "hover:translate-y-[-1px] hover:shadow-md",
                    isAddingEvent
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white dark:bg-tp-surface text-slate-900 dark:text-white border-slate-200 dark:border-white/6 hover:bg-slate-50 dark:hover:bg-tp-muted"
                  )}
                  title="Dodaj wydarzenie"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Dodaj wydarzenie
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="rounded-3xl border border-slate-100 dark:border-white/6 bg-slate-50/70 dark:bg-tp-canvas/20 p-4 sm:p-5">

        {dayTab === 'planned' && (
          <div className="space-y-4">
            {isAddingEvent && selectedDateStr && (
              <div className="grid grid-cols-1 gap-3 p-4 rounded-3xl border border-indigo-200 dark:border-indigo-900/50 bg-white/70 dark:bg-black/10 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Godzina</label>
                    <input
                      type="time"
                      value={newEventTime}
                      onChange={(e) => setNewEventTime(e.target.value)}
                      className="w-full text-sm rounded-2xl border border-slate-200 dark:border-white/10 px-3 py-2 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-tp-surface text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Czas (min)</label>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={String(newEventDuration)}
                      onChange={(e) => setNewEventDuration(parseInt(e.target.value || '0', 10))}
                      className="w-full text-sm rounded-2xl border border-slate-200 dark:border-white/10 px-3 py-2 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-tp-surface text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Tytuł</label>
                    <input
                      type="text"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      placeholder="np. Spotkanie / Call / Deadline…"
                      className="w-full text-sm rounded-2xl border border-slate-200 dark:border-white/10 px-3 py-2 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-tp-surface text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Projekt</label>
                    <select
                      value={newEventProjectId}
                      onChange={(e) => setNewEventProjectId(e.target.value)}
                      className="w-full text-sm rounded-2xl border border-slate-200 dark:border-white/10 px-3 py-2 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-tp-surface text-slate-900 dark:text-white"
                    >
                      <option value="">— brak —</option>
                      {projects.filter(p => !p.completed).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.emoji ? `${p.emoji} ` : ''}{p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAddingEvent(false); setNewEventTitle(''); }}
                    className="px-4 py-2 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-tp-muted/40 transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    onClick={handleAddEvent}
                    disabled={!newEventTitle.trim()}
                    className="px-4 py-2 rounded-2xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
                  >
                    Zapisz wydarzenie
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {!selectedDateStr ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-6">Wybierz dzień z kalendarza.</p>
              ) : selectedEvents.length === 0 ? (
                <div className="text-center py-10 bg-white/60 dark:bg-black/10 rounded-3xl border border-slate-200/70 dark:border-white/6 border-dashed">
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Brak wydarzeń w tym dniu.</p>
                </div>
              ) : (
                selectedEvents.map(ev => (
                  <div key={ev.id} className="p-4 rounded-3xl bg-white/70 dark:bg-black/10 border border-slate-200/70 dark:border-white/6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <input
                          type="time"
                          value={ev.time}
                          onChange={(e) => {
                            const next = selectedEvents.map(x => x.id === ev.id ? { ...x, time: e.target.value } : x).sort(sortTimeAsc);
                            upsertEventsForSelected(next);
                          }}
                          className="text-xs font-mono rounded-2xl border border-slate-200 dark:border-white/10 px-2 py-2 bg-white dark:bg-tp-surface text-slate-900 dark:text-white w-[96px]"
                          title="Godzina"
                        />
                        <input
                          type="text"
                          value={ev.title}
                          onChange={(e) => {
                            const next = selectedEvents.map(x => x.id === ev.id ? { ...x, title: e.target.value } : x);
                            upsertEventsForSelected(next);
                          }}
                          className="flex-1 min-w-0 text-sm font-semibold rounded-2xl border border-slate-200 dark:border-white/10 px-3 py-2 bg-white dark:bg-tp-surface text-slate-900 dark:text-white"
                          title="Tytuł"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = selectedEvents.filter(x => x.id !== ev.id);
                            upsertEventsForSelected(next);
                          }}
                          className="p-2.5 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                          title="Usuń wydarzenie"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">min</span>
                        <input
                          type="number"
                          min={0}
                          step={5}
                          value={String(ev.duration ?? 60)}
                          onChange={(e) => {
                            const v = parseInt(e.target.value || '0', 10);
                            const next = selectedEvents.map(x => x.id === ev.id ? { ...x, duration: Number.isFinite(v) ? Math.max(0, v) : undefined } : x);
                            upsertEventsForSelected(next);
                          }}
                          className="w-[104px] text-xs rounded-2xl border border-slate-200 dark:border-white/10 px-2 py-2 bg-white dark:bg-tp-surface text-slate-700 dark:text-slate-200"
                          title="Czas trwania (minuty)"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <select
                        value={ev.project_id || ''}
                        onChange={(e) => {
                          const next = selectedEvents.map(x => x.id === ev.id ? { ...x, project_id: e.target.value || null } : x);
                          upsertEventsForSelected(next);
                        }}
                        className="text-xs rounded-2xl border border-slate-200 dark:border-white/10 px-2 py-2 bg-white dark:bg-tp-surface text-slate-700 dark:text-slate-200"
                        title="Projekt"
                      >
                        <option value="">— brak projektu —</option>
                        {projects.filter(p => !p.completed).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.emoji ? `${p.emoji} ` : ''}{p.title}
                          </option>
                        ))}
                      </select>
                      {getProjectBadge(ev.project_id)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {dayTab === 'done' && (
          <div className="space-y-2">
            {!selectedDate ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">Wybierz dzień z kalendarza.</p>
            ) : completedTasksForSelected.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">Brak ukończonych zadań w tym dniu.</p>
            ) : (
              completedTasksForSelected.map(task => (
                <div key={task.id} className="p-4 rounded-3xl bg-white/70 dark:bg-black/10 border border-slate-200/70 dark:border-white/6 flex items-center gap-3 shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 line-through">{task.title}</span>
                  {task.pomodoros_completed ? (
                    <span className="text-xs text-rose-600 dark:text-rose-400 font-medium ml-auto flex items-center gap-1 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full border border-rose-100 dark:border-rose-900/30">
                      🍅 {task.pomodoros_completed}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}

        {dayTab === 'notes' && (
          <div>
            {selectedDate ? (
              <DailyNotePanel
                date={format(selectedDate, 'yyyy-MM-dd')}
                content={dailyNotes[format(selectedDate, 'yyyy-MM-dd')] || ''}
                onChange={onSaveDailyNote}
              />
            ) : (
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">Wybierz dzień z kalendarza.</p>
            )}
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
