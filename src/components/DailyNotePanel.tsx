import React, { useEffect } from 'react';
import { FileText, Bold, List, Heading2, Highlighter, Clock } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    largeText: {
      toggleLargeText: () => ReturnType;
    }
  }
}

const LargeText = Mark.create({
  name: 'largeText',
  parseHTML() {
    return [{ tag: 'span[data-large-text]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-large-text': 'true', class: 'text-lg font-bold' }), 0];
  },
  addCommands() {
    return {
      toggleLargeText: () => ({ commands }) => {
        return commands.toggleMark(this.name);
      },
    };
  },
});

interface DailyNotePanelProps {
  date: string;
  content: string;
  onChange: (date: string, content: string) => void;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  const insertTime = () => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    editor.chain().focus().insertContent(`${time} `).run();
  };

  return (
    <div className="flex items-center gap-1 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded-md transition-colors ${editor.isActive('bold') ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        title="Pogrubienie"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleLargeText().run()}
        className={`p-1.5 rounded-md transition-colors ${editor.isActive('largeText') ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        title="Większy tekst (tylko zaznaczenie)"
      >
        <Heading2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded-md transition-colors ${editor.isActive('bulletList') ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        title="Lista punktowana"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={`p-1.5 rounded-md transition-colors ${editor.isActive('highlight') ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        title="Wyróżnienie"
      >
        <Highlighter className="w-4 h-4" />
      </button>
      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
      <button
        onClick={insertTime}
        className="p-1.5 rounded-md transition-colors text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        title="Wstaw aktualną godzinę"
      >
        <Clock className="w-4 h-4" />
      </button>
    </div>
  );
};

export function DailyNotePanel({ date, content, onChange }: DailyNotePanelProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2],
        },
      }),
      LargeText,
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-yellow-200 dark:bg-yellow-900/60 text-inherit px-1 rounded',
        }
      }),
      Placeholder.configure({
        placeholder: 'Wpisz notatkę na ten dzień...',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] text-slate-600 dark:text-slate-400 prose-p:my-1 prose-headings:mt-4 prose-headings:mb-2 prose-ul:my-1 prose-li:my-0',
      },
    },
    onBlur: ({ editor }) => {
      let html = editor.getHTML();
      if (editor.isEmpty) {
        html = '';
      }
      if (html !== content) {
        onChange(date, html);
      }
    }
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content || '');
    }
  }, [content, date, editor]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 h-full flex flex-col transition-colors">
      <div className="flex items-center gap-3 mb-2 text-slate-800 dark:text-slate-200">
        <FileText className="w-5 h-5 text-indigo-500" />
        <h2 className="font-semibold">Notatka dnia</h2>
      </div>
      <MenuBar editor={editor} />
      <div className="flex-1 overflow-y-auto cursor-text" onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
