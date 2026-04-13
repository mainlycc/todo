import type { ReactNode } from 'react';
import { cn } from '../utils';

type RichText = { plain_text?: string }[];

function richTextToPlain(rich: RichText | undefined): string {
  if (!rich?.length) return '';
  return rich.map(t => t.plain_text ?? '').join('');
}

/** Mapowanie kolorów opcji Notion → chipy zbliżone do widoku tabeli Notion. */
export function notionOptionColorClasses(color: string | undefined): string {
  const c = (color ?? 'default').toLowerCase();
  const map: Record<string, string> = {
    default:
      'border border-slate-200/80 bg-slate-100 text-slate-800 dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-200',
    gray: 'border border-slate-300/60 bg-slate-200/80 text-slate-800 dark:border-slate-500/35 dark:bg-slate-500/20 dark:text-slate-200',
    brown:
      'border border-amber-800/25 bg-amber-200/90 text-amber-950 dark:border-amber-600/35 dark:bg-amber-900/35 dark:text-amber-100',
    orange:
      'border border-orange-400/40 bg-orange-200/80 text-orange-950 dark:border-orange-500/35 dark:bg-orange-500/20 dark:text-orange-100',
    yellow:
      'border border-yellow-400/45 bg-yellow-200/85 text-yellow-950 dark:border-yellow-500/35 dark:bg-yellow-500/15 dark:text-yellow-100',
    green:
      'border border-emerald-400/40 bg-emerald-200/80 text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/20 dark:text-emerald-100',
    blue: 'border border-blue-400/45 bg-blue-200/85 text-blue-950 dark:border-blue-500/40 dark:bg-blue-500/20 dark:text-blue-100',
    purple:
      'border border-violet-400/45 bg-violet-200/85 text-violet-950 dark:border-violet-500/40 dark:bg-violet-500/20 dark:text-violet-100',
    pink: 'border border-pink-400/45 bg-pink-200/85 text-pink-950 dark:border-pink-500/40 dark:bg-pink-500/20 dark:text-pink-100',
    red: 'border border-red-400/45 bg-red-200/85 text-red-950 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-100',
  };
  return cn(
    'inline-flex max-w-full items-center rounded px-2 py-0.5 text-xs font-medium leading-tight',
    map[c] ?? map.default
  );
}

function Chip({ name, color }: { name: string; color?: string }) {
  return <span className={notionOptionColorClasses(color)}>{name}</span>;
}

function isNettoColumn(key: string): boolean {
  return key === 'Ceny netto' || /^ceny\s*netto$/i.test(key.trim());
}

function isCurrencyStyleNumberColumn(key: string): boolean {
  if (isNettoColumn(key)) return true;
  return false;
}

function formatPln(n: number): string {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);
}

function formatPlainNumber(n: number): string {
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(n);
}

function readFormulaNumber(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = (raw as { formula?: { type?: string; number?: number | null } }).formula;
  if (f?.type === 'number' && f.number != null && !Number.isNaN(f.number)) return f.number;
  return null;
}

/** Jedna komórka tabeli — typy Notion + format jak w bazie „Obecni”. */
export function NotionClientPropertyCell({
  columnKey,
  raw,
}: {
  columnKey: string;
  raw: unknown;
}): ReactNode {
  if (raw == null || typeof raw !== 'object') {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }

  const prop = raw as { type?: string };

  switch (prop.type) {
    case 'status': {
      const s = (raw as { status?: { name?: string; color?: string } | null }).status;
      if (!s?.name) return <span className="text-slate-400 dark:text-slate-500">—</span>;
      return <Chip name={s.name} color={s.color} />;
    }
    case 'select': {
      const s = (raw as { select?: { name?: string; color?: string } | null }).select;
      if (!s?.name) return <span className="text-slate-400 dark:text-slate-500">—</span>;
      return <Chip name={s.name} color={s.color} />;
    }
    case 'multi_select': {
      const items = (raw as { multi_select?: { name?: string; color?: string }[] }).multi_select ?? [];
      if (!items.length) return <span className="text-slate-400 dark:text-slate-500">—</span>;
      return (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) =>
            item.name ? <Chip key={`${item.name}-${i}`} name={item.name} color={item.color} /> : null
          )}
        </div>
      );
    }
    case 'number': {
      const n = (raw as { number?: number | null }).number;
      if (n == null) return <span className="text-slate-400 dark:text-slate-500">—</span>;
      return (
        <span className="tabular-nums text-slate-800 dark:text-slate-200">
          {isCurrencyStyleNumberColumn(columnKey) ? formatPln(n) : formatPlainNumber(n)}
        </span>
      );
    }
    case 'formula': {
      const f = (raw as { formula?: { type?: string; string?: string; number?: number; boolean?: boolean } })
        .formula;
      if (!f?.type) return <span className="text-slate-400 dark:text-slate-500">—</span>;
      if (f.type === 'number' && f.number != null) {
        return (
          <span className="tabular-nums text-slate-800 dark:text-slate-200">
            {isCurrencyStyleNumberColumn(columnKey) ? formatPln(f.number) : formatPlainNumber(f.number)}
          </span>
        );
      }
      if (f.type === 'string' && f.string) {
        return <span className="text-slate-700 dark:text-slate-300">{f.string}</span>;
      }
      if (f.type === 'boolean') {
        return <span>{f.boolean ? 'Tak' : 'Nie'}</span>;
      }
      return <span className="text-slate-400 dark:text-slate-500">—</span>;
    }
    case 'rollup': {
      const r = (raw as { rollup?: { type?: string; number?: number | null; date?: unknown } }).rollup;
      if (r?.type === 'number' && r.number != null && !Number.isNaN(r.number)) {
        return (
          <span className="tabular-nums text-slate-800 dark:text-slate-200">
            {isCurrencyStyleNumberColumn(columnKey) ? formatPln(r.number) : formatPlainNumber(r.number)}
          </span>
        );
      }
      return <span className="text-slate-400 dark:text-slate-500">—</span>;
    }
    case 'rich_text': {
      const t = richTextToPlain((raw as { rich_text?: RichText }).rich_text);
      if (!t) return <span className="text-slate-400 dark:text-slate-500">—</span>;
      return <span className="text-slate-700 dark:text-slate-300">{t}</span>;
    }
    case 'title': {
      const t = richTextToPlain((raw as { title?: RichText }).title);
      if (!t) return <span className="text-slate-400 dark:text-slate-500">—</span>;
      return <span className="font-medium text-slate-900 dark:text-white">{t}</span>;
    }
    case 'date': {
      const d = (raw as { date?: { start?: string; end?: string } | null }).date;
      if (!d?.start) return <span className="text-slate-400 dark:text-slate-500">—</span>;
      const text = d.end ? `${d.start} → ${d.end}` : d.start;
      return <span className="text-slate-700 dark:text-slate-300">{text}</span>;
    }
    case 'checkbox': {
      return <span>{(raw as { checkbox?: boolean }).checkbox ? 'Tak' : 'Nie'}</span>;
    }
    case 'url': {
      const u = (raw as { url?: string | null }).url;
      if (!u) return <span className="text-slate-400 dark:text-slate-500">—</span>;
      return (
        <a href={u} className="text-violet-600 underline dark:text-violet-400" target="_blank" rel="noreferrer">
          link
        </a>
      );
    }
    default: {
      const n = readFormulaNumber(raw);
      if (n != null) {
        return (
          <span className="tabular-nums text-slate-800 dark:text-slate-200">
            {isCurrencyStyleNumberColumn(columnKey) ? formatPln(n) : formatPlainNumber(n)}
          </span>
        );
      }
      return <span className="text-slate-400 dark:text-slate-500">—</span>;
    }
  }
}
