import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ComponentProps } from 'react';
import React from 'react';
import { TaskItem } from '../TaskItem';
import { MinimalTaskItem } from './MinimalTaskItem';

export function DroppableContainer({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
}

type TaskItemOuterProps = Omit<ComponentProps<typeof TaskItem>, 'dragHandleProps' | 'isDragging'>;

export function SortableTaskItem(props: TaskItemOuterProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? ('relative' as const) : undefined,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

type MinimalOuterProps = Omit<
  ComponentProps<typeof MinimalTaskItem>,
  'dragHandleProps' | 'isDragging'
>;

export function SortableMinimalTaskItem(props: MinimalOuterProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? ('relative' as const) : undefined,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style}>
      <MinimalTaskItem
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}
