import React, { useContext, useEffect, useMemo, useState } from 'react';
import { MessageSquare, Plus, Save, Trash2, Edit3, ChevronRight } from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';

const EMPTY_FORM = {
  title: '',
  category: '',
  type: 'question',
  content: '',
  parentId: '',
  order: 0,
  priority: 0,
  active: true,
  rolesInput: 'all',
  entityType: '',
  entityId: '',
  path: ''
};

const normalizeNode = (node = {}) => ({
  id: String(node.id || node._id || ''),
  title: String(node.title || node.question || ''),
  content: String(node.content || node.response || ''),
  category: String(node.category || ''),
  type: String(node.type || 'question'),
  parentId: node.parentId ? String(node.parentId) : '',
  order: Number(node.order || 0),
  priority: Number(node.priority || 0),
  usageCount: Number(node.usageCount || 0),
  lastUsedAt: node.lastUsedAt || null,
  active: Boolean(node.active !== false),
  roles: Array.isArray(node.roles) ? node.roles : [],
  entityType: String(node.entityType || ''),
  entityId: String(node.entityId || ''),
  metadata: node.metadata && typeof node.metadata === 'object' ? node.metadata : {}
});

const buildTree = (nodes = []) => {
  const byParent = new Map();
  nodes.forEach((node) => {
    const key = node.parentId || 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  });

  const sortNodes = (list = []) =>
    [...list].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.order !== b.order) return a.order - b.order;
      return a.title.localeCompare(b.title, 'fr');
    });

  const mapChildren = (parentKey) =>
    sortNodes(byParent.get(parentKey) || []).map((node) => ({
      ...node,
      children: mapChildren(node.id)
    }));

  return mapChildren('root');
};

const flattenTreeLabels = (nodes = [], level = 0, output = []) => {
  nodes.forEach((node) => {
    output.push({
      id: node.id,
      label: `${'— '.repeat(level)}${node.title || '(Sans titre)'}`,
      level
    });
    flattenTreeLabels(node.children || [], level + 1, output);
  });
  return output;
};

const parseRolesInput = (rolesInput) =>
  Array.from(
    new Set(
      String(rolesInput || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  );

const nodeTypeLabel = (type) => {
  if (type === 'info') return 'Info';
  if (type === 'action') return 'Action';
  if (type === 'link') return 'Lien';
  return 'Question';
};

export default function AdminChatTemplates() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [accessUsers, setAccessUsers] = useState([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessSearch, setAccessSearch] = useState('');
  const [accessSavingUserId, setAccessSavingUserId] = useState('');

  const tree = useMemo(() => buildTree(templates), [templates]);
  const parentOptions = useMemo(() => flattenTreeLabels(tree), [tree]);

  const loadTemplates = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/chat/templates/manage');
      const list = Array.isArray(data?.templates) ? data.templates : Array.isArray(data) ? data : [];
      setTemplates(list.map(normalizeNode));
    } catch (err) {
      setError(err?.response?.data?.message || 'Impossible de charger les templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadAccessUsers = async (search = '') => {
    if (!isAdmin) return;
    setAccessLoading(true);
    try {
      const { data } = await api.get('/admin/chat-template-managers', {
        params: { search: String(search || '').trim(), limit: 50 }
      });
      setAccessUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Impossible de charger les accès templates chat.");
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadAccessUsers('').catch(() => {});
  }, [isAdmin]);

  const resetForm = () => {
    setEditingId('');
    setForm(EMPTY_FORM);
    setError('');
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const submitPayload = () => {
    const payload = {
      title: form.title,
      category: form.category,
      type: form.type,
      content: form.content,
      parentId: form.parentId || null,
      order: Number(form.order || 0),
      priority: Number(form.priority || 0),
      active: Boolean(form.active),
      roles: parseRolesInput(form.rolesInput),
      entityType: form.entityType || '',
      entityId: form.entityId || '',
      metadata: {
        ...(form.path ? { path: form.path } : {})
      }
    };
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setError('Titre et contenu requis.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = submitPayload();
      if (editingId) {
        await api.patch(`/chat/templates/manage/${editingId}`, payload);
      } else {
        await api.post('/chat/templates/manage', payload);
      }
      await loadTemplates();
      resetForm();
    } catch (err) {
      setError(err?.response?.data?.message || 'Impossible de sauvegarder le template.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (node) => {
    setEditingId(node.id);
    setForm({
      title: node.title,
      category: node.category,
      type: node.type,
      content: node.content,
      parentId: node.parentId || '',
      order: node.order,
      priority: node.priority,
      active: node.active,
      rolesInput: node.roles?.length ? node.roles.join(', ') : 'all',
      entityType: node.entityType || '',
      entityId: node.entityId || '',
      path: String(node.metadata?.path || node.metadata?.url || '')
    });
    setError('');
  };

  const handleDelete = async (id) => {
    if (!id) return;
    setError('');
    try {
      await api.delete(`/chat/templates/manage/${id}`);
      if (editingId === id) resetForm();
      await loadTemplates();
    } catch (err) {
      setError(err?.response?.data?.message || 'Impossible de supprimer le template.');
    }
  };

  const handleToggleAccess = async (targetUserId) => {
    if (!isAdmin || !targetUserId) return;
    setAccessSavingUserId(targetUserId);
    setError('');
    try {
      await api.patch(`/admin/chat-template-managers/${targetUserId}/toggle`);
      await loadAccessUsers(accessSearch);
    } catch (err) {
      setError(err?.response?.data?.message || "Impossible de modifier l'accès.");
    } finally {
      setAccessSavingUserId('');
    }
  };

  const renderTree = (nodes = [], level = 0) =>
    nodes.map((node) => (
      <div key={node.id} className="space-y-2">
        <div
          className="flex items-start justify-between rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
          style={{ marginLeft: `${Math.min(24, level * 12)}px` }}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold text-neutral-900 dark:text-neutral-100">{node.title}</span>
              <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                {nodeTypeLabel(node.type)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  node.active
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                {node.active ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">{node.content}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-neutral-500 dark:text-neutral-500">
              {!!node.category && <span>Catégorie: {node.category}</span>}
              <span>Priorité: {node.priority}</span>
              <span>Ordre: {node.order}</span>
              <span>Utilisation: {node.usageCount}</span>
              {node.roles?.length ? <span>Rôles: {node.roles.join(', ')}</span> : null}
            </div>
          </div>
          <div className="ml-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleEdit(node)}
              className="rounded-full border border-neutral-300 p-2 text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              title="Modifier"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(node.id)}
              className="rounded-full border border-red-200 p-2 text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {Array.isArray(node.children) && node.children.length > 0 ? renderTree(node.children, level + 1) : null}
      </div>
    ));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-8">
      <header className="rounded-2xl border border-neutral-200 bg-white/85 px-5 py-4 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          <MessageSquare className="h-6 w-6 text-neutral-700 dark:text-neutral-200" />
          Assistant guidé · Templates
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Arborescence de conversation sans saisie libre, pilotée par templates structurés.
        </p>
      </header>

      {isAdmin && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Accès gestion templates chat
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Accordez ou retirez l’accès. Chaque changement est enregistré dans l’audit admin.
              </p>
            </div>
            <input
              value={accessSearch}
              onChange={(event) => {
                const value = event.target.value;
                setAccessSearch(value);
                loadAccessUsers(value).catch(() => {});
              }}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-neutral-300 transition focus:ring-2 sm:w-80 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
              placeholder="Rechercher utilisateur..."
            />
          </div>

          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {accessLoading ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Chargement...</p>
            ) : accessUsers.length ? (
              accessUsers.map((candidate) => {
                const granted = Boolean(candidate.canManageChatTemplates);
                return (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {candidate.name}
                      </p>
                      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {candidate.email} · {candidate.phone || '—'} · {candidate.role}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleAccess(candidate.id)}
                      disabled={accessSavingUserId === candidate.id}
                      className={`ml-3 inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold transition disabled:opacity-60 ${
                        granted
                          ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300'
                          : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300'
                      }`}
                    >
                      {accessSavingUserId === candidate.id
                        ? '...'
                        : granted
                        ? 'Retirer accès'
                        : 'Accorder accès'}
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Aucun utilisateur trouvé.</p>
            )}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {editingId ? 'Modifier le nœud' : 'Nouveau nœud'}
          </h2>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Titre</label>
              <input
                value={form.title}
                onChange={(event) => handleChange('title', event.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-neutral-300 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                placeholder="Ex: Où est ma commande ?"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Catégorie</label>
              <input
                value={form.category}
                onChange={(event) => handleChange('category', event.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-neutral-300 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                placeholder="Orders, Payment, Disputes..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Type</label>
                <select
                  value={form.type}
                  onChange={(event) => handleChange('type', event.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-neutral-300 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                >
                  <option value="question">Question</option>
                  <option value="info">Info</option>
                  <option value="action">Action</option>
                  <option value="link">Lien</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Parent</label>
                <select
                  value={form.parentId}
                  onChange={(event) => handleChange('parentId', event.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-neutral-300 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                >
                  <option value="">Racine</option>
                  {parentOptions
                    .filter((option) => option.id !== editingId)
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Contenu / Réponse</label>
              <textarea
                rows={4}
                value={form.content}
                onChange={(event) => handleChange('content', event.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-neutral-300 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                placeholder="Réponse affichée dans l’assistant..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Priorité</label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(event) => handleChange('priority', event.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-neutral-300 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Ordre</label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(event) => handleChange('order', event.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-neutral-300 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Rôles (CSV)</label>
              <input
                value={form.rolesInput}
                onChange={(event) => handleChange('rolesInput', event.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-neutral-300 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                placeholder="all, client, seller, admin"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Entity type</label>
                <select
                  value={form.entityType}
                  onChange={(event) => handleChange('entityType', event.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-neutral-300 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                >
                  <option value="">Aucun</option>
                  <option value="order">Order</option>
                  <option value="product">Product</option>
                  <option value="dispute">Dispute</option>
                  <option value="payment">Payment</option>
                  <option value="shop">Shop</option>
                  <option value="external_link">External Link</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Entity ID</label>
                <input
                  value={form.entityId}
                  onChange={(event) => handleChange('entityId', event.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-neutral-300 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                  placeholder="ID / slug / URL"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Path (metadata.path)</label>
              <input
                value={form.path}
                onChange={(event) => handleChange('path', event.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-neutral-300 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                placeholder="/orders, /product/slug..."
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => handleChange('active', event.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-900"
              />
              Actif
            </label>

            {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Créer'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex min-h-10 items-center rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  Annuler
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Arborescence</h2>
          {loading ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Chargement...</p>
          ) : tree.length ? (
            <div className="space-y-3">
              {renderTree(tree)}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              Aucun template pour le moment.
            </div>
          )}
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            <p className="mb-1 flex items-center gap-1 font-medium">
              <ChevronRight className="h-3.5 w-3.5" />
              Règle de flow
            </p>
            <p>
              Les nœuds racine sont affichés en premier. Quand un nœud n’a plus d’enfant, le flow est marqué comme terminé.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
