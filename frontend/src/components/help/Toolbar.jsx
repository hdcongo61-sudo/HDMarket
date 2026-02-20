import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link2,
  Code2,
  Eraser,
  Undo2,
  Redo2,
  SendHorizonal,
  Type
} from 'lucide-react';

function ToolButton({ label, active = false, onClick, children, disabled = false, title }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title || label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        active
          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200'
          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

export default function Toolbar({
  active,
  onToggleMark,
  onSetHeading,
  onToggleList,
  onInsertLink,
  onCodeBlock,
  onClearFormatting,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSubmit,
  submitting,
  saveIndicator,
  paperMode,
  setPaperMode,
  pasteWithFormatting,
  setPasteWithFormatting
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolButton label="Gras" active={active.bold} onClick={() => onToggleMark('bold')} title="Gras (Ctrl/Cmd+B)">
            <Bold className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Italique" active={active.italic} onClick={() => onToggleMark('italic')} title="Italique (Ctrl/Cmd+I)">
            <Italic className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Souligner" active={active.underline} onClick={() => onToggleMark('underline')} title="Souligner (Ctrl/Cmd+U)">
            <Underline className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Barré" active={active.strikeThrough} onClick={() => onToggleMark('strikeThrough')}>
            <Strikethrough className="h-4 w-4" />
          </ToolButton>

          <span className="mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-700" />

          <ToolButton label="Titre 1" active={active.heading === 'h1'} onClick={() => onSetHeading('h1')}>
            <Heading1 className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Titre 2" active={active.heading === 'h2'} onClick={() => onSetHeading('h2')}>
            <Heading2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Titre 3" active={active.heading === 'h3'} onClick={() => onSetHeading('h3')}>
            <Heading3 className="h-4 w-4" />
          </ToolButton>

          <span className="mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-700" />

          <ToolButton label="Liste à puces" active={active.bulletList} onClick={() => onToggleList('bullet')}>
            <List className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Liste numérotée" active={active.orderedList} onClick={() => onToggleList('ordered')}>
            <ListOrdered className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Insérer un lien" onClick={onInsertLink}>
            <Link2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Bloc code" active={active.codeBlock} onClick={onCodeBlock}>
            <Code2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Effacer le formatage" onClick={onClearFormatting}>
            <Eraser className="h-4 w-4" />
          </ToolButton>
        </div>

        <div className="flex items-center gap-1.5">
          <ToolButton label="Annuler" onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl/Cmd+Z)">
            <Undo2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Rétablir" onClick={onRedo} disabled={!canRedo} title="Rétablir (Ctrl/Cmd+Y)">
            <Redo2 className="h-4 w-4" />
          </ToolButton>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SendHorizonal className="h-4 w-4" />
            {submitting ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-2.5 py-1 dark:border-neutral-700 dark:bg-neutral-900">
            <input
              type="checkbox"
              checked={paperMode}
              onChange={(event) => setPaperMode(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
            />
            <Type className="h-3.5 w-3.5" />
            Mode document A4
          </label>

          <label className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-2.5 py-1 dark:border-neutral-700 dark:bg-neutral-900">
            <input
              type="checkbox"
              checked={pasteWithFormatting}
              onChange={(event) => setPasteWithFormatting(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
            />
            Coller avec formatage
          </label>
        </div>
        <span>{saveIndicator}</span>
      </div>
    </div>
  );
}
