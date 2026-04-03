import type { ProjectTurn } from '../types';
import { cn } from '../utils';

/** 👉 w stronę widza = Twoja kolej · 👆 kolej po stronie klienta */
export function ProjectTurnGlyph({
  turn,
  className,
  size = 'sm',
}: {
  turn: ProjectTurn;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}) {
  const isMine = turn === 'mine';
  const sizeCls =
    size === 'xs'
      ? 'text-[15px] leading-none min-w-[15px]'
      : size === 'sm'
        ? 'text-lg leading-none min-w-[1.125rem]'
        : 'text-2xl leading-none min-w-[1.5rem]';

  return (
    <span
      role="img"
      aria-label={isMine ? 'Twoja kolej' : 'Kolej klienta'}
      className={cn(
        'inline-flex items-center justify-center select-none',
        sizeCls,
        className
      )}
    >
      {isMine ? '👉' : '👆'}
    </span>
  );
}
