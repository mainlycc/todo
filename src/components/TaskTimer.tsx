import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, Clock, X, Minus } from 'lucide-react';
import { Task } from '../types';
import { cn } from '../utils';

interface TaskTimerProps {
  task: Task;
  onStop: (elapsedSeconds: number) => void;
  onClose: () => void;
}

const storageKey = (taskId: string) => `task_session_timer_${taskId}`;

type PersistedTimer = {
  accumulatedMs: number;
  /** Początek bieżącego segmentu „odliczania” (wall clock), null gdy pauza */
  segmentStartedAt: number | null;
  isActive: boolean;
};

function loadPersisted(taskId: string): PersistedTimer | null {
  try {
    const raw = localStorage.getItem(storageKey(taskId));
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedTimer;
    if (
      typeof p.accumulatedMs !== 'number' ||
      typeof p.isActive !== 'boolean' ||
      (p.segmentStartedAt !== null && typeof p.segmentStartedAt !== 'number')
    ) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

function savePersisted(taskId: string, p: PersistedTimer) {
  try {
    localStorage.setItem(storageKey(taskId), JSON.stringify(p));
  } catch {
    /* ignore quota */
  }
}

function clearPersisted(taskId: string) {
  try {
    localStorage.removeItem(storageKey(taskId));
  } catch {
    /* ignore */
  }
}

function getInitialTimerState(taskId: string): PersistedTimer {
  const s = loadPersisted(taskId);
  if (s) {
    const seg =
      s.isActive && typeof s.segmentStartedAt === 'number' ? s.segmentStartedAt : null;
    return {
      accumulatedMs: s.accumulatedMs,
      segmentStartedAt: s.isActive ? (seg ?? Date.now()) : null,
      isActive: s.isActive,
    };
  }
  return {
    accumulatedMs: 0,
    segmentStartedAt: Date.now(),
    isActive: true,
  };
}

export const TaskTimer: React.FC<TaskTimerProps> = ({ task, onStop, onClose }) => {
  const taskId = task.id;
  const initial = getInitialTimerState(taskId);
  const segmentStartedAtRef = useRef<number | null>(initial.segmentStartedAt);
  const [accumulatedMs, setAccumulatedMs] = useState(initial.accumulatedMs);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [tick, setTick] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  const getElapsedMs = useCallback(() => {
    const seg = segmentStartedAtRef.current;
    return accumulatedMs + (seg != null ? Date.now() - seg : 0);
  }, [accumulatedMs]);

  // Odświeżanie wyświetlacza: interwał + po powrocie do karty (setInterval w tle jest dławiony)
  useEffect(() => {
    if (!isActive || segmentStartedAtRef.current == null) return;
    const id = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    document.addEventListener('visibilitychange', bump);
    window.addEventListener('focus', bump);
    return () => {
      document.removeEventListener('visibilitychange', bump);
      window.removeEventListener('focus', bump);
    };
  }, []);

  const flushPersist = useCallback(() => {
    savePersisted(taskId, {
      accumulatedMs,
      segmentStartedAt: segmentStartedAtRef.current,
      isActive,
    });
  }, [taskId, accumulatedMs, isActive]);

  useEffect(() => {
    flushPersist();
  }, [flushPersist]);

  useEffect(() => {
    const id = window.setInterval(flushPersist, 5000);
    return () => clearInterval(id);
  }, [flushPersist]);

  useEffect(() => {
    const onHide = () => flushPersist();
    const onVis = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', onHide);
    };
  }, [flushPersist]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const displaySeconds = Math.floor(getElapsedMs() / 1000);

  const toggleActive = () => {
    if (isActive) {
      const seg = segmentStartedAtRef.current;
      if (seg != null) {
        setAccumulatedMs(a => a + Date.now() - seg);
      }
      segmentStartedAtRef.current = null;
      setIsActive(false);
    } else {
      segmentStartedAtRef.current = Date.now();
      setIsActive(true);
    }
    setTick(t => t + 1);
  };

  const handleStop = () => {
    const seg = segmentStartedAtRef.current;
    const ms = accumulatedMs + (seg != null ? Date.now() - seg : 0);
    clearPersisted(taskId);
    onStop(Math.floor(ms / 1000));
  };

  const handleClose = () => {
    clearPersisted(taskId);
    onClose();
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white p-3 rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform flex items-center gap-2" onClick={() => setIsMinimized(false)}>
        <Clock className="w-5 h-5 animate-pulse" />
        <span className="text-xs font-bold font-mono">{formatTime(displaySeconds)}</span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-64 bg-white dark:bg-tp-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-white/6 p-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <Clock className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Timer Zadania</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized(true)} className="p-1 hover:bg-slate-100 dark:hover:bg-tp-muted rounded text-slate-400">
            <Minus className="w-4 h-4" />
          </button>
          <button onClick={handleClose} className="p-1 hover:bg-slate-100 dark:hover:bg-tp-muted rounded text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate mb-4">
        {task.title}
      </h4>

      <div className="text-4xl font-black text-slate-900 dark:text-white font-mono text-center mb-6 tabular-nums">
        {formatTime(displaySeconds)}
      </div>

      <div className="flex gap-2">
        <button 
          onClick={toggleActive}
          className={cn(
            "flex-1 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors font-bold text-sm",
            isActive ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-indigo-600 text-white hover:bg-indigo-700"
          )}
        >
          {isActive ? <><Pause className="w-4 h-4" /> Pauza</> : <><Play className="w-4 h-4" /> Wznów</>}
        </button>
        <button 
          onClick={handleStop}
          className="px-4 py-2 bg-slate-100 dark:bg-tp-muted text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 rounded-xl transition-colors"
          title="Zatrzymaj i zapisz"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>
      </div>
    </div>
  );
};
