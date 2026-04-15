import type { Payment, Project } from '../types';
import { PaymentForm } from './PaymentForm';
import { PaymentItem } from './PaymentItem';

export interface ExpectedPaymentsViewProps {
  sortedPayments: Payment[];
  projects: Project[];
  onAddPayment: (
    title: string,
    date: string,
    net_amount: number,
    gross_amount: number,
    projectId: string | null,
    isRealized: boolean
  ) => void | Promise<void>;
  onTogglePaymentRealized: (id: string) => void | Promise<void>;
  onDeletePayment: (id: string) => void | Promise<void>;
}

export function ExpectedPaymentsView({
  sortedPayments,
  projects,
  onAddPayment,
  onTogglePaymentRealized,
  onDeletePayment,
}: ExpectedPaymentsViewProps) {
  return (
    <>
      <PaymentForm onAdd={onAddPayment} projects={projects} defaultIsRealized={false} allowSetRealized={false} />
      <div className="space-y-3 mt-6">
        {sortedPayments.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-tp-surface rounded-2xl border border-slate-200 dark:border-white/6 border-dashed">
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Brak przewidywanych wpłat w tym miesiącu.
            </p>
          </div>
        ) : (
          sortedPayments.map(payment => (
            <PaymentItem
              key={payment.id}
              payment={payment}
              projectTitle={
                payment.project_id
                  ? projects.find(p => p.id === payment.project_id)?.title || null
                  : null
              }
              projectColor={
                payment.project_id
                  ? projects.find(p => p.id === payment.project_id)?.color || null
                  : null
              }
              onToggleRealized={onTogglePaymentRealized}
              onDelete={onDeletePayment}
            />
          ))
        )}
      </div>
    </>
  );
}
