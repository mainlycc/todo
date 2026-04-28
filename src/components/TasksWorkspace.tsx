import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useEffect, useState } from 'react';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Archive, Plus, X } from 'lucide-react';
import { QUICK_TODAY_PRESETS } from '../constants/quickTodayPresets';
import type { Priority, Project, Task, TaskColor } from '../types';
import { cn } from '../utils';
import { CalendarStrip } from './CalendarStrip';
import { TaskForm } from './TaskForm';
import {
  DroppableContainer,
  SortableMinimalTaskItem,
  SortableTaskItem,
} from './tasks/SortableTaskItems';

export interface TasksWorkspaceProps {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  isMinimalView: boolean;
  queueSortMode: 'priority' | 'manual';
  setQueueSortMode: (mode: 'priority' | 'manual') => void;
  todayTasks: Task[];
  queueTasks: Task[];
  projects: Project[];
  getGoalTitleForTask: (task: Task) => string | null;
  collapseAllTasksSignal: number;
  onCollapseAllTasks: () => void;
  onMoveToQueue: () => void;
  onAddTask: (
    title: string,
    priority: Priority,
    category: string,
    color: TaskColor,
    isRecurring: boolean,
    dueDate?: string
  ) => void | Promise<void>;
  onCreateProjectFromTaskForm: (title: string) => Promise<Project | null>;
  onToggleComplete: (id: string) => void | Promise<void>;
  onUpdateTask: (task: Task) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onDeleteSeries?: (templateId: string) => void | Promise<void>;
  onAddSubtask: (taskId: string, title: string) => void | Promise<void>;
  onToggleSubtask: (taskId: string, subtaskId: string) => void | Promise<void>;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void | Promise<void>;
  onFocusTask: (id: string) => void;
  onOpenProjectFromTask: (projectId: string) => void;
  getProjectForTask: (task: Task) => Project | undefined;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void | Promise<void>;
}

export function TasksWorkspace({
  selectedDate,
  onSelectDate,
  isMinimalView,
  queueSortMode,
  setQueueSortMode,
  todayTasks,
  queueTasks,
  projects,
  collapseAllTasksSignal,
  onCollapseAllTasks,
  onMoveToQueue,
  onAddTask,
  onCreateProjectFromTaskForm,
  onToggleComplete,
  onUpdateTask,
  onDelete,
  onDeleteSeries,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onFocusTask,
  onOpenProjectFromTask,
  getProjectForTask,
  getGoalTitleForTask,
  onDragOver,
  onDragEnd,
}: TasksWorkspaceProps) {
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [taskFormDialogKey, setTaskFormDialogKey] = useState(0);

  useEffect(() => {
    if (!addTaskDialogOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddTaskDialogOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addTaskDialogOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-6">
        <CalendarStrip selectedDate={selectedDate} onSelectDate={onSelectDate} />
        <div className="space-y-8">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 shrink-0">
                    Dzisiaj
                  </h2>
                  <div
                    className="flex items-center gap-0.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-tp-muted/60 p-0.5"
                    role="group"
                    aria-label="Szybkie zadania na dziś"
                  >
                    {QUICK_TODAY_PRESETS.map(({ title, Icon, hint }) => (
                      <button
                        key={title}
                        type="button"
                        title={hint}
                        onClick={() => void onAddTask(title, 'medium', '', 'indigo', false)}
                        className={cn(
                          'p-2 rounded-lg text-slate-500 dark:text-slate-400',
                          'hover:text-tp-accent hover:bg-white dark:hover:bg-tp-raised',
                          'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tp-accent/50'
                        )}
                      >
                        <Icon className="w-4 h-4" aria-hidden />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    title="Dodaj zadanie"
                    aria-label="Dodaj zadanie"
                    onClick={() => {
                      setTaskFormDialogKey(k => k + 1);
                      setAddTaskDialogOpen(true);
                    }}
                    className={cn(
                      'p-2 rounded-lg text-slate-500 dark:text-slate-400 shrink-0',
                      'hover:text-tp-accent hover:bg-white dark:hover:bg-tp-raised border border-transparent',
                      'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tp-accent/50'
                    )}
                  >
                    <Plus className="w-4 h-4" aria-hidden />
                  </button>
                </div>
                <button
                  onClick={onMoveToQueue}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium shrink-0"
                  title="Przenieś niezrobione do kolejki"
                >
                  <Archive className="w-4 h-4" />
                  <span>Do kolejki</span>
                </button>
              </div>
              <DroppableContainer id="today" className="min-h-[100px]">
                <SortableContext items={todayTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {isMinimalView ? (
                    <div className="bg-white dark:bg-tp-surface rounded-lg shadow-sm border border-slate-200 dark:border-white/6 p-4 font-mono">
                      {todayTasks.map(task => (
                        <SortableMinimalTaskItem
                          key={task.id}
                          task={task}
                          projects={projects}
                          goalTitle={getGoalTitleForTask(task)}
                          onToggleComplete={onToggleComplete}
                          onUpdateTask={onUpdateTask}
                          onAddSubtask={onAddSubtask}
                          onToggleSubtask={onToggleSubtask}
                          onDeleteSubtask={onDeleteSubtask}
                          onFocus={onFocusTask}
                          onOpenProject={onOpenProjectFromTask}
                          collapseSignal={collapseAllTasksSignal}
                        />
                      ))}
                      {todayTasks.length === 0 && (
                        <div className="text-slate-400 dark:text-slate-500 text-center py-4">
                          Brak zadań na ten dzień.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {todayTasks.map(task => (
                        <SortableTaskItem
                          key={task.id}
                          task={task}
                          projectColor={getProjectForTask(task)?.color || null}
                          projectEmoji={getProjectForTask(task)?.emoji || null}
                          linkedProjectId={getProjectForTask(task)?.id ?? null}
                          goalTitle={getGoalTitleForTask(task)}
                          onOpenProject={onOpenProjectFromTask}
                          onToggleComplete={onToggleComplete}
                          onDelete={onDelete}
                          onDeleteSeries={onDeleteSeries}
                          onAddSubtask={onAddSubtask}
                          onToggleSubtask={onToggleSubtask}
                          onDeleteSubtask={onDeleteSubtask}
                          onFocus={onFocusTask}
                          onUpdateTask={onUpdateTask}
                          collapseSignal={collapseAllTasksSignal}
                        />
                      ))}
                      {todayTasks.length === 0 && (
                        <div className="text-center py-8 bg-white dark:bg-tp-surface rounded-2xl border border-slate-200 dark:border-white/6 border-dashed">
                          <p className="text-slate-500 dark:text-slate-400 font-medium">
                            Brak zadań na ten dzień.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </SortableContext>
              </DroppableContainer>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Kolejka</h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-100 dark:bg-tp-muted rounded-lg p-0.5 border border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setQueueSortMode('priority');
                        localStorage.setItem('queueSortMode', 'priority');
                      }}
                      className={cn(
                        'px-2 py-1 text-xs font-semibold rounded-md transition-colors',
                        queueSortMode === 'priority'
                          ? 'bg-white dark:bg-tp-raised text-indigo-600 dark:text-tp-accent shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      )}
                      title="Sortuj kolejkę według ważności"
                    >
                      Ważność
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQueueSortMode('manual');
                        localStorage.setItem('queueSortMode', 'manual');
                      }}
                      className={cn(
                        'px-2 py-1 text-xs font-semibold rounded-md transition-colors',
                        queueSortMode === 'manual'
                          ? 'bg-white dark:bg-tp-raised text-indigo-600 dark:text-tp-accent shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      )}
                      title="Sortuj kolejkę ręcznie (przeciąganie)"
                    >
                      Ręcznie
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onCollapseAllTasks}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
                    title="Zwiń wszystkie rozwinięte zadania"
                  >
                    Zwiń wszystko
                  </button>
                </div>
              </div>
              <DroppableContainer id="queue" className="min-h-[100px]">
                <SortableContext items={queueTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {isMinimalView ? (
                    <div className="bg-white dark:bg-tp-surface rounded-lg shadow-sm border border-slate-200 dark:border-white/6 p-4 font-mono">
                      {queueTasks.map(task => (
                        <SortableMinimalTaskItem
                          key={task.id}
                          task={task}
                          projects={projects}
                          goalTitle={getGoalTitleForTask(task)}
                          onToggleComplete={onToggleComplete}
                          onUpdateTask={onUpdateTask}
                          onAddSubtask={onAddSubtask}
                          onToggleSubtask={onToggleSubtask}
                          onDeleteSubtask={onDeleteSubtask}
                          onFocus={onFocusTask}
                          onOpenProject={onOpenProjectFromTask}
                          collapseSignal={collapseAllTasksSignal}
                        />
                      ))}
                      {queueTasks.length === 0 && (
                        <div className="text-slate-400 dark:text-slate-500 text-center py-4">
                          Brak zadań w kolejce.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {queueTasks.map(task => (
                        <SortableTaskItem
                          key={task.id}
                          task={task}
                          projectColor={getProjectForTask(task)?.color || null}
                          projectEmoji={getProjectForTask(task)?.emoji || null}
                          linkedProjectId={getProjectForTask(task)?.id ?? null}
                          goalTitle={getGoalTitleForTask(task)}
                          onOpenProject={onOpenProjectFromTask}
                          onToggleComplete={onToggleComplete}
                          onDelete={onDelete}
                          onDeleteSeries={onDeleteSeries}
                          onAddSubtask={onAddSubtask}
                          onToggleSubtask={onToggleSubtask}
                          onDeleteSubtask={onDeleteSubtask}
                          onFocus={onFocusTask}
                          onUpdateTask={onUpdateTask}
                          collapseSignal={collapseAllTasksSignal}
                        />
                      ))}
                      {queueTasks.length === 0 && (
                        <div className="text-center py-8 bg-white dark:bg-tp-surface rounded-2xl border border-slate-200 dark:border-white/6 border-dashed">
                          <p className="text-slate-500 dark:text-slate-400 font-medium">
                            Brak zadań w kolejce.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </SortableContext>
              </DroppableContainer>
            </div>
          </DndContext>
        </div>

      {addTaskDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-task-dialog-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50 cursor-default border-0 p-0"
            aria-label="Zamknij"
            onClick={() => setAddTaskDialogOpen(false)}
          />
          <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-white/6 bg-white dark:bg-tp-surface shadow-xl overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/6">
              <h3 id="add-task-dialog-title" className="text-base font-semibold text-slate-900 dark:text-white">
                Nowe zadanie
              </h3>
              <button
                type="button"
                onClick={() => setAddTaskDialogOpen(false)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-tp-muted transition-colors"
                title="Zamknij"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            <div className="overflow-y-auto min-h-0 flex-1">
              <TaskForm
                key={taskFormDialogKey}
                className="rounded-none border-0 shadow-none mb-0"
                onAdd={(title, priority, category, color, isRecurring, dueDate) => {
                  void onAddTask(title, priority, category, color, isRecurring, dueDate);
                  setAddTaskDialogOpen(false);
                }}
                projects={projects}
                onCreateProject={onCreateProjectFromTaskForm}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
