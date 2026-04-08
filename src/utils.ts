import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TaskColor } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TASK_COLORS = ['slate', 'blue', 'emerald', 'amber', 'rose', 'purple', 'indigo'] as const;
export type PredefinedColor = typeof TASK_COLORS[number];

export const isPredefinedColor = (color: string): color is PredefinedColor => {
  return TASK_COLORS.includes(color as any);
};

export const colorStyles: Record<PredefinedColor, { high: string, medium: string, low: string, badge: string, picker: string }> = {
  slate: {
    high: 'bg-slate-300 dark:bg-tp-raised border-slate-600 dark:border-white/20',
    medium: 'bg-slate-200 dark:bg-tp-muted border-slate-500 dark:border-white/15',
    low: 'bg-slate-100 dark:bg-tp-surface border-slate-400 dark:border-white/10',
    badge: 'bg-slate-200 dark:bg-tp-muted text-slate-800 dark:text-slate-200 border-slate-300 dark:border-white/10',
    picker: 'bg-slate-500',
  },
  blue: {
    high: 'bg-blue-300 dark:bg-blue-900/40 border-blue-600 dark:border-blue-500',
    medium: 'bg-blue-200 dark:bg-blue-900/30 border-blue-500 dark:border-blue-600',
    low: 'bg-blue-100 dark:bg-blue-900/20 border-blue-400 dark:border-blue-700',
    badge: 'bg-blue-200 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    picker: 'bg-blue-500',
  },
  emerald: {
    high: 'bg-emerald-300 dark:bg-emerald-900/40 border-emerald-600 dark:border-emerald-500',
    medium: 'bg-emerald-200 dark:bg-emerald-900/30 border-emerald-500 dark:border-emerald-600',
    low: 'bg-emerald-100 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-700',
    badge: 'bg-emerald-200 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
    picker: 'bg-emerald-500',
  },
  amber: {
    high: 'bg-amber-300 dark:bg-amber-900/40 border-amber-600 dark:border-amber-500',
    medium: 'bg-amber-200 dark:bg-amber-900/30 border-amber-500 dark:border-amber-600',
    low: 'bg-amber-100 dark:bg-amber-900/20 border-amber-400 dark:border-amber-700',
    badge: 'bg-amber-200 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700',
    picker: 'bg-amber-500',
  },
  rose: {
    high: 'bg-rose-300 dark:bg-rose-900/40 border-rose-600 dark:border-rose-500',
    medium: 'bg-rose-200 dark:bg-rose-900/30 border-rose-500 dark:border-rose-600',
    low: 'bg-rose-100 dark:bg-rose-900/20 border-rose-400 dark:border-rose-700',
    badge: 'bg-rose-200 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700',
    picker: 'bg-rose-500',
  },
  purple: {
    high: 'bg-purple-300 dark:bg-purple-900/40 border-purple-600 dark:border-purple-500',
    medium: 'bg-purple-200 dark:bg-purple-900/30 border-purple-500 dark:border-purple-600',
    low: 'bg-purple-100 dark:bg-purple-900/20 border-purple-400 dark:border-purple-700',
    badge: 'bg-purple-200 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700',
    picker: 'bg-purple-500',
  },
  indigo: {
    high: 'bg-indigo-300 dark:bg-indigo-900/40 border-indigo-600 dark:border-indigo-500',
    medium: 'bg-indigo-200 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-600',
    low: 'bg-indigo-100 dark:bg-indigo-900/20 border-indigo-400 dark:border-indigo-700',
    badge: 'bg-indigo-200 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700',
    picker: 'bg-indigo-500',
  }
};

export const getCategoryColor = (category: string): string => {
  if (!category) return 'slate';
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TASK_COLORS.length;
  return TASK_COLORS[index];
};

export function getTaskStyle(color: string, priority: 'low' | 'medium' | 'high', completed: boolean) {
  if (completed) return "border-slate-200 opacity-75 bg-slate-50";
  
  if (isPredefinedColor(color)) {
    return colorStyles[color][priority];
  }
  
  // Custom hex color handling
  // We'll use the hex color as the border and a very light version as background
  // For simplicity, we'll just use the hex color with opacity for background
  const opacity = priority === 'high' ? '0.3' : priority === 'medium' ? '0.2' : '0.1';
  return {
    style: {
      borderColor: color,
      backgroundColor: `${color}${Math.round(parseFloat(opacity) * 255).toString(16).padStart(2, '0')}`,
    }
  };
}
