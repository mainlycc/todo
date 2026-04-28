import { format, isBefore, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { pl } from 'date-fns/locale';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { AppHeader } from './components/AppHeader';
import { CalendarView } from './components/CalendarView';
import { ClientsView } from './components/ClientsView';
import { DailyNotePanel } from './components/DailyNotePanel';
import { DaySidePanel } from './components/DaySidePanel';
import { ExpectedPaymentsView } from './components/ExpectedPaymentsView';
import { FocusMode } from './components/FocusMode';
import { GoalsView } from './components/GoalsView';
import { PaymentsHistoryView } from './components/PaymentsHistoryView';
import { PomyslyView } from './components/PomyslyView';
import { ProjectsView } from './components/ProjectsView';
import { RulesView } from './components/RulesView';
import { Sidebar } from './components/Sidebar';
import { TinderIdeasView } from './components/TinderIdeasView';
import { TaskTimer } from './components/TaskTimer';
import { TasksWorkspace } from './components/TasksWorkspace';
import { ANONYMOUS_USER_ID } from './constants';
import { QUEUE_DATE } from './constants/tasks';
import { useSupabaseEnv } from './hooks/useSupabaseEnv';
import { useSupabaseInitialData } from './hooks/useSupabaseInitialData';
import { buildDailyTimelineUpsertPayload } from './lib/dailyTimeline';
import { supabase } from './lib/supabase';
import type {
  DailyTimeline,
  DailyTimelineEvent,
  PaymentMonthOverride,
  Priority,
  Project,
  ProjectTask,
  RecurringTask,
  Task,
  TaskColor,
  ViewMode,
} from './types';
import { cn } from './utils';

export default function App() {
  const [view, setView] = useState<ViewMode>('tasks');
  const [openProjectTargetId, setOpenProjectTargetId] = useState<string | null>(null);

  const handleConsumedOpenProject = useCallback(() => {
    setOpenProjectTargetId(null);
  }, []);

  const handleOpenProjectFromTask = useCallback((projectId: string) => {
    setOpenProjectTargetId(projectId);
    setView('projects');
  }, []);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [collapseAllTasksSignal, setCollapseAllTasksSignal] = useState(0);
  const [paymentsMonth, setPaymentsMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [completionDates, setCompletionDates] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem('taskCompletionDates');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
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

  const { isSupabaseConfigured } = useSupabaseEnv();

  const {
    tasks,
    setTasks,
    recurringTasks,
    setRecurringTasks,
    payments,
    setPayments,
    paymentMonthOverrides,
    setPaymentMonthOverrides,
    dailyNotes,
    setDailyNotes,
    dailyTimelines,
    setDailyTimelines,
    hasCompletedTimelineBootstrap,
    projects,
    setProjects,
    goals,
    taskOrder,
    setTaskOrder,
  } = useSupabaseInitialData();

  const [activeTimerTask, setActiveTimerTask] = useState<Task | null>(null);

  useEffect(() => {
    localStorage.setItem('taskCompletionDates', JSON.stringify(completionDates));
  }, [completionDates]);

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

  // Nie zapisuj pustej listy zanim skończy się pierwszy fetch — inaczej nadpisujemy
  // user_projects wartością [] i kasujemy dane z poprzedniej sesji zanim migration z LS zadziała.
  // Gdy użytkownik doda projekt przed końcem fetchu, zapisujemy (projects.length > 0).
  useEffect(() => {
    if (!hasCompletedTimelineBootstrap && projects.length === 0) return;
    localStorage.setItem('user_projects', JSON.stringify(projects));
  }, [projects, hasCompletedTimelineBootstrap]);

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

  const emptyDailyTimelineFallback = useMemo(
    (): DailyTimeline => ({
      id: `new-${selectedDateStr}`,
      user_id: ANONYMOUS_USER_ID,
      date: selectedDateStr,
      wake_up_time: '08:00',
      sleep_time: '00:00',
      events: [
        {
          id: `sleep-${selectedDateStr}`,
          type: 'sleep',
          time: '00:00',
          title: 'Sen',
          duration: 480,
          color: '#1D4ED8',
        },
      ],
    }),
    [selectedDateStr]
  );

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

  const getProjectForTask = (task: Task): Project | undefined => {
    if (task.project_id) return projects.find(p => p.id === task.project_id);
    const name = (task.project_title || task.category || '').trim();
    if (!name) return undefined;
    return projects.find(p => p.title.toLowerCase() === name.toLowerCase());
  };

  const getGoalTitleForTask = (task: Task): string | null => {
    const gid = task.goal_id || null;
    if (!gid) return null;
    const g = goals.find(x => x.id === gid);
    return g?.title ?? null;
  };

  const normalizeTaskProjectMeta = (task: Task): Task => {
    if (task.project_id || task.project_title) return task;
    const p = getProjectForTask(task);
    if (!p) return task;
    return { ...task, project_id: p.id, project_title: p.title };
  };

  const ensureTaskInProjectKanban = async (task: Task) => {
    const normalized = normalizeTaskProjectMeta(task);
    const p = getProjectForTask(normalized);
    if (!p) return;

    const projTaskId = `proj_task_${normalized.id}`;
    const desiredStatus: ProjectTask['status'] = normalized.completed ? 'done' : 'do_zrobienia';

    // 1) Local state update (and then persist the project.tasks array)
    let didChange = false;
    setProjects(prev => {
      const next = prev.map(project => {
        if (project.id !== p.id) return project;

        const tasksArr = project.tasks || [];
        const idx = tasksArr.findIndex(pt => pt.id === projTaskId);
        if (idx === -1) {
          didChange = true;
          const newPt: ProjectTask = {
            id: projTaskId,
            title: normalized.title,
            status: desiredStatus,
            completed: normalized.completed,
            created_at: new Date().toISOString(),
            priority: normalized.priority,
            color: normalized.color || project.color,
            notes: normalized.notes || '',
            subtasks: normalized.subtasks || [],
            date: normalized.date,
            pomodoros_completed: normalized.pomodoros_completed || 0,
          };
          return { ...project, tasks: [...tasksArr, newPt] };
        }

        const existing = tasksArr[idx];
        const nextStatus = normalized.completed
          ? 'done'
          : (existing.status === 'in_progress' ? 'in_progress' : 'do_zrobienia');

        const updated: ProjectTask = {
          ...existing,
          title: normalized.title,
          completed: normalized.completed,
          status: nextStatus,
          priority: normalized.priority,
          color: normalized.color || existing.color,
          notes: normalized.notes || existing.notes,
          subtasks: normalized.subtasks || existing.subtasks,
          date: normalized.date,
          pomodoros_completed: normalized.pomodoros_completed || existing.pomodoros_completed,
        };

        // Cheap equality guard
        const changed =
          existing.title !== updated.title ||
          existing.completed !== updated.completed ||
          existing.status !== updated.status ||
          existing.priority !== updated.priority ||
          existing.color !== updated.color ||
          (existing.notes || '') !== (updated.notes || '') ||
          (existing.date || '') !== (updated.date || '') ||
          (existing.pomodoros_completed || 0) !== (updated.pomodoros_completed || 0) ||
          JSON.stringify(existing.subtasks || []) !== JSON.stringify(updated.subtasks || []);

        if (!changed) return project;
        didChange = true;
        const newTasks = [...tasksArr];
        newTasks[idx] = updated;
        return { ...project, tasks: newTasks };
      });
      return next;
    });

    // 2) Persist if we actually changed something
    if (didChange) {
      const latest = projects.find(pr => pr.id === p.id);
      const tasksToSave = latest?.tasks;
      // If state hasn't propagated yet, schedule a microtask to save using current state in closure
      queueMicrotask(() => {
        setProjects(curr => {
          const pr = curr.find(x => x.id === p.id);
          if (!pr) return curr;
          supabase.from('projects').update({ tasks: pr.tasks }).eq('id', p.id).then(({ error }) => {
            if (error) console.error('Error syncing task to project kanban:', error);
          });
          return curr;
        });
      });
    }
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
        priority: (pt.priority ?? p.priority ?? 'medium') as Priority,
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

  const baseTasks = tasks.map(normalizeTaskProjectMeta);
  // Jeśli zadanie jest połączone z projektem, tworzymy w kanbanie klona `proj_task_<taskId>`.
  // Nie chcemy go dublować w głównej liście zadań (Dzisiaj / Kolejka), więc filtrujemy te klony.
  const linkedProjectCloneIds = new Set(baseTasks.map(t => `proj_task_${t.id}`));
  const allTasks = [...baseTasks, ...projectTasksAsTasks.filter(t => !linkedProjectCloneIds.has(t.id))];

  const workBlockDoneTasksForDay = useMemo(
    () =>
      allTasks
        .filter(
          t =>
            t.completed &&
            (t.date === selectedDateStr || completionDates[t.id] === selectedDateStr)
        )
        .map(t => ({ id: t.id, title: t.title })),
    [allTasks, selectedDateStr, completionDates]
  );

  const WORK_BLOCK_HIDDEN_DATES_LS_KEY = 'daily_timeline_work_block_hidden_dates';
  const isWorkBlockEvent = (e: { type?: string; title?: string }) =>
    (e.type || '') === 'other' && (e.title || '').trim().toLowerCase() === 'praca';

  const readWorkBlockHiddenDates = (): Record<string, true> => {
    try {
      const raw = localStorage.getItem(WORK_BLOCK_HIDDEN_DATES_LS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed as Record<string, true>;
    } catch {
      return {};
    }
  };

  const setWorkBlockHiddenForDate = (date: string, hidden: boolean) => {
    try {
      const map = readWorkBlockHiddenDates();
      if (hidden) map[date] = true;
      else delete map[date];
      localStorage.setItem(WORK_BLOCK_HIDDEN_DATES_LS_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  };

  const isWorkBlockHiddenForDate = (date: string) => {
    const map = readWorkBlockHiddenDates();
    return !!map[date];
  };

  // Jeśli są ukończone zadania do pokazania, a harmonogram nie ma bloku „Praca”,
  // automatycznie go tworzymy dla wybranego dnia (żeby lista zawsze była widoczna w tym jednym bloku).
  useEffect(() => {
    if (!hasCompletedTimelineBootstrap) return;
    if (!selectedDateStr) return;
    if (workBlockDoneTasksForDay.length === 0) return;
    if (isWorkBlockHiddenForDate(selectedDateStr)) return;
    const current = dailyTimelines[selectedDateStr];
    // Brak zapisanego wiersza: bierzemy domyślny szablon (m.in. sen), żeby nie zapisać samej „Pracy” i nie nadpisać później pełnych danych z API.
    const base = current ?? emptyDailyTimelineFallback;
    const events = base.events || [];
    const hasWorkBlock = events.some(isWorkBlockEvent);
    if (hasWorkBlock) return;

    const nextTimeline: DailyTimeline = {
      id: base.id || crypto.randomUUID(),
      user_id: base.user_id || ANONYMOUS_USER_ID,
      date: selectedDateStr,
      wake_up_time: base.wake_up_time,
      sleep_time: base.sleep_time,
      events: [
        ...events,
        {
          id: crypto.randomUUID(),
          type: 'other',
          time: '09:00',
          title: 'Praca',
          duration: 90,
          color: 'indigo',
        },
      ],
    };

    handleSaveDailyTimelineForDate(selectedDateStr, nextTimeline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedDateStr,
    workBlockDoneTasksForDay.length,
    hasCompletedTimelineBootstrap,
    dailyTimelines[selectedDateStr],
    emptyDailyTimelineFallback,
  ]);

  const todayTasks = sortTasks(allTasks.filter(t => t.date === selectedDateStr), selectedDateStr);
  const queueTasksBase = allTasks
    .filter(t => t.date === QUEUE_DATE)
    .filter(t => !t.is_recurring)
    .filter(t => !t.completed || completionDates[t.id] === selectedDateStr);
  const queueTasks = queueSortMode === 'manual'
    ? sortTasks(queueTasksBase, QUEUE_DATE)
    : sortTasksByPriority(queueTasksBase);

  // Nie zmieniamy `date` zadań podczas dragOver: wtedy przy dragEnd stan ma jeszcze starą datę
  // z bazy, warunek `activeTask.date !== finalDate` jest spełniony i zapis do Supabase się wykonuje.
  // Gdybyśmy tu ustawiali QUEUE_DATE / selectedDateStr, po puszczeniu nad kolejką obie daty byłyby
  // już zsynchronizowane lokalnie i pomijalibyśmy UPDATE — po odświeżeniu zadanie wracało na listę „dziś”.
  const handleDragOver = (_event: DragOverEvent) => {};

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTask = allTasks.find(t => t.id === active.id);
    if (!activeTask) return;

    const isOverQueue = over.id === 'queue' || allTasks.find(t => t.id === over.id)?.date === QUEUE_DATE;
    const isOverToday = over.id === 'today' || allTasks.find(t => t.id === over.id)?.date === selectedDateStr;

    let finalDate = activeTask.date;
    if (isOverQueue && !activeTask.is_recurring) finalDate = QUEUE_DATE;
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

  const createProjectFromTaskForm = async (title: string): Promise<Project | null> => {
    const trimmed = title.trim();
    if (!trimmed) return null;

    const existing = projects.find(p => p.title.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;

    const generateId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    const COLORS = [
      '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#06b6d4',
      '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    ];

    const newProject: Project = {
      id: generateId(),
      user_id: ANONYMOUS_USER_ID,
      title: trimmed,
      description: '',
      tasks: [],
      notes: '',
      completed: false,
      created_at: new Date().toISOString(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      type: 'own',
      deadline: null,
      client_name: null,
      client_notion_page_id: null,
      priority: 'medium',
      turn: 'mine',
    };

    setProjects(prev => [newProject, ...prev]);

    const { error } = await supabase.from('projects').insert([newProject]);
    if (error) {
      console.error('Error adding project to Supabase:', error);
    }
    return newProject;
  };

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
          const linkedProjectName = (rt.category || '').trim();
          const linkedProject = linkedProjectName
            ? projects.find(p => p.title.toLowerCase() === linkedProjectName.toLowerCase())
            : undefined;

          const tasksWithSubtasks = taskData.map(t => {
            const base = { ...t, subtasks: [] } as Task;
            return linkedProject ? { ...base, project_id: linkedProject.id, project_title: linkedProject.title } : base;
          });
          setTasks(prev => [...tasksWithSubtasks, ...prev]);

          // Jeśli szablon cykliczny ma przypisany projekt (pole "Projekt"), dodaj wpis również do projektu
          const created = tasksWithSubtasks[0] as Task | undefined;
          if (created && linkedProject) {
              const projTaskId = `proj_task_${created.id}`;
              setProjects(prev => {
                const next = prev.map(p => {
                  if (p.id !== linkedProject.id) return p;
                  const exists = (p.tasks || []).some(pt => pt.id === projTaskId);
                  if (exists) return p;
                  const newPt: ProjectTask = {
                    id: projTaskId,
                    title: created.title,
                    status: 'do_zrobienia',
                    completed: false,
                    created_at: new Date().toISOString(),
                    priority: created.priority,
                    color: created.color,
                    notes: created.notes || '',
                    subtasks: created.subtasks || [],
                    date: created.date,
                    pomodoros_completed: created.pomodoros_completed || 0,
                  };
                  const newTasks = [...(p.tasks || []), newPt];
                  const updatedProject = { ...p, tasks: newTasks };
                  supabase.from('projects').update({ tasks: newTasks }).eq('id', p.id).then(({ error }) => {
                    if (error) console.error('Error adding linked recurring task to project:', error);
                  });
                  return updatedProject;
                });
                return next;
              });
          }
        }
      }
    } else {
      const normalizedTitle = title.trim().toLowerCase();
      const metric_kind =
        normalizedTitle === 'szukanie klientów'
          ? 'client_inquiry_sent'
          : normalizedTitle === 'szukanie pracy'
            ? 'cv_sent'
            : null;

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
          metric_kind,
          metric_count: metric_kind ? 0 : null,
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
        const projectName = category.trim();
        const linkedProject = projectName
          ? projects.find(p => p.title.toLowerCase() === projectName.toLowerCase())
          : undefined;

        const tasksWithSubtasks = data.map(t => {
          const base = { ...t, subtasks: [] } as Task;
          return linkedProject ? { ...base, project_id: linkedProject.id, project_title: linkedProject.title } : base;
        });
        setTasks(prev => [...tasksWithSubtasks, ...prev]);

        // Jeśli użytkownik wybrał projekt (w polu "Projekt"), dodaj też wpis do tego projektu (kanban)
        const created = tasksWithSubtasks[0] as Task | undefined;
        if (created && linkedProject) {
            const projTaskId = `proj_task_${created.id}`;
            setProjects(prev => {
              const next = prev.map(p => {
                if (p.id !== linkedProject.id) return p;
                const exists = (p.tasks || []).some(pt => pt.id === projTaskId);
                if (exists) return p;
                const newPt: ProjectTask = {
                  id: projTaskId,
                  title: created.title,
                  status: 'do_zrobienia',
                  completed: false,
                  created_at: new Date().toISOString(),
                  priority: created.priority,
                  color: created.color,
                  notes: created.notes || '',
                  subtasks: created.subtasks || [],
                  date: created.date,
                  pomodoros_completed: created.pomodoros_completed || 0,
                };
                const newTasks = [...(p.tasks || []), newPt];
                const updatedProject = { ...p, tasks: newTasks };
                supabase.from('projects').update({ tasks: newTasks }).eq('id', p.id).then(({ error }) => {
                  if (error) console.error('Error adding linked task to project:', error);
                });
                return updatedProject;
              });
              return next;
            });
        }
      }
    }
  };

  const handleAddTaskToGoal = async (goalId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          user_id: ANONYMOUS_USER_ID,
          title: trimmed,
          date: QUEUE_DATE,
          completed: false,
          priority: 'medium',
          category: '',
          color: 'indigo',
          pomodoros_completed: 0,
          metric_kind: null,
          metric_count: null,
          notes: '',
          due_date: null,
          goal_id: goalId,
        },
      ])
      .select();

    if (error) {
      console.error('Error adding goal task:', error);
      alert('Błąd podczas dodawania zadania do celu: ' + error.message);
      return;
    }

    if (data && data.length > 0) {
      const row = data[0] as Task;
      setTasks(prev => [{ ...row, subtasks: [] }, ...prev]);
    }
  };

  const handleToggleComplete = async (id: string) => {
    if (id.toString().startsWith('proj_task_')) {
      const targetTask = allTasks.find(t => t.id === id);
      const willBeCompleted = !(targetTask?.completed ?? false);
      setCompletionDates(prev => {
        // Ukończenie przypisujemy do aktualnie oglądanego dnia (selectedDateStr),
        // żeby zadanie nie znikało od razu z widoku tego dnia.
        if (willBeCompleted) return { ...prev, [id]: selectedDateStr };
        const { [id]: _, ...rest } = prev;
        return rest;
      });
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
      const willBeCompleted = !task.completed;
      setCompletionDates(prev => {
        // Ukończenie przypisujemy do aktualnie oglądanego dnia (selectedDateStr),
        // żeby zadanie nie znikało od razu z widoku tego dnia.
        if (willBeCompleted) return { ...prev, [id]: selectedDateStr };
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      setTasks(prev => prev.map(t => 
        t.id === id ? { ...t, completed: !t.completed } : t
      ));

      // Jeśli to zadanie jest przypisane do projektu (tag projektu), zsynchronizuj z kanbanem projektu.
      ensureTaskInProjectKanban({ ...task, completed: !task.completed });
    }
  };

  const handleDelete = async (id: string) => {
    if (id.toString().startsWith('proj_task_')) {
      updateProjectTask(id, pt => null);
      setCompletionDates(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
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
      setCompletionDates(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
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

      // Jeśli po edycji zadanie jest przypisane do projektu, upewnij się, że istnieje w kanbanie projektu.
      // (To naprawia przypadek: tag projektu w zadaniach, ale brak wpisu w `project.tasks`).
      ensureTaskInProjectKanban({ ...updatedTask, subtasks: updatedTask.subtasks || [] });
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

  const handleSaveDailyTimelineForDate = async (date: string, timeline: DailyTimeline) => {
    // Jeśli użytkownik ręcznie usunął blok „Praca”, zapamiętujemy to per-data,
    // żeby automatyczne „bootstrapowanie” nie dodawało go z powrotem.
    try {
      const prev = dailyTimelines[date];
      const prevHasWork = !!(prev?.events || []).some(isWorkBlockEvent);
      const nextHasWork = !!(timeline?.events || []).some(isWorkBlockEvent);
      if (prevHasWork && !nextHasWork) setWorkBlockHiddenForDate(date, true);
      if (nextHasWork) setWorkBlockHiddenForDate(date, false);
    } catch {
      /* ignore */
    }

    const optimistic: DailyTimeline = {
      ...timeline,
      user_id: ANONYMOUS_USER_ID,
      date,
      events: timeline.events || [],
    };

    // Optymistycznie aktualizuj stan lokalny od razu, żeby kolejne szybkie akcje (dodawanie eventów)
    // nie bazowały na starych propsach i nie nadpisywały poprzednich zmian.
    setDailyTimelines(prev => ({
      ...prev,
      [date]: optimistic
    }));

    if (!isSupabaseConfigured) {
      try {
        const saved = localStorage.getItem('daily_timelines') || '{}';
        const parsed = JSON.parse(saved);
        parsed[date] = optimistic;
        localStorage.setItem('daily_timelines', JSON.stringify(parsed));
      } catch {
        /* ignore */
      }
      return;
    }

    try {
      const payload = buildDailyTimelineUpsertPayload(optimistic, date);

      const { data, error } = await supabase
        .from('daily_timelines')
        .upsert(payload, { onConflict: 'user_id,date' })
        .select()
        .maybeSingle();

      if (error) throw error;

      const row = data as DailyTimeline | null;
      // Zostawiamy treść zapisu (optimistic); z API bierzemy głównie `id` po pierwszym insertcie — pełna odpowiedź bywa niepełna i mogłaby wyczyścić `events`.
      const merged: DailyTimeline = {
        ...optimistic,
        id: row?.id ?? optimistic.id,
      };

      setDailyTimelines(prev => ({
        ...prev,
        [date]: merged
      }));

      try {
        const saved = localStorage.getItem('daily_timelines') || '{}';
        const parsed = JSON.parse(saved);
        parsed[date] = merged;
        localStorage.setItem('daily_timelines', JSON.stringify(parsed));
      } catch {
        /* ignore */
      }
    } catch (err: any) {
      console.error('Error saving daily timeline:', err);
      // Fallback to local storage if table doesn't exist
      const saved = localStorage.getItem('daily_timelines') || '{}';
      const parsed = JSON.parse(saved);
      parsed[date] = optimistic;
      localStorage.setItem('daily_timelines', JSON.stringify(parsed));
    }
  };

  const handleSaveDailyTimeline = async (timeline: DailyTimeline) => {
    return handleSaveDailyTimelineForDate(selectedDateStr, timeline);
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
  const handleAddPayment = async (
    title: string,
    date: string,
    net_amount: number,
    gross_amount: number,
    projectId: string | null,
    isRealized: boolean
  ) => {
    if (!isSupabaseConfigured) {
      alert('Supabase nie jest skonfigurowane (brak VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Nie zapisano wpłaty.');
      return;
    }
    const { data, error } = await supabase
      .from('payments')
      .insert([{
        user_id: ANONYMOUS_USER_ID,
        title,
        date,
        net_amount,
        gross_amount,
        is_realized: isRealized,
        project_id: projectId
      }])
      .select();

    if (error) {
      console.error('Error adding payment:', error);
      alert('Błąd podczas dodawania płatności: ' + error.message);
      return;
    }

    if (data) {
      setPayments(prev => [...data, ...prev].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setPaymentsMonth(startOfMonth(new Date(date)));
    }
  };

  const handleTogglePaymentRealized = async (id: string) => {
    if (!isSupabaseConfigured) {
      alert('Supabase nie jest skonfigurowane. Nie zapisano zmiany statusu wpłaty.');
      return;
    }
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
    if (!isSupabaseConfigured) {
      alert('Supabase nie jest skonfigurowane. Nie usunięto wpłaty.');
      return;
    }
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id);

    if (!error) {
      setPayments(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleUpsertPaymentMonthOverride = async (month: string, net_total_override: number, gross_total_override: number) => {
    if (!isSupabaseConfigured) {
      alert('Supabase nie jest skonfigurowane. Nie zapisano override dla miesiąca.');
      return;
    }
    const payload = {
      user_id: ANONYMOUS_USER_ID,
      month,
      net_total_override,
      gross_total_override,
    };

    const { data, error } = await supabase
      .from('payment_month_overrides')
      .upsert(payload as any, { onConflict: 'user_id,month' })
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error upserting payment month override:', error);
      alert('Nie udało się zapisać nadpisania dla miesiąca.');
      return;
    }

    if (data) {
      setPaymentMonthOverrides(prev => {
        const next = [...prev];
        const idx = next.findIndex(o => o.user_id === data.user_id && o.month === data.month);
        if (idx === -1) return [data as PaymentMonthOverride, ...next];
        next[idx] = data as PaymentMonthOverride;
        return next;
      });
    }
  };

  const currentMonthStr = format(paymentsMonth, 'yyyy-MM');
  const thisMonthPayments = payments.filter(p => p.date.startsWith(currentMonthStr));
  
  // Total predicted is everything in this month, regardless of status
  const sumNetTotal = thisMonthPayments.reduce((acc, p) => acc + p.net_amount, 0);
  const sumGrossTotal = thisMonthPayments.reduce((acc, p) => acc + p.gross_amount, 0);
  
  const realizedThisMonth = thisMonthPayments.filter(p => p.is_realized);
  const sumNetRealized = realizedThisMonth.reduce((acc, p) => acc + p.net_amount, 0);
  const sumGrossRealized = realizedThisMonth.reduce((acc, p) => acc + p.gross_amount, 0);

  const sortedPayments = [...thisMonthPayments].sort((a, b) => {
    if (a.is_realized !== b.is_realized) return a.is_realized ? 1 : -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const focusedTask = allTasks.find(t => t.id === focusedTaskId);

  const handleStopTimer = async (elapsedSeconds: number) => {
    if (!activeTimerTask) return;

    if (elapsedSeconds > 300) {
      const durationMinutes = Math.ceil(elapsedSeconds / 60);
      const now = new Date();
      const startTime = new Date(now.getTime() - elapsedSeconds * 1000);
      const startStr = format(startTime, 'HH:mm');
      const endStr = format(now, 'HH:mm');
      const todayStr = format(now, 'yyyy-MM-dd');
      const line = `${startStr}–${endStr} · ${durationMinutes}m · ${activeTimerTask.title}`;

      const existing = dailyTimelines[todayStr];
      const events = [...(existing?.events || [])];
      const workIdx = events.findIndex(
        e => e.type === 'other' && e.title.trim().toLowerCase() === 'praca'
      );

      let nextEvents: DailyTimelineEvent[];
      if (workIdx !== -1) {
        const w = events[workIdx];
        const prev = (w.notes || '').trim();
        nextEvents = events.map((e, i) =>
          i === workIdx ? { ...e, notes: prev ? `${prev}\n${line}` : line } : e
        );
      } else {
        nextEvents = [
          ...events,
          {
            id: crypto.randomUUID(),
            type: 'other',
            time: startStr,
            title: 'Praca',
            duration: Math.max(90, durationMinutes),
            color: 'indigo',
            notes: line,
          },
        ];
      }

      const nextTimeline: DailyTimeline = {
        id: existing?.id || crypto.randomUUID(),
        user_id: existing?.user_id || ANONYMOUS_USER_ID,
        date: todayStr,
        wake_up_time: existing?.wake_up_time,
        sleep_time: existing?.sleep_time,
        events: nextEvents,
      };

      await handleSaveDailyTimelineForDate(todayStr, nextTimeline);
    }

    setActiveTimerTask(null);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-tp-canvas overflow-hidden transition-colors duration-300">
      {activeTimerTask && (
        <TaskTimer
          key={activeTimerTask.id}
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
        <AppHeader
          view={view}
          isMinimalView={isMinimalView}
          setIsMinimalView={setIsMinimalView}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          paymentsMonth={paymentsMonth}
          setPaymentsMonth={setPaymentsMonth}
          tasksHeaderGrossRealized={sumGrossRealized}
          tasksHeaderGrossTotal={sumGrossTotal}
          expectedPaymentsCount={thisMonthPayments.length}
          realizedThisMonthCount={realizedThisMonth.length}
          sumNetTotal={sumNetTotal}
          sumGrossTotal={sumGrossTotal}
          sumNetRealized={sumNetRealized}
          sumGrossRealized={sumGrossRealized}
        />

        <main data-app-main className="flex-1 overflow-y-auto p-8 relative">
          <div
            className={cn(
              'mx-auto h-full',
              view === 'tasks' ||
                view === 'focus' ||
                view === 'expected_payments' ||
                view === 'rules' ||
                view === 'goals' ||
                view === 'pomysly' ||
              view === 'tinder' ||
                view === 'projects' ||
                view === 'clients'
                ? 'max-w-7xl'
                : 'max-w-3xl'
            )}
          >
            {(view === 'tasks' || view === 'focus') && (
              <div className="flex gap-8 h-full items-start">
                <div className="flex-1 min-w-0">
                  {view === 'tasks' && (
                    <TasksWorkspace
                      selectedDate={selectedDate}
                      onSelectDate={setSelectedDate}
                      isMinimalView={isMinimalView}
                      queueSortMode={queueSortMode}
                      setQueueSortMode={setQueueSortMode}
                      todayTasks={todayTasks}
                      queueTasks={queueTasks}
                      projects={projects}
                      getGoalTitleForTask={getGoalTitleForTask}
                      collapseAllTasksSignal={collapseAllTasksSignal}
                      onCollapseAllTasks={() => setCollapseAllTasksSignal(v => v + 1)}
                      onMoveToQueue={handleMoveToQueue}
                      onAddTask={handleAddTask}
                      onCreateProjectFromTaskForm={createProjectFromTaskForm}
                      onToggleComplete={handleToggleComplete}
                      onUpdateTask={handleUpdateTask}
                      onDelete={handleDelete}
                      onDeleteSeries={handleDeleteSeries}
                      onAddSubtask={handleAddSubtask}
                      onToggleSubtask={handleToggleSubtask}
                      onDeleteSubtask={handleDeleteSubtask}
                      onFocusTask={handleFocusTask}
                      onOpenProjectFromTask={handleOpenProjectFromTask}
                      getProjectForTask={getProjectForTask}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                    />
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
                <DaySidePanel
                  selectedDateStr={selectedDateStr}
                  dailyNoteContent={dailyNotes[selectedDateStr] || ''}
                  onSaveDailyNote={handleSaveDailyNote}
                  dailyTimeline={dailyTimelines[selectedDateStr] || emptyDailyTimelineFallback}
                  onSaveDailyTimeline={handleSaveDailyTimeline}
                  workBlockDoneTasksForDay={workBlockDoneTasksForDay}
                />
              </div>
            )}

            {view === 'calendar' && (
              <CalendarView
                tasks={allTasks}
                dailyNotes={dailyNotes}
                onSaveDailyNote={handleSaveDailyNote}
                dailyTimelines={dailyTimelines}
                onSaveDailyTimeline={handleSaveDailyTimelineForDate}
                projects={projects}
                completionDates={completionDates}
              />
            )}

            {view === 'expected_payments' && (
              <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
                <div className="flex-1 min-w-0 w-full lg:max-w-3xl">
                  <ExpectedPaymentsView
                    sortedPayments={sortedPayments}
                    projects={projects}
                    onAddPayment={handleAddPayment}
                    onTogglePaymentRealized={handleTogglePaymentRealized}
                    onDeletePayment={handleDeletePayment}
                  />
                </div>
                <aside className="w-full lg:w-[440px] xl:w-[500px] lg:flex-shrink-0 lg:sticky lg:top-4 self-start flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3 px-1">
                    <label
                      htmlFor="expected-payments-note-date"
                      className="text-sm font-medium text-slate-700 dark:text-slate-200 shrink-0"
                    >
                      Dzień notatki
                    </label>
                    <input
                      id="expected-payments-note-date"
                      type="date"
                      value={selectedDateStr}
                      onChange={e => {
                        const v = e.target.value;
                        if (!v) return;
                        setSelectedDate(startOfDay(parseISO(v)));
                      }}
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-tp-surface px-3 py-2 text-sm text-slate-900 dark:text-white shadow-sm"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                      {format(selectedDate, 'EEEE, d MMM yyyy', { locale: pl })}
                    </span>
                  </div>
                  <div className="h-[min(560px,calc(100vh-14rem))] min-h-[280px] flex flex-col w-full">
                    <DailyNotePanel
                      date={selectedDateStr}
                      content={dailyNotes[selectedDateStr] || ''}
                      onChange={handleSaveDailyNote}
                    />
                  </div>
                </aside>
              </div>
            )}

            {view === 'payments_history' && (
              <PaymentsHistoryView
                payments={payments}
                overrides={paymentMonthOverrides}
                onUpsertOverride={handleUpsertPaymentMonthOverride}
                projects={projects}
                onAddPayment={handleAddPayment}
              />
            )}

            {view === 'rules' && <RulesView />}

            {view === 'goals' && (
              <GoalsView
                tasks={tasks}
                onAddTaskToGoal={handleAddTaskToGoal}
                onToggleTaskComplete={handleToggleComplete}
                onDeleteTask={handleDelete}
              />
            )}

            {view === 'pomysly' && <PomyslyView />}

            {view === 'tinder' && (
              <TinderIdeasView
                dailyNotes={dailyNotes}
                onSaveDailyNote={handleSaveDailyNote}
              />
            )}

            {view === 'projects' && (
              <ProjectsView
                projects={projects}
                setProjects={setProjects}
                payments={payments}
                openProjectId={openProjectTargetId}
                onConsumedOpenProject={handleConsumedOpenProject}
              />
            )}

            {view === 'clients' && <ClientsView />}
          </div>
        </main>
      </div>
    </div>
  );
}
