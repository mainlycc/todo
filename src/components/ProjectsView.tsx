import React, { useState, useEffect, useRef } from 'react';
import { Briefcase, Plus, Trash2, CheckCircle2, Circle, Save, X, Edit2, ArrowRight, ArrowLeft, Link as LinkIcon, Smile, ArrowLeft as BackIcon } from 'lucide-react';
import { Project, ProjectTask, KanbanStatus } from '../types';
import { cn } from '../utils';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { useEditor, EditorContent } from '@tiptap/react';
import {
  createRichNoteExtensions,
  RICH_NOTE_EDITOR_CONTENT_CLASS,
  RichNoteFormattingMenuBar,
} from './richNoteEditor';
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

import { supabase } from '../lib/supabase';
import { ANONYMOUS_USER_ID } from '../constants';

interface ProjectsViewProps {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
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

export function ProjectsView({ projects, setProjects }: ProjectsViewProps) {
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectType, setNewProjectType] = useState<'own' | 'client'>('own');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'created_at' | 'type' | 'title'>('created_at');

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
    };

    // Update local state first for immediate feedback
    setProjects([newProject, ...projects]);
    setNewProjectTitle('');
    setIsAddingProject(false);
    setExpandedProjectId(newProject.id);

    const { error } = await supabase.from('projects').insert([newProject]);
    if (error) {
      console.error('Error adding project to Supabase:', error);
      // We keep it locally even if Supabase fails, but we could optionally revert here
    }
  };

  const handleUpdateProject = async (updatedProject: Project) => {
    // Update local state first for immediate feedback
    const newProjects = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
    setProjects(newProjects);

    const { error } = await supabase.from('projects').update(updatedProject).eq('id', updatedProject.id);
    if (error) {
      console.error('Error updating project in Supabase:', error);
      // If it fails, we might want to revert or just leave it local
      // For now, we keep the local change as it's better than nothing
    }
  };

  const handleDeleteProject = async (id: string) => {
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

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortBy === 'type') {
      const typeA = a.type || 'own';
      const typeB = b.type || 'own';
      return typeA.localeCompare(typeB);
    }
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

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
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-8">
        {isAddingProject && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-500 p-6 shadow-lg animate-in fade-in slide-in-from-top-4 duration-200 mb-6">
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
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
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
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
                  )}
                >
                  CLI (Klient)
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setIsAddingProject(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {sortedProjects.map(project => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                onClick={() => setExpandedProjectId(project.id)}
                onToggleComplete={() => toggleProjectCompletion(project)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project, onClick, onToggleComplete }: { project: Project, onClick: () => void, onToggleComplete: () => void }) {
  const totalTasks = project.tasks?.length || 0;
  const completedTasks = project.tasks?.filter(t => t.status === 'done').length || 0;
  const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return (
    <div 
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer p-3 flex flex-col gap-2 relative overflow-hidden group h-40",
        project.completed && "opacity-75"
      )}
      style={{ 
        backgroundColor: project.color ? `${project.color}20` : 'var(--tw-colors-white)',
        borderColor: project.color ? `${project.color}60` : undefined
      }}
    >
      <div className="flex justify-between items-start">
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
            </div>
            <h3 className={cn(
              "font-bold text-sm truncate leading-tight",
              project.completed ? "text-slate-500 line-through" : "text-slate-800 dark:text-slate-100"
            )}>
              {project.emoji && <span className="mr-1">{project.emoji}</span>}
              {project.title}
            </h3>
            {project.description && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-tight">
                {project.description}
              </p>
            )}
          </div>
        </div>
        {project.link && (
          <a 
            href={project.link} 
            target="_blank" 
            rel="noopener noreferrer" 
            onClick={e => e.stopPropagation()}
            className="text-slate-400 hover:text-indigo-500 transition-colors flex-shrink-0 ml-1"
          >
            <LinkIcon className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="mt-auto">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">({completedTasks}/{totalTasks})</span>
          <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">{progress}%</span>
        </div>
        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
        "bg-white dark:bg-slate-900 p-2.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/50 group cursor-grab active:cursor-grabbing",
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
      <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  
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

  const handleSave = () => {
    onUpdate({ 
      ...project, 
      title: editTitle, 
      description: editDesc,
      color: editColor,
      link: editLink,
      emoji: editEmoji,
      type: editType
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

  const deleteTask = (taskId: string) => {
    onUpdate({ ...project, tasks: (project.tasks || []).filter(t => t.id !== taskId) });
  };

  const columns: { id: KanbanStatus; label: string; color: string }[] = [
    { id: 'poczekalnia', label: 'Poczekalnia', color: 'bg-slate-100 dark:bg-slate-800' },
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
      if (tasks[activeIndex].status !== tasks[overIndex].status) {
        tasks[activeIndex].status = tasks[overIndex].status;
        onUpdate({ ...project, tasks: arrayMove(tasks, activeIndex, overIndex) });
      } else {
        onUpdate({ ...project, tasks: arrayMove(tasks, activeIndex, overIndex) });
      }
    } else if (isOverColumn) {
      if (tasks[activeIndex].status !== overId) {
        tasks[activeIndex].status = overId as KanbanStatus;
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
      if (tasks[activeIndex].status !== tasks[overIndex].status) {
        tasks[activeIndex].status = tasks[overIndex].status;
        onUpdate({ ...project, tasks: arrayMove(tasks, activeIndex, overIndex) });
      } else {
        onUpdate({ ...project, tasks: arrayMove(tasks, activeIndex, overIndex) });
      }
    } else if (isOverColumn) {
      if (tasks[activeIndex].status !== overId) {
        tasks[activeIndex].status = overId as KanbanStatus;
        onUpdate({ ...project, tasks });
      }
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-200">
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
            <div className="flex-1 flex items-center gap-2 relative">
              <div className="relative" ref={emojiPickerRef}>
                <button 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xl"
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
                className="flex-1 font-bold text-2xl bg-transparent border-b border-indigo-500 focus:outline-none text-slate-800 dark:text-white"
                autoFocus
                placeholder="Nazwa projektu..."
              />
            </div>
          ) : (
            <h2 className={cn(
              "font-bold text-2xl truncate flex items-center gap-2",
              project.completed ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-100"
            )}>
              {project.emoji && <span>{project.emoji}</span>}
              {project.title}
              {project.link && (
                <a href={project.link} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-500 ml-2">
                  <LinkIcon className="w-5 h-5" />
                </a>
              )}
            </h2>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors">
              <Save className="w-4 h-4" />
              Zapisz
            </button>
          ) : (
            <button onClick={startEditing} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors">
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 block">Opis projektu</label>
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder="Dodaj szczegółowy opis swojego projektu..."
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[80px] text-slate-700 dark:text-slate-300"
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
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700 dark:text-slate-300"
                />
              </div>
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
                    "w-8 h-8 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors",
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
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
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
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
                  )}
                >
                  CLI (Klient)
                </button>
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

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-8">
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
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 dark:text-slate-300 shadow-sm"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
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
          <div className="w-full lg:w-[400px] lg:flex-shrink-0 space-y-4 flex flex-col h-full min-h-[280px] lg:min-h-0">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Notatki</label>
            <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col p-4 min-h-[240px]">
              <RichNoteFormattingMenuBar editor={editor} />
              <div
                className="flex-1 overflow-y-auto custom-scrollbar cursor-text min-h-0"
                onClick={() => editor?.commands.focus()}
              >
                <EditorContent editor={editor} className="h-full text-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

