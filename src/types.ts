export type Priority = 'low' | 'medium' | 'high';
export type TaskColor = string;

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface RecurringTask {
  id: string;
  user_id: string;
  title: string;
  priority: Priority;
  category: string;
  color?: TaskColor;
  due_date?: string | null;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  priority: Priority;
  category: string;
  color?: TaskColor;
  subtasks: Subtask[];
  notes?: string | null;
  pomodoros_completed?: number;
  is_recurring?: boolean;
  recurring_template_id?: string | null;
  due_date?: string | null;
  project_id?: string;
  project_title?: string;
  kanban_status?: KanbanStatus;
}

export interface Payment {
  id: string;
  user_id: string;
  title: string;
  date: string; // YYYY-MM-DD
  net_amount: number;
  gross_amount: number;
  is_realized: boolean;
}

export interface DailyNote {
  id: string;
  user_id: string;
  date: string;
  content: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  subtasks: Subtask[];
  completed: boolean;
  created_at: string;
}

export type KanbanStatus = 'poczekalnia' | 'do_zrobienia' | 'in_progress' | 'done';

export interface ProjectTask {
  id: string;
  title: string;
  status: KanbanStatus;
  notes?: string;
  priority?: Priority;
  color?: TaskColor;
  completed: boolean;
  created_at: string;
  subtasks?: Subtask[];
  date?: string;
  pomodoros_completed?: number;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  tasks: ProjectTask[];
  notes?: string;
  completed: boolean;
  created_at: string;
  color?: string;
  link?: string;
  emoji?: string;
  type?: 'own' | 'client';
}

export interface DailyTimelineEvent {
  id: string;
  type: string;
  time: string;
  title: string;
  notes?: string;
  color?: string;
  duration?: number; // in minutes
}

export interface DailyTimeline {
  id: string;
  user_id: string;
  date: string;
  wake_up_time?: string;
  sleep_time?: string;
  events: DailyTimelineEvent[];
}

export type ViewMode = 'tasks' | 'calendar' | 'expected_payments' | 'focus' | 'rules' | 'goals' | 'projects';
