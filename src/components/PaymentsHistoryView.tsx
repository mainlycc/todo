import React, { useMemo, useState } from 'react';
import { format, startOfMonth, subMonths } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Check, ChevronRight, Edit2, X } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Payment, PaymentMonthOverride } from '../types';
import { cn } from '../utils';

type SeriesKey = 'predicted' | 'realized';
type AmountKind = 'gross' | 'net';

interface PaymentsHistoryViewProps {
  payments: Payment[];
  overrides: PaymentMonthOverride[];
  onUpsertOverride: (month: string, net_total_override: number, gross_total_override: number) => Promise<void> | void;
}

function monthKeyFromDate(date: Date) {
  return format(date, 'yyyy-MM');
}

function formatMonthLabel(monthKey: string) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return format(d, 'MMM yy', { locale: pl });
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

export function PaymentsHistoryView({ payments, overrides, onUpsertOverride }: PaymentsHistoryViewProps) {
  const [showPredicted, setShowPredicted] = useState(true);
  const [showRealized, setShowRealized] = useState(true);
  const [amountKind, setAmountKind] = useState<AmountKind>('gross');

  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editNet, setEditNet] = useState('');
  const [editGross, setEditGross] = useState('');
  const [confirmMonth, setConfirmMonth] = useState<string | null>(null);

  const monthKeys = useMemo(() => {
    const start = startOfMonth(new Date());
    const keys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      keys.push(monthKeyFromDate(subMonths(start, i)));
    }
    return keys;
  }, []);

  const overridesByMonth = useMemo(() => {
    const map = new Map<string, PaymentMonthOverride>();
    for (const o of overrides) map.set(o.month, o);
    return map;
  }, [overrides]);

  const baseAgg = useMemo(() => {
    const predicted = new Map<string, { net: number; gross: number }>();
    const realized = new Map<string, { net: number; gross: number }>();
    for (const k of monthKeys) {
      predicted.set(k, { net: 0, gross: 0 });
      realized.set(k, { net: 0, gross: 0 });
    }

    for (const p of payments) {
      const k = p.date.slice(0, 7);
      if (!predicted.has(k)) continue;
      const pred = predicted.get(k)!;
      pred.net += p.net_amount;
      pred.gross += p.gross_amount;
      if (p.is_realized) {
        const rea = realized.get(k)!;
        rea.net += p.net_amount;
        rea.gross += p.gross_amount;
      }
    }

    return { predicted, realized };
  }, [payments, monthKeys]);

  const rows = useMemo(() => {
    return monthKeys.map((k) => {
      const pred = baseAgg.predicted.get(k)!;
      const rea = baseAgg.realized.get(k)!;
      const ov = overridesByMonth.get(k);

      const predictedNet = ov ? ov.net_total_override : pred.net;
      const predictedGross = ov ? ov.gross_total_override : pred.gross;

      return {
        monthKey: k,
        label: formatMonthLabel(k),
        predicted_net: predictedNet,
        predicted_gross: predictedGross,
        realized_net: rea.net,
        realized_gross: rea.gross,
        hasOverride: Boolean(ov),
      };
    });
  }, [monthKeys, baseAgg, overridesByMonth]);

  const chartData = useMemo(() => {
    return rows.map((r) => ({
      label: r.label,
      monthKey: r.monthKey,
      predicted: amountKind === 'gross' ? r.predicted_gross : r.predicted_net,
      realized: amountKind === 'gross' ? r.realized_gross : r.realized_net,
    }));
  }, [rows, amountKind]);

  const startEdit = (month: string) => {
    const row = rows.find(r => r.monthKey === month);
    if (!row) return;
    setEditingMonth(month);
    setConfirmMonth(null);
    setEditNet(String(row.predicted_net.toFixed(2)));
    setEditGross(String(row.predicted_gross.toFixed(2)));
  };

  const cancelEdit = () => {
    setEditingMonth(null);
    setConfirmMonth(null);
    setEditNet('');
    setEditGross('');
  };

  const requestConfirmSave = () => {
    if (!editingMonth) return;
    setConfirmMonth(editingMonth);
  };

  const confirmSave = async () => {
    if (!confirmMonth) return;
    const net = Number(editNet);
    const gross = Number(editGross);
    if (!Number.isFinite(net) || !Number.isFinite(gross)) {
      alert('Wpisz poprawne kwoty (netto i brutto).');
      return;
    }
    await onUpsertOverride(confirmMonth, net, gross);
    cancelEdit();
  };

  const getMonthTitle = (monthKey: string) => {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, (m || 1) - 1, 1);
    return format(d, 'LLLL yyyy', { locale: pl });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Historia przychodów (ostatnie 12 miesięcy)</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Przełącz serie i porównaj przewidywane vs zrealizowane.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setAmountKind('gross')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-colors",
                    amountKind === 'gross'
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  Brutto
                </button>
                <button
                  type="button"
                  onClick={() => setAmountKind('net')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-colors",
                    amountKind === 'net'
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  Netto
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                <input type="checkbox" className="w-4 h-4" checked={showPredicted} onChange={() => setShowPredicted(v => !v)} />
                <span className="text-slate-700 dark:text-slate-200">Przewidywane</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                <input type="checkbox" className="w-4 h-4" checked={showRealized} onChange={() => setShowRealized(v => !v)} />
                <span className="text-slate-700 dark:text-slate-200">Zrealizowane</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-5 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v: any, name: any) => [formatMoney(Number(v)), name === 'predicted' ? 'Przewidywane' : 'Zrealizowane']}
              />
              <Legend
                formatter={(value: any) => (value === 'predicted' ? 'Przewidywane' : value === 'realized' ? 'Zrealizowane' : value)}
              />
              {showPredicted && <Line type="monotone" dataKey="predicted" stroke="#6366f1" strokeWidth={2.5} dot={false} />}
              {showRealized && <Line type="monotone" dataKey="realized" stroke="#10b981" strokeWidth={2.5} dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Miesiące (override sumy)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Override nadpisuje serię „Przewidywane” dla miesiąca.</p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => {
            const isEditing = editingMonth === r.monthKey;
            return (
              <div key={r.monthKey} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-base font-semibold text-slate-900 dark:text-white capitalize">
                      {getMonthTitle(r.monthKey)}
                    </div>
                    {r.hasOverride && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">
                        override
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      <span className="font-semibold text-indigo-700 dark:text-indigo-300">Przewidywane:</span>{' '}
                      {amountKind === 'gross' ? `${formatMoney(r.predicted_gross)} brutto` : `${formatMoney(r.predicted_net)} netto`}
                    </span>
                    <span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">Zrealizowane:</span>{' '}
                      {amountKind === 'gross' ? `${formatMoney(r.realized_gross)} brutto` : `${formatMoney(r.realized_net)} netto`}
                    </span>
                  </div>
                </div>

                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => startEdit(r.monthKey)}
                    className="self-start md:self-center inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-semibold"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edytuj override
                    <ChevronRight className="w-4 h-4 opacity-60" />
                  </button>
                ) : (
                  <div className="w-full md:w-auto flex flex-col md:flex-row gap-2 md:items-end">
                    <div className="flex gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          Netto
                        </label>
                        <input
                          value={editNet}
                          onChange={(e) => setEditNet(e.target.value)}
                          inputMode="decimal"
                          className="w-36 text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          Brutto
                        </label>
                        <input
                          value={editGross}
                          onChange={(e) => setEditGross(e.target.value)}
                          inputMode="decimal"
                          className="w-36 text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-xs font-semibold"
                      >
                        <X className="w-4 h-4" />
                        Anuluj
                      </button>
                      <button
                        type="button"
                        onClick={requestConfirmSave}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white transition-colors text-xs font-semibold shadow-sm"
                      >
                        <Check className="w-4 h-4" />
                        Zapisz
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {confirmMonth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setConfirmMonth(null)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="text-lg font-bold text-slate-900 dark:text-white">Potwierdź zmianę</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Na pewno chcesz nadpisać sumy dla <span className="font-semibold text-slate-800 dark:text-slate-200">{getMonthTitle(confirmMonth)}</span>?
              </div>
            </div>
            <div className="p-5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Zostanie zapisane: <span className="font-semibold">{editNet}</span> netto / <span className="font-semibold">{editGross}</span> brutto
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmMonth(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={confirmSave}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl font-semibold transition-colors shadow-sm"
                >
                  Tak, zapisz
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

