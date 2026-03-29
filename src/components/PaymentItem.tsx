import { CheckCircle2, Circle, Trash2, Calendar } from 'lucide-react';
import { Payment } from '../types';
import { cn } from '../utils';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface PaymentItemProps {
  key?: string | number;
  payment: Payment;
  onToggleRealized: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PaymentItem({ payment, onToggleRealized, onDelete }: PaymentItemProps) {
  return (
    <div className={cn(
      "bg-white dark:bg-slate-900 rounded-2xl border p-4 flex items-center gap-4 transition-all",
      payment.is_realized 
        ? "border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10 opacity-75" 
        : "border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md dark:shadow-none"
    )}>
      <button
        onClick={() => onToggleRealized(payment.id)}
        className={cn(
          "flex-shrink-0 transition-colors",
          payment.is_realized ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
        )}
        title={payment.is_realized ? "Oznacz jako nie zrealizowane" : "Oznacz jako zrealizowane"}
      >
        {payment.is_realized ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
      </button>

      <div className="flex-grow min-w-0">
        <h3 className={cn(
          "text-base font-medium",
          payment.is_realized ? "text-slate-600 dark:text-slate-400 line-through" : "text-slate-900 dark:text-slate-100"
        )}>
          {payment.title}
        </h3>
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>{format(new Date(payment.date), 'd MMMM yyyy', { locale: pl })}</span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className={cn(
          "text-sm font-bold",
          payment.is_realized ? "text-emerald-700 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"
        )}>
          {payment.net_amount.toFixed(2)} zł <span className="text-xs font-normal text-slate-500 dark:text-slate-400">netto</span>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {payment.gross_amount.toFixed(2)} zł brutto
        </div>
      </div>

      <button
        onClick={() => onDelete(payment.id)}
        className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors ml-2"
        title="Usuń wpłatę"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}
