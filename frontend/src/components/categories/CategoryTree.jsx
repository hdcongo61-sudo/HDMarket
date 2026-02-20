import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, MoveDown, MoveUp, Plus } from 'lucide-react';
import StatusChip from './StatusChip';

function NodeRow({
  node,
  depth,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onCreateSubcategory,
  onMove,
  onDragStart,
  onDrop
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  return (
    <div className="space-y-1">
      <div
        draggable
        onDragStart={(event) => onDragStart(event, node)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => onDrop(event, node)}
        className={`group flex items-center gap-2 rounded-xl border px-2 py-2 transition ${
          selectedId === node.id
            ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-500/10'
            : 'border-transparent hover:border-neutral-200 hover:bg-neutral-50 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/80'
        }`}
        style={{ marginLeft: `${depth * 18}px` }}
      >
        <input
          type="checkbox"
          checked={selectedIds.has(node.id)}
          onChange={() => onToggleSelect(node.id)}
          className="h-4 w-4 rounded border-neutral-300 text-indigo-600"
        />
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded p-0.5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <GripVertical size={14} className="text-neutral-400" />
          <span className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{node.name}</span>
        </button>
        <span className="text-xs text-neutral-500">#{node.order}</span>
        <span className="hidden text-xs text-neutral-500 sm:inline">{node.usedByProducts || 0} produits</span>
        {node.isDeleted ? <StatusChip type="deleted">Supprimée</StatusChip> : null}
        {!node.isDeleted && !node.isActive ? <StatusChip type="hidden">Masquée</StatusChip> : null}
        {!node.isDeleted && node.isActive ? <StatusChip type="active">Active</StatusChip> : null}
        <div className="hidden items-center gap-1 group-hover:flex">
          <button
            type="button"
            onClick={() => onMove(node, 'up')}
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            title="Monter"
          >
            <MoveUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => onMove(node, 'down')}
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            title="Descendre"
          >
            <MoveDown size={14} />
          </button>
          {node.level === 0 ? (
            <button
              type="button"
              onClick={() => onCreateSubcategory(node)}
              className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              title="Créer une sous-catégorie"
            >
              <Plus size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {hasChildren && expanded ? (
        <div className="space-y-1">
          {node.children.map((child) => (
            <NodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onSelect={onSelect}
              onToggleSelect={onToggleSelect}
              onCreateSubcategory={onCreateSubcategory}
              onMove={onMove}
              onDragStart={onDragStart}
              onDrop={onDrop}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CategoryTree({
  tree,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onCreateSubcategory,
  onMove,
  onReorder
}) {
  const [draggedNode, setDraggedNode] = useState(null);

  const flatCount = useMemo(() => {
    let count = 0;
    tree.forEach((root) => {
      count += 1;
      count += Array.isArray(root.children) ? root.children.length : 0;
    });
    return count;
  }, [tree]);

  const handleDragStart = (event, node) => {
    setDraggedNode(node);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (event, targetNode) => {
    event.preventDefault();
    if (!draggedNode || draggedNode.id === targetNode.id) return;
    onReorder({ draggedNode, targetNode });
    setDraggedNode(null);
  };

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Arborescence</h2>
        <span className="text-xs text-neutral-500">{flatCount} éléments</span>
      </div>

      <div className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
        {tree.map((node) => (
          <NodeRow
            key={node.id}
            node={node}
            depth={0}
            selectedId={selectedId}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onToggleSelect={onToggleSelect}
            onCreateSubcategory={onCreateSubcategory}
            onMove={onMove}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </section>
  );
}
