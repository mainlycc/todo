import { ArrowLeft, Play, Pause, RotateCcw, CheckCircle2, Circle, Plus, Minus, Trash2 } from 'lucide-react';
import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Task } from '../types';
import { cn } from '../utils';

interface FocusModeProps {
  task: Task;
  onBack: () => void;
  onUpdateTask: (task: Task) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
}

type TimerMode = 'work' | 'break';
const WORK_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

export function FocusMode({ 
  task, 
  onBack, 
  onUpdateTask,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask
}: FocusModeProps) {
  const [timeLeft, setTimeLeft] = useState(WORK_TIME);
  const [isActive, setIsActive] = useState(false);
  const [timerMode, setTimerMode] = useState<TimerMode>('work');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [localNotes, setLocalNotes] = useState(task.notes || '');
  const metricCount = task.metric_kind ? (task.metric_count ?? 0) : null;
  const metricLabel =
    task.metric_kind === 'cv_sent'
      ? 'Wysłane CV'
      : task.metric_kind === 'client_inquiry_sent'
        ? 'Wysłane zapytania'
        : 'Licznik';

  useEffect(() => {
    setLocalNotes(task.notes || '');
  }, [task.notes]);

  useEffect(() => {
    let interval: number | undefined;

    if (isActive && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      setIsActive(false);
      if (timerMode === 'work') {
        const currentPomodoros = task.pomodoros_completed || 0;
        onUpdateTask({ ...task, pomodoros_completed: currentPomodoros + 1 });
        setTimerMode('break');
        setTimeLeft(BREAK_TIME);
      } else {
        setTimerMode('work');
        setTimeLeft(WORK_TIME);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, timerMode, task, onUpdateTask]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(timerMode === 'work' ? WORK_TIME : BREAK_TIME);
  };

  const switchMode = (mode: TimerMode) => {
    setIsActive(false);
    setTimerMode(mode);
    setTimeLeft(mode === 'work' ? WORK_TIME : BREAK_TIME);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNotesChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setLocalNotes(e.target.value);
  };

  const handleNotesBlur = () => {
    if (localNotes !== (task.notes || '')) {
      onUpdateTask({ ...task, notes: localNotes });
    }
  };

  const handleAddSubtask = (e: FormEvent) => {
    e.preventDefault();
    if (newSubtaskTitle.trim()) {
      onAddSubtask(task.id, newSubtaskTitle.trim());
      setNewSubtaskTitle('');
    }
  };

  const handleToggleSubtaskLocal = (subtaskId: string) => {
    onToggleSubtask(task.id, subtaskId);
  };

  const handleDeleteSubtaskLocal = (subtaskId: string) => {
    onDeleteSubtask(task.id, subtaskId);
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 bg-white dark:bg-tp-surface rounded-xl border border-slate-200 dark:border-white/6 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-tp-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white truncate flex-grow">
          {task.title}
        </h2>
        {task.metric_kind && (
          <div className="flex items-center gap-3 bg-white dark:bg-tp-surface px-4 py-2 rounded-xl border border-slate-200 dark:border-white/6">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {metricLabel}:
            </span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
              {metricCount}
            </span>
            <button
              type="button"
              onClick={() => {
                const current = task.metric_count ?? 0;
                onUpdateTask({ ...task, metric_count: Math.max(0, current - 1) });
              }}
              disabled={(task.metric_count ?? 0) <= 0}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-tp-muted text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-200 dark:hover:bg-tp-raised transition-colors active:scale-95 disabled:opacity-40 disabled:hover:bg-slate-100 dark:disabled:hover:bg-tp-muted"
              title="Odejmij -1"
              aria-label="Zmniejsz licznik"
            >
              <Minus className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const current = task.metric_count ?? 0;
                onUpdateTask({ ...task, metric_count: current + 1 });
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors active:scale-95"
              title="Dodaj +1"
              aria-label="Zwiększ licznik"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-white dark:bg-tp-surface px-4 py-2 rounded-xl border border-slate-200 dark:border-white/6">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Ukończone Pomodoro:</span>
          <span className="text-lg font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
            🍅 {task.pomodoros_completed || 0}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Timer & Notes */}
        <div className="flex flex-col gap-6">
          {/* Pomodoro Timer */}
          <div className="bg-white dark:bg-tp-surface rounded-3xl border border-slate-200 dark:border-white/6 p-8 flex flex-col items-center justify-center shadow-sm transition-colors">
            <div className="flex gap-2 mb-8 bg-slate-100 dark:bg-tp-muted p-1 rounded-xl">
              <button
                onClick={() => switchMode('work')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  timerMode === 'work' ? "bg-white dark:bg-tp-raised text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                )}
              >
                Praca (25m)
              </button>
              <button
                onClick={() => switchMode('break')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  timerMode === 'break' ? "bg-white dark:bg-tp-raised text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                )}
              >
                Przerwa (5m)
              </button>
            </div>

            <div className={cn(
              "text-8xl font-black tracking-tighter mb-8 tabular-nums transition-colors",
              timerMode === 'work' ? "text-slate-900 dark:text-white" : "text-emerald-600 dark:text-emerald-400"
            )}>
              {formatTime(timeLeft)}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={toggleTimer}
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95",
                  isActive ? "bg-amber-500 hover:bg-amber-600" : "bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600"
                )}
              >
                {isActive ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>
              <button
                onClick={resetTimer}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-100 dark:bg-tp-muted text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-tp-raised transition-colors"
                title="Resetuj stoper"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white dark:bg-tp-surface rounded-3xl border border-slate-200 dark:border-white/6 p-6 flex-grow flex flex-col shadow-sm transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Notatki</h3>
            <textarea
              value={localNotes}
              onChange={handleNotesChange}
              onBlur={handleNotesBlur}
              placeholder="Zapisz swoje przemyślenia, linki lub ważne informacje dotyczące tego zadania..."
              className="flex-grow w-full resize-none bg-slate-50 dark:bg-tp-muted border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Right Column: Subtasks */}
        <div className="bg-white dark:bg-tp-surface rounded-3xl border border-slate-200 dark:border-white/6 p-6 flex flex-col shadow-sm transition-colors">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Podzadania</h3>
          
          <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mb-6">
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="Dodaj nowy krok..."
              className="flex-grow bg-slate-50 dark:bg-tp-muted border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={!newSubtaskTitle.trim()}
              className="bg-indigo-600 dark:bg-indigo-500 text-white p-3 rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>

          <div className="flex-grow pr-2 space-y-2 max-h-[400px] overflow-y-auto">
            {task.subtasks.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                Brak podzadań. Rozbij zadanie na mniejsze kroki!
              </div>
            ) : (
              task.subtasks.map(subtask => (
                <div key={subtask.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-tp-muted group border border-transparent hover:border-slate-100 dark:hover:border-white/10 transition-colors">
                  <button
                    onClick={() => handleToggleSubtaskLocal(subtask.id)}
                    className="text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-shrink-0"
                  >
                    {subtask.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </button>
                  <span className={cn(
                    "text-sm flex-grow",
                    subtask.completed ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-700 dark:text-slate-300 font-medium"
                  )}>
                    {subtask.title}
                  </span>
                  <button
                    onClick={() => handleDeleteSubtaskLocal(subtask.id)}
                    className="text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
