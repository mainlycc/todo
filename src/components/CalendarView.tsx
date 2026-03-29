import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Task } from '../types';
import { cn } from '../utils';
import { DailyNotePanel } from './DailyNotePanel';

interface CalendarViewProps {
  tasks: Task[];
  dailyNotes: Record<string, string>;
  onSaveDailyNote: (date: string, content: string) => void;
}

export function CalendarView({ tasks, dailyNotes, onSaveDailyNote }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const completedTasksForSelected = selectedDate 
    ? tasks.filter(t => t.date === format(selectedDate, 'yyyy-MM-dd') && t.completed)
    : [];

  return (
    <div className="flex gap-6 h-full">
      <div className="w-1/2 flex flex-col gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: pl })}
          </h2>
          <div className="flex gap-2">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-600 dark:text-slate-400">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-600 dark:text-slate-400">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 py-2">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayTasks = tasks.filter(t => t.date === dateStr && t.completed);
            const hasNote = !!dailyNotes[dateStr];
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, monthStart);
            
            return (
              <button
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all relative",
                  !isCurrentMonth && "text-slate-300 dark:text-slate-700",
                  isCurrentMonth && !isSelected && "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300",
                  isSelected && "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none font-bold"
                )}
              >
                <span>{format(day, dateFormat)}</span>
                <div className="absolute bottom-1.5 flex gap-1">
                  {dayTasks.length > 0 && (
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      isSelected ? "bg-white" : "bg-emerald-500 dark:bg-emerald-400"
                    )} />
                  )}
                  {hasNote && (
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      isSelected ? "bg-white" : "bg-indigo-500 dark:bg-indigo-400"
                    )} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex-grow overflow-hidden flex flex-col transition-colors">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          Zrobione {selectedDate ? format(selectedDate, 'd MMMM', { locale: pl }) : ''}
        </h3>
        
        <div className="flex-grow overflow-y-auto pr-2 space-y-2">
          {!selectedDate ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">Wybierz dzień z kalendarza.</p>
          ) : completedTasksForSelected.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">Brak ukończonych zadań w tym dniu.</p>
          ) : (
            completedTasksForSelected.map(task => (
              <div key={task.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
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
      </div>
      </div>
      <div className="w-1/2">
        {selectedDate && (
          <DailyNotePanel
            date={format(selectedDate, 'yyyy-MM-dd')}
            content={dailyNotes[format(selectedDate, 'yyyy-MM-dd')] || ''}
            onChange={onSaveDailyNote}
          />
        )}
      </div>
    </div>
  );
}
