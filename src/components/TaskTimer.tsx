import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Clock, X, Minus } from 'lucide-react';
import { Task } from '../types';
import { cn } from '../utils';

interface TaskTimerProps {
  task: Task;
  onStop: (elapsedSeconds: number) => void;
  onClose: () => void;
}

export const TaskTimer: React.FC<TaskTimerProps> = ({ task, onStop, onClose }) => {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    let interval: number | undefined;
    if (isActive) {
      interval = window.setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white p-3 rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform flex items-center gap-2" onClick={() => setIsMinimized(false)}>
        <Clock className="w-5 h-5 animate-pulse" />
        <span className="text-xs font-bold font-mono">{formatTime(seconds)}</span>
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
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-tp-muted rounded text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate mb-4">
        {task.title}
      </h4>

      <div className="text-4xl font-black text-slate-900 dark:text-white font-mono text-center mb-6 tabular-nums">
        {formatTime(seconds)}
      </div>

      <div className="flex gap-2">
        <button 
          onClick={() => setIsActive(!isActive)}
          className={cn(
            "flex-1 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors font-bold text-sm",
            isActive ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-indigo-600 text-white hover:bg-indigo-700"
          )}
        >
          {isActive ? <><Pause className="w-4 h-4" /> Pauza</> : <><Play className="w-4 h-4" /> Wznów</>}
        </button>
        <button 
          onClick={() => onStop(seconds)}
          className="px-4 py-2 bg-slate-100 dark:bg-tp-muted text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 rounded-xl transition-colors"
          title="Zatrzymaj i zapisz"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>
      </div>
    </div>
  );
};
