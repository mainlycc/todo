import { useState, useEffect } from 'react';
import {
  CheckSquare,
  Wallet,
  Landmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Target,
  Briefcase,
  Users,
} from 'lucide-react';
import { ViewMode } from '../types';
import { cn } from '../utils';

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebarCollapsed') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isCollapsed));
  }, [isCollapsed]);

  const navItems = [
    { id: 'tasks', label: 'Zadania', icon: CheckSquare },
    { id: 'calendar', label: 'Kalendarz', icon: CalendarDays },
    { id: 'expected_payments', label: 'Przewidywana wpłata', icon: Wallet },
    { id: 'payments_history', label: 'Historia wpłat', icon: Landmark },
    { id: 'projects', label: 'Projekty', icon: Briefcase },
    { id: 'clients', label: 'Klienci', icon: Users },
    { id: 'goals', label: 'Cele', icon: Target },
    { id: 'rules', label: 'Zasady', icon: ShieldCheck },
  ] as const;

  return (
    <aside
      data-app-sidebar
      className={cn(
      "bg-slate-900 dark:bg-tp-sidebar text-slate-300 dark:text-neutral-400 flex flex-col h-full flex-shrink-0 transition-all duration-300 relative",
      isCollapsed ? "w-20" : "w-64"
    )}
    >
      <div className={cn("p-6 flex items-center h-20", isCollapsed ? "justify-center" : "justify-start")}>
        <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <CheckSquare className="w-6 h-6 text-tp-accent flex-shrink-0" />
          <h2 className={cn(
            "text-xl font-bold text-white transition-opacity duration-300",
            isCollapsed ? "opacity-0 w-0" : "opacity-100"
          )}>
            Mój Plan
          </h2>
        </div>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-2">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as ViewMode)}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center rounded-xl transition-all duration-300 text-sm font-medium overflow-hidden whitespace-nowrap",
                isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                isActive 
                  ? "bg-white/[0.08] text-white border border-white/[0.06]" 
                  : "text-neutral-400 hover:bg-white/[0.05] hover:text-white"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className={cn(
                "transition-opacity duration-300",
                isCollapsed ? "opacity-0 w-0" : "opacity-100"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 dark:border-white/6">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "flex items-center text-slate-400 hover:text-white transition-all duration-300 w-full rounded-xl hover:bg-slate-800 dark:hover:bg-tp-muted overflow-hidden whitespace-nowrap",
            isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
          )}
          title={isCollapsed ? "Rozwiń menu" : "Zwiń menu"}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5 flex-shrink-0" /> : <ChevronLeft className="w-5 h-5 flex-shrink-0" />}
          <span className={cn(
            "text-sm font-medium transition-opacity duration-300",
            isCollapsed ? "opacity-0 w-0" : "opacity-100"
          )}>
            Zwiń menu
          </span>
        </button>
      </div>
    </aside>
  );
}
