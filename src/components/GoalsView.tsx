import React, { useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Target,
  Info,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Save,
  Edit2,
  FileText,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import {
  createRichNoteExtensions,
  RICH_NOTE_EDITOR_CONTENT_CLASS,
  RichNoteFormattingMenuBar,
} from './richNoteEditor';
import { readExpandOverlayLayout } from '../lib/expandNoteOverlayLayout';
import { Goal, Subtask } from '../types';
import { cn } from '../utils';
import { supabase } from '../lib/supabase';
import { ANONYMOUS_USER_ID } from '../constants';

const newGoalId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `goal_${Date.now()}`;

export function GoalsView() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', ANONYMOUS_USER_ID)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error('Error fetching goals:', error);
        setLoaded(true);
        return;
      }

      if (data && data.length > 0) {
        setGoals(
          data.map((row) => ({
            id: row.id,
            user_id: row.user_id,
            title: row.title,
            description: row.description || '',
            notes: row.notes || '',
            subtasks: (row.subtasks as Subtask[]) || [],
            completed: row.completed,
            created_at: row.created_at,
          }))
        );
        setLoaded(true);
        return;
      }

      const savedGoals = localStorage.getItem('user_goals');
      if (savedGoals) {
        try {
          const parsed: Goal[] = JSON.parse(savedGoals);
          if (parsed.length > 0) {
            setGoals(parsed);
            for (const g of parsed) {
              await supabase.from('goals').upsert(
                {
                  id: g.id,
                  user_id: ANONYMOUS_USER_ID,
                  title: g.title,
                  description: g.description ?? '',
                  notes: g.notes ?? '',
                  subtasks: g.subtasks || [],
                  completed: g.completed,
                  created_at: g.created_at,
                },
                { onConflict: 'id' }
              );
            }
          }
        } catch (e) {
          console.error('Goals migration failed:', e);
        }
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upsertGoalRow = async (g: Goal) => {
    const { error } = await supabase.from('goals').upsert(
      {
        id: g.id,
        user_id: ANONYMOUS_USER_ID,
        title: g.title,
        description: g.description ?? '',
        notes: g.notes ?? '',
        subtasks: g.subtasks || [],
        completed: g.completed,
        created_at: g.created_at,
      },
      { onConflict: 'id' }
    );
    if (error) console.error('Error saving goal:', error);
  };

  const handleAddGoal = async () => {
    if (!newGoalTitle.trim()) return;

    const newGoal: Goal = {
      id: newGoalId(),
      user_id: ANONYMOUS_USER_ID,
      title: newGoalTitle.trim(),
      description: '',
      notes: '',
      subtasks: [],
      completed: false,
      created_at: new Date().toISOString(),
    };

    setGoals((prev) => [newGoal, ...prev]);
    await upsertGoalRow(newGoal);
    setNewGoalTitle('');
    setIsAddingGoal(false);
    setExpandedGoalId(newGoal.id);
  };

  const handleUpdateGoal = async (updatedGoal: Goal) => {
    setGoals((prev) => prev.map((g) => (g.id === updatedGoal.id ? updatedGoal : g)));
    await upsertGoalRow(updatedGoal);
  };

  const handleDeleteGoal = async (id: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) console.error('Error deleting goal:', error);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const toggleGoalCompletion = (goal: Goal) => {
    handleUpdateGoal({ ...goal, completed: !goal.completed });
  };

  if (!loaded) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
        Wczytywanie celów…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Cele</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Definiuj i realizuj swoje długoterminowe cele</p>
        </div>
        <button
          onClick={() => setIsAddingGoal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Dodaj cel
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 flex-1 overflow-hidden">
        {/* Zasady Celów */}
        <div className="xl:col-span-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
          <div className="bg-white dark:bg-tp-surface rounded-2xl border border-slate-200 dark:border-white/6 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-indigo-600 dark:text-indigo-400">
              <Info className="w-5 h-5" />
              <h3 className="font-bold uppercase tracking-wider text-xs">Zasady dobrych celów (SMART)</h3>
            </div>
            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <div className="p-3 bg-slate-50 dark:bg-tp-muted/50 rounded-xl border border-slate-100 dark:border-white/6">
                <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">S - Konkretny (Specific)</p>
                <p>Cel powinien być jasny i precyzyjny. Zamiast "chcę być fit", wybierz "chcę przebiec 5km".</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-tp-muted/50 rounded-xl border border-slate-100 dark:border-white/6">
                <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">M - Mierzalny (Measurable)</p>
                <p>Musisz wiedzieć, kiedy cel zostanie osiągnięty. Dodaj liczby lub konkretne wskaźniki.</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-tp-muted/50 rounded-xl border border-slate-100 dark:border-white/6">
                <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">A - Atrakcyjny (Achievable)</p>
                <p>Cel powinien być ambitny, ale możliwy do zrealizowania przy Twoich zasobach.</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-tp-muted/50 rounded-xl border border-slate-100 dark:border-white/6">
                <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">R - Istotny (Relevant)</p>
                <p>Cel musi być dla Ciebie ważny i zgodny z Twoimi wartościami.</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-tp-muted/50 rounded-xl border border-slate-100 dark:border-white/6">
                <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">T - Określony w czasie (Time-bound)</p>
                <p>Wyznacz konkretny termin realizacji. To motywuje do działania.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista Celów */}
        <div className="xl:col-span-2 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar pb-8">
          {isAddingGoal && (
            <div className="bg-white dark:bg-tp-surface rounded-2xl border-2 border-indigo-500 p-6 shadow-lg animate-in fade-in slide-in-from-top-4 duration-200">
              <input
                type="text"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                placeholder="Wpisz swój cel..."
                className="w-full text-xl font-bold bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white placeholder:text-slate-400"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddGoal()}
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setIsAddingGoal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-tp-muted rounded-xl transition-colors">
                  Anuluj
                </button>
                <button onClick={handleAddGoal} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                  Stwórz cel
                </button>
              </div>
            </div>
          )}

          {goals.length === 0 && !isAddingGoal ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Target className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Nie masz jeszcze żadnych celów.</p>
              <p className="text-sm">Dodaj swój pierwszy cel, aby zacząć go realizować.</p>
            </div>
          ) : (
            goals.map((goal) => (
              <GoalItem
                key={goal.id}
                goal={goal}
                isExpanded={expandedGoalId === goal.id}
                onToggleExpand={() => setExpandedGoalId(expandedGoalId === goal.id ? null : goal.id)}
                onUpdate={handleUpdateGoal}
                onDelete={() => handleDeleteGoal(goal.id)}
                onToggleComplete={() => toggleGoalCompletion(goal)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function GoalNotesBlock({ goal, onUpdate }: { goal: Goal; onUpdate: (g: Goal) => void }) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notesOverlayLayout, setNotesOverlayLayout] = useState(() => readExpandOverlayLayout());

  const editor = useEditor({
    extensions: createRichNoteExtensions('Luźne notatki, linki, pomysły przy tym celu…'),
    content: goal.notes || '',
    editorProps: {
      attributes: {
        class: RICH_NOTE_EDITOR_CONTENT_CLASS,
      },
    },
    onUpdate: ({ editor: ed }) => {
      let html = ed.getHTML();
      if (ed.isEmpty) html = '';
      onUpdate({ ...goal, notes: html });
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== (goal.notes || '')) {
      editor.commands.setContent(goal.notes || '');
    }
  }, [goal.notes, editor]);

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

  const goalNoteEditorSection = (
    <>
      <RichNoteFormattingMenuBar editor={editor} clockMode="date" />
      <div
        className={cn(
          'flex-1 overflow-y-auto custom-scrollbar cursor-text min-h-0',
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

  return (
    <>
      <div className="space-y-3 flex flex-col min-h-[240px]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
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
          <div className="flex-1 bg-white dark:bg-tp-surface border border-slate-200 dark:border-white/6 rounded-2xl overflow-hidden shadow-sm flex flex-col p-4 min-h-[200px]">
            {goalNoteEditorSection}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2 text-sm text-slate-600 dark:text-slate-400">
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
            aria-label={`Notatki celu — rozszerzony widok: ${goal.title}`}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-tp-surface shrink-0">
              <div className="flex items-center gap-2 min-w-0 text-slate-800 dark:text-white">
                <FileText className="w-5 h-5 text-indigo-500 dark:text-tp-accent shrink-0" />
                <h2 className="font-semibold truncate">Notatki — {goal.title}</h2>
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
            <div className="flex-1 flex flex-col min-h-0 p-4 pt-2">{goalNoteEditorSection}</div>
          </div>,
          document.body,
        )}
    </>
  );
}

function GoalItem({
  goal,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onToggleComplete,
}: {
  goal: Goal;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (goal: Goal) => void;
  onDelete: () => void;
  onToggleComplete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(goal.title);
  const [editDesc, setEditDesc] = useState(goal.description || '');
  const [newSubtask, setNewSubtask] = useState('');

  const handleSave = () => {
    onUpdate({ ...goal, title: editTitle, description: editDesc });
    setIsEditing(false);
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    const subtask: Subtask = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `st_${Date.now()}`,
      title: newSubtask.trim(),
      completed: false,
    };
    onUpdate({ ...goal, subtasks: [...(goal.subtasks || []), subtask] });
    setNewSubtask('');
  };

  const toggleSubtask = (subtaskId: string) => {
    const updatedSubtasks = (goal.subtasks || []).map((s) => (s.id === subtaskId ? { ...s, completed: !s.completed } : s));
    onUpdate({ ...goal, subtasks: updatedSubtasks });
  };

  const deleteSubtask = (subtaskId: string) => {
    onUpdate({ ...goal, subtasks: (goal.subtasks || []).filter((s) => s.id !== subtaskId) });
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-tp-surface rounded-2xl border transition-all duration-300',
        isExpanded ? 'border-indigo-200 dark:border-indigo-800 shadow-md' : 'border-slate-200 dark:border-white/6 shadow-sm hover:border-slate-300 dark:hover:border-white/10'
      )}
    >
      <div className="p-5 flex items-center gap-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete();
          }}
          className="flex-shrink-0"
        >
          {goal.completed ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Circle className="w-6 h-6 text-slate-300 dark:text-slate-700 hover:text-indigo-400 transition-colors" />}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggleExpand}>
          {isEditing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full font-bold text-lg bg-transparent border-b border-indigo-500 focus:outline-none text-slate-800 dark:text-white"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3 className={cn('font-bold text-lg truncate transition-all', goal.completed ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100')}>{goal.title}</h3>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <button onClick={handleSave} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors">
              <Save className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onToggleExpand} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-tp-muted rounded-lg transition-colors">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-5 pb-6 pt-2 border-t border-slate-100 dark:border-white/6 space-y-6 animate-in fade-in duration-200">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Opis celu</label>
            {isEditing ? (
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Dodaj szczegółowy opis swojego celu..."
                className="w-full bg-slate-50 dark:bg-tp-muted/50 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[100px] text-slate-700 dark:text-slate-300"
              />
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                {goal.description || <span className="italic opacity-50">Brak opisu. Kliknij edytuj, aby dodać szczegóły.</span>}
              </p>
            )}
          </div>

          <GoalNotesBlock goal={goal} onUpdate={onUpdate} />

          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Kroki do celu (Podzadania)</label>
            <div className="space-y-2">
              {goal.subtasks?.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-3 group">
                  <button onClick={() => toggleSubtask(subtask.id)}>
                    {subtask.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-slate-300 dark:text-slate-700" />}
                  </button>
                  <span className={cn('text-sm flex-1', subtask.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300')}>{subtask.title}</span>
                  <button onClick={() => deleteSubtask(subtask.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                  placeholder="Dodaj kolejny krok..."
                  className="flex-1 bg-transparent border-b border-slate-200 dark:border-white/6 py-1 text-sm focus:border-indigo-500 focus:outline-none text-slate-700 dark:text-slate-300"
                />
                <button onClick={handleAddSubtask} className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
