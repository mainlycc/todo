import { Plus, Calculator } from 'lucide-react';
import { useState, FormEvent, ChangeEvent } from 'react';
import { Project } from '../types';

interface PaymentFormProps {
  onAdd: (title: string, date: string, net_amount: number, gross_amount: number, projectId: string | null) => void;
  projects: Project[];
}

export function PaymentForm({ onAdd, projects }: PaymentFormProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [netAmount, setNetAmount] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [projectId, setProjectId] = useState<string>('');

  const handleNetChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNetAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setGrossAmount((num * 1.23).toFixed(2));
    } else {
      setGrossAmount('');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim() && date && netAmount && grossAmount) {
      onAdd(title.trim(), date, parseFloat(netAmount), parseFloat(grossAmount), projectId || null);
      setTitle('');
      setDate('');
      setNetAmount('');
      setGrossAmount('');
      setProjectId('');
    }
  };

  return (
    <div className="bg-white dark:bg-tp-surface rounded-2xl shadow-sm border border-slate-200 dark:border-white/6 overflow-hidden transition-colors">
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Tytuł wpłaty
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Faktura FV/03/2026"
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-tp-muted text-slate-900 dark:text-white"
              required
            />
          </div>
          <div className="w-full md:w-48">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Data
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-tp-muted text-slate-900 dark:text-white"
              required
            />
          </div>
          <div className="w-full md:w-56">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Projekt
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-tp-muted text-slate-900 dark:text-white"
            >
              <option value="">— brak —</option>
              {projects
                .filter(p => !p.completed)
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.emoji ? `${p.emoji} ` : ''}{p.title}
                  </option>
                ))}
            </select>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Kwota Netto (PLN)
            </label>
            <input
              type="number"
              step="0.01"
              value={netAmount}
              onChange={handleNetChange}
              placeholder="0.00"
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-tp-muted text-slate-900 dark:text-white"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Kwota Brutto (PLN)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-tp-muted text-slate-900 dark:text-white"
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" title="Obliczono automatycznie (23% VAT)">
                <Calculator className="w-4 h-4" />
              </div>
            </div>
          </div>
          <button
            type="submit"
            className="w-full md:w-auto bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Dodaj
          </button>
        </div>
      </form>
    </div>
  );
}
