import { ChevronDown, ChevronUp, Trash2, Plus, CheckCircle2, Circle, Play, MoreVertical, Edit2, Calendar, GripVertical, Clock } from 'lucide-react';
import { useState, FormEvent, useRef, useEffect } from 'react';
import { format, isBefore, startOfDay, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Task, Priority, TaskColor } from '../types';
import { cn, colorStyles, TASK_COLORS, getTaskStyle, isPredefinedColor, PredefinedColor } from '../utils';

interface TaskItemProps {
  key?: string | number;
  task: Task;
  projectColor?: string | null;
  /** Emotikon projektu (wyświetlany w tagu projektu). */
  projectEmoji?: string | null;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteSeries?: (templateId: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
  onFocus: (id: string) => void;
  onUpdateTask: (task: Task) => void;
  /** Id dopasowanego projektu (z listy projektów) — jeśli jest, tag projektu/kategorii otwiera widok projektu */
  linkedProjectId?: string | null;
  onOpenProject?: (projectId: string) => void;
  /** Zmiana tej wartości powoduje zwinięcie szczegółów w zadaniu. */
  collapseSignal?: number;
  dragHandleProps?: Record<string, any>;
  isDragging?: boolean;
}

const priorityLabels = {
  low: 'Niski',
  medium: 'Średni',
  high: 'Wysoki',
};

export function TaskItem({
  task,
  projectColor,
  projectEmoji,
  onToggleComplete,
  onDelete,
  onDeleteSeries,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onFocus,
  onUpdateTask,
  linkedProjectId,
  onOpenProject,
  collapseSignal,
  dragHandleProps,
  isDragging,
}: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPriority, setEditPriority] = useState<Priority>(task.priority);
  const [editCategory, setEditCategory] = useState(task.category);
  const [editColor, setEditColor] = useState<TaskColor>(task.color || 'slate');
  const [editDueDate, setEditDueDate] = useState(task.due_date || '');
  const [editNotes, setEditNotes] = useState(task.notes || '');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  useEffect(() => {
    if (collapseSignal === undefined) return;
    setIsExpanded(false);
    setShowMenu(false);
  }, [collapseSignal]);

  const handleAddSubtask = (e: FormEvent) => {
    e.preventDefault();
    if (newSubtaskTitle.trim()) {
      onAddSubtask(task.id, newSubtaskTitle.trim());
      setNewSubtaskTitle('');
    }
  };

  const handleSaveEdit = () => {
    if (editTitle.trim()) {
      onUpdateTask({
        ...task,
        title: editTitle.trim(),
        priority: editPriority,
        category: editCategory.trim(),
        color: editColor,
        due_date: editDueDate || null,
        notes: editNotes.trim()
      });
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-tp-surface rounded-2xl border border-indigo-300 dark:border-indigo-800 shadow-sm p-4">
        <input 
          value={editTitle} 
          onChange={e => setEditTitle(e.target.value)} 
          className="w-full text-base font-medium bg-transparent border-b border-slate-200 dark:border-white/6 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none pb-1 mb-3"
          autoFocus
        />
        <div className="flex flex-wrap gap-3 mb-3 items-center">
          <input 
            type="date"
            value={editDueDate} 
            onChange={e => setEditDueDate(e.target.value)} 
            className="text-sm rounded-lg border border-slate-200 dark:border-white/10 px-2 py-1 focus:outline-none focus:border-indigo-500 bg-slate-50 dark:bg-tp-muted text-slate-900 dark:text-slate-100"
          />
          <select 
            value={editPriority} 
            onChange={e => setEditPriority(e.target.value as Priority)} 
            className="text-sm rounded-lg border border-slate-200 dark:border-white/10 px-2 py-1 focus:outline-none focus:border-indigo-500 bg-slate-50 dark:bg-tp-muted text-slate-900 dark:text-slate-100"
          >
            <option value="low">Niski</option>
            <option value="medium">Średni</option>
            <option value="high">Wysoki</option>
          </select>
          <input 
            value={editCategory} 
            onChange={e => setEditCategory(e.target.value)} 
            placeholder="Kategoria"
            className="text-sm rounded-lg border border-slate-200 dark:border-white/10 px-2 py-1 w-32 focus:outline-none focus:border-indigo-500 bg-slate-50 dark:bg-tp-muted text-slate-900 dark:text-slate-100"
          />
          <div className="flex items-center gap-1 ml-2">
            {TASK_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setEditColor(c)}
                className={cn("w-5 h-5 rounded-full transition-transform", colorStyles[c].picker, editColor === c ? "ring-2 ring-offset-1 ring-slate-400 dark:ring-slate-600 scale-110" : "hover:scale-110")}
              />
            ))}
            <div className="w-px h-4 bg-slate-200 dark:bg-tp-raised mx-1" />
            <input
              type="color"
              value={isPredefinedColor(editColor) ? '#6366f1' : editColor}
              onChange={(e) => setEditColor(e.target.value)}
              className="w-5 h-5 rounded-full border-none p-0 cursor-pointer overflow-hidden bg-transparent"
            />
          </div>
        </div>
        <textarea
          value={editNotes}
          onChange={e => setEditNotes(e.target.value)}
          placeholder="Dodaj notatkę..."
          className="w-full text-sm bg-slate-50 dark:bg-tp-muted border border-slate-200 dark:border-white/10 rounded-xl p-3 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 text-slate-900 dark:text-slate-100 mb-4 min-h-[80px] resize-none"
        />
        <div className="flex justify-end gap-2">
          <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-tp-muted rounded-lg transition-colors">Anuluj</button>
          <button onClick={handleSaveEdit} className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors">Zapisz</button>
        </div>
      </div>
    );
  }

  const styleData = getTaskStyle(task.color || 'slate', task.priority, task.completed);
  const isCustomStyle = typeof styleData === 'object' && 'style' in styleData;
  const bgClass = isCustomStyle ? "" : styleData as string;
  const inlineStyle = isCustomStyle ? styleData.style : {};
  const projectTagColor = projectColor || undefined;

  return (
    <div 
      className={cn(
        "rounded-2xl border transition-all duration-200 overflow-visible",
        bgClass,
        task.completed ? "dark:bg-tp-surface/50 dark:border-white/6 dark:opacity-60" : "shadow-sm hover:shadow-md dark:shadow-none dark:border-opacity-40",
        isDragging && "opacity-90 scale-[1.02] shadow-xl z-50 ring-2 ring-indigo-500"
      )}
      style={inlineStyle}
    >
      <div className="p-4 flex items-start gap-3">
        {dragHandleProps && (
          <div 
            {...dragHandleProps}
            className="mt-1 flex-shrink-0 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-5 h-5" />
          </div>
        )}
        <button
          onClick={() => onToggleComplete(task.id)}
          className={cn(
            "mt-0.5 flex-shrink-0 transition-colors",
            task.completed ? "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          )}
        >
          {task.completed ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <Circle className="w-6 h-6" />
          )}
        </button>
        
        <div className="flex-grow min-w-0">
          <h3 className={cn(
            "text-base font-medium transition-all",
            task.completed ? "text-slate-500 dark:text-slate-500 line-through" : "text-slate-900 dark:text-slate-100"
          )}>
            {task.title}
          </h3>
          
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {task.due_date && (
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1",
                task.completed ? "bg-slate-100 dark:bg-tp-muted text-slate-500 dark:text-slate-500 border-slate-200 dark:border-white/10" : 
                (isBefore(parseISO(task.due_date), startOfDay(new Date())) ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50" : "bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10")
              )}>
                <Calendar className="w-3 h-3" />
                {format(parseISO(task.due_date), 'd MMM', { locale: pl })}
              </span>
            )}
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full border font-medium",
              task.completed ? "bg-slate-100 dark:bg-tp-muted text-slate-500 dark:text-slate-500 border-slate-200 dark:border-white/10" : (isPredefinedColor(task.color || 'slate') ? colorStyles[task.color as PredefinedColor || 'slate'].badge : "bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10")
            )}
            style={!task.completed && !isPredefinedColor(task.color || 'slate') ? { borderColor: task.color, backgroundColor: `${task.color}20`, color: task.color } : {}}>
              {priorityLabels[task.priority]}
            </span>
            {task.project_title && (
              linkedProjectId && onOpenProject && !task.completed ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProject(linkedProjectId);
                  }}
                  title={`Otwórz projekt: ${task.project_title}`}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full border font-extrabold uppercase tracking-wider shadow-sm whitespace-nowrap inline-flex items-center gap-1",
                    "bg-white/70 dark:bg-black/25 text-slate-800 dark:text-slate-100 border-black/15 dark:border-white/15",
                    "cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition-[filter,box-shadow] hover:ring-2 hover:ring-indigo-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  )}
                  style={
                    projectTagColor
                      ? {
                          borderColor: `${projectTagColor}80`,
                          backgroundColor: `${projectTagColor}24`,
                          color: projectTagColor,
                          boxShadow: `0 0 0 1px ${projectTagColor}1f`,
                        }
                      : undefined
                  }
                >
                  {projectEmoji ? <span className="mr-0.5">{projectEmoji}</span> : null}
                  {task.project_title}
                </button>
              ) : (
                <span
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full border font-extrabold uppercase tracking-wider shadow-sm whitespace-nowrap inline-flex items-center gap-1",
                    task.completed
                      ? "bg-slate-100 dark:bg-tp-muted text-slate-500 dark:text-slate-500 border-slate-200 dark:border-white/10"
                      : "bg-white/70 dark:bg-black/25 text-slate-800 dark:text-slate-100 border-black/15 dark:border-white/15"
                  )}
                  style={
                    !task.completed && projectTagColor
                      ? {
                          borderColor: `${projectTagColor}80`,
                          backgroundColor: `${projectTagColor}24`,
                          color: projectTagColor,
                          boxShadow: `0 0 0 1px ${projectTagColor}1f`,
                        }
                      : undefined
                  }
                >
                  {projectEmoji ? <span className="mr-0.5">{projectEmoji}</span> : null}
                  {task.project_title}
                </span>
              )
            )}
            {!task.project_title && task.category && (
              linkedProjectId && onOpenProject && !task.completed ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProject(linkedProjectId);
                  }}
                  title={`Otwórz projekt: ${task.category}`}
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full border font-medium",
                    "bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10",
                    "cursor-pointer hover:bg-white/80 dark:hover:bg-black/35 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  )}
                >
                  {task.category}
                </button>
              ) : (
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full border font-medium",
                  task.completed ? "bg-slate-100 dark:bg-tp-muted text-slate-500 dark:text-slate-500 border-slate-200 dark:border-white/10" : "bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10"
                )}>
                  {task.category}
                </span>
              )
            )}
            {task.subtasks.length > 0 && (
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium ml-1">
                {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} podzadań
              </span>
            )}
            {(task.pomodoros_completed ?? 0) > 0 && (
              <span className="text-xs text-rose-700 dark:text-rose-400 font-medium ml-1 flex items-center gap-1 bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded-full border border-black/10 dark:border-white/10">
                🍅 {task.pomodoros_completed}
              </span>
            )}
          </div>

          {/* Preview for notes and subtasks */}
          {(task.notes || task.subtasks.length > 0) && (
            <div className="mt-2 space-y-1">
              {task.notes && (
                <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400 italic line-clamp-2">
                  {task.notes}
                </p>
              )}
              {task.subtasks.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {task.subtasks.map(st => (
                    <button 
                      key={st.id} 
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSubtask(task.id, st.id);
                      }}
                      className={cn(
                        "text-[11px] flex items-center gap-1 hover:bg-black/5 dark:hover:bg-white/5 px-1 rounded transition-colors",
                        st.completed ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-600 dark:text-slate-300 font-medium"
                      )}
                    >
                      {st.completed ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Circle className="w-2.5 h-2.5" />}
                      {st.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onFocus(task.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors mr-1",
              task.completed ? "bg-slate-100 dark:bg-tp-muted text-slate-500 dark:text-slate-500" : "bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-black/40"
            )}
          >
            <Play className="w-3.5 h-3.5" />
            Rób teraz
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              task.completed ? "text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-tp-muted" : "text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
            )}
            title="Podzadania"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                task.completed ? "text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-tp-muted" : "text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
              )}
              title="Opcje"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-tp-muted border border-slate-200 dark:border-white/10 shadow-lg rounded-xl z-20 py-1 overflow-hidden">
                <button 
                  onClick={() => { setIsEditing(true); setShowMenu(false); }} 
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-tp-raised flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" /> Edytuj
                </button>
                <button 
                  onClick={() => { onDelete(task.id); setShowMenu(false); }} 
                  className="w-full text-left px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Usuń to zadanie
                </button>
                {task.is_recurring && task.recurring_template_id && onDeleteSeries && (
                  <button 
                    onClick={() => { onDeleteSeries(task.recurring_template_id!); setShowMenu(false); }} 
                    className="w-full text-left px-4 py-2 text-sm text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-2 border-t border-slate-100 dark:border-white/10"
                  >
                    <Trash2 className="w-4 h-4" /> Usuń codzienny cykl
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className={cn(
          "border-t p-4 pt-3",
          task.completed ? "bg-slate-50 dark:bg-tp-surface/30 border-slate-200 dark:border-white/6" : "bg-white/40 dark:bg-black/10 border-black/5 dark:border-white/5"
        )}>
          <div className="space-y-2 mb-3">
            {task.subtasks.map(subtask => (
              <div key={subtask.id} className="flex items-center gap-3 group">
                <button
                  onClick={() => onToggleSubtask(task.id, subtask.id)}
                  className="text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {subtask.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <span className={cn(
                  "text-sm flex-grow",
                  subtask.completed ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-700 dark:text-slate-300"
                )}>
                  {subtask.title}
                </span>
                <button
                  onClick={() => onDeleteSubtask(task.id, subtask.id)}
                  className="text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          
          <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="Dodaj podzadanie..."
              className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={!newSubtaskTitle.trim()}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50 disabled:hover:text-indigo-600 px-2 py-1"
            >
              Dodaj
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
