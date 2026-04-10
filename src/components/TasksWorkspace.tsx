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
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Archive } from 'lucide-react';
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
  onDragOver,
  onDragEnd,
}: TasksWorkspaceProps) {
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
        <div className="mt-6">
          <TaskForm
            onAdd={onAddTask}
            projects={projects}
            onCreateProject={onCreateProjectFromTaskForm}
          />
        </div>
    </div>
  );
}
