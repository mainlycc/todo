import React, { useState, useEffect } from 'react';
import { Sun, Moon, Plus, MoreVertical, Clock, CheckCircle2, Footprints, Dumbbell, Thermometer, Snowflake, Utensils, Trash2 } from 'lucide-react';
import { DailyTimeline as DailyTimelineData, DailyTimelineEvent } from '../types';
import { cn } from '../utils';

interface DailyTimelineProps {
  timeline: DailyTimelineData | null;
  onUpdate: (timeline: DailyTimelineData) => void;
}

const EVENT_TYPES = [
  { type: 'wake_up', label: 'Pobudka', icon: Sun, color: '#FBBF24' },
  { type: 'sleep', label: 'Sen', icon: Moon, color: '#3B82F6' },
  { type: 'check', label: 'Zrobione', icon: CheckCircle2, color: '#10B981' },
  { type: 'walk', label: 'Spacer', icon: Footprints, color: '#14B8A6' },
  { type: 'workout', label: 'Trening', icon: Dumbbell, color: '#6B7280' },
  { type: 'sauna', label: 'Sauna', icon: Thermometer, color: '#EF4444' },
  { type: 'shower', label: 'Zimny prysznic', icon: Snowflake, color: '#06B6D4' },
  { type: 'food', label: 'Posiłek/Suplementy', icon: Utensils, color: '#84CC16' },
];

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

export const DailyTimeline: React.FC<DailyTimelineProps> = ({ timeline, onUpdate }) => {
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

  const handleResizeStart = (e: React.MouseEvent, eventId: string, edge: 'top' | 'bottom') => {
    e.preventDefault();
    e.stopPropagation();
    setResizingEventId(eventId);
    setResizeEdge(edge);
  };

  const handleDragStart = (e: React.MouseEvent, eventId: string) => {
    if (resizingEventId) return;
    
    const event = events.find(ev => ev.id === eventId);
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
          newEvents[eventIndex] = { ...event, duration: newDuration };
        } else if (resizeEdge === 'top') {
          const endMinutes = startMinutes + currentDuration;
          const newStartMinutes = Math.min(totalMinutes, endMinutes - SNAP_MINUTES);
          const newDuration = endMinutes - newStartMinutes;
          
          const h = Math.floor(newStartMinutes / 60);
          const m = newStartMinutes % 60;
          
          newEvents[eventIndex] = { 
            ...event, 
            time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
            duration: newDuration 
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
            ev.id === draggingEventId ? { ...ev, time: timeStr } : ev
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

  const updateSleep = (time: string) => {
    const updatedTimeline: DailyTimelineData = timeline || {
      id: generateId(),
      user_id: '',
      date: '',
      wake_up_time: '',
      sleep_time: '',
      events: []
    };
    onUpdate({ ...updatedTimeline, sleep_time: time });
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
    const newEvents = timeline.events.map(e => 
      e.id === eventId ? { ...e, color } : e
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
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-5 h-5 text-indigo-500" />
        <h3 className="text-lg font-bold">Harmonogram Dnia</h3>
      </div>

      {/* Wake Up & Sleep Inputs */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-1 block">Pobudka</label>
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            <input 
              type="time" 
              value={timeline?.wake_up_time || ''} 
              onChange={(e) => updateWakeUp(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-lg font-medium w-full p-0 dark:text-white"
            />
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-1 block">Sen</label>
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-blue-500" />
            <input 
              type="time" 
              value={timeline?.sleep_time || ''} 
              onChange={(e) => updateSleep(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-lg font-medium w-full p-0 dark:text-white"
            />
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
        {events.map((event) => {
          const [h, m] = event.time.split(':').map(Number);
          const top = (h * ROW_HEIGHT) + (m * PIXELS_PER_MINUTE);
          const height = (event.duration || 60) * PIXELS_PER_MINUTE;
          const colorCfg = COLORS.find(c => c.value === event.color) || COLORS[0];

          return (
            <div 
              key={event.id}
              onMouseDown={(e) => handleDragStart(e, event.id)}
              className={cn(
                "absolute left-[68px] right-0 rounded-lg p-2 flex flex-col group/event border transition-shadow hover:shadow-md cursor-grab active:cursor-grabbing",
                colorCfg.bg.replace('bg-', 'bg-opacity-10 bg-'),
                colorCfg.border,
                colorCfg.darkBg,
                colorCfg.darkBorder,
                resizingEventId === event.id || draggingEventId === event.id ? "z-50 ring-2 ring-indigo-500 shadow-lg" : "z-20"
              )}
              style={{ 
                top: `${top + 2}px`,
                height: `${height - 4}px`,
              }}
            >
              {/* Top Resize Handle */}
              <div 
                className="absolute top-0 inset-x-0 h-2 cursor-ns-resize opacity-0 group-hover/event:opacity-100 flex justify-center items-start z-30"
                onMouseDown={(e) => handleResizeStart(e, event.id, 'top')}
              >
                <div className={cn("w-8 h-1 rounded-full mt-0.5", colorCfg.bg)} />
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
                    {COLORS.map(c => (
                      <button
                        key={c.value}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => updateEventColor(event.id, c.value)}
                        className={cn(
                          "w-3 h-3 rounded-full border border-white dark:border-slate-900 transition-transform hover:scale-125",
                          c.bg,
                          event.color === c.value && "ring-1 ring-offset-1 ring-slate-400"
                        )}
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
