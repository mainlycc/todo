import { Plus, Smile, Palette } from 'lucide-react';
import { useState, FormEvent, useRef } from 'react';
import { Priority, TaskColor, Project } from '../types';
import { TASK_COLORS, getCategoryColor, colorStyles, cn, isPredefinedColor } from '../utils';

interface TaskFormProps {
  onAdd: (title: string, priority: Priority, category: string, color: TaskColor, isRecurring: boolean, dueDate?: string) => void;
  projects: Project[];
  onCreateProject: (title: string) => Promise<Project | null>;
  /** Dodatkowe klasy na kontenerze (np. usunięcie marginesu w modalu). */
  className?: string;
}

const COMMON_EMOJIS = [
  '🔥', '🚀', '💻', '📅', '🛒', '🏋️', '📚', '🧹', 
  '🍔', '☕', '💰', '💡', '🎉', '⚠️', '📌', '📝', 
  '📞', '📧', '🚗', '✈️', '⭐', '✅', '🛑', '⏳'
];

export function TaskForm({ onAdd, projects, onCreateProject, className }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState(''); // project title (string) for backward compatibility
  const [selectedColor, setSelectedColor] = useState<TaskColor | 'auto'>('auto');
  const [isRecurring, setIsRecurring] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [projectMode, setProjectMode] = useState<'select' | 'create'>('select');
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matchedProject = category.trim()
    ? projects.find(p => p.title.toLowerCase() === category.trim().toLowerCase())
    : undefined;

  const effectiveColor =
    selectedColor === 'auto'
      ? (matchedProject?.color || getCategoryColor(category))
      : selectedColor;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onAdd(title.trim(), priority, category.trim(), effectiveColor, isRecurring, dueDate);
      setTitle('');
      setCategory('');
      setPriority('medium');
      setSelectedColor('auto');
      setIsRecurring(false);
      setDueDate('');
      setIsExpanded(false);
      setShowEmojiPicker(false);
      setProjectMode('select');
      setNewProjectTitle('');
    }
  };

  const handleEmojiClick = (emoji: string) => {
    if (inputRef.current) {
      const start = inputRef.current.selectionStart || 0;
      const end = inputRef.current.selectionEnd || 0;
      const newTitle = title.substring(0, start) + emoji + title.substring(end);
      setTitle(newTitle);
      
      // Restore cursor position after state update
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.selectionStart = inputRef.current.selectionEnd = start + emoji.length;
          inputRef.current.focus();
        }
      }, 0);
    } else {
      setTitle(prev => prev + emoji);
    }
    setShowEmojiPicker(false);
  };

  const handleSetToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDueDate(today);
    setPriority('high');
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-tp-surface rounded-2xl shadow-sm border border-slate-200 dark:border-white/6 overflow-visible mb-6 relative z-10 transition-colors',
        className
      )}
    >
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-white/10 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            placeholder="Co masz do zrobienia?"
            className="flex-1 min-w-0 text-base bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium text-slate-900 dark:text-white"
          />
          
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-tp-muted"
              title="Dodaj emotikon"
            >
              <Smile className="w-5 h-5" />
            </button>
            {title.trim() && (
              <button
                type="submit"
                className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-colors flex-shrink-0"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>

          {showEmojiPicker && (
            <>
              <div 
                className="fixed inset-0 z-20" 
                onClick={() => setShowEmojiPicker(false)}
              />
              <div className="absolute right-4 top-12 bg-white dark:bg-tp-muted border border-slate-200 dark:border-white/10 shadow-xl rounded-2xl p-3 z-30 w-64 grid grid-cols-6 gap-2">
                {COMMON_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiClick(emoji)}
                    className="text-xl hover:bg-slate-100 dark:hover:bg-tp-raised p-1.5 rounded-lg transition-colors flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 transition-all">
            <div className="min-w-0 md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                Termin
              </label>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isRecurring}
                  className="min-w-0 flex-1 basis-[11rem] max-w-full text-sm rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-tp-muted text-slate-900 dark:text-white disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleSetToday}
                  disabled={isRecurring}
                  className="shrink-0 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 font-medium bg-white dark:bg-tp-muted text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-tp-raised transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Dzisiaj
                </button>
              </div>
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                Priorytet
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-tp-muted text-slate-900 dark:text-white"
              >
                <option value="low">Niski</option>
                <option value="medium">Średni</option>
                <option value="high">Wysoki</option>
              </select>
            </div>
            
            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                Projekt
              </label>
              {projectMode === 'select' ? (
                <select
                  value={category}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__create__') {
                      setProjectMode('create');
                      setNewProjectTitle('');
                      return;
                    }
                    setCategory(val);
                  }}
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-tp-muted text-slate-900 dark:text-white"
                >
                  <option value="">— wybierz —</option>
                  {projects
                    .filter(p => !p.completed)
                    .map(p => (
                      <option key={p.id} value={p.title}>
                        {p.emoji ? `${p.emoji} ` : ''}{p.title}
                      </option>
                    ))}
                  <option value="__create__">+ Dodaj nowy projekt…</option>
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    placeholder="Nazwa nowego projektu…"
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-tp-muted text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={!newProjectTitle.trim() || isCreatingProject}
                    onClick={async () => {
                      if (!newProjectTitle.trim()) return;
                      setIsCreatingProject(true);
                      try {
                        const created = await onCreateProject(newProjectTitle.trim());
                        if (created) {
                          setCategory(created.title);
                          setProjectMode('select');
                        }
                      } finally {
                        setIsCreatingProject(false);
                      }
                    }}
                    className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 font-semibold bg-white dark:bg-tp-muted text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-tp-raised transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    Dodaj
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectMode('select')}
                    className="text-xs px-3 py-2 rounded-xl border border-transparent font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-tp-muted transition-colors whitespace-nowrap"
                  >
                    Anuluj
                  </button>
                </div>
              )}
            </div>

            <div className="min-w-0 md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                Kolor
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedColor('auto')}
                  className={cn(
                    "text-xs px-2 py-1 rounded-lg border font-medium transition-colors",
                    selectedColor === 'auto' ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200" : "bg-white dark:bg-tp-muted text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-tp-raised"
                  )}
                >
                  Auto
                </button>
                <div className="w-px h-4 bg-slate-200 dark:bg-tp-raised mx-1" />
                {TASK_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-transform",
                      colorStyles[c].picker,
                      selectedColor === c ? "ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-600 scale-110" : "hover:scale-110"
                    )}
                    title={c}
                  />
                ))}
                <div className="w-px h-4 bg-slate-200 dark:bg-tp-raised mx-1" />
                <div className="relative flex items-center">
                  <input
                    type="color"
                    id="custom-color"
                    value={!isPredefinedColor(selectedColor) && selectedColor !== 'auto' ? selectedColor : '#6366f1'}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-6 h-6 rounded-full border-none p-0 cursor-pointer overflow-hidden bg-transparent"
                  />
                  <label htmlFor="custom-color" className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {!isPredefinedColor(selectedColor) && selectedColor !== 'auto' ? null : <Palette className="w-3 h-3 text-slate-400 dark:text-slate-500" />}
                  </label>
                </div>
              </div>
            </div>

            <div className="col-span-full mt-2 pt-4 border-t border-slate-100 dark:border-white/6">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer w-fit hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => {
                    setIsRecurring(e.target.checked);
                    if (e.target.checked) setDueDate('');
                  }}
                  className="w-4 h-4 rounded border-slate-300 dark:border-white/10 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-transparent"
                />
                <span className="font-medium">Codzienne zadanie</span>
                <span className="text-slate-400 dark:text-slate-500 text-xs">(pojawia się każdego dnia, termin automatycznie ustawiany na "dzisiaj")</span>
              </label>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
