import { format, isBefore, startOfDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import React, { useEffect, useState, useRef } from 'react';
import { Moon, Sun, List, ChevronRight, ChevronDown, X, GripVertical, Play, Clock, Archive } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarStrip } from './components/CalendarStrip';
import { TaskForm } from './components/TaskForm';
import { TaskItem } from './components/TaskItem';
import { Sidebar } from './components/Sidebar';
import { PaymentForm } from './components/PaymentForm';
import { PaymentItem } from './components/PaymentItem';
import { FocusMode } from './components/FocusMode';
import { CalendarView } from './components/CalendarView';
import { RulesView } from './components/RulesView';
import { GoalsView } from './components/GoalsView';
import { ProjectsView } from './components/ProjectsView';
import { DailyNotePanel } from './components/DailyNotePanel';
import { DailyTimeline as DailyTimelineComponent } from './components/DailyTimeline';
import { TaskTimer } from './components/TaskTimer';
import { supabase } from './lib/supabase';
import { ANONYMOUS_USER_ID } from './constants';
import { Priority, Task, Payment, ViewMode, TaskColor, RecurringTask, DailyNote, Project, ProjectTask, DailyTimeline, DailyTimelineEvent } from './types';
import { cn } from './utils';
const QUEUE_DATE = '2099-12-31';

function DroppableContainer({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
}

function SortableTaskItem(props: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
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

function SortableMinimalTaskItem(props: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
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

const MinimalTaskItem: React.FC<{ 
  task: Task, 
  projects?: Project[],
  onToggleComplete: (id: string) => Promise<void> | void, 
  onUpdateTask: (task: Task) => Promise<void> | void,
  onAddSubtask: (taskId: string, title: string) => Promise<void> | void,
  onToggleSubtask: (taskId: string, subtaskId: string) => Promise<void> | void,
  onDeleteSubtask: (taskId: string, subtaskId: string) => Promise<void> | void,
  onFocus: (id: string) => void,
  collapseSignal?: number,
  dragHandleProps?: any,
  isDragging?: boolean
}> = ({ task, projects, onToggleComplete, onUpdateTask, onAddSubtask, onToggleSubtask, onDeleteSubtask, onFocus, collapseSignal, dragHandleProps, isDragging }) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.notes || '');
  const [isExpanded, setIsExpanded] = useState(!!task.notes || (task.subtasks && task.subtasks.length > 0));
  const [newSubtask, setNewSubtask] = useState('');

  const project = projects?.find(p => p.id === task.project_id);
  const projectColor = project?.color;

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
      ? 'bg-emerald-500 dark:bg-emerald-400'
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
    <div className={cn("py-2 border-b border-slate-100 dark:border-slate-800/50 last:border-0", isDragging && "opacity-50")}>
      <div className="flex items-center gap-3">
        <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400">
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
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            "text-base flex-1 bg-transparent border-none focus:ring-0 p-0 m-0 focus:outline-none",
            task.completed ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200"
          )}
        />
        {task.project_title && (
          <span 
            className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0 ml-1.5"
            style={{ 
              backgroundColor: projectColor ? `${projectColor}15` : 'transparent',
              color: projectColor || 'inherit',
              borderColor: projectColor ? `${projectColor}30` : 'transparent'
            }}
          >
            {task.project_title}
          </span>
        )}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => handleSetPriority('low')}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-colors",
              priorityLevel >= 1 ? litColorClass : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
            )}
            title="Priorytet: luz (1 kropka)"
          />
          <button
            type="button"
            onClick={() => handleSetPriority('medium')}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-colors",
              priorityLevel >= 2 ? litColorClass : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
            )}
            title="Priorytet: ważne (2 kropki)"
          />
          <button
            type="button"
            onClick={() => handleSetPriority('high')}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-colors",
              priorityLevel >= 3 ? litColorClass : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
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
            onChange={(e) => setDescription(e.target.value)}
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
                  <span className={cn(
                    "text-sm flex-1", 
                    subtask.completed ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-300"
                  )}>
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
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={handleAddSubtask}
            placeholder="Dodaj podzadanie (Enter)"
            className="w-full text-sm bg-transparent border-none focus:ring-0 p-0 m-0 text-slate-600 dark:text-slate-300 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 mt-1"
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<ViewMode>('tasks');
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [collapseAllTasksSignal, setCollapseAllTasksSignal] = useState(0);
  const [queueSortMode, setQueueSortMode] = useState<'priority' | 'manual'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('queueSortMode');
      if (saved === 'manual' || saved === 'priority') return saved;
    }
    return 'priority';
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [isMinimalView, setIsMinimalView] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('minimalView');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
  const [dailyTimelines, setDailyTimelines] = useState<Record<string, DailyTimeline>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTimerTask, setActiveTimerTask] = useState<Task | null>(null);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(true);
  const allowPersistTaskOrder = useRef(false);

  useEffect(() => {
    const url = (import.meta as any).env.VITE_SUPABASE_URL;
    const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key || url === 'https://placeholder.supabase.co' || key === 'placeholder') {
      setIsSupabaseConfigured(false);
    }
  }, []);

  const updateProjectTask = async (taskId: string, updater: (pt: ProjectTask) => ProjectTask | null) => {
    setProjects(prev => {
      let updatedProject: Project | null = null;
      const next = prev.map(p => {
        const taskIndex = (p.tasks || []).findIndex(pt => pt.id === taskId);
        if (taskIndex !== -1) {
          const newTasks = [...(p.tasks || [])];
          const updatedTask = updater(newTasks[taskIndex]);
          if (updatedTask === null) {
            newTasks.splice(taskIndex, 1);
          } else {
            newTasks[taskIndex] = updatedTask;
          }
          updatedProject = { ...p, tasks: newTasks };
          return updatedProject;
        }
        return p;
      });
      
      if (updatedProject) {
        supabase.from('projects').update({ tasks: updatedProject.tasks }).eq('id', updatedProject.id).then(({error}) => {
          if (error) console.error('Error updating project tasks:', error);
        });
      }
      return next;
    });
  };

  useEffect(() => {
    localStorage.setItem('user_projects', JSON.stringify(projects));
  }, [projects]);

  const [taskOrder, setTaskOrder] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!allowPersistTaskOrder.current) return;
    supabase
      .from('user_task_order')
      .upsert(
        { user_id: ANONYMOUS_USER_ID, order_json: taskOrder },
        { onConflict: 'user_id' }
      )
      .then(({ error }) => {
        if (error) console.error('Error saving task order:', error);
      });
  }, [taskOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle Dark Mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Handle Minimal View
  useEffect(() => {
    localStorage.setItem('minimalView', String(isMinimalView));
  }, [isMinimalView]);

  // Fetch Data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      console.log('Fetching data from Supabase...');
      try {
        // Fetch Tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*, subtasks(*)');
        
        if (tasksError) {
          console.error('Error fetching tasks:', tasksError);
          throw tasksError;
        }

        console.log('Tasks fetched:', tasksData?.length);
        if (tasksData) {
          setTasks(tasksData.map(t => ({
            ...t,
            subtasks: t.subtasks || []
          })));
        }

        // Fetch Recurring Tasks
        const { data: rtData, error: rtError } = await supabase
          .from('recurring_tasks')
          .select('*');
        
        if (rtError) console.error('Error fetching recurring tasks:', rtError);
        if (rtData) {
          console.log('Recurring tasks fetched:', rtData.length);
          setRecurringTasks(rtData);
        }

        // Fetch Payments
        const { data: paymentsData, error: pError } = await supabase
          .from('payments')
          .select('*');
        
        if (pError) console.error('Error fetching payments:', pError);
        if (paymentsData) {
          console.log('Payments fetched:', paymentsData.length);
          setPayments(paymentsData);
        }

        // Fetch Daily Notes
        const { data: notesData, error: notesError } = await supabase
          .from('daily_notes')
          .select('*');
        
        if (notesError) console.error('Error fetching daily notes:', notesError);
        if (notesData) {
          console.log('Daily notes fetched:', notesData.length);
          const notesMap: Record<string, string> = {};
          notesData.forEach(n => {
            notesMap[n.date] = n.content;
          });
          setDailyNotes(notesMap);
        }

        // Fetch Daily Timelines
        const { data: timelineData, error: timelineError } = await supabase
          .from('daily_timelines')
          .select('*');
        
        if (timelineError) console.error('Error fetching daily timelines:', timelineError);
        if (timelineData) {
          console.log('Daily timelines fetched:', timelineData.length);
          const timelineMap: Record<string, DailyTimeline> = {};
          timelineData.forEach(t => {
            timelineMap[t.date] = t;
          });
          setDailyTimelines(timelineMap);
        } else {
          // Fallback to local storage
          const saved = localStorage.getItem('daily_timelines');
          if (saved) {
            try {
              setDailyTimelines(JSON.parse(saved));
            } catch (e) {
              console.error('Failed to parse daily timelines from local storage');
            }
          }
        }

        // Fetch Projects
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (projectsError) console.error('Error fetching projects:', projectsError);
        if (projectsData && projectsData.length > 0) {
          console.log('Projects fetched:', projectsData.length);
          setProjects(projectsData);
        } else {
          // Migrate from local storage if Supabase is empty
          const saved = localStorage.getItem('user_projects');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed.length > 0) {
                const projectsToInsert = parsed.map((p: any) => ({
                  ...p,
                  user_id: ANONYMOUS_USER_ID,
                }));
                const { data: insertedData, error: insertError } = await supabase
                  .from('projects')
                  .insert(projectsToInsert)
                  .select();
                
                if (!insertError && insertedData) {
                  setProjects(insertedData);
                } else {
                  setProjects(parsed);
                }
              }
            } catch (e) {
              console.error('Failed to parse projects from local storage');
            }
          }
        }

        const { data: orderRow, error: orderErr } = await supabase
          .from('user_task_order')
          .select('order_json')
          .eq('user_id', ANONYMOUS_USER_ID)
          .maybeSingle();
        if (orderErr) console.error('Error fetching task order:', orderErr);
        if (orderRow?.order_json && typeof orderRow.order_json === 'object') {
          setTaskOrder(orderRow.order_json as Record<string, string[]>);
        } else {
          const savedOrder = localStorage.getItem('taskOrder');
          if (savedOrder) {
            try {
              const parsed = JSON.parse(savedOrder);
              setTaskOrder(parsed);
              await supabase.from('user_task_order').upsert(
                { user_id: ANONYMOUS_USER_ID, order_json: parsed },
                { onConflict: 'user_id' }
              );
            } catch (e) {
              console.error('Failed to migrate taskOrder from local storage', e);
            }
          }
        }
        allowPersistTaskOrder.current = true;
      } catch (err: any) {
        console.error('Error in fetchData:', err);
        allowPersistTaskOrder.current = true;
      }
    };

    fetchData();
  }, []);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Migrate overdue tasks to today on mount
  useEffect(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayDate = startOfDay(new Date());
    
    const migrateOverdue = async () => {
      const overdueTasks = tasks.filter(task => !task.completed && !task.is_recurring && isBefore(new Date(task.date), todayDate));
      const overdueProjectTasks = projects.flatMap(p => p.tasks || []).filter(task => !task.completed && task.date && task.date !== QUEUE_DATE && isBefore(new Date(task.date), todayDate));
      
      if (overdueTasks.length > 0) {
        const { error } = await supabase
          .from('tasks')
          .update({ date: todayStr })
          .in('id', overdueTasks.map(t => t.id));

        if (!error) {
          setTasks(prev => prev.map(task => {
            if (!task.completed && !task.is_recurring && isBefore(new Date(task.date), todayDate)) {
              return { ...task, date: todayStr };
            }
            return task;
          }));
        }
      }

      if (overdueProjectTasks.length > 0) {
        setProjects(prev => {
          const next = prev.map(p => {
            let changed = false;
            const newTasks = (p.tasks || []).map(pt => {
              if (!pt.completed && pt.date && pt.date !== QUEUE_DATE && isBefore(new Date(pt.date), todayDate)) {
                changed = true;
                return { ...pt, date: todayStr };
              }
              return pt;
            });
            if (changed) {
              const updatedProject = { ...p, tasks: newTasks };
              supabase.from('projects').update({ tasks: newTasks }).eq('id', p.id).then(({error}) => {
                if (error) console.error('Error migrating project tasks:', error);
              });
              return updatedProject;
            }
            return p;
          });
          return next;
        });
      }
    };

    if (tasks.length > 0 || projects.some(p => (p.tasks || []).length > 0)) {
      migrateOverdue();
    }
  }, [tasks.length, projects.length]); // Re-run when task count changes (e.g. after initial fetch)

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  // Auto-generate recurring tasks for the selected date
  useEffect(() => {
    const generateRecurring = async () => {
      // Check if we have already generated for this date in this session to avoid loops
      const missing = recurringTasks.filter(rt => !tasks.some(t => t.date === selectedDateStr && t.recurring_template_id === rt.id));
      if (missing.length === 0) return;
      
      const newTasks = missing.map(rt => ({
        user_id: ANONYMOUS_USER_ID,
        title: rt.title,
        date: selectedDateStr,
        completed: false,
        priority: rt.priority,
        category: rt.category,
        color: rt.color,
        is_recurring: true,
        recurring_template_id: rt.id,
        pomodoros_completed: 0,
        notes: '',
        due_date: selectedDateStr
      }));
      
      const { data, error } = await supabase
        .from('tasks')
        .insert(newTasks)
        .select();

      if (data && !error) {
        const tasksWithSubtasks = data.map(t => ({ ...t, subtasks: [] }));
        setTasks(prev => [...tasksWithSubtasks, ...prev]);
      }
    };

    if (recurringTasks.length > 0) {
      generateRecurring();
    }
  }, [selectedDateStr, recurringTasks, tasks.length]);

  // Tasks logic
  const sortTasks = (taskList: Task[], dateStr: string) => {
    return [...taskList].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      
      const orderForDate = taskOrder[dateStr] || [];
      const indexA = orderForDate.indexOf(a.id);
      const indexB = orderForDate.indexOf(b.id);

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      // Fallback sorting
      if (a.is_recurring !== b.is_recurring) return a.is_recurring ? -1 : 1;
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });
  };

  const sortTasksByPriority = (taskList: Task[]) => {
    return [...taskList].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.is_recurring !== b.is_recurring) return a.is_recurring ? -1 : 1;
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const diff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (diff !== 0) return diff;
      // stabilizacja: najpierw z terminem, potem alfabetycznie
      if (!!a.due_date !== !!b.due_date) return a.due_date ? -1 : 1;
      if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  };

  const projectTasksAsTasks: Task[] = projects.flatMap(p => 
    (p.tasks || [])
      .filter(pt => pt.status === 'do_zrobienia' || pt.status === 'in_progress')
      .map(pt => ({
        id: pt.id,
        user_id: p.user_id,
        title: pt.title,
        date: pt.date || QUEUE_DATE,
        completed: pt.completed,
        priority: pt.priority || 'medium',
        category: p.title,
        color: pt.color || p.color || 'blue',
        is_recurring: false,
        pomodoros_completed: pt.pomodoros_completed || 0,
        notes: pt.notes || '',
        subtasks: pt.subtasks || [],
        project_id: p.id,
        project_title: p.title,
        kanban_status: pt.status
      } as Task))
  );

  const allTasks = [...tasks, ...projectTasksAsTasks];

  const todayTasks = sortTasks(allTasks.filter(t => t.date === selectedDateStr), selectedDateStr);
  const queueTasksBase = allTasks.filter(t => t.date === QUEUE_DATE);
  const queueTasks = queueSortMode === 'manual'
    ? sortTasks(queueTasksBase, QUEUE_DATE)
    : sortTasksByPriority(queueTasksBase);

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeTask = allTasks.find(t => t.id === activeId);
    if (!activeTask) return;

    const isOverQueue = overId === 'queue' || allTasks.find(t => t.id === overId)?.date === QUEUE_DATE;
    const isOverToday = overId === 'today' || allTasks.find(t => t.id === overId)?.date === selectedDateStr;

    if (isOverQueue && activeTask.date !== QUEUE_DATE) {
      if (activeId.toString().startsWith('proj_task_')) {
        updateProjectTask(activeId.toString(), pt => ({ ...pt, date: QUEUE_DATE }));
      } else {
        setTasks(prev => prev.map(t => t.id === activeId ? { ...t, date: QUEUE_DATE } : t));
      }
    } else if (isOverToday && activeTask.date !== selectedDateStr) {
      if (activeId.toString().startsWith('proj_task_')) {
        updateProjectTask(activeId.toString(), pt => ({ ...pt, date: selectedDateStr }));
      } else {
        setTasks(prev => prev.map(t => t.id === activeId ? { ...t, date: selectedDateStr } : t));
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTask = allTasks.find(t => t.id === active.id);
    if (!activeTask) return;

    const isOverQueue = over.id === 'queue' || allTasks.find(t => t.id === over.id)?.date === QUEUE_DATE;
    const isOverToday = over.id === 'today' || allTasks.find(t => t.id === over.id)?.date === selectedDateStr;

    let finalDate = activeTask.date;
    if (isOverQueue) finalDate = QUEUE_DATE;
    else if (isOverToday) finalDate = selectedDateStr;

    const isQueue = finalDate === QUEUE_DATE;
    const listTasks = isQueue ? queueTasks : todayTasks;
    const dateStr = isQueue ? QUEUE_DATE : selectedDateStr;
    
    const oldIndex = listTasks.findIndex(t => t.id === active.id);
    const newIndex = over.id === 'queue' || over.id === 'today' 
      ? listTasks.length - 1 
      : listTasks.findIndex(t => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1 && !(isQueue && queueSortMode === 'priority')) {
      const newFilteredTasks = arrayMove(listTasks, oldIndex, newIndex);
      const newOrder = newFilteredTasks.map(t => t.id);
      
      setTaskOrder(prev => ({
        ...prev,
        [dateStr]: newOrder
      }));
    }

    // Always save the date in case it was moved between lists
    if (activeTask.date !== finalDate) {
      if (activeTask.id.toString().startsWith('proj_task_')) {
        updateProjectTask(active.id.toString(), pt => ({ ...pt, date: finalDate }));
      } else {
        setTasks(prev => prev.map(t => t.id === active.id ? { ...t, date: finalDate } : t));
        await supabase.from('tasks').update({ date: finalDate }).eq('id', activeTask.id);
      }
    }
  };

  const categories = Array.from(new Set(allTasks.map(t => t.category).filter(Boolean))) as string[];

  const handleAddTask = async (title: string, priority: Priority, category: string, color: TaskColor, isRecurring: boolean, dueDate?: string) => {
    if (isRecurring) {
      const { data: templateData, error: tError } = await supabase
        .from('recurring_tasks')
        .insert([{
          user_id: ANONYMOUS_USER_ID,
          title,
          priority,
          category,
          color
        }])
        .select();

      if (tError) {
        console.error('Error adding recurring task:', tError);
        alert('Błąd podczas dodawania zadania cyklicznego: ' + tError.message);
        return;
      }

      if (templateData) {
        setRecurringTasks(prev => [...templateData, ...prev]);
        
        // Immediately generate task for current selected date
        const rt = templateData[0];
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .insert([{
            user_id: ANONYMOUS_USER_ID,
            title: rt.title,
            date: selectedDateStr,
            completed: false,
            priority: rt.priority,
            category: rt.category,
            color: rt.color,
            is_recurring: true,
            recurring_template_id: rt.id,
            pomodoros_completed: 0,
            notes: '',
            due_date: selectedDateStr
          }])
          .select();

        if (!taskError && taskData) {
          const tasksWithSubtasks = taskData.map(t => ({ ...t, subtasks: [] }));
          setTasks(prev => [...tasksWithSubtasks, ...prev]);
        }
      }
    } else {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          user_id: ANONYMOUS_USER_ID,
          title,
          date: selectedDateStr,
          completed: false,
          priority,
          category,
          color,
          pomodoros_completed: 0,
          notes: '',
          due_date: dueDate || null
        }])
        .select();

      if (error) {
        console.error('Error adding task:', error);
        alert('Błąd podczas dodawania zadania: ' + error.message);
        return;
      }

      if (data) {
        const tasksWithSubtasks = data.map(t => ({ ...t, subtasks: [] }));
        setTasks(prev => [...tasksWithSubtasks, ...prev]);
      }
    }
  };

  const handleToggleComplete = async (id: string) => {
    if (id.toString().startsWith('proj_task_')) {
      updateProjectTask(id, pt => ({ ...pt, completed: !pt.completed, status: !pt.completed ? 'done' : 'in_progress' }));
      return;
    }

    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const { error } = await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', id);

    if (!error) {
      setTasks(prev => prev.map(t => 
        t.id === id ? { ...t, completed: !t.completed } : t
      ));
    }
  };

  const handleDelete = async (id: string) => {
    if (id.toString().startsWith('proj_task_')) {
      updateProjectTask(id, pt => null);
      if (focusedTaskId === id) {
        setFocusedTaskId(null);
        setView('tasks');
      }
      return;
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== id));
      if (focusedTaskId === id) {
        setFocusedTaskId(null);
        setView('tasks');
      }
    }
  };

  const handleDeleteSeries = async (templateId: string) => {
    const { error } = await supabase
      .from('recurring_tasks')
      .delete()
      .eq('id', templateId);

    if (!error) {
      setRecurringTasks(prev => prev.filter(rt => rt.id !== templateId));
      setTasks(prev => prev.filter(t => !(t.recurring_template_id === templateId && !t.completed)));
      
      const focusedTask = tasks.find(t => t.id === focusedTaskId);
      if (focusedTask && focusedTask.recurring_template_id === templateId && !focusedTask.completed) {
        setFocusedTaskId(null);
        setView('tasks');
      }
    }
  };

  const handleAddSubtask = async (taskId: string, title: string) => {
    if (taskId.toString().startsWith('proj_task_')) {
      const newSubtask = {
        id: `proj_subtask_${Date.now()}`,
        task_id: taskId,
        title,
        completed: false
      };
      updateProjectTask(taskId, pt => ({ ...pt, subtasks: [...(pt.subtasks || []), newSubtask] }));
      return;
    }

    const { data, error } = await supabase
      .from('subtasks')
      .insert([{ task_id: taskId, title, completed: false }])
      .select();

    if (error) {
      console.error('Error adding subtask:', error);
      return;
    }

    if (data) {
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            subtasks: [...t.subtasks, data[0]]
          };
        }
        return t;
      }));
    }
  };

  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    if (taskId.toString().startsWith('proj_task_')) {
      updateProjectTask(taskId, pt => ({
        ...pt,
        subtasks: (pt.subtasks || []).map(s => 
          s.id === subtaskId ? { ...s, completed: !s.completed } : s
        )
      }));
      return;
    }

    const task = tasks.find(t => t.id === taskId);
    const subtask = task?.subtasks.find(s => s.id === subtaskId);
    if (!subtask) return;

    const { error } = await supabase
      .from('subtasks')
      .update({ completed: !subtask.completed })
      .eq('id', subtaskId);

    if (!error) {
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            subtasks: t.subtasks.map(s => 
              s.id === subtaskId ? { ...s, completed: !s.completed } : s
            )
          };
        }
        return t;
      }));
    }
  };

  const handleDeleteSubtask = async (taskId: string, subtaskId: string) => {
    if (taskId.toString().startsWith('proj_task_')) {
      updateProjectTask(taskId, pt => ({
        ...pt,
        subtasks: (pt.subtasks || []).filter(s => s.id !== subtaskId)
      }));
      return;
    }

    const { error } = await supabase
      .from('subtasks')
      .delete()
      .eq('id', subtaskId);

    if (!error) {
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            subtasks: t.subtasks.filter(s => s.id !== subtaskId)
          };
        }
        return t;
      }));
    }
  };

  const handleFocusTask = (id: string) => {
    setFocusedTaskId(id);
    setView('focus');
    
    // Auto-start timer when entering focus mode
    const task = allTasks.find(t => t.id === id);
    if (task) {
      setActiveTimerTask(task);
    }
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    if (updatedTask.id.toString().startsWith('proj_task_')) {
      updateProjectTask(updatedTask.id, pt => ({
        ...pt,
        title: updatedTask.title,
        priority: updatedTask.priority,
        color: updatedTask.color,
        notes: updatedTask.notes,
        date: updatedTask.date,
        pomodoros_completed: updatedTask.pomodoros_completed
      }));
      return;
    }

    const { id, subtasks, project_id, project_title, kanban_status, ...rest } = updatedTask;
    const { error } = await supabase
      .from('tasks')
      .update(rest)
      .eq('id', id);

    if (error) {
      console.error('Error updating task:', error);
    } else {
      setTasks(prev => prev.map(t => {
        if (t.id === updatedTask.id) {
          return { ...updatedTask, subtasks: t.subtasks };
        }
        return t;
      }));
    }
  };

  // Daily Notes logic
  const handleSaveDailyNote = async (date: string, content: string) => {
    try {
      const { error } = await supabase
        .from('daily_notes')
        .upsert({
          user_id: ANONYMOUS_USER_ID,
          date,
          content
        }, { onConflict: 'user_id,date' });

      if (error) throw error;

      setDailyNotes(prev => ({
        ...prev,
        [date]: content
      }));
    } catch (err: any) {
      console.error('Error saving daily note:', err);
      alert('Nie udało się zapisać notatki.');
    }
  };

  const handleSaveDailyTimeline = async (timeline: DailyTimeline) => {
    const date = format(selectedDate, 'yyyy-MM-dd');
    try {
      const { error } = await supabase
        .from('daily_timelines')
        .upsert({
          ...timeline,
          user_id: ANONYMOUS_USER_ID,
          date
        }, { onConflict: 'user_id,date' });

      if (error) throw error;

      setDailyTimelines(prev => ({
        ...prev,
        [date]: timeline
      }));
    } catch (err: any) {
      console.error('Error saving daily timeline:', err);
      // Fallback to local storage if table doesn't exist
      const saved = localStorage.getItem('daily_timelines') || '{}';
      const parsed = JSON.parse(saved);
      parsed[date] = timeline;
      localStorage.setItem('daily_timelines', JSON.stringify(parsed));
      
      setDailyTimelines(prev => ({
        ...prev,
        [date]: timeline
      }));
    }
  };

  const handleMoveToQueue = async () => {
    const todayStr = format(selectedDate, 'yyyy-MM-dd');
    const tasksToMove = tasks.filter(t => t.date === todayStr && !t.completed && !t.is_recurring);
    
    if (tasksToMove.length > 0) {
      const { error } = await supabase
        .from('tasks')
        .update({ date: QUEUE_DATE })
        .in('id', tasksToMove.map(t => t.id));

      if (!error) {
        setTasks(prev => prev.map(t => {
          if (t.date === todayStr && !t.completed && !t.is_recurring) {
            return { ...t, date: QUEUE_DATE };
          }
          return t;
        }));
      }
    }

    setProjects(prev => {
      return prev.map(p => {
        let changed = false;
        const newTasks = (p.tasks || []).map(pt => {
          if (pt.date === todayStr && !pt.completed) {
            changed = true;
            return { ...pt, date: QUEUE_DATE };
          }
          return pt;
        });
        if (changed) {
          const updatedProject = { ...p, tasks: newTasks };
          supabase.from('projects').update({ tasks: newTasks }).eq('id', p.id).then(({error}) => {
            if (error) console.error('Error moving project tasks to queue:', error);
          });
          return updatedProject;
        }
        return p;
      });
    });
  };

  // Payments logic
  const handleAddPayment = async (title: string, date: string, net_amount: number, gross_amount: number) => {
    const { data, error } = await supabase
      .from('payments')
      .insert([{
        user_id: ANONYMOUS_USER_ID,
        title,
        date,
        net_amount,
        gross_amount,
        is_realized: false
      }])
      .select();

    if (error) {
      console.error('Error adding payment:', error);
      alert('Błąd podczas dodawania płatności: ' + error.message);
      return;
    }

    if (data) {
      setPayments(prev => [...data, ...prev].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    }
  };

  const handleTogglePaymentRealized = async (id: string) => {
    const payment = payments.find(p => p.id === id);
    if (!payment) return;

    const { error } = await supabase
      .from('payments')
      .update({ is_realized: !payment.is_realized })
      .eq('id', id);

    if (!error) {
      setPayments(prev => prev.map(p => p.id === id ? { ...p, is_realized: !p.is_realized } : p));
    }
  };

  const handleDeletePayment = async (id: string) => {
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id);

    if (!error) {
      setPayments(prev => prev.filter(p => p.id !== id));
    }
  };

  const currentMonthStr = format(new Date(), 'yyyy-MM');
  const thisMonthPayments = payments.filter(p => p.date.startsWith(currentMonthStr));
  
  // Total predicted is everything in this month, regardless of status
  const sumNetTotal = thisMonthPayments.reduce((acc, p) => acc + p.net_amount, 0);
  const sumGrossTotal = thisMonthPayments.reduce((acc, p) => acc + p.gross_amount, 0);
  
  const realizedThisMonth = thisMonthPayments.filter(p => p.is_realized);
  const sumNetRealized = realizedThisMonth.reduce((acc, p) => acc + p.net_amount, 0);
  const sumGrossRealized = realizedThisMonth.reduce((acc, p) => acc + p.gross_amount, 0);

  const sortedPayments = [...payments].sort((a, b) => {
    if (a.is_realized !== b.is_realized) return a.is_realized ? 1 : -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const focusedTask = allTasks.find(t => t.id === focusedTaskId);

  const handleStopTimer = async (elapsedSeconds: number) => {
    if (!activeTimerTask) return;

    // Only add to timeline if duration is more than 5 minutes (300 seconds)
    if (elapsedSeconds > 300) {
      const durationMinutes = Math.ceil(elapsedSeconds / 60);
      const now = new Date();
      const startTime = new Date(now.getTime() - elapsedSeconds * 1000);
      const timeStr = format(startTime, 'HH:mm');
      const todayStr = format(now, 'yyyy-MM-dd');

      const newEvent: DailyTimelineEvent = {
        id: crypto.randomUUID(),
        type: 'task',
        time: timeStr,
        title: activeTimerTask.title,
        color: activeTimerTask.color || '#6366f1',
        duration: durationMinutes
      };

      const todayTimeline = dailyTimelines[todayStr];

      if (todayTimeline) {
        const updatedEvents = [...todayTimeline.events, newEvent];
        const { error } = await supabase
          .from('daily_timelines')
          .update({ events: updatedEvents })
          .eq('id', todayTimeline.id);

        if (!error) {
          setDailyTimelines(prev => ({
            ...prev,
            [todayStr]: { ...todayTimeline, events: updatedEvents }
          }));
        }
      } else {
        const newTimeline: DailyTimeline = {
          id: crypto.randomUUID(),
          user_id: ANONYMOUS_USER_ID,
          date: todayStr,
          events: [newEvent]
        };
        const { error } = await supabase
          .from('daily_timelines')
          .insert([newTimeline]);

        if (!error) {
          setDailyTimelines(prev => ({
            ...prev,
            [todayStr]: newTimeline
          }));
        }
      }
    }

    setActiveTimerTask(null);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      {activeTimerTask && (
        <TaskTimer 
          task={activeTimerTask} 
          onStop={handleStopTimer} 
          onClose={() => setActiveTimerTask(null)} 
        />
      )}
      <Sidebar currentView={view} onViewChange={setView} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isSupabaseConfigured && (
          <div className="bg-amber-500 text-white px-4 py-1 text-center text-[10px] font-bold uppercase tracking-wider">
            Supabase nie jest skonfigurowany. Dane będą zapisywane tylko lokalnie.
          </div>
        )}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 transition-colors">
          <div className="px-8 h-16 flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {view === 'tasks' ? 'Zadania' : view === 'calendar' ? 'Kalendarz' : view === 'expected_payments' ? 'Przewidywana Wpłata' : view === 'rules' ? 'Zasady' : view === 'goals' ? 'Cele' : view === 'projects' ? 'Projekty' : 'Tryb Skupienia'}
            </h1>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMinimalView(!isMinimalView)}
                  className={cn(
                    "p-2 rounded-xl transition-colors",
                    isMinimalView 
                      ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" 
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                  title={isMinimalView ? "Widok standardowy" : "Widok minimalistyczny"}
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title={isDarkMode ? "Przełącz na tryb jasny" : "Przełącz na tryb nocny"}
                >
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>

              {view === 'expected_payments' && (
                <div className="flex items-center gap-4 text-sm bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                  <div className="font-semibold text-indigo-900 dark:text-indigo-300 capitalize border-r border-indigo-200 dark:border-indigo-800 pr-4">
                    {format(new Date(), 'MMMM', { locale: pl })}
                  </div>
                  <div className="flex gap-8">
                    <div className="flex flex-col text-xs">
                      <span className="text-indigo-600/80 dark:text-indigo-400/80 font-medium uppercase tracking-tighter">Przewidywane Razem ({thisMonthPayments.length}):</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {sumNetTotal.toFixed(2)} <span className="font-normal opacity-70">netto</span> / {sumGrossTotal.toFixed(2)} <span className="font-normal opacity-70">brutto</span>
                      </span>
                    </div>
                    <div className="flex flex-col text-xs">
                      <span className="text-emerald-600/80 dark:text-emerald-400/80 font-medium uppercase tracking-tighter">Zrealizowane ({realizedThisMonth.length}):</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {sumNetRealized.toFixed(2)} <span className="font-normal opacity-70">netto</span> / {sumGrossRealized.toFixed(2)} <span className="font-normal opacity-70">brutto</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {view === 'tasks' && (
                <div className="flex flex-col items-end">
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-200 capitalize leading-none">
                    {format(new Date(), 'EEEE, d MMMM', { locale: pl })}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter mt-1">
                    <span className="text-emerald-600 dark:text-emerald-400">{sumGrossRealized.toFixed(2)}</span>
                    <span className="text-slate-400">/</span>
                    <span className="text-indigo-600 dark:text-indigo-400">{sumGrossTotal.toFixed(2)}</span>
                    <span className="text-slate-400 ml-0.5">brutto</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className={cn("mx-auto h-full", (view === 'tasks' || view === 'focus' || view === 'rules' || view === 'goals' || view === 'projects') ? "max-w-7xl" : "max-w-3xl")}>
            {(view === 'tasks' || view === 'focus') && (
              <div className="flex gap-8 h-full items-start">
                <div className="flex-1 min-w-0 flex flex-col gap-6">
                  {view === 'tasks' && (
                    <>
                      <CalendarStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
                      <div className="space-y-8">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragOver={handleDragOver}
                          onDragEnd={handleDragEnd}
                        >
                    {/* Today Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Dzisiaj</h2>
                        <button
                          onClick={handleMoveToQueue}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
                          title="Przenieś niezrobione do kolejki"
                        >
                          <Archive className="w-4 h-4" />
                          <span>Do kolejki</span>
                        </button>
                      </div>
                      <DroppableContainer id="today" className="min-h-[100px]">
                        <SortableContext
                          items={todayTasks.map(t => t.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {isMinimalView ? (
                            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-4 font-mono">
                              {todayTasks.map(task => (
                                <SortableMinimalTaskItem
                                  key={task.id}
                                  task={task}
                                  projects={projects}
                                  onToggleComplete={handleToggleComplete}
                                  onUpdateTask={handleUpdateTask}
                                  onAddSubtask={handleAddSubtask}
                                  onToggleSubtask={handleToggleSubtask}
                                  onDeleteSubtask={handleDeleteSubtask}
                                  onFocus={handleFocusTask}
                                  collapseSignal={collapseAllTasksSignal}
                                />
                              ))}
                              {todayTasks.length === 0 && (
                                <div className="text-slate-400 dark:text-slate-500 text-center py-4">Brak zadań na ten dzień.</div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {todayTasks.map(task => (
                                <SortableTaskItem
                                  key={task.id}
                                  task={task}
                                  onToggleComplete={handleToggleComplete}
                                  onDelete={handleDelete}
                                  onDeleteSeries={handleDeleteSeries}
                                  onAddSubtask={handleAddSubtask}
                                  onToggleSubtask={handleToggleSubtask}
                                  onDeleteSubtask={handleDeleteSubtask}
                                  onFocus={handleFocusTask}
                                  onUpdateTask={handleUpdateTask}
                                  collapseSignal={collapseAllTasksSignal}
                                />
                              ))}
                              {todayTasks.length === 0 && (
                                <div className="text-center py-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                                  <p className="text-slate-500 dark:text-slate-400 font-medium">Brak zadań na ten dzień.</p>
                                </div>
                              )}
                            </div>
                          )}
                        </SortableContext>
                      </DroppableContainer>
                    </div>

                    {/* Queue Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Kolejka</h2>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => { setQueueSortMode('priority'); localStorage.setItem('queueSortMode', 'priority'); }}
                              className={cn(
                                "px-2 py-1 text-xs font-semibold rounded-md transition-colors",
                                queueSortMode === 'priority'
                                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              )}
                              title="Sortuj kolejkę według ważności"
                            >
                              Ważność
                            </button>
                            <button
                              type="button"
                              onClick={() => { setQueueSortMode('manual'); localStorage.setItem('queueSortMode', 'manual'); }}
                              className={cn(
                                "px-2 py-1 text-xs font-semibold rounded-md transition-colors",
                                queueSortMode === 'manual'
                                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              )}
                              title="Sortuj kolejkę ręcznie (przeciąganie)"
                            >
                              Ręcznie
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCollapseAllTasksSignal(v => v + 1)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
                            title="Zwiń wszystkie rozwinięte zadania"
                          >
                            Zwiń wszystko
                          </button>
                        </div>
                      </div>
                      <DroppableContainer id="queue" className="min-h-[100px]">
                        <SortableContext
                          items={queueTasks.map(t => t.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {isMinimalView ? (
                            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-4 font-mono">
                              {queueTasks.map(task => (
                                <SortableMinimalTaskItem
                                  key={task.id}
                                  task={task}
                                  projects={projects}
                                  onToggleComplete={handleToggleComplete}
                                  onUpdateTask={handleUpdateTask}
                                  onAddSubtask={handleAddSubtask}
                                  onToggleSubtask={handleToggleSubtask}
                                  onDeleteSubtask={handleDeleteSubtask}
                                  onFocus={handleFocusTask}
                                  collapseSignal={collapseAllTasksSignal}
                                />
                              ))}
                              {queueTasks.length === 0 && (
                                <div className="text-slate-400 dark:text-slate-500 text-center py-4">Brak zadań w kolejce.</div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {queueTasks.map(task => (
                                <SortableTaskItem
                                  key={task.id}
                                  task={task}
                                  onToggleComplete={handleToggleComplete}
                                  onDelete={handleDelete}
                                  onDeleteSeries={handleDeleteSeries}
                                  onAddSubtask={handleAddSubtask}
                                  onToggleSubtask={handleToggleSubtask}
                                  onDeleteSubtask={handleDeleteSubtask}
                                  onFocus={handleFocusTask}
                                  onUpdateTask={handleUpdateTask}
                                  collapseSignal={collapseAllTasksSignal}
                                />
                              ))}
                              {queueTasks.length === 0 && (
                                <div className="text-center py-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                                  <p className="text-slate-500 dark:text-slate-400 font-medium">Brak zadań w kolejce.</p>
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
                  <TaskForm onAdd={handleAddTask} categories={categories} />
                </div>
              </>
            )}

            {view === 'focus' && focusedTask && (
              <div className="flex flex-col gap-6 min-h-full pb-8">
                <FocusMode
                  task={focusedTask}
                  onBack={() => setView('tasks')}
                  onUpdateTask={handleUpdateTask}
                  onAddSubtask={handleAddSubtask}
                  onToggleSubtask={handleToggleSubtask}
                  onDeleteSubtask={handleDeleteSubtask}
                />
              </div>
            )}
          </div>

          <div className="w-[400px] flex-shrink-0">
            <DailyNotePanel
              date={format(selectedDate, 'yyyy-MM-dd')}
              content={dailyNotes[format(selectedDate, 'yyyy-MM-dd')] || ''}
              onChange={handleSaveDailyNote}
            />
            <DailyTimelineComponent
              timeline={dailyTimelines[format(selectedDate, 'yyyy-MM-dd')] || {
                id: `new-${format(selectedDate, 'yyyy-MM-dd')}`,
                user_id: ANONYMOUS_USER_ID,
                date: format(selectedDate, 'yyyy-MM-dd'),
                wake_up_time: '08:00',
                sleep_time: '00:00',
                events: [
                  {
                    id: `sleep-${format(selectedDate, 'yyyy-MM-dd')}`,
                    type: 'sleep',
                    time: '00:00',
                    title: 'Sen',
                    duration: 480,
                    color: 'indigo'
                  }
                ]
              }}
              onUpdate={handleSaveDailyTimeline}
            />
          </div>
        </div>
      )}

      {view === 'calendar' && (
        <CalendarView tasks={allTasks} dailyNotes={dailyNotes} onSaveDailyNote={handleSaveDailyNote} />
      )}

      {view === 'expected_payments' && (
        <>
          <PaymentForm onAdd={handleAddPayment} />
          <div className="space-y-3 mt-6">
            {sortedPayments.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                <p className="text-slate-500 dark:text-slate-400 font-medium">Brak przewidywanych wpłat.</p>
              </div>
            ) : (
              sortedPayments.map(payment => (
                <PaymentItem
                  key={payment.id}
                  payment={payment}
                  onToggleRealized={handleTogglePaymentRealized}
                  onDelete={handleDeletePayment}
                />
              ))
            )}
          </div>
        </>
      )}

      {view === 'rules' && (
        <RulesView />
      )}

      {view === 'goals' && (
        <GoalsView />
      )}

      {view === 'projects' && (
        <ProjectsView projects={projects} setProjects={setProjects} />
      )}
    </div>
  </main>
      </div>
    </div>
  );
}
