export type Priority = 'low' | 'medium' | 'high';
/** Czyja kolej w komunikacji z klientem: ja działam vs czekam na drugą stronę. */
export type ProjectTurn = 'mine' | 'theirs';
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
  /** Licznik dla zadań typu "wysłane CV" / "wysłane zapytania" itp. */
  metric_kind?: 'cv_sent' | 'client_inquiry_sent' | null;
  metric_count?: number | null;
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
  project_id?: string | null;
}

export interface PaymentMonthOverride {
  id: string;
  user_id: string;
  month: string; // YYYY-MM
  net_total_override: number;
  gross_total_override: number;
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
  /** Bogata notatka (HTML z TipTap), jak w projektach */
  notes?: string;
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
  deadline?: string | null; // YYYY-MM-DD
  /** Nazwa klienta przypisana do projektu (wybór z Notion lub ręczny wpis). */
  client_name?: string | null;
  /** Jeśli wybrano klienta z Notion (tabela notion_clients) — jego `notion_page_id`. */
  client_notion_page_id?: string | null;
  /** Priorytet domyślny dla zadań w tym projekcie (gdy zadanie nie ma własnego). */
  priority?: Priority;
  /** Kolejka kontaktu: `mine` — Twoja kolej (👉), `theirs` — kolej klienta (👆). */
  turn?: ProjectTurn;
}

export interface DailyTimelineEvent {
  id: string;
  type: string;
  time: string;
  title: string;
  notes?: string;
  color?: string;
  duration?: number; // in minutes
  project_id?: string | null;
}

export interface DailyTimeline {
  id: string;
  user_id: string;
  date: string;
  wake_up_time?: string;
  sleep_time?: string;
  events: DailyTimelineEvent[];
}

export type ViewMode =
  | 'tasks'
  | 'calendar'
  | 'expected_payments'
  | 'payments_history'
  | 'focus'
  | 'rules'
  | 'goals'
  | 'projects'
  | 'clients'
  | 'pomysly';

/** Wiersz tabeli `ideas` (pomysły → Notion + Supabase). */
export interface IdeaRow {
  id: string;
  user_id: string;
  content: string;
  notion_page_id: string | null;
  created_at: string;
}

/** Wiersz kopii bazy klientów z Notion (Supabase: notion_clients). */
export interface NotionClientRow {
  notion_page_id: string;
  user_id: string;
  title: string;
  notion_properties: Record<string, unknown>;
  last_edited_time: string | null;
  synced_at: string;
}
