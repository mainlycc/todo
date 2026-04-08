import React, { useState, useEffect } from 'react';
import { Edit2, Save, X, Plus, Trash2, ShieldCheck, Bold, List as ListIcon, Heading2, Highlighter } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { supabase } from '../lib/supabase';
import { ANONYMOUS_USER_ID } from '../constants';

interface RuleCard {
  id: string;
  title: string;
  content: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 mb-2 pb-2 border-b border-slate-100 dark:border-white/6">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1 rounded-md transition-colors ${editor.isActive('bold') ? 'bg-slate-200 dark:bg-tp-raised text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-tp-muted'}`}
        title="Pogrubienie"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-1 rounded-md transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-slate-200 dark:bg-tp-raised text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-tp-muted'}`}
        title="Nagłówek"
      >
        <Heading2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1 rounded-md transition-colors ${editor.isActive('bulletList') ? 'bg-slate-200 dark:bg-tp-raised text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-tp-muted'}`}
        title="Lista"
      >
        <ListIcon className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={`p-1 rounded-md transition-colors ${editor.isActive('highlight') ? 'bg-slate-200 dark:bg-tp-raised text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-tp-muted'}`}
        title="Wyróżnienie"
      >
        <Highlighter className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

function RuleEditor({ initialContent, onSave, onCancel }: { initialContent: string; onSave: (content: string) => void; onCancel: () => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-yellow-200 dark:bg-yellow-900/60 text-inherit px-1 rounded',
        },
      }),
      Placeholder.configure({
        placeholder: 'Wpisz zasady...',
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[150px] text-slate-700 dark:text-slate-300',
      },
    },
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <MenuBar editor={editor} />
      <div className="flex-1 overflow-y-auto cursor-text" onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} className="h-full" />
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/6">
        <button onClick={onCancel} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-tp-muted rounded-xl transition-colors font-medium">
          <X className="w-4 h-4" /> Anuluj
        </button>
        <button
          onClick={() => onSave(editor?.getHTML() || '')}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors font-medium shadow-sm"
        >
          <Save className="w-4 h-4" /> Zapisz
        </button>
      </div>
    </div>
  );
}

function migratePlainContent(card: RuleCard): RuleCard {
  if (!card.content.includes('<p>') && !card.content.includes('<ul>')) {
    const htmlContent = card.content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => `<p>${line}</p>`)
      .join('');
    return { ...card, content: htmlContent };
  }
  return card;
}

async function persistRuleCards(cards: RuleCard[]) {
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const { error } = await supabase.from('rule_cards').upsert(
      {
        id: c.id,
        user_id: ANONYMOUS_USER_ID,
        title: c.title,
        content: c.content,
        position: i,
      },
      { onConflict: 'id' }
    );
    if (error) console.error('Error saving rule card:', error);
  }
}

export function RulesView() {
  const [cards, setCards] = useState<RuleCard[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('rule_cards')
        .select('*')
        .eq('user_id', ANONYMOUS_USER_ID)
        .order('position', { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error('Error fetching rule cards:', error);
        setLoaded(true);
        return;
      }

      if (data && data.length > 0) {
        setCards(
          data.map((row) => ({
            id: row.id,
            title: row.title,
            content: row.content,
          }))
        );
        setLoaded(true);
        return;
      }

      const savedCards = localStorage.getItem('rule_cards');
      if (savedCards) {
        try {
          const parsed: RuleCard[] = JSON.parse(savedCards).map(migratePlainContent);
          setCards(parsed);
          await persistRuleCards(parsed);
          setLoaded(true);
          return;
        } catch (e) {
          console.error('rule_cards migration failed', e);
        }
      }

      const oldRules = localStorage.getItem('work_rules');
      if (oldRules) {
        const initial = [{ id: '1', title: 'Ogólne zasady', content: oldRules.includes('<p>') ? oldRules : `<p>${oldRules}</p>` }];
        setCards(initial);
        await persistRuleCards(initial);
        setLoaded(true);
        return;
      }

      const defaults: RuleCard[] = [
        {
          id: '1',
          title: 'Zasady Dnia',
          content: '<p>1. Zawsze planuj dzień rano</p><p>2. Najważniejsze zadania jako pierwsze</p><p>3. Rób regularne przerwy</p>',
        },
        {
          id: '2',
          title: 'Praca z Klientem',
          content: '<p>1. Odpowiadaj w ciągu 24h</p><p>2. Bądź zawsze uprzejmy i profesjonalny</p><p>3. Ustalaj jasne terminy</p>',
        },
      ];
      setCards(defaults);
      await persistRuleCards(defaults);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveCards = async (newCards: RuleCard[]) => {
    setCards(newCards);
    await persistRuleCards(newCards);
  };

  const handleEdit = (card: RuleCard) => {
    setEditingId(card.id);
    setEditTitle(card.title);
    setEditContent(card.content);
    setDeletingId(null);
  };

  const handleSave = async (id: string, content?: string) => {
    const finalContent = content !== undefined ? content : editContent;
    if (id === 'new') {
      const newCard = {
        id: Date.now().toString(),
        title: editTitle.trim() || 'Nowa Karta',
        content: finalContent,
      };
      await saveCards([newCard, ...cards]);
    } else {
      const updatedCards = cards.map((c) => (c.id === id ? { ...c, title: editTitle.trim() || 'Bez tytułu', content: finalContent } : c));
      await saveCards(updatedCards);
    }
    setEditingId(null);
  };

  const confirmDelete = async (id: string) => {
    const { error } = await supabase.from('rule_cards').delete().eq('id', id);
    if (error) console.error('Error deleting rule card:', error);
    const newCards = cards.filter((c) => c.id !== id);
    await saveCards(newCards);
    setDeletingId(null);
  };

  const handleAddNew = () => {
    setEditingId('new');
    setEditTitle('');
    setEditContent('');
    setDeletingId(null);
  };

  if (!loaded) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
        Wczytywanie zasad…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Karty Zasad</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Zarządzaj swoimi zasadami w różnych obszarach</p>
        </div>
        <button
          onClick={handleAddNew}
          disabled={editingId !== null}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Dodaj kartę
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {editingId === 'new' && (
            <div className="bg-white dark:bg-tp-surface rounded-2xl border-2 border-indigo-500 shadow-lg p-5 flex flex-col h-[380px] animate-in fade-in zoom-in duration-200">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Tytuł (np. Zasady dnia)"
                className="text-base font-bold bg-transparent border-b border-slate-200 dark:border-white/10 pb-2 mb-3 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white placeholder:text-slate-400"
                autoFocus
              />
              <RuleEditor initialContent="" onSave={(content) => handleSave('new', content)} onCancel={() => setEditingId(null)} />
            </div>
          )}

          {cards.map((card) =>
            editingId === card.id ? (
              <div key={card.id} className="bg-white dark:bg-tp-surface rounded-2xl border-2 border-indigo-500 shadow-lg p-5 flex flex-col h-[380px]">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Tytuł (np. Zasady dnia)"
                  className="text-base font-bold bg-transparent border-b border-slate-200 dark:border-white/10 pb-2 mb-3 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white placeholder:text-slate-400"
                />
                <RuleEditor initialContent={card.content} onSave={(content) => handleSave(card.id, content)} onCancel={() => setEditingId(null)} />
              </div>
            ) : (
              <div
                key={card.id}
                className="relative bg-white dark:bg-tp-surface rounded-2xl border border-slate-200 dark:border-white/6 shadow-sm p-5 flex flex-col h-[380px] group hover:shadow-md transition-shadow"
              >
                {deletingId === card.id && (
                  <div className="absolute inset-0 bg-white/95 dark:bg-tp-surface/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 z-10">
                    <Trash2 className="w-12 h-12 text-red-500 mb-4 opacity-80" />
                    <p className="text-xl font-bold text-slate-800 dark:text-white mb-2 text-center">Usunąć tę kartę?</p>
                    <p className="text-slate-500 dark:text-slate-400 text-center mb-6 text-sm">Ta operacja jest nieodwracalna.</p>
                    <div className="flex gap-3 w-full">
                      <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-tp-muted dark:hover:bg-tp-raised text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors">
                        Anuluj
                      </button>
                      <button onClick={() => confirmDelete(card.id)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-sm">
                        Usuń
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100 dark:border-white/6">
                  <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wide">{card.title}</h3>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(card)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                      title="Edytuj kartę"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingId(card.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Usuń kartę"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div
                  className="flex-1 overflow-y-auto pr-2 custom-scrollbar prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:mt-4 prose-headings:mb-2 prose-ul:my-1 prose-li:my-0 text-slate-700 dark:text-slate-300 text-[13px]"
                  dangerouslySetInnerHTML={{ __html: card.content }}
                />
              </div>
            )
          )}
        </div>

        {cards.length === 0 && editingId !== 'new' && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 mt-20">
            <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-xl font-medium">Brak zapisanych kart zasad.</p>
            <p className="mt-2 text-sm">Kliknij "Dodaj kartę", aby stworzyć pierwszą.</p>
          </div>
        )}
      </div>
    </div>
  );
}
