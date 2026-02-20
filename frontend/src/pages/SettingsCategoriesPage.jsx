import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Download, FileJson, RefreshCcw, Search } from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import GlassHeader from '../components/categories/GlassHeader';
import CategoryTree from '../components/categories/CategoryTree';
import CategoryEditor from '../components/categories/CategoryEditor';
import BulkActionsToolbar from '../components/categories/BulkActionsToolbar';
import ImportWizard from '../components/categories/ImportWizard';
import ReassignProductsModal from '../components/categories/ReassignProductsModal';
import ActivityPanel from '../components/categories/ActivityPanel';
import categoryGroups from '../data/categories';

const buildImportTemplate = () => ({
  tree: [
    {
      name: 'Mode',
      slug: 'mode',
      order: 0,
      isActive: true,
      iconKey: 'Shirt',
      description: 'Catégorie parent exemple',
      children: [
        {
          name: 'Chaussures',
          slug: 'chaussures',
          order: 0,
          isActive: true
        },
        {
          name: 'Sacs',
          slug: 'sacs',
          order: 1,
          isActive: true
        }
      ]
    },
    {
      name: 'Maison',
      slug: 'maison',
      order: 1,
      isActive: true,
      children: [
        {
          name: 'Décoration',
          slug: 'decoration',
          order: 0,
          isActive: true
        }
      ]
    }
  ]
});

const buildLegacyHardcodedTree = () =>
  categoryGroups.map((group, groupIndex) => ({
    name: group.label,
    slug: group.id,
    order: groupIndex,
    isActive: true,
    description: group.description || '',
    iconKey: group.icon?.displayName || group.icon?.name || '',
    children: (group.options || []).map((option, optionIndex) => ({
      name: option.label,
      slug: option.value,
      order: optionIndex,
      isActive: true
    }))
  }));

const flattenTree = (tree = []) => {
  const flat = [];
  tree.forEach((root) => {
    flat.push(root);
    (root.children || []).forEach((child) => flat.push(child));
  });
  return flat;
};

const cloneTree = (tree = []) => JSON.parse(JSON.stringify(tree));

const moveArrayItem = (array, from, to) => {
  const copy = [...array];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

const reorderNodes = (tree, draggedNode, targetNode, direction = null, allowParentChange = false) => {
  const next = cloneTree(tree);

  if (draggedNode.level === 0 && targetNode.level === 0) {
    const roots = next;
    const fromIndex = roots.findIndex((node) => node.id === draggedNode.id);
    const toIndex =
      direction === 'up'
        ? Math.max(0, fromIndex - 1)
        : direction === 'down'
        ? Math.min(roots.length - 1, fromIndex + 1)
        : roots.findIndex((node) => node.id === targetNode.id);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return null;
    const reordered = moveArrayItem(roots, fromIndex, toIndex).map((node, index) => ({ ...node, order: index }));
    const items = reordered.map((node, index) => ({ id: node.id, parentId: null, order: index }));
    return { nextTree: reordered, items, allowParentChange: false };
  }

  if (draggedNode.level !== 1 || targetNode.level !== 1) return null;

  const sourceParent = next.find((node) => node.id === draggedNode.parentId);
  const targetParent = next.find((node) => node.id === targetNode.parentId);
  if (!sourceParent || !targetParent) return null;

  if (sourceParent.id !== targetParent.id && !allowParentChange) {
    return { needsParentConfirm: true };
  }

  const sourceChildren = [...(sourceParent.children || [])];
  const fromIndex = sourceChildren.findIndex((node) => node.id === draggedNode.id);
  if (fromIndex < 0) return null;
  const [dragged] = sourceChildren.splice(fromIndex, 1);

  let targetChildren = sourceParent.id === targetParent.id ? sourceChildren : [...(targetParent.children || [])];

  const toIndex =
    direction === 'up'
      ? Math.max(0, fromIndex - 1)
      : direction === 'down'
      ? Math.min(sourceChildren.length, fromIndex + 1)
      : targetChildren.findIndex((node) => node.id === targetNode.id);

  const insertIndex = toIndex < 0 ? targetChildren.length : toIndex;
  targetChildren.splice(insertIndex, 0, { ...dragged, parentId: targetParent.id });

  sourceParent.children = (sourceParent.id === targetParent.id ? targetChildren : sourceChildren).map((node, index) => ({
    ...node,
    order: index,
    parentId: sourceParent.id
  }));

  if (sourceParent.id !== targetParent.id) {
    targetParent.children = targetChildren.map((node, index) => ({
      ...node,
      order: index,
      parentId: targetParent.id
    }));
  }

  const items = [
    ...(sourceParent.children || []).map((node, index) => ({ id: node.id, parentId: sourceParent.id, order: index })),
    ...(sourceParent.id !== targetParent.id
      ? (targetParent.children || []).map((node, index) => ({ id: node.id, parentId: targetParent.id, order: index }))
      : [])
  ];

  return {
    nextTree: next,
    items,
    allowParentChange: sourceParent.id !== targetParent.id
  };
};

export default function SettingsCategoriesPage() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();

  const [tree, setTree] = useState([]);
  const [totalNodes, setTotalNodes] = useState(0);
  const [loadingTree, setLoadingTree] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importSeedJson, setImportSeedJson] = useState('');
  const [reassignSource, setReassignSource] = useState(null);
  const [reassignOpen, setReassignOpen] = useState(false);

  const [activity, setActivity] = useState({ items: [], pagination: { total: 0 } });
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityFilters, setActivityFilters] = useState({ action: '', from: '', to: '' });

  const flatNodes = useMemo(() => flattenTree(tree), [tree]);
  const selectedNode = useMemo(() => flatNodes.find((node) => node.id === selectedId) || null, [flatNodes, selectedId]);

  const previewData = useMemo(
    () =>
      tree
        .filter((node) => node.isActive && !node.isDeleted)
        .slice(0, 6)
        .map((node) => ({
          id: node.id,
          name: node.name,
          children: (node.children || []).filter((child) => child.isActive && !child.isDeleted).slice(0, 3)
        })),
    [tree]
  );

  const importTemplatePayload = useMemo(() => buildImportTemplate(), []);
  const importTemplateJson = useMemo(
    () => JSON.stringify(importTemplatePayload, null, 2),
    [importTemplatePayload]
  );
  const legacyHardcodedPayload = useMemo(
    () => ({
      exportedAt: new Date().toISOString(),
      source: 'frontend/src/data/categories.js',
      tree: buildLegacyHardcodedTree()
    }),
    []
  );
  const legacyHardcodedJson = useMemo(
    () => JSON.stringify(legacyHardcodedPayload, null, 2),
    [legacyHardcodedPayload]
  );

  const loadTree = useCallback(async () => {
    setLoadingTree(true);
    try {
      const { data } = await api.get('/admin/categories/tree', {
        params: {
          includeDeleted: true,
          includeInactive: true,
          search: debouncedSearch || undefined
        },
        skipCache: true
      });
      const nextTree = Array.isArray(data?.tree) ? data.tree : [];
      setTree(nextTree);
      setTotalNodes(Number(data?.totalNodes || 0));
      if (selectedId && !flattenTree(nextTree).some((node) => node.id === selectedId)) {
        setSelectedId('');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur chargement catégories.', { variant: 'error' });
    } finally {
      setLoadingTree(false);
    }
  }, [debouncedSearch, selectedId, showToast]);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const { data } = await api.get('/admin/categories/audit', {
        params: {
          action: activityFilters.action || undefined,
          from: activityFilters.from || undefined,
          to: activityFilters.to || undefined,
          page: 1,
          limit: 20
        },
        skipCache: true
      });
      setActivity(data || { items: [], pagination: { total: 0 } });
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur chargement audit.', { variant: 'error' });
    } finally {
      setActivityLoading(false);
    }
  }, [activityFilters.action, activityFilters.from, activityFilters.to, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    loadTree();
  }, [user?.role, loadTree]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    loadActivity();
  }, [user?.role, loadActivity]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async (id, payload) => {
    setSaving(true);
    try {
      await api.patch(`/admin/categories/${id}`, payload);
      showToast('Catégorie mise à jour.', { variant: 'success' });
      await Promise.all([loadTree(), loadActivity()]);
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur mise à jour.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async (payload) => {
    setSaving(true);
    try {
      await api.post('/admin/categories', payload);
      showToast('Catégorie créée.', { variant: 'success' });
      await Promise.all([loadTree(), loadActivity()]);
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur création.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubcategory = async (parent, payload = null) => {
    const safePayload = payload || { name: `Nouvelle sous-catégorie ${Date.now()}` };
    setSaving(true);
    try {
      await api.post('/admin/categories', {
        ...safePayload,
        parentId: parent.id,
        country: parent.country || '',
        cities: parent.cities || []
      });
      showToast('Sous-catégorie créée.', { variant: 'success' });
      await Promise.all([loadTree(), loadActivity()]);
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur création sous-catégorie.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async (node) => {
    if (!window.confirm(`Supprimer (soft) ${node.name} ?`)) return;
    setSaving(true);
    try {
      await api.post(`/admin/categories/${node.id}/soft-delete`, {});
      showToast('Catégorie supprimée (soft).', { variant: 'success' });
      await Promise.all([loadTree(), loadActivity()]);
    } catch (error) {
      const message = error.response?.data?.message || 'Suppression impossible.';
      showToast(message, { variant: 'error' });
      if (error.response?.status === 409) {
        setReassignSource(node);
        setReassignOpen(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (node) => {
    setSaving(true);
    try {
      await api.post(`/admin/categories/${node.id}/restore`, {});
      showToast('Catégorie restaurée.', { variant: 'success' });
      await Promise.all([loadTree(), loadActivity()]);
    } catch (error) {
      showToast(error.response?.data?.message || 'Restauration impossible.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePersistReorder = async (nextTree, items, allowParentChange) => {
    const previousTree = tree;
    setTree(nextTree);
    try {
      await api.post('/admin/categories/reorder', {
        items,
        allowParentChange
      });
      await Promise.all([loadTree(), loadActivity()]);
    } catch (error) {
      setTree(previousTree);
      showToast(error.response?.data?.message || 'Erreur réorganisation.', { variant: 'error' });
    }
  };

  const handleMove = async (node, direction) => {
    const targetNode = node;
    const result = reorderNodes(tree, node, targetNode, direction, false);
    if (!result?.nextTree || !result?.items?.length) return;
    await handlePersistReorder(result.nextTree, result.items, result.allowParentChange);
  };

  const handleReorder = async ({ draggedNode, targetNode }) => {
    const baseResult = reorderNodes(tree, draggedNode, targetNode, null, false);
    if (!baseResult) return;
    if (baseResult.needsParentConfirm) {
      const confirmed = window.confirm(
        'Déplacer cette sous-catégorie vers un autre parent ? Cette action modifie le path.'
      );
      if (!confirmed) return;
      const confirmedResult = reorderNodes(tree, draggedNode, targetNode, null, true);
      if (!confirmedResult?.nextTree || !confirmedResult?.items?.length) return;
      await handlePersistReorder(confirmedResult.nextTree, confirmedResult.items, true);
      return;
    }
    if (!baseResult.nextTree || !baseResult.items?.length) return;
    await handlePersistReorder(baseResult.nextTree, baseResult.items, baseResult.allowParentChange);
  };

  const handleBulkAction = async (action) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setSaving(true);
    try {
      if (action === 'activate' || action === 'deactivate') {
        await Promise.all(
          ids.map((id) => api.patch(`/admin/categories/${id}`, { isActive: action === 'activate' }))
        );
      } else if (action === 'softDelete') {
        await Promise.all(ids.map((id) => api.post(`/admin/categories/${id}/soft-delete`, {})));
      } else if (action === 'restore') {
        await Promise.all(ids.map((id) => api.post(`/admin/categories/${id}/restore`, {})));
      }
      setSelectedIds(new Set());
      showToast('Action bulk exécutée.', { variant: 'success' });
      await Promise.all([loadTree(), loadActivity()]);
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur action bulk.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const { data } = await api.get('/admin/categories/export', {
        params: { format },
        responseType: 'blob',
        skipCache: true
      });
      const blob = new Blob([data], {
        type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `categories-export.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur export.', { variant: 'error' });
    }
  };

  const openImportWithPayload = (payload) => {
    setImportSeedJson(JSON.stringify(payload, null, 2));
    setImportResult(null);
    setImportOpen(true);
  };

  const handleCopyJson = async (content, successMessage) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast(successMessage, { variant: 'success' });
    } catch (error) {
      showToast('Impossible de copier dans le presse-papiers.', { variant: 'error' });
    }
  };

  const downloadJson = (filename, content) => {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportHardcodedLegacy = () => {
    downloadJson('categories-hardcoded-legacy.json', legacyHardcodedJson);
    showToast('Export des catégories hardcodées généré.', { variant: 'success' });
  };

  const handleImportDryRun = async (payload) => {
    try {
      const body = Array.isArray(payload) ? { tree: payload } : payload;
      const { data } = await api.post('/admin/categories/import?dryRun=true', body, { skipCache: true });
      setImportResult(data);
      showToast('Dry-run terminé.', { variant: 'success' });
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur dry-run import.', { variant: 'error' });
    }
  };

  const handleImportApply = async (payload) => {
    setSaving(true);
    try {
      const body = Array.isArray(payload) ? { tree: payload } : payload;
      await api.post('/admin/categories/import?dryRun=false', body, { skipCache: true });
      showToast('Import appliqué.', { variant: 'success' });
      setImportOpen(false);
      setImportResult(null);
      await Promise.all([loadTree(), loadActivity()]);
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur import.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReassignConfirm = async (payload) => {
    setSaving(true);
    try {
      await api.post('/admin/categories/reassign-products', payload);
      showToast('Produits réassignés.', { variant: 'success' });
      setReassignOpen(false);
      await Promise.all([loadTree(), loadActivity()]);
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur réassignation.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          Accès refusé. Cette page est réservée aux administrateurs.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <GlassHeader
        title="Category Manager"
        subtitle={`Arborescence dynamique, migration safe et audit (${totalNodes} noeuds)`}
        actions={
          <>
            <Link
              to="/admin/settings"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <ArrowLeft size={14} /> App settings
            </Link>
            <button
              type="button"
              onClick={() => {
                loadTree();
                loadActivity();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              <RefreshCcw size={14} /> Refresh
            </button>
          </>
        }
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="space-y-4 lg:col-span-7">
          <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <label className="relative block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher catégorie, slug, path"
                className="w-full rounded-2xl border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </label>
          </section>

          <BulkActionsToolbar
            selectedCount={selectedIds.size}
            onBulkAction={handleBulkAction}
            onExport={handleExport}
            onOpenImport={() => {
              setImportSeedJson('');
              setImportOpen(true);
            }}
            loading={saving}
          />

          {loadingTree ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
              Chargement catégories...
            </div>
          ) : (
            <CategoryTree
              tree={tree}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onSelect={(node) => setSelectedId(node.id)}
              onToggleSelect={toggleSelected}
              onCreateSubcategory={(parent) => handleCreateSubcategory(parent)}
              onMove={handleMove}
              onReorder={handleReorder}
            />
          )}

          <ActivityPanel
            activity={activity}
            filters={activityFilters}
            loading={activityLoading}
            onChangeFilters={setActivityFilters}
            onRefresh={loadActivity}
          />
        </div>

        <div className="space-y-4 lg:col-span-5">
          <CategoryEditor
            selectedNode={selectedNode}
            saving={saving}
            onSave={handleSave}
            onSoftDelete={handleSoftDelete}
            onRestore={handleRestore}
            onCreateCategory={handleCreateCategory}
            onCreateSubcategory={handleCreateSubcategory}
            onOpenReassign={(node) => {
              setReassignSource(node);
              setReassignOpen(true);
            }}
          />

          <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Preview storefront & form</h2>
            <p className="mb-3 text-xs text-neutral-500">Aperçu des catégories actives visibles pour les clients.</p>
            <div className="space-y-2">
              {previewData.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{entry.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {entry.children.map((child) => (
                      <span
                        key={child.id}
                        className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        {child.name}
                      </span>
                    ))}
                    {!entry.children.length ? (
                      <span className="text-xs text-neutral-400">Sans sous-catégorie active</span>
                    ) : null}
                  </div>
                </div>
              ))}
              {!previewData.length ? (
                <p className="text-xs text-neutral-500">Aucune catégorie active.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Modèle d'import catégories</h2>
            <p className="mb-3 text-xs text-neutral-500">
              Utilisez ce JSON comme base pour ajouter des catégories/sous-catégories, puis importez via le wizard.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCopyJson(importTemplateJson, 'Modèle JSON copié.')}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <Copy size={14} /> Copier modèle
              </button>
              <button
                type="button"
                onClick={() => openImportWithPayload(importTemplatePayload)}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
              >
                <FileJson size={14} /> Ouvrir dans import
              </button>
            </div>
            <pre className="max-h-56 overflow-auto rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-5 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              {importTemplateJson}
            </pre>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Exporter catégories hardcodées</h2>
            <p className="mb-3 text-xs text-neutral-500">
              Exporte toutes les catégories legacy de <code>frontend/src/data/categories.js</code> au format importable.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportHardcodedLegacy}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <Download size={14} /> Export JSON legacy
              </button>
              <button
                type="button"
                onClick={() => openImportWithPayload(legacyHardcodedPayload)}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
              >
                <FileJson size={14} /> Charger dans import
              </button>
              <button
                type="button"
                onClick={() => handleCopyJson(legacyHardcodedJson, 'JSON legacy copié.')}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <Copy size={14} /> Copier JSON legacy
              </button>
            </div>
            <pre className="max-h-56 overflow-auto rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-5 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              {legacyHardcodedJson}
            </pre>
          </section>
        </div>
      </div>

      <ImportWizard
        open={importOpen}
        loading={saving}
        onClose={() => {
          setImportOpen(false);
          setImportResult(null);
        }}
        onDryRun={handleImportDryRun}
        onApply={handleImportApply}
        result={importResult}
        initialJson={importSeedJson}
      />

      <ReassignProductsModal
        open={reassignOpen}
        source={reassignSource}
        nodes={flatNodes}
        loading={saving}
        onClose={() => setReassignOpen(false)}
        onConfirm={handleReassignConfirm}
      />
    </div>
  );
}
