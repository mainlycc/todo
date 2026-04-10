import { ChevronDown, ChevronRight, GripVertical, Play, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { Priority, Project, Task } from '../../types';
import { cn } from '../../utils';

export interface MinimalTaskItemProps {
  task: Task;
  projects?: Project[];
  onToggleComplete: (id: string) => Promise<void> | void;
  onUpdateTask: (task: Task) => Promise<void> | void;
  onAddSubtask: (taskId: string, title: string) => Promise<void> | void;
  onToggleSubtask: (taskId: string, subtaskId: string) => Promise<void> | void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => Promise<void> | void;
  onFocus: (id: string) => void;
  onOpenProject?: (projectId: string) => void;
  collapseSignal?: number;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

export const MinimalTaskItem: React.FC<MinimalTaskItemProps> = ({
  task,
  projects,
  onToggleComplete,
  onUpdateTask,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onFocus,
  onOpenProject,
  collapseSignal,
  dragHandleProps,
  isDragging,
}) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.notes || '');
  const [isExpanded, setIsExpanded] = useState(!!task.notes || (task.subtasks && task.subtasks.length > 0));
  const [newSubtask, setNewSubtask] = useState('');

  const project = projects?.find(p => p.id === task.project_id);
  const projectColor = project?.color;
  const matchedProject =
    project ??
    projects?.find(
      pr =>
        !!task.project_title &&
        pr.title.toLowerCase() === task.project_title.trim().toLowerCase()
    );

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.notes || '');
  }, [task.title, task.notes]);

  useEffect(() => {
    if (collapseSignal === undefined) return;
    setIsExpanded(false);
  }, [collapseSignal]);

  const handleSetPriority = (p: Priority) => {
    if (p === task.priority) return;
    onUpdateTask({ ...task, priority: p });
  };

  const priorityLevel: 1 | 2 | 3 =
    task.priority === 'low' ? 1 : task.priority === 'medium' ? 2 : 3;
  const litColorClass =
    priorityLevel === 1
      ? 'bg-blue-500 dark:bg-tp-accent'
      : priorityLevel === 2
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-rose-500 dark:bg-rose-400';

  const handleBlur = () => {
    if (title.trim() !== task.title && title.trim() !== '') {
      onUpdateTask({ ...task, title: title.trim() });
    } else {
      setTitle(task.title);
    }
  };

  const handleDescriptionBlur = () => {
    if (description.trim() !== (task.notes || '')) {
      onUpdateTask({ ...task, notes: description.trim() });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setTitle(task.title);
      e.currentTarget.blur();
    }
  };

  const handleAddSubtask = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newSubtask.trim()) {
      onAddSubtask(task.id, newSubtask.trim());
      setNewSubtask('');
    }
  };

  return (
    <div
      className={cn(
        'py-2 border-b border-slate-100 dark:border-white/6/50 last:border-0',
        isDragging && 'opacity-50'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggleComplete(task.id)}
          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            'text-base flex-1 bg-transparent border-none focus:ring-0 p-0 m-0 focus:outline-none',
            task.completed
              ? 'line-through text-slate-400 dark:text-slate-500'
              : 'text-slate-800 dark:text-slate-200'
          )}
        />
        {task.project_title ? (
          matchedProject && onOpenProject && !task.completed ? (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onOpenProject(matchedProject.id);
              }}
              title={`Otwórz projekt: ${task.project_title}`}
              className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0 ml-1.5 inline-flex items-center gap-0.5 cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              style={{
                backgroundColor: projectColor ? `${projectColor}15` : 'transparent',
                color: projectColor || 'inherit',
                borderColor: projectColor ? `${projectColor}30` : 'transparent',
              }}
            >
              {matchedProject?.emoji ? matchedProject.emoji : null}
              {task.project_title}
            </button>
          ) : (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0 ml-1.5 inline-flex items-center gap-0.5"
              style={{
                backgroundColor: projectColor ? `${projectColor}15` : 'transparent',
                color: projectColor || 'inherit',
                borderColor: projectColor ? `${projectColor}30` : 'transparent',
              }}
            >
              {matchedProject?.emoji ? matchedProject.emoji : null}
              {task.project_title}
            </span>
          )
        ) : task.category ? (
          matchedProject && onOpenProject && !task.completed ? (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onOpenProject(matchedProject.id);
              }}
              title={`Otwórz projekt: ${task.category}`}
              className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0 ml-1.5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-tp-muted/60 cursor-pointer hover:bg-slate-100 dark:hover:bg-tp-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {task.category}
            </button>
          ) : (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0 ml-1.5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-tp-muted/60"
              title="Projekt"
            >
              {task.category}
            </span>
          )
        ) : null}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => handleSetPriority('low')}
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-colors',
              priorityLevel >= 1
                ? litColorClass
                : 'bg-slate-200 dark:bg-tp-raised hover:bg-slate-300 dark:hover:bg-neutral-600'
            )}
            title="Priorytet: luz (1 kropka)"
          />
          <button
            type="button"
            onClick={() => handleSetPriority('medium')}
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-colors',
              priorityLevel >= 2
                ? litColorClass
                : 'bg-slate-200 dark:bg-tp-raised hover:bg-slate-300 dark:hover:bg-neutral-600'
            )}
            title="Priorytet: ważne (2 kropki)"
          />
          <button
            type="button"
            onClick={() => handleSetPriority('high')}
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-colors',
              priorityLevel >= 3
                ? litColorClass
                : 'bg-slate-200 dark:bg-tp-raised hover:bg-slate-300 dark:hover:bg-neutral-600'
            )}
            title="Priorytet: turbo pilne (3 kropki)"
          />
        </div>
        <button
          onClick={() => onFocus(task.id)}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
          title="Tryb skupienia"
        >
          <Play className="w-4 h-4" />
        </button>
      </div>
      {isExpanded && (
        <div className="ml-11 mt-2 space-y-2">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Dodaj opis..."
            className="w-full text-sm bg-transparent border-none focus:ring-0 p-0 m-0 text-slate-500 dark:text-slate-400 resize-none focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
            rows={description ? Math.max(2, description.split('\n').length) : 1}
          />
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {task.subtasks.map(subtask => (
                <div key={subtask.id} className="flex items-center gap-2 group">
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() => onToggleSubtask(task.id, subtask.id)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span
                    className={cn(
                      'text-sm flex-1',
                      subtask.completed
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {subtask.title}
                  </span>
                  <button
                    onClick={() => onDeleteSubtask(task.id, subtask.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            type="text"
            value={newSubtask}
            onChange={e => setNewSubtask(e.target.value)}
            onKeyDown={handleAddSubtask}
            placeholder="Dodaj podzadanie (Enter)"
            className="w-full text-sm bg-transparent border-none focus:ring-0 p-0 m-0 text-slate-600 dark:text-slate-300 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 mt-1"
          />
        </div>
      )}
    </div>
  );
};
