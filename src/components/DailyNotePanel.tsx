import React, { useEffect } from 'react';
import { FileText } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import {
  createRichNoteExtensions,
  RICH_NOTE_EDITOR_CONTENT_CLASS,
  RichNoteFormattingMenuBar,
} from './richNoteEditor';

interface DailyNotePanelProps {
  date: string;
  content: string;
  onChange: (date: string, content: string) => void;
}

export function DailyNotePanel({ date, content, onChange }: DailyNotePanelProps) {
  const editor = useEditor({
    extensions: createRichNoteExtensions('Wpisz notatkę na ten dzień...'),
    content: content || '',
    editorProps: {
      attributes: {
        class: RICH_NOTE_EDITOR_CONTENT_CLASS,
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
    },
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
      <RichNoteFormattingMenuBar editor={editor} />
      <div className="flex-1 overflow-y-auto cursor-text" onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
