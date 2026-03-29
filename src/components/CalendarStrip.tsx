import { addDays, format, isSameDay, subDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '../utils';

interface CalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function CalendarStrip({ selectedDate, onSelectDate }: CalendarStripProps) {
  const days = Array.from({ length: 7 }).map((_, i) => subDays(selectedDate, 3 - i));

  return (
    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-x-auto gap-2 transition-colors">
      {days.map((day) => {
        const isSelected = isSameDay(day, selectedDate);
        const isToday = isSameDay(day, new Date());
        return (
          <button
            key={day.toISOString()}
            onClick={() => onSelectDate(day)}
            className={cn(
              "flex flex-col items-center justify-center min-w-[3.5rem] h-16 rounded-xl transition-all",
              isSelected
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400",
              isToday && !isSelected && "text-indigo-600 dark:text-indigo-400 font-semibold"
            )}
          >
            <span className="text-sm uppercase tracking-wider mb-1">
              {format(day, 'EEE', { locale: pl })}
            </span>
            <span className={cn("text-lg", isSelected ? "font-bold" : "font-medium")}>
              {format(day, 'd')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
