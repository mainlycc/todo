import { ANONYMOUS_USER_ID } from '../constants';
import type { DailyTimeline, DailyTimelineEvent } from '../types';
import { supabase } from './supabase';

export function normalizeDailyTimelineEvents(raw: unknown): DailyTimelineEvent[] {
  if (Array.isArray(raw)) return raw as DailyTimelineEvent[];
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? (p as DailyTimelineEvent[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeDailyTimelineFromApiRow(raw: unknown): DailyTimeline | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.date !== 'string' || !t.date) return null;
  const events = normalizeDailyTimelineEvents(t.events);
  return {
    id: typeof t.id === 'string' ? t.id : `new-${t.date}`,
    user_id: typeof t.user_id === 'string' ? t.user_id : ANONYMOUS_USER_ID,
    date: t.date,
    wake_up_time: typeof t.wake_up_time === 'string' ? t.wake_up_time : undefined,
    sleep_time: typeof t.sleep_time === 'string' ? t.sleep_time : undefined,
    events,
  };
}

export function parseDailyTimelinesFromLocalStorage(): Record<string, DailyTimeline> {
  const out: Record<string, DailyTimeline> = {};
  try {
    const raw = localStorage.getItem('daily_timelines');
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return out;
    for (const [dateKey, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue;
      const t = value as Record<string, unknown>;
      const date = typeof t.date === 'string' && t.date ? t.date : dateKey;
      const events = normalizeDailyTimelineEvents(t.events);
      out[dateKey] = {
        id: typeof t.id === 'string' ? t.id : `new-${date}`,
        user_id: typeof t.user_id === 'string' ? t.user_id : ANONYMOUS_USER_ID,
        date,
        wake_up_time: typeof t.wake_up_time === 'string' ? t.wake_up_time : undefined,
        sleep_time: typeof t.sleep_time === 'string' ? t.sleep_time : undefined,
        events,
      };
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Po odświeżeniu serwer może mieć pusty lub nieaktualny `events` względem localStorage — scalamy per data. */
export function mergeServerAndLocalDailyTimelines(
  server: Record<string, DailyTimeline>,
  localOrSession: Record<string, DailyTimeline>
): Record<string, DailyTimeline> {
  const dates = new Set([...Object.keys(server), ...Object.keys(localOrSession)]);
  const out: Record<string, DailyTimeline> = {};
  for (const date of dates) {
    const s = server[date];
    const l = localOrSession[date];
    if (!l) {
      if (s) out[date] = s;
      continue;
    }
    if (!s) {
      out[date] = l;
      continue;
    }
    const sLen = s.events?.length ?? 0;
    const lLen = l.events?.length ?? 0;
    if (lLen > sLen) {
      out[date] = {
        ...l,
        id: String(l.id).startsWith('new-') && s.id ? s.id : l.id,
        user_id: l.user_id || s.user_id || ANONYMOUS_USER_ID,
      };
    } else if (sLen > lLen) {
      out[date] = s;
    } else {
      out[date] = {
        ...s,
        ...l,
        events: l.events,
        id: String(l.id).startsWith('new-') && s.id ? s.id : l.id || s.id,
        user_id: l.user_id || s.user_id || ANONYMOUS_USER_ID,
      };
    }
  }
  return out;
}

const TIMELINE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Payload pod `daily_timelines` — `events` jako czysty JSON (JSONB), bez `undefined`. */
export function buildDailyTimelineUpsertPayload(
  timeline: DailyTimeline,
  date: string
): Record<string, unknown> {
  const events = JSON.parse(JSON.stringify(timeline.events || [])) as unknown[];
  const id = timeline.id;
  const omitId =
    typeof id !== 'string' || id.startsWith('new-') || !TIMELINE_UUID_RE.test(id);
  return {
    ...(omitId ? {} : { id }),
    wake_up_time: timeline.wake_up_time ?? null,
    sleep_time: timeline.sleep_time ?? null,
    events,
    user_id: ANONYMOUS_USER_ID,
    date,
  };
}

export function isSupabaseEnvConfigured(): boolean {
  const url = (import.meta as { env?: { VITE_SUPABASE_URL?: string } }).env?.VITE_SUPABASE_URL;
  const key = (import.meta as { env?: { VITE_SUPABASE_ANON_KEY?: string } }).env
    ?.VITE_SUPABASE_ANON_KEY;
  return !!(
    url &&
    key &&
    url !== 'https://placeholder.supabase.co' &&
    key !== 'placeholder'
  );
}

/** Gdy po mergu lokalnie jest więcej danych niż w bazie — jeden `upsert` na datę, żeby Supabase nadążył. */
export async function pushRicherTimelinesToSupabase(
  serverByDate: Record<string, DailyTimeline>,
  merged: Record<string, DailyTimeline>
) {
  if (!isSupabaseEnvConfigured()) return;
  for (const date of Object.keys(merged)) {
    const s = serverByDate[date];
    const m = merged[date];
    const sLen = s?.events?.length ?? 0;
    const mLen = m.events?.length ?? 0;
    if (mLen === 0) continue;
    if (s && mLen <= sLen) continue;
    const payload = buildDailyTimelineUpsertPayload(m, date);
    const { error } = await supabase
      .from('daily_timelines')
      .upsert(payload, { onConflict: 'user_id,date' });
    if (error) {
      console.error('Synchronizacja harmonogramu do Supabase nie powiodła się:', date, error);
    }
  }
}
