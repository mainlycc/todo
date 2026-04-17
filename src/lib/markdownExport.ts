import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { DayLog } from './dailyLog';
import { minutesToHumanText } from './dailyLog';
import { htmlToMarkdown } from './htmlToMarkdown';

const safeList = (items: Array<{ title: string }>) => {
  if (items.length === 0) return '- —\n';
  return items.map(i => `- ${i.title}`).join('\n') + '\n';
};

export function renderDayMarkdown(log: DayLog): string {
  const mdNote = htmlToMarkdown(log.noteHtml);
  const header = `# ${log.date} (${format(parseISO(log.date), 'EEEE', { locale: pl })})\n\n`;

  return (
    header +
    `data:\n` +
    `sen: ${minutesToHumanText(log.sleepMinutes)}\n` +
    `praca: ${minutesToHumanText(log.workMinutes)}\n` +
    `siłownia: ${log.gym ? 'tak' : 'nie'}\n\n` +
    `zadania zapisane na dzisiaj:\n` +
    safeList(log.plannedTasks) +
    `\n` +
    `zadania zrobione:\n` +
    safeList(log.doneTasks) +
    `\n` +
    `notatka dnia:\n` +
    (mdNote ? `${mdNote}\n` : '—\n')
  );
}

export function renderRangeMarkdown(args: {
  title: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  days: DayLog[];
}): string {
  const { title, from, to, days } = args;
  const header =
    `# ${title}\n\n` +
    `Zakres: ${from} → ${to}\n\n`;

  const body = days
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => {
      const mdNote = htmlToMarkdown(d.noteHtml);
      return (
        `## ${d.date} (${format(parseISO(d.date), 'EEEE', { locale: pl })})\n\n` +
        `data:\n` +
        `sen: ${minutesToHumanText(d.sleepMinutes)}\n` +
        `praca: ${minutesToHumanText(d.workMinutes)}\n` +
        `siłownia: ${d.gym ? 'tak' : 'nie'}\n\n` +
        `zadania zapisane na dzisiaj:\n` +
        safeList(d.plannedTasks) +
        `\n` +
        `zadania zrobione:\n` +
        safeList(d.doneTasks) +
        `\n` +
        `notatka dnia:\n` +
        (mdNote ? `${mdNote}\n` : '—\n')
      );
    })
    .join('\n');

  return header + body;
}

