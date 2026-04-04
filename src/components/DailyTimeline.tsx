import React, { useState, useEffect } from 'react';
import { Sun, Moon, Plus, MoreVertical, Clock, CheckCircle2, Footprints, Dumbbell, Thermometer, Snowflake, Utensils, Trash2, Briefcase } from 'lucide-react';
import { DailyTimeline as DailyTimelineData, DailyTimelineEvent } from '../types';
import { cn } from '../utils';

interface DailyTimelineProps {
  timeline: DailyTimelineData | null;
  onUpdate: (timeline: DailyTimelineData) => void;
  /** Ukończone zadania przypisane do tego dnia — pokazywane jako zwykły tekst tylko w bloku „Praca”. */
  workBlockDoneTasks?: { id: string; title: string }[];
}

const EVENT_TYPES = [
  { type: 'wake_up', label: 'Pobudka', icon: Sun, color: '#FBBF24' },
  // Kolor "Sen" jest zarezerwowany i nie może być użyty przez inne wydarzenia.
  { type: 'sleep', label: 'Sen', icon: Moon, color: '#1D4ED8' },
  { type: 'check', label: 'Zrobione', icon: CheckCircle2, color: '#10B981' },
  { type: 'walk', label: 'Spacer', icon: Footprints, color: '#14B8A6' },
  { type: 'workout', label: 'Trening', icon: Dumbbell, color: '#6B7280' },
  { type: 'sauna', label: 'Sauna', icon: Thermometer, color: '#EF4444' },
  { type: 'shower', label: 'Zimny prysznic', icon: Snowflake, color: '#06B6D4' },
  { type: 'food', label: 'Posiłek/Suplementy', icon: Utensils, color: '#84CC16' },
];

const SLEEP_COLOR = EVENT_TYPES.find(t => t.type === 'sleep')!.color;

/** Główny sen nocny (`sleep`) synchronizuje kartę „Pobudka”; drzemka w ciągu dnia (`nap`) — ten sam wygląd, bez nadpisywania pobudki. */
const isSleepLikeType = (t: string) => t === 'sleep' || t === 'nap';

const isHexColor = (value: string | undefined): value is string => {
  if (!value) return false;
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
};

const withAlpha = (hex: string, alpha01: number) => {
  const a = Math.max(0, Math.min(1, alpha01));
  const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0');
  // If already has alpha, overwrite it.
  return hex.length === 9 ? `${hex.slice(0, 7)}${alphaHex}` : `${hex}${alphaHex}`;
};

const parseTimeToMinutes = (time: string | undefined) => {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
};

const formatMinutes = (totalMinutes: number) => {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
};

const formatClock = (totalMinutes: number) => {
  const m = ((Math.round(totalMinutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

const DEFAULT_TEMPLATES: Array<{
  id: 'work' | 'gym' | 'chill' | 'nap';
  label: string;
  title: string;
  color: 'indigo' | 'emerald' | 'amber' | 'rose';
  duration: number;
}> = [
  { id: 'work', label: 'Praca', title: 'Praca', color: 'indigo', duration: 90 },
  { id: 'gym', label: 'Siłownia', title: 'Siłownia', color: 'emerald', duration: 75 },
  { id: 'chill', label: 'Chill', title: 'Chill', color: 'amber', duration: 60 },
  { id: 'nap', label: 'Drzemka', title: 'Drzemka', color: 'amber', duration: 30 },
];

const isWorkBlockEvent = (ev: DailyTimelineEvent) =>
  ev.type === 'other' && ev.title.trim().toLowerCase() === 'praca';

export const DailyTimeline: React.FC<DailyTimelineProps> = ({ timeline, onUpdate, workBlockDoneTasks = [] }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [resizingEventId, setResizingEventId] = useState<string | null>(null);
  const [resizeEdge, setResizeEdge] = useState<'top' | 'bottom' | null>(null);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [dragStartMinutes, setDragStartMinutes] = useState<number>(0);

  const ROW_HEIGHT = 40; // Explicit row height for calculations
  const SNAP_MINUTES = 15;
  const PIXELS_PER_MINUTE = ROW_HEIGHT / 60;

  const COLORS = [
    { name: 'Indigo', value: 'indigo', bg: 'bg-indigo-500', border: 'border-indigo-200', darkBg: 'dark:bg-indigo-900/20', darkBorder: 'dark:border-indigo-800' },
    { name: 'Emerald', value: 'emerald', bg: 'bg-emerald-500', border: 'border-emerald-200', darkBg: 'dark:bg-emerald-900/20', darkBorder: 'dark:border-emerald-800' },
    { name: 'Amber', value: 'amber', bg: 'bg-amber-500', border: 'border-amber-200', darkBg: 'dark:bg-amber-900/20', darkBorder: 'dark:border-amber-800' },
    { name: 'Rose', value: 'rose', bg: 'bg-rose-500', border: 'border-rose-200', darkBg: 'dark:bg-rose-900/20', darkBorder: 'dark:border-rose-800' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const events = timeline?.events || [];

  // "Sen" zawsze ma swój stały kolor, niezależnie od tego co jest zapisane w danych.
  const normalizedEvents: DailyTimelineEvent[] = events.map(ev =>
    isSleepLikeType(ev.type) ? { ...ev, color: SLEEP_COLOR } : ev
  );
  const firstWorkBlockEventId = normalizedEvents.find(isWorkBlockEvent)?.id;

  const addTemplateEvent = (tpl: (typeof DEFAULT_TEMPLATES)[number]) => {
    const updatedTimeline: DailyTimelineData = timeline || {
      id: generateId(),
      user_id: '',
      date: '',
      wake_up_time: '',
      sleep_time: '',
      events: [],
    };

    const targetMinutes =
      tpl.id === 'gym'
        ? (15 * 60)
        : (() => {
            const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
            return Math.round(nowMinutes / SNAP_MINUTES) * SNAP_MINUTES;
          })();
    const h = Math.floor(targetMinutes / 60) % 24;
    const m = targetMinutes % 60;
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    const newEvent: DailyTimelineEvent =
      tpl.id === 'nap'
        ? {
            id: generateId(),
            type: 'nap',
            time: timeStr,
            title: tpl.title,
            duration: tpl.duration,
            color: SLEEP_COLOR,
          }
        : {
            id: generateId(),
            type: 'other',
            time: timeStr,
            title: tpl.title,
            duration: tpl.duration,
            color: tpl.color,
          };

    onUpdate({
      ...updatedTimeline,
      events: [...(updatedTimeline.events || []), newEvent],
    });
  };

  const sleepStartMin = parseTimeToMinutes(timeline?.sleep_time);
  const wakeUpMin = parseTimeToMinutes(timeline?.wake_up_time);
  const sleepDurationMin =
    sleepStartMin === null || wakeUpMin === null
      ? null
      : (wakeUpMin >= sleepStartMin ? (wakeUpMin - sleepStartMin) : (24 * 60 - sleepStartMin + wakeUpMin));

  const sleepEvent = normalizedEvents.find(e => e.type === 'sleep');
  const sleepEventStartMin = sleepEvent ? parseTimeToMinutes(sleepEvent.time) : null;
  const sleepEventDurationMin = sleepEvent?.duration ?? null;
  const nightSleepMinutes =
    sleepEventStartMin !== null && typeof sleepEventDurationMin === 'number'
      ? Math.max(0, Math.round(sleepEventDurationMin))
      : sleepDurationMin;

  const napMinutesTotal = normalizedEvents
    .filter(e => e.type === 'nap')
    .reduce((sum, e) => sum + Math.max(0, Math.round(e.duration ?? 0)), 0);

  /** Podsumowanie karty „Sen”: sen nocny (blok lub godziny) + wszystkie drzemki. */
  const totalSleepSummaryMin =
    nightSleepMinutes === null && napMinutesTotal === 0
      ? null
      : (nightSleepMinutes ?? 0) + napMinutesTotal;

  const workMinutesTotal = normalizedEvents
    .filter(isWorkBlockEvent)
    .reduce((sum, e) => sum + Math.max(0, Math.round(e.duration ?? 0)), 0);

  const sleepEndEffective =
    sleepEventStartMin !== null && typeof sleepEventDurationMin === 'number'
      ? formatClock(sleepEventStartMin + sleepEventDurationMin)
      : (timeline?.wake_up_time || null);

  // Jeśli istnieje kafelek "Sen" na osi czasu, to "Pobudka" powinna być jego końcem.
  // Synchronizujemy `wake_up_time`, żeby karta Pobudka zawsze pokazywała prawidłową godzinę.
  useEffect(() => {
    if (!timeline) return;
    if (!sleepEndEffective) return;
    if (timeline.wake_up_time === sleepEndEffective) return;
    onUpdate({ ...timeline, wake_up_time: sleepEndEffective });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepEventStartMin, sleepEventDurationMin, sleepEndEffective]);

  const handleResizeStart = (e: React.MouseEvent, eventId: string, edge: 'top' | 'bottom') => {
    e.preventDefault();
    e.stopPropagation();
    setResizingEventId(eventId);
    setResizeEdge(edge);
  };

  const handleDragStart = (e: React.MouseEvent, eventId: string) => {
    if (resizingEventId) return;
    
    const event = normalizedEvents.find(ev => ev.id === eventId);
    if (!event) return;

    e.preventDefault();
    const [h, m] = event.time.split(':').map(Number);
    setDraggingEventId(eventId);
    setDragStartY(e.clientY);
    setDragStartMinutes(h * 60 + m);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if ((!resizingEventId || !resizeEdge) && !draggingEventId) return;
      if (!timeline) return;

      const timelineElement = document.getElementById('timeline-grid');
      if (!timelineElement) return;

      const rect = timelineElement.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      if (resizingEventId && resizeEdge) {
        // Calculate minutes and snap
        let totalMinutes = Math.floor(relativeY / PIXELS_PER_MINUTE);
        totalMinutes = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
        totalMinutes = Math.max(0, Math.min(24 * 60 - SNAP_MINUTES, totalMinutes));

        const eventIndex = timeline.events.findIndex(ev => ev.id === resizingEventId);
        if (eventIndex === -1) return;

        const event = timeline.events[eventIndex];
        const [startH, startM] = event.time.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const currentDuration = event.duration || 60;

        let newEvents = [...timeline.events];

        if (resizeEdge === 'bottom') {
          const newDuration = Math.max(SNAP_MINUTES, totalMinutes - startMinutes);
          newEvents[eventIndex] = { ...event, duration: newDuration, color: isSleepLikeType(event.type) ? SLEEP_COLOR : event.color };
        } else if (resizeEdge === 'top') {
          const endMinutes = startMinutes + currentDuration;
          const newStartMinutes = Math.min(totalMinutes, endMinutes - SNAP_MINUTES);
          const newDuration = endMinutes - newStartMinutes;
          
          const h = Math.floor(newStartMinutes / 60);
          const m = newStartMinutes % 60;
          
          newEvents[eventIndex] = { 
            ...event, 
            time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
            duration: newDuration,
            color: isSleepLikeType(event.type) ? SLEEP_COLOR : event.color,
          };
        }
        onUpdate({ ...timeline, events: newEvents });
      } else if (draggingEventId) {
        const deltaY = e.clientY - dragStartY;
        const deltaMinutes = Math.round((deltaY / PIXELS_PER_MINUTE) / SNAP_MINUTES) * SNAP_MINUTES;
        
        const event = timeline.events.find(ev => ev.id === draggingEventId);
        if (!event) return;

        let newStartMinutes = dragStartMinutes + deltaMinutes;
        const duration = event.duration || 60;
        
        newStartMinutes = Math.max(0, Math.min(24 * 60 - duration, newStartMinutes));

        const h = Math.floor(newStartMinutes / 60);
        const m = newStartMinutes % 60;
        const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

        if (event.time !== timeStr) {
          const newEvents = timeline.events.map(ev =>
            ev.id === draggingEventId
              ? { ...ev, time: timeStr, color: isSleepLikeType(ev.type) ? SLEEP_COLOR : ev.color }
              : ev
          );
          onUpdate({ ...timeline, events: newEvents });
        }
      }
    };

    const handleMouseUp = () => {
      setResizingEventId(null);
      setResizeEdge(null);
      setDraggingEventId(null);
    };

    if (resizingEventId || draggingEventId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingEventId, resizeEdge, draggingEventId, dragStartY, dragStartMinutes, timeline, onUpdate]);
  
  const updateWakeUp = (time: string) => {
    const updatedTimeline: DailyTimelineData = timeline || {
      id: generateId(),
      user_id: '',
      date: '',
      wake_up_time: '',
      sleep_time: '',
      events: []
    };
    onUpdate({ ...updatedTimeline, wake_up_time: time });
  };

  const updateHourEvent = (hour: number, title: string) => {
    const updatedTimeline: DailyTimelineData = timeline || {
      id: generateId(),
      user_id: '',
      date: '',
      wake_up_time: '',
      sleep_time: '',
      events: []
    };

    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    const existingEventIndex = updatedTimeline.events.findIndex(e => e.time === timeStr);

    let newEvents = [...updatedTimeline.events];
    if (title.trim() === '') {
      newEvents = newEvents.filter(e => e.time !== timeStr);
    } else if (existingEventIndex !== -1) {
      newEvents[existingEventIndex] = { ...newEvents[existingEventIndex], title };
    } else {
      newEvents.push({
        id: generateId(),
        time: timeStr,
        title,
        type: 'other'
      });
    }

    onUpdate({ ...updatedTimeline, events: newEvents });
  };

  const updateEventColor = (eventId: string, color: string) => {
    if (!timeline) return;
    const target = timeline.events.find(e => e.id === eventId);
    if (!target) return;
    // Zablokuj ustawienie koloru snu na innych wydarzeniach.
    if (!isSleepLikeType(target.type) && color === SLEEP_COLOR) return;
    const newEvents = timeline.events.map(e =>
      e.id === eventId
        ? { ...e, color: isSleepLikeType(e.type) ? SLEEP_COLOR : color }
        : e
    );
    onUpdate({ ...timeline, events: newEvents });
  };

  const deleteEvent = (eventId: string) => {
    if (!timeline) return;
    const newEvents = timeline.events.filter(e => e.id !== eventId);
    onUpdate({ ...timeline, events: newEvents });
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-slate-800 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-800 mt-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-bold">Harmonogram Dnia</h3>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {DEFAULT_TEMPLATES.map(tpl => {
          const colorCfg = COLORS.find(c => c.value === tpl.color) || COLORS[0];
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => addTemplateEvent(tpl)}
              className={cn(
                "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all hover:translate-y-[-1px] hover:shadow-sm",
                "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              )}
              title={`Dodaj: ${tpl.title} (start: teraz, ${tpl.duration} min)`}
            >
              {tpl.id === 'nap' ? (
                <span
                  className="inline-block w-2 h-2 rounded-full mr-2 align-middle border border-white/30 dark:border-slate-700"
                  style={{ backgroundColor: SLEEP_COLOR }}
                />
              ) : (
                <span className={cn("inline-block w-2 h-2 rounded-full mr-2 align-middle", colorCfg.bg)} />
              )}
              <span className="align-middle">{tpl.label}</span>
            </button>
          );
        })}
      </div>

      {/* Wake Up & Sleep Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold block">Pobudka</label>
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500 shrink-0" />
            <input 
              type="time" 
              value={timeline?.wake_up_time || ''} 
              onChange={(e) => updateWakeUp(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm font-medium tabular-nums w-full p-0 text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold block">Sen</label>
          <div className="flex items-center justify-between gap-2">
            <Moon className="w-4 h-4 shrink-0" style={{ color: SLEEP_COLOR }} />
            <div className="text-sm font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {totalSleepSummaryMin === null ? '—' : formatMinutes(totalSleepSummaryMin)}
            </div>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold block">Praca</label>
          <div className="flex items-center justify-between gap-2">
            <Briefcase className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="text-sm font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {formatMinutes(workMinutesTotal)}
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Timeline */}
      <div id="timeline-grid" className="relative">
        {/* Vertical Line */}
        <div className="absolute left-[52px] top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-800" />

        {/* Current Time Indicator (Green Line) */}
        {(() => {
          const h = currentTime.getHours();
          const m = currentTime.getMinutes();
          const topOffset = (h * ROW_HEIGHT) + (m / 60 * ROW_HEIGHT);
          return (
            <div 
              className="absolute left-0 right-0 z-30 flex items-center pointer-events-none transition-all duration-1000"
              style={{ top: `${topOffset}px` }}
            >
              <div className="w-12 text-right pr-2 text-[9px] font-bold text-emerald-500 bg-white dark:bg-slate-900">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 -ml-[5px]" />
              <div className="flex-1 h-px bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </div>
          );
        })()}

        {hours.map((hour) => {
          const timeStr = `${hour.toString().padStart(2, '0')}:00`;
          return (
            <div key={hour} style={{ height: `${ROW_HEIGHT}px` }} className="flex items-center gap-4 group relative border-t border-slate-100 dark:border-slate-800/50 first:border-t-0">
              <div className="w-9 text-right text-[11px] font-mono text-slate-400 dark:text-slate-500">
                {timeStr}
              </div>
              <div className="relative z-10">
                <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 transition-colors" />
              </div>
              <div className="flex-1 h-full flex items-center">
                <button 
                  onClick={() => {
                    const updatedTimeline: DailyTimelineData = timeline || {
                      id: generateId(),
                      user_id: '',
                      date: '',
                      wake_up_time: '',
                      sleep_time: '',
                      events: []
                    };
                    onUpdate({
                      ...updatedTimeline,
                      events: [...updatedTimeline.events, {
                        id: generateId(),
                        time: timeStr,
                        title: 'Nowa czynność',
                        type: 'other',
                        duration: 60,
                        color: 'indigo'
                      }]
                    });
                  }}
                  className="w-full h-full text-left text-slate-300 dark:text-slate-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  + Dodaj czynność
                </button>
              </div>
            </div>
          );
        })}

        {/* Events Overlay */}
        {normalizedEvents.map((event) => {
          const [h, m] = event.time.split(':').map(Number);
          const top = (h * ROW_HEIGHT) + (m * PIXELS_PER_MINUTE);
          const height = (event.duration || 60) * PIXELS_PER_MINUTE;
          const isSleep = isSleepLikeType(event.type);
          const isWorkBlock = isWorkBlockEvent(event);
          const isNamed = typeof event.color === 'string' && COLORS.some(c => c.value === event.color);
          const colorCfg = isNamed ? (COLORS.find(c => c.value === event.color) || COLORS[0]) : COLORS[0];
          const hexColor = isHexColor(event.color) ? event.color : null;
          const eventStyle: React.CSSProperties | undefined = hexColor
            ? {
                borderColor: withAlpha(hexColor, 0.35),
                backgroundColor: withAlpha(hexColor, 0.10),
              }
            : undefined;

          return (
            <div 
              key={event.id}
              onMouseDown={(e) => handleDragStart(e, event.id)}
              className={cn(
                "absolute left-[68px] right-0 rounded-lg p-2 flex flex-col group/event border transition-shadow hover:shadow-md cursor-grab active:cursor-grabbing overflow-hidden",
                !hexColor && colorCfg.bg.replace('bg-', 'bg-opacity-10 bg-'),
                !hexColor && colorCfg.border,
                !hexColor && colorCfg.darkBg,
                !hexColor && colorCfg.darkBorder,
                resizingEventId === event.id || draggingEventId === event.id ? "z-50 ring-2 ring-indigo-500 shadow-lg" : "z-20"
              )}
              style={{ 
                top: `${top + 2}px`,
                height: `${height - 4}px`,
                ...(eventStyle || {}),
              }}
            >
              {/* Sleep pattern overlay */}
              {isSleep && (
                <>
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      // "gwiazdki" + miękka poświata
                      backgroundImage: [
                        'radial-gradient(circle at 18% 24%, rgba(255,255,255,0.9) 0 1px, rgba(255,255,255,0) 2px)',
                        'radial-gradient(circle at 72% 30%, rgba(255,255,255,0.85) 0 1px, rgba(255,255,255,0) 2px)',
                        'radial-gradient(circle at 40% 70%, rgba(255,255,255,0.8) 0 1px, rgba(255,255,255,0) 2px)',
                        'radial-gradient(circle at 88% 78%, rgba(255,255,255,0.75) 0 1px, rgba(255,255,255,0) 2px)',
                        'radial-gradient(100% 80% at 20% 0%, rgba(29,78,216,0.25) 0%, rgba(29,78,216,0) 60%)',
                      ].join(','),
                      opacity: 0.55,
                      mixBlendMode: 'overlay',
                    }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 w-1.5 pointer-events-none"
                    style={{
                      background: `linear-gradient(180deg, ${withAlpha(SLEEP_COLOR, 0.85)}, ${withAlpha(SLEEP_COLOR, 0.35)})`,
                    }}
                  />
                </>
              )}

              {/* Top Resize Handle */}
              <div 
                className="absolute top-0 inset-x-0 h-2 cursor-ns-resize opacity-0 group-hover/event:opacity-100 flex justify-center items-start z-30"
                onMouseDown={(e) => handleResizeStart(e, event.id, 'top')}
              >
                <div
                  className={cn("w-8 h-1 rounded-full mt-0.5", !hexColor && colorCfg.bg)}
                  style={hexColor ? { backgroundColor: hexColor } : undefined}
                />
              </div>

              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-[10px] font-mono font-bold opacity-60 shrink-0">{event.time}</span>
                    <input 
                      type="text"
                      value={event.title}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const newEvents = events.map(ev => ev.id === event.id ? { ...ev, title: e.target.value } : ev);
                        onUpdate({ ...timeline!, events: newEvents });
                      }}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm p-0 font-bold text-slate-800 dark:text-slate-100 truncate"
                    />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover/event:opacity-100 transition-opacity shrink-0">
                    {!isSleepLikeType(event.type) && COLORS.map(c => (
                      <button
                        key={c.value}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => updateEventColor(event.id, c.value)}
                        className={cn(
                          "w-3 h-3 rounded-full border border-white dark:border-slate-900 transition-transform hover:scale-125",
                          c.bg,
                          event.color === c.value && "ring-1 ring-offset-1 ring-slate-400"
                        )}
                        title={c.name}
                      />
                    ))}
                    <button 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => deleteEvent(event.id)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {event.duration && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-white/50 dark:bg-black/20 rounded-full font-bold whitespace-nowrap">
                      {event.duration >= 60 ? `${Math.floor(event.duration / 60)}h ` : ''}
                      {event.duration % 60 > 0 ? `${event.duration % 60}m` : ''}
                    </span>
                  )}
                </div>

                {isWorkBlock && event.id === firstWorkBlockEventId &&
                  (workBlockDoneTasks.length > 0 || (event.notes || '').trim().length > 0) && (
                  <div className="mt-1 pt-1.5 border-t border-slate-300/40 dark:border-slate-600/40 min-h-0 max-h-[160px] overflow-y-auto">
                    {workBlockDoneTasks.map((t) => (
                      <div
                        key={t.id}
                        className="text-[11px] font-normal text-slate-600 dark:text-slate-400 leading-snug py-0.5"
                      >
                        {t.title}
                      </div>
                    ))}
                    {(event.notes || '')
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .map((line, i) => (
                        <div
                          key={`work-note-${i}-${line.slice(0, 24)}`}
                          className="text-[11px] font-normal text-slate-600 dark:text-slate-400 leading-snug py-0.5"
                        >
                          {line}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Bottom Resize Handle */}
              <div 
                className="absolute bottom-0 inset-x-0 h-2 cursor-ns-resize opacity-0 group-hover/event:opacity-100 flex justify-center items-end z-30"
                onMouseDown={(e) => handleResizeStart(e, event.id, 'bottom')}
              >
                <div className={cn("w-8 h-1 rounded-full mb-0.5", colorCfg.bg)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
