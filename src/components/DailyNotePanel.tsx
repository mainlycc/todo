import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Maximize2, Minimize2 } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import {
  createRichNoteExtensions,
  RICH_NOTE_EDITOR_CONTENT_CLASS,
  RichNoteFormattingMenuBar,
} from './richNoteEditor';
import { readExpandOverlayLayout } from '../lib/expandNoteOverlayLayout';
import { cn } from '../utils';

interface DailyNotePanelProps {
  date: string;
  content: string;
  onChange: (date: string, content: string) => void;
  /** Gdy true: treść nie ma wewnętrznego scrolla (bez suwaka). */
  disableInnerScroll?: boolean;
}

export function DailyNotePanel({ date, content, onChange, disableInnerScroll }: DailyNotePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [overlayLayout, setOverlayLayout] = useState(() => readExpandOverlayLayout());

  const editor = useEditor({
    extensions: createRichNoteExtensions('Wpisz notatkę na ten dzień...'),
    content: content || '',
    editorProps: {
      attributes: {
        class: cn(
          RICH_NOTE_EDITOR_CONTENT_CLASS,
          'dark:text-white prose-p:dark:text-white prose-li:dark:text-white prose-strong:dark:text-white prose-headings:dark:text-white',
        ),
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

  useLayoutEffect(() => {
    if (!expanded) return;
    const updateLayout = () => setOverlayLayout(readExpandOverlayLayout());
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
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const main = document.querySelector('[data-app-main]');
    const prevOverflow = main instanceof HTMLElement ? main.style.overflow : '';
    if (main instanceof HTMLElement) main.style.overflow = 'hidden';
    return () => {
      if (main instanceof HTMLElement) main.style.overflow = prevOverflow;
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const noteEditorSection = (
    <>
      <RichNoteFormattingMenuBar editor={editor} />
      <div
        className={cn(
          'flex-1 min-h-0 cursor-text',
          disableInnerScroll ? 'overflow-visible' : 'overflow-y-auto',
          expanded ? 'px-2 pt-1' : '',
        )}
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent
          editor={editor}
          className={cn('h-full', expanded && 'min-h-[min(70vh,520px)]')}
        />
      </div>
    </>
  );

  return (
    <>
      <div
        className={cn(
          'bg-white dark:bg-tp-surface rounded-3xl shadow-sm border border-slate-200 dark:border-white/6 p-6 flex flex-col transition-colors',
          expanded ? 'min-h-[140px]' : 'h-full',
        )}
      >
        <div className="flex items-center gap-3 mb-2 text-slate-800 dark:text-white flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <FileText className="w-5 h-5 text-indigo-500 dark:text-tp-accent shrink-0" />
            <h2 className="font-semibold">Notatka dnia</h2>
          </div>
          {!expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-tp-muted hover:bg-slate-200 dark:hover:bg-tp-raised border border-slate-200/80 dark:border-white/10 transition-colors shrink-0"
              title="Rozwiń notatkę na obszar obok menu i nagłówka"
            >
              <Maximize2 className="w-3.5 h-3.5" aria-hidden />
              Na cały obszar
            </button>
          )}
        </div>

        {!expanded ? (
          noteEditorSection
        ) : (
          <div className="flex flex-col gap-3 py-4 text-sm text-slate-600 dark:text-slate-400">
            <p>Edytujesz w rozszerzonym oknie obok (sidebar i pasek u góry pozostają widoczne).</p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center justify-center gap-2 self-start px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-tp-muted hover:bg-slate-200 dark:hover:bg-tp-raised border border-slate-200 dark:border-white/10 transition-colors"
            >
              <Minimize2 className="w-4 h-4" aria-hidden />
              Wróć do podglądu
            </button>
          </div>
        )}
      </div>

      {expanded &&
        createPortal(
          <div
            className="fixed z-[90] flex flex-col bg-slate-50 dark:bg-tp-canvas border-l border-slate-200 dark:border-white/10 shadow-xl"
            style={{
              top: overlayLayout.top,
              left: overlayLayout.left,
              right: 0,
              bottom: 0,
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Notatka dnia — rozszerzony widok"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-tp-surface shrink-0">
              <div className="flex items-center gap-2 min-w-0 text-slate-800 dark:text-white">
                <FileText className="w-5 h-5 text-indigo-500 dark:text-tp-accent shrink-0" />
                <h2 className="font-semibold truncate">Notatka dnia</h2>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-tp-muted hover:bg-slate-200 dark:hover:bg-tp-raised border border-slate-200 dark:border-white/10 transition-colors shrink-0"
                title="Wróć do wąskiego podglądu w panelu"
              >
                <Minimize2 className="w-4 h-4" aria-hidden />
                Wróć do podglądu
              </button>
            </div>
            <div className="flex-1 flex flex-col min-h-0 p-4 pt-2">{noteEditorSection}</div>
          </div>,
          document.body,
        )}
    </>
  );
}
