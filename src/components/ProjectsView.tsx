import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Briefcase,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Save,
  X,
  Edit2,
  ArrowRight,
  ArrowLeft,
  Link as LinkIcon,
  Smile,
  ArrowLeft as BackIcon,
  Calendar,
  DollarSign,
  FileText,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Payment, Project, ProjectTask, KanbanStatus, Priority, ProjectTurn } from '../types';
import { cn } from '../utils';
import { ProjectTurnGlyph } from './ProjectTurnVisual';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { useEditor, EditorContent } from '@tiptap/react';
import {
  createRichNoteExtensions,
  RICH_NOTE_EDITOR_CONTENT_CLASS,
  RichNoteFormattingMenuBar,
} from './richNoteEditor';
import { readExpandOverlayLayout } from '../lib/expandNoteOverlayLayout';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { ANONYMOUS_USER_ID } from '../constants';

interface ProjectsViewProps {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  payments: Payment[];
  /** Ustawiane z listy zadań — otwórz od razu szczegóły projektu o tym id */
  openProjectId?: string | null;
  onConsumedOpenProject?: () => void;
}

const COLORS = [
  '#ef4444', // Red 500
  '#f97316', // Orange 500
  '#f59e0b', // Amber 500
  '#eab308', // Yellow 500
  '#84cc16', // Lime 500
  '#22c55e', // Green 500
  '#10b981', // Emerald 500
  '#06b6d4', // Cyan 500
  '#0ea5e9', // Sky 500
  '#3b82f6', // Blue 500
  '#6366f1', // Indigo 500
  '#8b5cf6', // Violet 500
  '#a855f7', // Purple 500
  '#d946ef', // Fuchsia 500
  '#ec4899', // Pink 500
  '#f43f5e', // Rose 500
];

export function ProjectsView({ projects, setProjects, payments, openProjectId, onConsumedOpenProject }: ProjectsViewProps) {
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectType, setNewProjectType] = useState<'own' | 'client'>('own');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'created_at' | 'type' | 'title'>('created_at');

  useEffect(() => {
    if (!openProjectId) return;
    const exists = projects.some(p => p.id === openProjectId);
    if (exists) {
      setExpandedProjectId(openProjectId);
      onConsumedOpenProject?.();
      return;
    }
    // Projekty już załadowane, ale id nie istnieje — nie zostawiaj „wiszącego” żądania w rodzicu
    if (projects.length > 0) {
      onConsumedOpenProject?.();
    }
  }, [openProjectId, projects, onConsumedOpenProject]);

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const pendingPaidProjectIds = new Set(
    payments
      .filter(p => !!p.project_id)
      .filter(p => p.date?.startsWith(currentMonth))
      .filter(p => !p.is_realized)
      .map(p => p.project_id as string)
  );

  const handleAddProject = async () => {
    if (!newProjectTitle.trim()) return;

    // Fallback for crypto.randomUUID()
    const generateId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    const newProject: Project = {
      id: generateId(),
      user_id: ANONYMOUS_USER_ID,
      title: newProjectTitle.trim(),
      description: '',
      tasks: [],
      notes: '',
      completed: false,
      created_at: new Date().toISOString(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      type: newProjectType,
      priority: 'medium',
      turn: 'mine',
    };

    // Update local state first for immediate feedback
    setProjects([newProject, ...projects]);
    setNewProjectTitle('');
    setIsAddingProject(false);
    setExpandedProjectId(newProject.id);

    if (!isSupabaseConfigured) {
      console.error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Project saved only locally.');
      return;
    }

    // Nie wysyłaj pól, które są puste/null — jeśli dana kolumna nie istnieje w DB (np. deadline),
    // PostgREST odrzuci insert/update nawet gdy wartość jest null.
    const row: any = { ...newProject };
    if (row.deadline == null || row.deadline === '') delete row.deadline;

    const { error } = await supabase.from('projects').insert([row]);
    if (error) {
      console.error('Error adding project to Supabase:', error);
      // We keep it locally even if Supabase fails, but we could optionally revert here
    }
  };

  const handleUpdateProject = async (updatedProject: Project) => {
    // Update local state first for immediate feedback
    const newProjects = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
    setProjects(newProjects);

    if (!isSupabaseConfigured) {
      console.error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Project updated only locally.');
      return;
    }

    // Nie wysyłaj `id` w treści PATCH — PostgREST może odrzucić żądanie; wtedy nic nie trafia do bazy.
    const { id, ...row } = updatedProject as any;
    if ((row as any).deadline == null || (row as any).deadline === '') delete (row as any).deadline;
    const { error } = await supabase.from('projects').update(row).eq('id', id);
    if (error) {
      console.error('Error updating project in Supabase:', error);
      // If it fails, we might want to revert or just leave it local
      // For now, we keep the local change as it's better than nothing
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!isSupabaseConfigured) {
      console.error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Project deleted only locally.');
      const newProjects = projects.filter(p => p.id !== id);
      setProjects(newProjects);
      if (expandedProjectId === id) {
        setExpandedProjectId(null);
      }
      return;
    }
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (!error) {
      const newProjects = projects.filter(p => p.id !== id);
      setProjects(newProjects);
      if (expandedProjectId === id) {
        setExpandedProjectId(null);
      }
    } else {
      console.error('Error deleting project:', error);
    }
  };

  const toggleProjectCompletion = (project: Project) => {
    handleUpdateProject({ ...project, completed: !project.completed });
  };

  const sortWithinGroup = (list: Project[]) =>
    [...list].sort((a, b) => {
      if (sortBy === 'type') {
        // przy podziale na kolumny typ jest już ustalony, więc w ramach kolumny sortuj po nazwie
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const clientProjects = sortWithinGroup(projects.filter(p => (p.type || 'own') === 'client'));
  const ownProjects = sortWithinGroup(projects.filter(p => (p.type || 'own') !== 'client'));

  const expandedProject = projects.find(p => p.id === expandedProjectId);

  if (expandedProject) {
    return (
      <ProjectDetail
        key={expandedProject.id}
        project={expandedProject}
        onBack={() => setExpandedProjectId(null)}
        onUpdate={handleUpdateProject}
        onDelete={() => handleDeleteProject(expandedProject.id)}
        onToggleComplete={() => toggleProjectCompletion(expandedProject)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Projekty</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Zarządzaj swoimi projektami, zadaniami i notatkami</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white dark:bg-tp-surface border border-slate-200 dark:border-white/6 rounded-xl px-3 py-2 text-sm text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="created_at">Sortuj: Data dodania</option>
            <option value="type">Sortuj: Typ (OWN/CLI)</option>
            <option value="title">Sortuj: Nazwa</option>
          </select>
          <button
            onClick={() => setIsAddingProject(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Dodaj projekt
          </button>
        </div>
      </div>

      <div className="flex-1 pr-2 pb-8">
        {isAddingProject && (
          <div className="bg-white dark:bg-tp-surface rounded-2xl border-2 border-indigo-500 p-6 shadow-lg animate-in fade-in slide-in-from-top-4 duration-200 mb-6">
            <input
              type="text"
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              placeholder="Nazwa projektu..."
              className="w-full text-xl font-bold bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white placeholder:text-slate-400"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
            />
            <div className="flex items-center gap-4 mt-4">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Typ projektu:</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewProjectType('own')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    newProjectType === 'own' 
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 ring-1 ring-indigo-500" 
                      : "bg-slate-100 text-slate-600 dark:bg-tp-muted dark:text-slate-400 hover:bg-slate-200"
                  )}
                >
                  OWN (Własny)
                </button>
                <button
                  type="button"
                  onClick={() => setNewProjectType('client')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    newProjectType === 'client' 
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-500" 
                      : "bg-slate-100 text-slate-600 dark:bg-tp-muted dark:text-slate-400 hover:bg-slate-200"
                  )}
                >
                  CLI (Klient)
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setIsAddingProject(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-tp-muted rounded-xl transition-colors">
                Anuluj
              </button>
              <button onClick={handleAddProject} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                Stwórz projekt
              </button>
            </div>
          </div>
        )}

        {projects.length === 0 && !isAddingProject ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Briefcase className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Nie masz jeszcze żadnych projektów.</p>
            <p className="text-sm">Dodaj swój pierwszy projekt, aby zacząć działać.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-32 items-start">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                Klienci (CLI)
              </div>
              <div className="grid grid-cols-2 gap-3 justify-items-start">
                {clientProjects.map(project => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    onClick={() => setExpandedProjectId(project.id)}
                    onToggleComplete={() => toggleProjectCompletion(project)}
                    onSetPriority={(p) => handleUpdateProject({ ...project, priority: p })}
                    onToggleTurn={() =>
                      handleUpdateProject({
                        ...project,
                        turn: (project.turn || 'mine') === 'mine' ? 'theirs' : 'mine',
                      })
                    }
                    showDollar={pendingPaidProjectIds.has(project.id)}
                  />
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                Prywatne (OWN)
              </div>
              <div className="grid grid-cols-2 gap-3 justify-items-start">
                {ownProjects.map(project => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    onClick={() => setExpandedProjectId(project.id)}
                    onToggleComplete={() => toggleProjectCompletion(project)}
                    onSetPriority={(p) => handleUpdateProject({ ...project, priority: p })}
                    onToggleTurn={() =>
                      handleUpdateProject({
                        ...project,
                        turn: (project.turn || 'mine') === 'mine' ? 'theirs' : 'mine',
                      })
                    }
                    showDollar={pendingPaidProjectIds.has(project.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PriorityDots({
  priority,
  onChange,
  sizeClass = 'w-3.5 h-3.5',
  gapClass = 'gap-1',
  className,
}: {
  priority: Priority;
  onChange: (p: Priority) => void;
  sizeClass?: string;
  gapClass?: string;
  className?: string;
}) {
  const level: 1 | 2 | 3 = priority === 'low' ? 1 : priority === 'medium' ? 2 : 3;
  const litColorClass =
    level === 1
      ? 'bg-emerald-500 dark:bg-emerald-400'
      : level === 2
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-rose-500 dark:bg-rose-400';

  const baseDot =
    'rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.18)]';

  const offDot = 'bg-slate-200 dark:bg-tp-raised hover:bg-slate-300 dark:hover:bg-neutral-600';

  return (
    <div className={cn('flex items-center', gapClass, className)} aria-label="Priorytet">
      <button
        type="button"
        onClick={() => onChange('low')}
        className={cn(baseDot, sizeClass, level >= 1 ? litColorClass : offDot)}
        title="Priorytet: luz (1 kropka)"
      />
      <button
        type="button"
        onClick={() => onChange('medium')}
        className={cn(baseDot, sizeClass, level >= 2 ? litColorClass : offDot)}
        title="Priorytet: ważne (2 kropki)"
      />
      <button
        type="button"
        onClick={() => onChange('high')}
        className={cn(baseDot, sizeClass, level >= 3 ? litColorClass : offDot)}
        title="Priorytet: turbo pilne (3 kropki)"
      />
    </div>
  );
}

function ProjectTurnToggle({
  turn,
  onToggle,
  size = 'sm',
  variant = 'icon',
  className,
}: {
  turn: ProjectTurn;
  onToggle: () => void;
  size?: 'sm' | 'md';
  variant?: 'icon' | 'label';
  className?: string;
}) {
  const isMine = turn === 'mine';
  const pad = size === 'sm' ? 'p-1.5' : 'p-2';

  if (variant === 'label') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          'w-full text-left text-[10px] font-bold uppercase tracking-wide py-1.5 px-2.5 rounded-lg border-2 shadow-sm transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          isMine
            ? [
                'bg-emerald-600 border-emerald-700 text-white',
                'hover:bg-emerald-500 hover:border-emerald-600',
                'dark:bg-emerald-600 dark:border-emerald-500 dark:hover:bg-emerald-500',
                'focus-visible:ring-emerald-400',
              ]
            : [
                'bg-red-600 border-red-700 text-white',
                'hover:bg-red-500 hover:border-red-600',
                'dark:bg-red-600 dark:border-red-500 dark:hover:bg-red-500',
                'focus-visible:ring-red-400',
              ],
          className
        )}
        title={isMine ? 'Kliknij, aby ustawić: ruch klienta' : 'Kliknij, aby ustawić: twój ruch'}
      >
        {isMine ? 'Twój ruch' : 'Ruch klienta'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        pad,
        'shrink-0 rounded-xl border-2 shadow-sm transition-all leading-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        isMine
          ? [
              'bg-emerald-600 border-emerald-700',
              'hover:bg-emerald-500 hover:border-emerald-600',
              'dark:bg-emerald-600 dark:border-emerald-500 dark:hover:bg-emerald-500',
              'focus-visible:ring-emerald-400',
            ]
          : [
              'bg-red-600 border-red-700',
              'hover:bg-red-500 hover:border-red-600',
              'dark:bg-red-600 dark:border-red-500 dark:hover:bg-red-500',
              'focus-visible:ring-red-400',
            ],
        className
      )}
      title={isMine ? 'Twoja kolej' : 'Kolej klienta'}
    >
      <ProjectTurnGlyph
        turn={turn}
        size={size === 'sm' ? 'sm' : 'md'}
        className="brightness-110 contrast-125 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
      />
    </button>
  );
}

function ProjectCard({
  project,
  onClick,
  onToggleComplete,
  onSetPriority,
  onToggleTurn,
  showDollar,
}: {
  project: Project;
  onClick: () => void;
  onToggleComplete: () => void;
  onSetPriority: (p: Priority) => void;
  onToggleTurn: () => void;
  showDollar: boolean;
}) {
  const totalTasks = project.tasks?.length || 0;
  const completedTasks = project.tasks?.filter(t => t.status === 'done').length || 0;
  const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  const turn = (project.turn || 'mine') as ProjectTurn;
  const myTurnHighlight = turn === 'mine' && !project.completed;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer p-3 flex flex-col gap-2 relative overflow-hidden group h-40 w-full max-w-[260px]",
        myTurnHighlight
          ? "border-2 border-emerald-500 dark:border-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.45),0_16px_36px_-12px_rgba(5,150,105,0.55)] dark:shadow-[0_0_0_3px_rgba(52,211,153,0.5),0_16px_36px_-12px_rgba(16,185,129,0.45)] after:absolute after:inset-0 after:rounded-2xl after:bg-emerald-200/55 dark:after:bg-emerald-600/25 after:pointer-events-none"
          : "border border-slate-200 dark:border-white/6 hover:border-indigo-300 dark:hover:border-indigo-700",
        project.completed && "opacity-75",
        myTurnHighlight &&
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:ring-2 before:ring-inset before:ring-emerald-500/80 dark:before:ring-emerald-300/70 before:z-[1]"
      )}
      style={{ 
        backgroundColor: project.color ? `${project.color}20` : 'var(--tw-colors-white)',
        borderColor: myTurnHighlight ? undefined : (project.color ? `${project.color}60` : undefined)
      }}
    >
      <div className={cn('flex justify-between items-start', myTurnHighlight && 'relative z-10')}>
        <div className="flex items-start gap-1.5 min-w-0">
          <button onClick={(e) => { e.stopPropagation(); onToggleComplete(); }} className="flex-shrink-0 mt-0.5">
            {project.completed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <Circle className="w-4 h-4 text-slate-400 dark:text-slate-500 hover:text-indigo-500 transition-colors" />
            )}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={cn(
                "text-[8px] px-1 py-0.5 rounded-md font-bold uppercase tracking-wider",
                project.type === 'client' 
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200" 
                  : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200"
              )}>
                {project.type === 'client' ? 'CLI' : 'OWN'}
              </span>
              <div
                className="px-1 py-0.5 rounded-md bg-white/70 dark:bg-black/25 border border-black/10 dark:border-white/10"
                title="Priorytet projektu"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <PriorityDots
                  priority={(project.priority || 'medium') as Priority}
                  onChange={onSetPriority}
                  sizeClass="w-4 h-4"
                  gapClass="gap-1"
                />
              </div>
            </div>
            <div className="flex items-start justify-between gap-2 min-w-0 w-full">
              <h3
                className={cn(
                  'font-bold text-[15px] leading-snug min-w-0 flex-1 overflow-hidden',
                  project.completed ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'
                )}
              >
                <span className="block truncate">
                  {project.emoji ? <span className="mr-1 inline">{project.emoji}</span> : null}
                  {project.title}
                </span>
              </h3>
            </div>
            {project.description && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-tight">
                {project.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-1 flex-shrink-0 ml-1">
        {project.link && (
          <a 
            href={project.link} 
            target="_blank" 
            rel="noopener noreferrer" 
            onClick={e => e.stopPropagation()}
            className="text-slate-400 hover:text-indigo-500 transition-colors flex-shrink-0 mt-0.5"
          >
            <LinkIcon className="w-3 h-3" />
          </a>
        )}
        {showDollar && (
          <div
            className="ml-1 flex-shrink-0"
            title="Są niezrealizowane przewidywane wpłaty w tym miesiącu"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="p-1.5 rounded-xl bg-emerald-500/15 dark:bg-emerald-400/15 border border-emerald-500/30 dark:border-emerald-400/30 shadow-sm">
              <DollarSign className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
            </div>
          </div>
        )}
        </div>
      </div>

      <div className={cn('mt-auto', myTurnHighlight && 'relative z-10')}>
        {project.deadline && (
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
            <Calendar className="w-3 h-3 opacity-70" />
            <span>{project.deadline}</span>
          </div>
        )}
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">({completedTasks}/{totalTasks})</span>
          <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">{progress}%</span>
        </div>
        <ProjectTurnToggle
          turn={turn}
          onToggle={onToggleTurn}
          variant="label"
          className="mb-1.5"
        />
        <div className="h-1 w-full bg-slate-100 dark:bg-tp-muted rounded-full overflow-hidden">
          <div 
            className="h-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: project.color || '#6366f1' }}
          />
        </div>
      </div>
    </div>
  );
}

function SortableTask({ 
  task, 
  onDelete, 
  onMoveLeft, 
  onMoveRight, 
  canMoveLeft, 
  canMoveRight 
}: { 
  task: ProjectTask, 
  onDelete: (id: string) => void,
  onMoveLeft: () => void,
  onMoveRight: () => void,
  canMoveLeft: boolean,
  canMoveRight: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'Task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "bg-white dark:bg-tp-surface p-2.5 rounded-xl shadow-sm border border-slate-200 dark:border-white/[0.08] group cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 ring-2 ring-indigo-500"
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <span className={cn(
          "text-xs font-medium leading-tight",
          task.completed ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200"
        )}>
          {task.title}
        </span>
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} 
          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-slate-100 dark:border-white/6">
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onMoveLeft(); }}
          disabled={!canMoveLeft}
          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onMoveRight(); }}
          disabled={!canMoveRight}
          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function KanbanColumn({ 
  column, 
  tasks, 
  onDeleteTask, 
  onMoveLeft, 
  onMoveRight,
  canMoveLeft,
  canMoveRight
}: { 
  column: { id: KanbanStatus; label: string; color: string }, 
  tasks: ProjectTask[],
  onDeleteTask: (id: string) => void,
  onMoveLeft: (taskId: string) => void,
  onMoveRight: (taskId: string) => void,
  canMoveLeft: boolean,
  canMoveRight: boolean
}) {
  const { setNodeRef } = useSortable({
    id: column.id,
    data: { type: 'Column', column },
  });

  return (
    <div ref={setNodeRef} className={cn("rounded-2xl p-3 flex flex-col gap-2.5", column.color)}>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
        {column.label}
      </h4>
      <div className="flex flex-col gap-2 min-h-[100px]">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableTask 
              key={task.id} 
              task={task} 
              onDelete={onDeleteTask}
              onMoveLeft={() => onMoveLeft(task.id)}
              onMoveRight={() => onMoveRight(task.id)}
              canMoveLeft={canMoveLeft}
              canMoveRight={canMoveRight}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function ProjectDetail({ project, onBack, onUpdate, onDelete, onToggleComplete }: { 
  project: Project, 
  onBack: () => void,
  onUpdate: (project: Project) => void,
  onDelete: () => void,
  onToggleComplete: () => void
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDesc, setEditDesc] = useState(project.description || '');
  const [editColor, setEditColor] = useState(project.color || '');
  const [editLink, setEditLink] = useState(project.link || '');
  const [editEmoji, setEditEmoji] = useState(project.emoji || '');
  const [editType, setEditType] = useState<'own' | 'client'>(project.type || 'own');
  const [editDeadline, setEditDeadline] = useState<string>(project.deadline || '');
  const [editPriority, setEditPriority] = useState<Priority>((project.priority || 'medium') as Priority);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notesOverlayLayout, setNotesOverlayLayout] = useState(() => readExpandOverlayLayout());

  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const editor = useEditor({
    extensions: createRichNoteExtensions('Zapisz luźne notatki, linki, pomysły...'),
    content: project.notes || '',
    editorProps: {
      attributes: {
        class: RICH_NOTE_EDITOR_CONTENT_CLASS,
      },
    },
    onUpdate: ({ editor }) => {
      let html = editor.getHTML();
      if (editor.isEmpty) html = '';
      onUpdate({ ...project, notes: html });
    },
  });

  useLayoutEffect(() => {
    if (!notesExpanded) return;
    const updateLayout = () => setNotesOverlayLayout(readExpandOverlayLayout());
    updateLayout();
    window.addEventListener('resize', updateLayout);
    const ro = new ResizeObserver(updateLayout);
    const main = document.querySelector('[data-app-main]');
    const sidebar = document.querySelector('[data-app-sidebar]');
    if (main) ro.observe(main);
    if (sidebar) ro.observe(sidebar);
    return () => {
      window.removeEventListener('resize', updateLayout);
      ro.disconnect();
    };
  }, [notesExpanded]);

  useEffect(() => {
    if (!notesExpanded) return;
    const main = document.querySelector('[data-app-main]');
    const prevOverflow = main instanceof HTMLElement ? main.style.overflow : '';
    if (main instanceof HTMLElement) main.style.overflow = 'hidden';
    return () => {
      if (main instanceof HTMLElement) main.style.overflow = prevOverflow;
    };
  }, [notesExpanded]);

  useEffect(() => {
    if (!notesExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotesExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notesExpanded]);

  const projectNoteEditorSection = (
    <>
      <RichNoteFormattingMenuBar editor={editor} clockMode="date" />
      <div
        className={cn(
          'flex-1 overflow-visible cursor-text min-h-0',
          notesExpanded ? 'px-2 pt-1' : '',
        )}
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent
          editor={editor}
          className={cn('h-full text-sm', notesExpanded && 'min-h-[min(70vh,520px)]')}
        />
      </div>
    </>
  );

  const handleSave = () => {
    onUpdate({ 
      ...project, 
      title: editTitle, 
      description: editDesc,
      color: editColor,
      link: editLink,
      emoji: editEmoji,
      type: editType,
      deadline: editDeadline.trim() ? editDeadline.trim() : null,
      priority: editPriority,
    });
    setIsEditing(false);
  };

  const startEditing = () => {
    setEditTitle(project.title);
    setEditDesc(project.description || '');
    setEditColor(project.color || '');
    setEditLink(project.link || '');
    setEditEmoji(project.emoji || '');
    setEditType(project.type || 'own');
    setEditDeadline(project.deadline || '');
    setEditPriority((project.priority || 'medium') as Priority);
    setIsEditing(true);
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const task: ProjectTask = {
      id: `proj_task_${Date.now()}`,
      title: newTaskTitle.trim(),
      status: 'poczekalnia',
      completed: false,
      created_at: new Date().toISOString()
    };
    onUpdate({ ...project, tasks: [...(project.tasks || []), task] });
    setNewTaskTitle('');
  };

  const updateTaskStatus = (taskId: string, newStatus: KanbanStatus) => {
    const updatedTasks = (project.tasks || []).map(t => 
      t.id === taskId ? { ...t, status: newStatus, completed: newStatus === 'done' } : t
    );
    onUpdate({ ...project, tasks: updatedTasks });
  };

  const withStatusAndCompleted = (task: ProjectTask, status: KanbanStatus): ProjectTask => ({
    ...task,
    status,
    completed: status === 'done',
  });

  const deleteTask = (taskId: string) => {
    onUpdate({ ...project, tasks: (project.tasks || []).filter(t => t.id !== taskId) });
  };

  const columns: { id: KanbanStatus; label: string; color: string }[] = [
    { id: 'poczekalnia', label: 'Poczekalnia', color: 'bg-slate-100 dark:bg-tp-muted' },
    { id: 'do_zrobienia', label: 'Do zrobienia', color: 'bg-blue-50 dark:bg-blue-900/20' },
    { id: 'in_progress', label: 'W trakcie', color: 'bg-amber-50 dark:bg-amber-900/20' },
    { id: 'done', label: 'Zrobione', color: 'bg-emerald-50 dark:bg-emerald-900/20' }
  ];

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

  const [activeTask, setActiveTask] = useState<ProjectTask | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = (project.tasks || []).find(t => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveTask) return;

    const tasks = [...(project.tasks || [])];
    const activeIndex = tasks.findIndex(t => t.id === activeId);
    
    if (activeIndex === -1) return;

    if (isOverTask) {
      const overIndex = tasks.findIndex(t => t.id === overId);
      const newStatus = tasks[overIndex].status;
      if (tasks[activeIndex].status !== newStatus) {
        tasks[activeIndex] = withStatusAndCompleted(tasks[activeIndex], newStatus);
        onUpdate({ ...project, tasks: arrayMove(tasks, activeIndex, overIndex) });
      } else {
        onUpdate({ ...project, tasks: arrayMove(tasks, activeIndex, overIndex) });
      }
    } else if (isOverColumn) {
      const newStatus = overId as KanbanStatus;
      if (tasks[activeIndex].status !== newStatus) {
        tasks[activeIndex] = withStatusAndCompleted(tasks[activeIndex], newStatus);
        onUpdate({ ...project, tasks });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveTask) return;

    const tasks = [...(project.tasks || [])];
    const activeIndex = tasks.findIndex(t => t.id === activeId);
    
    if (activeIndex === -1) return;

    if (isOverTask) {
      const overIndex = tasks.findIndex(t => t.id === overId);
      const newStatus = tasks[overIndex].status;
      if (tasks[activeIndex].status !== newStatus) {
        tasks[activeIndex] = withStatusAndCompleted(tasks[activeIndex], newStatus);
        onUpdate({ ...project, tasks: arrayMove(tasks, activeIndex, overIndex) });
      } else {
        onUpdate({ ...project, tasks: arrayMove(tasks, activeIndex, overIndex) });
      }
    } else if (isOverColumn) {
      const newStatus = overId as KanbanStatus;
      if (tasks[activeIndex].status !== newStatus) {
        tasks[activeIndex] = withStatusAndCompleted(tasks[activeIndex], newStatus);
        onUpdate({ ...project, tasks });
      }
    }
  };

  const detailTurn = (project.turn || 'mine') as ProjectTurn;
  const detailMyTurnHighlight = detailTurn === 'mine' && !project.completed;

  return (
    <div
      className={cn(
        'min-h-full flex flex-col gap-6 animate-in fade-in duration-200',
        detailMyTurnHighlight &&
          'rounded-2xl border-2 border-emerald-500 dark:border-emerald-400 bg-emerald-100/90 dark:bg-emerald-950/55 p-4 sm:p-5 shadow-[0_0_0_4px_rgba(16,185,129,0.35),0_20px_44px_-14px_rgba(5,150,105,0.45)] dark:shadow-[0_0_0_4px_rgba(52,211,153,0.35),0_20px_44px_-14px_rgba(16,185,129,0.4)]'
      )}
    >
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors">
          <BackIcon className="w-6 h-6" />
        </button>
        
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <button onClick={onToggleComplete} className="flex-shrink-0">
            {project.completed ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            ) : (
              <Circle className="w-8 h-8 text-slate-300 dark:text-slate-700 hover:text-indigo-400 transition-colors" />
            )}
          </button>
          
          {isEditing ? (
            <div className="flex-1 flex items-start gap-2 relative min-w-0">
              <div className="relative flex-shrink-0" ref={emojiPickerRef}>
                <button 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-tp-muted rounded-lg hover:bg-slate-200 dark:hover:bg-tp-raised transition-colors text-xl"
                >
                  {editEmoji || <Smile className="w-5 h-5 text-slate-400" />}
                </button>
                {showEmojiPicker && (
                  <div className="absolute top-full left-0 mt-2 z-50">
                    <EmojiPicker 
                      theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
                      onEmojiClick={(emojiData) => {
                        setEditEmoji(emojiData.emoji);
                        setShowEmojiPicker(false);
                      }}
                    />
                  </div>
                )}
              </div>
              <input 
                value={editTitle} 
                onChange={e => setEditTitle(e.target.value)}
                className="flex-1 min-w-0 pt-1.5 font-bold text-2xl bg-transparent border-b border-indigo-500 focus:outline-none text-slate-800 dark:text-white"
                autoFocus
                placeholder="Nazwa projektu..."
              />
              <ProjectTurnToggle
                turn={detailTurn}
                onToggle={() =>
                  onUpdate({
                    ...project,
                    turn: detailTurn === 'mine' ? 'theirs' : 'mine',
                  })
                }
                size="md"
                className="mt-1"
              />
            </div>
          ) : (
            <div className="flex-1 min-w-0 flex items-start gap-2">
              <h2
                className={cn(
                  'font-bold text-2xl min-w-0 flex-1 overflow-hidden leading-snug',
                  project.completed ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-100"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {project.emoji ? <span className="flex-shrink-0">{project.emoji}</span> : null}
                  <span className="min-w-0 truncate">{project.title}</span>
                </span>
              </h2>
              <ProjectTurnToggle
                turn={detailTurn}
                onToggle={() =>
                  onUpdate({
                    ...project,
                    turn: detailTurn === 'mine' ? 'theirs' : 'mine',
                  })
                }
                size="md"
                className="mt-1"
              />
              {project.link && (
                <a href={project.link} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-500 flex-shrink-0 mt-1.5">
                  <LinkIcon className="w-5 h-5" />
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors">
              <Save className="w-4 h-4" />
              Zapisz
            </button>
          ) : (
            <button onClick={startEditing} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-tp-muted hover:bg-slate-200 dark:hover:bg-tp-raised text-slate-700 dark:text-slate-300 rounded-xl transition-colors">
              <Edit2 className="w-4 h-4" />
              Edytuj
            </button>
          )}
          <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="bg-white dark:bg-tp-surface rounded-2xl p-5 border border-slate-200 dark:border-white/6 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 block">Opis projektu</label>
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder="Dodaj szczegółowy opis swojego projektu..."
              className="w-full bg-slate-50 dark:bg-tp-muted/50 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[80px] text-slate-700 dark:text-slate-300"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 block">Link (URL)</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="url"
                  value={editLink}
                  onChange={e => setEditLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-50 dark:bg-tp-muted/50 border border-slate-200 dark:border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700 dark:text-slate-300"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 block">Deadline</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={editDeadline}
                  onChange={e => setEditDeadline(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-tp-muted/50 border border-slate-200 dark:border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700 dark:text-slate-300"
                />
              </div>
              {editDeadline && (
                <button
                  type="button"
                  onClick={() => setEditDeadline('')}
                  className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-red-600 transition-colors"
                >
                  Usuń deadline
                </button>
              )}
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 block">Kolor projektu</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-transform hover:scale-110",
                      editColor === c ? "ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900 scale-110" : ""
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <button
                  onClick={() => setEditColor('')}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 border-dashed border-slate-300 dark:border-white/15 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors",
                    !editColor ? "ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900" : ""
                  )}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 block">Typ projektu</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditType('own')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                    editType === 'own' 
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 ring-1 ring-indigo-500" 
                      : "bg-slate-100 text-slate-600 dark:bg-tp-muted dark:text-slate-400 hover:bg-slate-200"
                  )}
                >
                  OWN (Własny)
                </button>
                <button
                  type="button"
                  onClick={() => setEditType('client')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                    editType === 'client' 
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-500" 
                      : "bg-slate-100 text-slate-600 dark:bg-tp-muted dark:text-slate-400 hover:bg-slate-200"
                  )}
                >
                  CLI (Klient)
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 block">Priorytet projektu</label>
              <div className="flex items-center gap-3">
                <div className="px-3 py-2 rounded-xl bg-white dark:bg-tp-surface border border-slate-200 dark:border-white/10 shadow-sm">
                  <PriorityDots
                    priority={editPriority}
                    onChange={setEditPriority}
                    sizeClass="w-6 h-6"
                    gapClass="gap-2"
                  />
                </div>
                <div className="text-[10px] leading-tight text-slate-400 dark:text-slate-500">
                  Zadania w tym projekcie dziedziczą ten priorytet, jeśli nie mają ustawionego własnego.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isEditing && project.description && (
        <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
          {project.description}
        </p>
      )}

      <div className="flex-1 pr-2 pb-8">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-8 h-full">
          {/* Kanban */}
          <div className="flex-1 min-w-0 space-y-4 flex flex-col h-full">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Zadania w projekcie (Kanban)</label>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                placeholder="Dodaj nowe zadanie do poczekalni..."
                className="flex-1 bg-white dark:bg-tp-surface border border-slate-200 dark:border-white/6 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 dark:text-slate-300 shadow-sm"
              />
              <button 
                onClick={handleAddTask}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 pr-1">
                {columns.map((column, idx) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    tasks={(project.tasks || []).filter(t => t.status === column.id)}
                    onDeleteTask={deleteTask}
                    onMoveLeft={(taskId) => {
                      if (idx > 0) updateTaskStatus(taskId, columns[idx - 1].id);
                    }}
                    onMoveRight={(taskId) => {
                      if (idx < columns.length - 1) updateTaskStatus(taskId, columns[idx + 1].id);
                    }}
                    canMoveLeft={idx > 0}
                    canMoveRight={idx < columns.length - 1}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeTask ? (
                  <SortableTask 
                    task={activeTask} 
                    onDelete={() => {}} 
                    onMoveLeft={() => {}} 
                    onMoveRight={() => {}} 
                    canMoveLeft={false} 
                    canMoveRight={false} 
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* Notatki */}
          <div
            className={cn(
              'w-full lg:w-[400px] lg:flex-shrink-0 space-y-4 flex flex-col h-full min-h-[280px] lg:min-h-0',
            )}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Notatki
              </label>
              {!notesExpanded && (
                <button
                  type="button"
                  onClick={() => setNotesExpanded(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-tp-muted hover:bg-slate-200 dark:hover:bg-tp-raised border border-slate-200/80 dark:border-white/10 transition-colors shrink-0"
                  title="Rozwiń notatkę na obszar obok menu i nagłówka"
                >
                  <Maximize2 className="w-3.5 h-3.5" aria-hidden />
                  Na cały obszar
                </button>
              )}
            </div>
            {!notesExpanded ? (
              <div className="flex-1 bg-white dark:bg-tp-surface border border-slate-200 dark:border-white/6 rounded-2xl overflow-hidden shadow-sm flex flex-col p-4 min-h-[240px]">
                {projectNoteEditorSection}
              </div>
            ) : (
              <div className="flex flex-col gap-3 py-2 text-sm text-slate-600 dark:text-slate-400 flex-1 min-h-[120px]">
                <p>Edytujesz w rozszerzonym oknie obok (sidebar i pasek u góry pozostają widoczne).</p>
                <button
                  type="button"
                  onClick={() => setNotesExpanded(false)}
                  className="inline-flex items-center justify-center gap-2 self-start px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-tp-muted hover:bg-slate-200 dark:hover:bg-tp-raised border border-slate-200 dark:border-white/10 transition-colors"
                >
                  <Minimize2 className="w-4 h-4" aria-hidden />
                  Wróć do podglądu
                </button>
              </div>
            )}
          </div>
        </div>

        {notesExpanded &&
          createPortal(
            <div
              className="fixed z-[90] flex flex-col bg-slate-50 dark:bg-tp-canvas border-l border-slate-200 dark:border-white/10 shadow-xl"
              style={{
                top: notesOverlayLayout.top,
                left: notesOverlayLayout.left,
                right: 0,
                bottom: 0,
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Notatki projektu — rozszerzony widok"
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-tp-surface shrink-0">
                <div className="flex items-center gap-2 min-w-0 text-slate-800 dark:text-white">
                  <FileText className="w-5 h-5 text-indigo-500 dark:text-tp-accent shrink-0" />
                  <h2 className="font-semibold truncate">Notatki</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setNotesExpanded(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-tp-muted hover:bg-slate-200 dark:hover:bg-tp-raised border border-slate-200 dark:border-white/10 transition-colors shrink-0"
                  title="Wróć do wąskiego podglądu w panelu"
                >
                  <Minimize2 className="w-4 h-4" aria-hidden />
                  Wróć do podglądu
                </button>
              </div>
              <div className="flex-1 flex flex-col min-h-0 p-4 pt-2">{projectNoteEditorSection}</div>
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}

