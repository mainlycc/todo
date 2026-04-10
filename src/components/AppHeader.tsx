import { addMonths, format, subMonths } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, List, Moon, Sun } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import type { ViewMode } from '../types';
import { cn } from '../utils';

const viewTitles: Record<ViewMode, string> = {
  tasks: 'Zadania',
  calendar: 'Kalendarz',
  expected_payments: 'Przewidywana Wpłata',
  payments_history: 'Historia wpłat',
  rules: 'Zasady',
  goals: 'Cele',
  projects: 'Projekty',
  focus: 'Tryb Skupienia',
};

export interface AppHeaderProps {
  view: ViewMode;
  isMinimalView: boolean;
  setIsMinimalView: (v: boolean) => void;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  paymentsMonth: Date;
  setPaymentsMonth: Dispatch<SetStateAction<Date>>;
  /** Widok tasks: skrót brutto zrealizowane / przewidywane */
  tasksHeaderGrossRealized: number;
  tasksHeaderGrossTotal: number;
  /** Widok expected_payments */
  expectedPaymentsCount: number;
  realizedThisMonthCount: number;
  sumNetTotal: number;
  sumGrossTotal: number;
  sumNetRealized: number;
  sumGrossRealized: number;
}

export function AppHeader({
  view,
  isMinimalView,
  setIsMinimalView,
  isDarkMode,
  setIsDarkMode,
  paymentsMonth,
  setPaymentsMonth,
  tasksHeaderGrossRealized,
  tasksHeaderGrossTotal,
  expectedPaymentsCount,
  realizedThisMonthCount,
  sumNetTotal,
  sumGrossTotal,
  sumNetRealized,
  sumGrossRealized,
}: AppHeaderProps) {
  return (
    <header className="bg-white dark:bg-tp-canvas border-b border-slate-200 dark:border-white/6 flex-shrink-0 transition-colors">
      <div className="px-8 h-16 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          {viewTitles[view]}
        </h1>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimalView(!isMinimalView)}
              className={cn(
                'p-2 rounded-xl transition-colors',
                isMinimalView
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                  : 'bg-slate-100 dark:bg-tp-muted text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-tp-raised'
              )}
              title={isMinimalView ? 'Widok standardowy' : 'Widok minimalistyczny'}
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-tp-muted text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-tp-raised transition-colors"
              title={isDarkMode ? 'Przełącz na tryb jasny' : 'Przełącz na tryb nocny'}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          {view === 'expected_payments' && (
            <div className="flex items-center gap-4 text-sm bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
              <div className="flex items-center gap-2 border-r border-indigo-200 dark:border-indigo-800 pr-4">
                <button
                  type="button"
                  onClick={() => setPaymentsMonth(prev => subMonths(prev, 1))}
                  className="p-1.5 rounded-lg text-indigo-700/80 dark:text-indigo-300/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                  title="Poprzedni miesiąc"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="font-semibold text-indigo-900 dark:text-indigo-300 capitalize">
                  {format(paymentsMonth, 'MMMM yyyy', { locale: pl })}
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentsMonth(prev => addMonths(prev, 1))}
                  className="p-1.5 rounded-lg text-indigo-700/80 dark:text-indigo-300/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                  title="Następny miesiąc"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-8">
                <div className="flex flex-col text-xs">
                  <span className="text-indigo-600/80 dark:text-indigo-400/80 font-medium uppercase tracking-tighter">
                    Przewidywane Razem ({expectedPaymentsCount}):
                  </span>
                  <span className="font-bold text-indigo-700 dark:text-indigo-300">
                    {sumNetTotal.toFixed(2)} <span className="font-normal opacity-70">netto</span> /{' '}
                    {sumGrossTotal.toFixed(2)} <span className="font-normal opacity-70">brutto</span>
                  </span>
                </div>
                <div className="flex flex-col text-xs">
                  <span className="text-blue-600/80 dark:text-tp-accent/80 font-medium uppercase tracking-tighter">
                    Zrealizowane ({realizedThisMonthCount}):
                  </span>
                  <span className="font-bold text-blue-700 dark:text-tp-accent">
                    {sumNetRealized.toFixed(2)} <span className="font-normal opacity-70">netto</span> /{' '}
                    {sumGrossRealized.toFixed(2)} <span className="font-normal opacity-70">brutto</span>
                  </span>
                </div>
              </div>
            </div>
          )}
          {view === 'tasks' && (
            <div className="flex flex-col items-end">
              <div className="text-xl font-bold text-slate-800 dark:text-slate-200 capitalize leading-none">
                {format(new Date(), 'EEEE, d MMMM', { locale: pl })}
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter mt-1">
                <span className="text-blue-600 dark:text-tp-accent">
                  {tasksHeaderGrossRealized.toFixed(2)}
                </span>
                <span className="text-slate-400">/</span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  {tasksHeaderGrossTotal.toFixed(2)}
                </span>
                <span className="text-slate-400 ml-0.5">brutto</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
