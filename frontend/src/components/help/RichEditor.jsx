import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import Toolbar from './Toolbar';
import { getPlainTextFromHtml, sanitizeHelpHtml } from '../../utils/helpEditorContent';

const EMPTY_HTML = '<p><br></p>';

function moveCaretToEnd(element) {
  if (!element) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function isShortcut(event) {
  return event.ctrlKey || event.metaKey;
}

function isPrintableInput(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return event.key.length === 1;
}

const RichEditor = forwardRef(function RichEditor(
  {
    initialHtml = '',
    maxLength = 5000,
    placeholder = 'Décrivez votre problème en détail…',
    onDebouncedChange,
    paperMode,
    setPaperMode,
    pasteWithFormatting,
    setPasteWithFormatting,
    onSubmit,
    submitting,
    saveIndicator
  },
  ref
) {
  const editorRef = useRef(null);
  const debounceRef = useRef(null);
  const lastValidHtmlRef = useRef(EMPTY_HTML);
  const lastEmittedHtmlRef = useRef(EMPTY_HTML);
  const canRedoRef = useRef(false);
  const [charCount, setCharCount] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [active, setActive] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    bulletList: false,
    orderedList: false,
    heading: 'p',
    codeBlock: false
  });

  const emitChange = useCallback(
    (immediate = false) => {
      if (!editorRef.current) return;
      const html = editorRef.current.innerHTML || EMPTY_HTML;
      const plainText = getPlainTextFromHtml(html);
      const payload = {
        html,
        plainText,
        blocks: []
      };
      lastEmittedHtmlRef.current = html;

      setCharCount(plainText.length);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (immediate) {
        onDebouncedChange?.(payload);
      } else {
        debounceRef.current = setTimeout(() => {
          onDebouncedChange?.(payload);
        }, 280);
      }
    },
    [onDebouncedChange]
  );

  const refreshActiveState = useCallback(() => {
    if (!editorRef.current) return;
    const hasFocus = document.activeElement === editorRef.current;
    if (!hasFocus) return;

    const block =
      String(document.queryCommandValue('formatBlock') || 'p')
        .replace(/[<>]/g, '')
        .toLowerCase() || 'p';

    const nextState = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      bulletList: document.queryCommandState('insertUnorderedList'),
      orderedList: document.queryCommandState('insertOrderedList'),
      heading: ['h1', 'h2', 'h3'].includes(block) ? block : 'p',
      codeBlock: block === 'pre'
    };

    setActive(nextState);
    setCanUndo(document.queryCommandEnabled('undo'));
    setCanRedo(document.queryCommandEnabled('redo') || canRedoRef.current);
  }, []);

  const exec = useCallback(
    (command, value = null) => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      document.execCommand(command, false, value);
      if (command === 'undo') canRedoRef.current = true;
      if (command === 'redo') canRedoRef.current = false;
      refreshActiveState();
      emitChange();
    },
    [emitChange, refreshActiveState]
  );

  const setHeading = useCallback(
    (tag) => {
      exec('formatBlock', tag === 'p' ? 'p' : tag);
    },
    [exec]
  );

  const insertLink = useCallback(() => {
    const raw = window.prompt('Insérez une URL', 'https://');
    if (!raw) return;
    const href = raw.trim();
    if (!href) return;
    exec('createLink', href);
  }, [exec]);

  const clearFormatting = useCallback(() => {
    exec('removeFormat');
    exec('unlink');
    exec('formatBlock', 'p');
  }, [exec]);

  const onKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) {
          exec('insertLineBreak');
        } else {
          exec('insertParagraph');
        }
        return;
      }

      if (isShortcut(event)) {
        const key = event.key.toLowerCase();
        if (key === 'b') {
          event.preventDefault();
          exec('bold');
          return;
        }
        if (key === 'i') {
          event.preventDefault();
          exec('italic');
          return;
        }
        if (key === 'u') {
          event.preventDefault();
          exec('underline');
          return;
        }
        if (key === 'z') {
          event.preventDefault();
          if (event.shiftKey) {
            exec('redo');
          } else {
            exec('undo');
          }
          return;
        }
        if (key === 'y') {
          event.preventDefault();
          exec('redo');
          return;
        }
      }

      if (!maxLength) return;
      const currentText = getPlainTextFromHtml(editorRef.current?.innerHTML || '');
      const selectedText = window.getSelection()?.toString() || '';
      const nextLength = currentText.length - selectedText.length;

      if (isPrintableInput(event) && nextLength >= maxLength) {
        event.preventDefault();
      }
    },
    [exec, maxLength]
  );

  const onPaste = useCallback(
    (event) => {
      if (pasteWithFormatting) return;
      event.preventDefault();
      const text = event.clipboardData?.getData('text/plain') || '';
      exec('insertText', text);
    },
    [pasteWithFormatting, exec]
  );

  const onInput = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML || EMPTY_HTML;
    const plainText = getPlainTextFromHtml(html);

    if (maxLength && plainText.length > maxLength) {
      editorRef.current.innerHTML = lastValidHtmlRef.current;
      moveCaretToEnd(editorRef.current);
      return;
    }

    lastValidHtmlRef.current = html;
    emitChange();
    refreshActiveState();
  }, [emitChange, maxLength, refreshActiveState]);

  useEffect(() => {
    if (!editorRef.current) return;
    const normalized = sanitizeHelpHtml(initialHtml || '') || EMPTY_HTML;
    const currentHtml = editorRef.current.innerHTML || EMPTY_HTML;
    const isFocused = document.activeElement === editorRef.current;

    // Prevent cursor jump while typing: don't re-apply local editor updates.
    if (normalized === currentHtml || normalized === lastEmittedHtmlRef.current || isFocused) {
      return;
    }

    editorRef.current.innerHTML = normalized;
    lastValidHtmlRef.current = normalized;
    lastEmittedHtmlRef.current = normalized;
    setCharCount(getPlainTextFromHtml(normalized).length);
  }, [initialHtml]);

  useEffect(() => {
    const onSelectionChange = () => refreshActiveState();
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refreshActiveState]);

  useImperativeHandle(
    ref,
    () => ({
      getDocumentState() {
        const html = editorRef.current?.innerHTML || EMPTY_HTML;
        return {
          html,
          plainText: getPlainTextFromHtml(html),
          blocks: []
        };
      },
      clear() {
        if (!editorRef.current) return;
        editorRef.current.innerHTML = EMPTY_HTML;
        lastValidHtmlRef.current = EMPTY_HTML;
        lastEmittedHtmlRef.current = EMPTY_HTML;
        setCharCount(0);
        emitChange(true);
      },
      focus() {
        editorRef.current?.focus();
      },
      setHtml(html) {
        if (!editorRef.current) return;
        const normalized = sanitizeHelpHtml(html || '') || EMPTY_HTML;
        editorRef.current.innerHTML = normalized;
        lastValidHtmlRef.current = normalized;
        lastEmittedHtmlRef.current = normalized;
        setCharCount(getPlainTextFromHtml(normalized).length);
        emitChange(true);
      }
    }),
    [emitChange]
  );

  const editorContainerClass = useMemo(() => {
    if (paperMode) {
      return 'mx-auto max-w-[850px] rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900';
    }
    return 'rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900';
  }, [paperMode]);

  return (
    <section className="space-y-3">
      <Toolbar
        active={active}
        onToggleMark={exec}
        onSetHeading={setHeading}
        onToggleList={(type) => exec(type === 'bullet' ? 'insertUnorderedList' : 'insertOrderedList')}
        onInsertLink={insertLink}
        onCodeBlock={() => setHeading(active.codeBlock ? 'p' : 'pre')}
        onClearFormatting={clearFormatting}
        onUndo={() => exec('undo')}
        onRedo={() => exec('redo')}
        canUndo={canUndo}
        canRedo={canRedo}
        onSubmit={onSubmit}
        submitting={submitting}
        saveIndicator={saveIndicator}
        paperMode={paperMode}
        setPaperMode={setPaperMode}
        pasteWithFormatting={pasteWithFormatting}
        setPasteWithFormatting={setPasteWithFormatting}
      />

      <div className={editorContainerClass}>
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-label="Description de la demande"
          aria-multiline="true"
          suppressContentEditableWarning
          spellCheck
          onKeyDown={onKeyDown}
          onInput={onInput}
          onPaste={onPaste}
          onBlur={() => emitChange(true)}
          className="help-rich-editor min-h-[280px] w-full rounded-xl border border-transparent px-1 py-1 text-sm leading-7 text-neutral-900 outline-none focus:border-indigo-200 dark:text-neutral-100 dark:focus:border-indigo-700 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-tight [&_h3]:mb-2 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:rounded-lg [&_pre]:bg-neutral-100 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs dark:[&_pre]:bg-neutral-800"
          data-placeholder={placeholder}
        />
        <div className="mt-2 flex items-center justify-end text-xs text-neutral-500 dark:text-neutral-400">
          {charCount.toLocaleString('fr-FR')} / {maxLength.toLocaleString('fr-FR')} caractères
        </div>
      </div>
    </section>
  );
});

export default React.memo(RichEditor);
