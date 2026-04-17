import type { DailyTimeline, Task } from '../types';

export type CompletionDatesMap = Record<string, string | undefined>;

export interface DayLog {
  date: string; // YYYY-MM-DD
  sleepMinutes: number | null;
  workMinutes: number;
  gym: boolean;
  plannedTasks: Array<{ id: string; title: string }>;
  doneTasks: Array<{ id: string; title: string }>;
  noteHtml: string;
}

const parseTimeToMinutes = (time: string | undefined | null) => {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
};

const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const isWorkEvent = (t: { type?: string; title?: string }) =>
  (t.type || '') === 'other' && normalizeText(t.title || '') === 'praca';

const isGymEvent = (t: { type?: string; title?: string }) => {
  const type = (t.type || '').toLowerCase();
  if (type === 'workout') return true;
  const title = normalizeText(t.title || '');
  return title === 'silownia' || title === 'trening' || title.includes('silownia') || title.includes('trening');
};

const isSleepLikeType = (type: string) => type === 'sleep' || type === 'nap';

function computeSleepMinutesFromTimeline(timeline: DailyTimeline | null): number | null {
  if (!timeline) return null;
  const events = timeline.events || [];
  const sleepEvent = events.find(e => e.type === 'sleep');

  const sleepEventStartMin = sleepEvent ? parseTimeToMinutes(sleepEvent.time) : null;
  const sleepEventDurationMin = sleepEvent?.duration ?? null;
  const nightSleepMinutes =
    sleepEventStartMin !== null && typeof sleepEventDurationMin === 'number'
      ? Math.max(0, Math.round(sleepEventDurationMin))
      : (() => {
          const sleepStartMin = parseTimeToMinutes(timeline.sleep_time);
          const wakeUpMin = parseTimeToMinutes(timeline.wake_up_time);
          if (sleepStartMin === null || wakeUpMin === null) return null;
          return wakeUpMin >= sleepStartMin
            ? wakeUpMin - sleepStartMin
            : 24 * 60 - sleepStartMin + wakeUpMin;
        })();

  const napMinutesTotal = events
    .filter(e => e.type === 'nap')
    .reduce((sum, e) => sum + Math.max(0, Math.round(e.duration ?? 0)), 0);

  if (nightSleepMinutes === null && napMinutesTotal === 0) return null;
  return (nightSleepMinutes ?? 0) + napMinutesTotal;
}

function computeWorkMinutesFromTimeline(timeline: DailyTimeline | null): number {
  if (!timeline) return 0;
  const events = timeline.events || [];
  return events.filter(isWorkEvent).reduce((sum, e) => sum + Math.max(0, Math.round(e.duration ?? 0)), 0);
}

function computeGymFromTimeline(timeline: DailyTimeline | null): boolean {
  if (!timeline) return false;
  const events = timeline.events || [];
  return events.some(isGymEvent);
}

function computeDoneTasksForDay(
  tasks: Task[],
  date: string,
  completionDates: CompletionDatesMap | undefined
): Array<{ id: string; title: string }> {
  return tasks
    .filter(t => {
      if (!t.completed) return false;
      if (t.date === date) return true;
      return (completionDates?.[t.id] || '') === date;
    })
    .map(t => ({ id: t.id, title: t.title }));
}

function computePlannedTasksForDay(tasks: Task[], date: string): Array<{ id: string; title: string }> {
  return tasks
    .filter(t => t.date === date && !t.completed)
    .map(t => ({ id: t.id, title: t.title }));
}

export function computeDayLog(args: {
  date: string;
  tasks: Task[];
  completionDates?: CompletionDatesMap;
  dailyNotes: Record<string, string | undefined>;
  dailyTimeline: DailyTimeline | null;
}): DayLog {
  const { date, tasks, completionDates, dailyNotes, dailyTimeline } = args;
  const sleepMinutes = computeSleepMinutesFromTimeline(dailyTimeline);
  const workMinutes = computeWorkMinutesFromTimeline(dailyTimeline);
  const gym = computeGymFromTimeline(dailyTimeline);
  const plannedTasks = computePlannedTasksForDay(tasks, date);
  const doneTasks = computeDoneTasksForDay(tasks, date, completionDates);
  const noteHtml = (dailyNotes[date] || '').trim();

  return {
    date,
    sleepMinutes,
    workMinutes,
    gym,
    plannedTasks,
    doneTasks,
    noteHtml,
  };
}

export function minutesToHumanText(totalMinutes: number | null): string {
  if (totalMinutes === null) return '—';
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}

