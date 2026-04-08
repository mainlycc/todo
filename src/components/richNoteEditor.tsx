import { Bold, List, Heading2, Highlighter, Clock } from 'lucide-react';
import { Mark, mergeAttributes, type Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    largeText: {
      toggleLargeText: () => ReturnType;
    };
  }
}

export const LargeText = Mark.create({
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

export function createRichNoteExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: {
        levels: [2],
      },
    }),
    LargeText,
    Highlight.configure({
      HTMLAttributes: {
        class: 'bg-yellow-200 dark:bg-yellow-900/60 text-inherit px-1 rounded',
      },
    }),
    Placeholder.configure({
      placeholder,
      emptyEditorClass: 'is-editor-empty',
    }),
  ];
}

/** Wspólne klasy treści edytora (notatka dnia + notatki projektu) */
export const RICH_NOTE_EDITOR_CONTENT_CLASS =
  'tiptap prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] text-slate-600 dark:text-slate-400 prose-p:my-1 prose-headings:mt-4 prose-headings:mb-2 prose-ul:my-1 prose-li:my-0';

export function RichNoteFormattingMenuBar({ editor }: { editor: Editor | null }) {
  if (!editor) {
    return null;
  }

  const insertTime = () => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    editor.chain().focus().insertContent(`${time} `).run();
  };

  return (
    <div className="flex items-center gap-1 mb-3 pb-3 border-b border-slate-100 dark:border-white/6">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded-md transition-colors ${editor.isActive('bold') ? 'bg-slate-200 dark:bg-tp-raised text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-tp-muted'}`}
        title="Pogrubienie"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleLargeText().run()}
        className={`p-1.5 rounded-md transition-colors ${editor.isActive('largeText') ? 'bg-slate-200 dark:bg-tp-raised text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-tp-muted'}`}
        title="Większy tekst (tylko zaznaczenie)"
      >
        <Heading2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded-md transition-colors ${editor.isActive('bulletList') ? 'bg-slate-200 dark:bg-tp-raised text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-tp-muted'}`}
        title="Lista punktowana"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={`p-1.5 rounded-md transition-colors ${editor.isActive('highlight') ? 'bg-slate-200 dark:bg-tp-raised text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-tp-muted'}`}
        title="Wyróżnienie"
      >
        <Highlighter className="w-4 h-4" />
      </button>
      <div className="w-px h-4 bg-slate-200 dark:bg-tp-raised mx-1" />
      <button
        type="button"
        onClick={insertTime}
        className="p-1.5 rounded-md transition-colors text-slate-500 hover:bg-slate-100 dark:hover:bg-tp-muted"
        title="Wstaw aktualną godzinę"
      >
        <Clock className="w-4 h-4" />
      </button>
    </div>
  );
}
