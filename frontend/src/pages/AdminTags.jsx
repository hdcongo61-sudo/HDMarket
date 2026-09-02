import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowUpTrayIcon, ArrowsPointingInIcon, ChartBarIcon, CheckIcon, MagnifyingGlassIcon, PencilSquareIcon, PlusIcon, SparklesIcon, TagIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

const EMPTY_FORM = {
  name: '',
  description: '',
  category: '',
  type: 'system',
  color: '#2563EB',
  icon: '',
  visibility: 'public',
  status: 'active',
  priority: 0,
  aliases: '',
  featured: false,
  homepageTitle: '',
  campaignStartsAt: '',
  campaignEndsAt: ''
};

const TYPES = ['system', 'seller', 'campaign', 'ai', 'internal', 'beta'];
const STATUSES = ['active', 'draft', 'archived', 'disabled'];
const VISIBILITIES = ['public', 'private', 'hidden', 'archived'];
const TYPE_LABELS = { system: 'Système', seller: 'Vendeur', campaign: 'Campagne', ai: 'IA', internal: 'Interne', beta: 'Bêta' };
const STATUS_LABELS = { active: 'Actif', draft: 'Brouillon', archived: 'Archivé', disabled: 'Désactivé' };
const VISIBILITY_LABELS = { public: 'Public', private: 'Privé', hidden: 'Masqué', archived: 'Archivé' };

const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function AdminTags() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const importRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tagsRes, categoryRes, analyticsRes] = await Promise.all([
        api.get('/tags/admin/all', { params: { q: query || undefined, type: type || undefined, status: status || undefined, deleted: showDeleted, page, limit: 30 } }),
        api.get('/tags/categories'),
        api.get('/tags/admin/analytics')
      ]);
      setItems(tagsRes.data?.items || []);
      setPagination(tagsRes.data?.pagination || { page: 1, pages: 1, total: 0 });
      setCategories(categoryRes.data || []);
      setAnalytics(analyticsRes.data || null);
      setSelected(new Set());
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Impossible de charger les tags.');
    } finally {
      setLoading(false);
    }
  }, [page, query, showDeleted, status, type]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const metrics = useMemo(() => [
    ['Tags', analytics?.totals?.tags || 0],
    ['Affectations', analytics?.totals?.usage || 0],
    ['Recherches', analytics?.totals?.searches || 0],
    ['Conversions', analytics?.totals?.conversions || 0]
  ], [analytics]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId('');
    setShowForm(false);
  };

  const startEdit = (tag) => {
    setEditingId(tag._id);
    setForm({
      name: tag.name || '',
      description: tag.description || '',
      category: tag.category?._id || tag.category || '',
      type: tag.type || 'system',
      color: tag.color || '#2563EB',
      icon: tag.icon || '',
      visibility: tag.visibility || 'public',
      status: tag.status || 'active',
      priority: tag.priority || 0,
      aliases: (tag.aliases || []).join(', '),
      featured: Boolean(tag.featured),
      homepageTitle: tag.homepageTitle || '',
      campaignStartsAt: toLocalInput(tag.campaignStartsAt),
      campaignEndsAt: toLocalInput(tag.campaignEndsAt)
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveTag = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        ...form,
        category: form.category || null,
        priority: Number(form.priority || 0),
        aliases: form.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
        campaignStartsAt: form.campaignStartsAt || null,
        campaignEndsAt: form.campaignEndsAt || null
      };
      if (editingId) await api.put(`/tags/admin/${editingId}`, payload);
      else await api.post('/tags/admin', payload);
      setMessage(editingId ? 'TagIcon mis à jour.' : 'TagIcon créé.');
      resetForm();
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Impossible d’enregistrer le tag.');
    } finally {
      setSaving(false);
    }
  };

  const mutate = async (operation, success) => {
    setError('');
    try {
      await operation();
      setMessage(success);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Action impossible.');
    }
  };

  const review = (tag, approved) => mutate(
    () => api.post(`/tags/admin/${tag._id}/review`, { approved, reason: approved ? '' : 'Rejeté par la modération.' }),
    approved ? 'TagIcon vendeur approuvé.' : 'TagIcon vendeur rejeté.'
  );

  const toggleFeatured = (tag) => mutate(
    () => api.put(`/tags/admin/${tag._id}`, { featured: !tag.featured }),
    tag.featured ? 'TagIcon retiré de l’accueil.' : 'TagIcon ajouté à l’accueil.'
  );

  const remove = (tag) => {
    if (!window.confirm(`Supprimer le tag “${tag.name}” ?`)) return;
    mutate(() => api.delete(`/tags/admin/${tag._id}`), 'TagIcon supprimé.');
  };

  const restore = (tag) => mutate(() => api.post(`/tags/admin/${tag._id}/restore`), 'TagIcon restauré en brouillon.');

  const merge = (tag) => {
    const targetTagId = window.prompt('Identifiant du tag cible (les affectations seront déplacées) :');
    if (!targetTagId) return;
    mutate(() => api.post(`/tags/admin/${tag._id}/merge`, { targetTagId }), 'Tags fusionnés.');
  };

  const bulkDelete = () => {
    const ids = [...selected];
    if (!ids.length || !window.confirm(`Supprimer ${ids.length} tag(s) ?`)) return;
    mutate(() => api.post('/tags/admin/bulk', { action: 'delete', ids }), `${ids.length} tag(s) supprimé(s).`);
  };

  const createCategory = async (event) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    await mutate(() => api.post('/tags/admin/categories', { name }), 'Catégorie créée.');
    setCategoryName('');
  };

  const exportCsv = async () => {
    try {
      const response = await api.get('/tags/admin/export', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'hdmarket-tags.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export impossible.');
    }
  };

  const importJson = async (event) => {
    const [file] = event.target.files || [];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const response = await api.post('/tags/admin/import', payload);
      setMessage(`${response.data?.created || 0} tag(s) importé(s).`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Le fichier JSON est invalide.');
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Découverte universelle</p>
          <h1 className="mt-1 text-2xl font-black text-neutral-950">Gestion des tags</h1>
          <p className="mt-1 text-sm text-neutral-500">Recherche, recommandations, campagnes, SEO et analytique depuis un catalogue unique.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCsv} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold"><ArrowDownTrayIcon className="h-4 w-4" /> Exporter</button>
          <button type="button" onClick={() => importRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold"><ArrowUpTrayIcon className="h-4 w-4" /> Importer JSON</button>
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={importJson} />
          <button type="button" onClick={() => { setShowForm(true); setEditingId(''); setForm(EMPTY_FORM); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-bold text-white"><PlusIcon className="h-4 w-4" /> Nouveau tag</button>
        </div>
      </div>

      {(message || error) && <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-neutral-950">{Number(value).toLocaleString('fr-FR')}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={saveTag} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">{editingId ? 'Modifier le tag' : 'Créer un tag'}</h2>
            <button type="button" onClick={resetForm} className="rounded-lg p-2 hover:bg-neutral-100"><XMarkIcon className="h-[18px] w-[18px]" /></button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-bold">Nom<input required minLength={2} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3 font-normal" /></label>
            <label className="text-sm font-bold">Catégorie<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3 font-normal"><option value="">Sans catégorie</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
            <label className="text-sm font-bold">Type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3 font-normal">{TYPES.map((value) => <option key={value} value={value}>{TYPE_LABELS[value]}</option>)}</select></label>
            <label className="text-sm font-bold">Visibilité<select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3 font-normal">{VISIBILITIES.map((value) => <option key={value} value={value}>{VISIBILITY_LABELS[value]}</option>)}</select></label>
            <label className="text-sm font-bold">Statut<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3 font-normal">{STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></label>
            <label className="text-sm font-bold">Couleur<input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-neutral-200 p-1" /></label>
            <label className="text-sm font-bold">Priorité<input type="number" min="0" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3 font-normal" /></label>
            <label className="text-sm font-bold lg:col-span-2">Alias (séparés par des virgules)<input value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3 font-normal" /></label>
            <label className="text-sm font-bold">Début campagne<input type="datetime-local" value={form.campaignStartsAt} onChange={(e) => setForm({ ...form, campaignStartsAt: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3 font-normal" /></label>
            <label className="text-sm font-bold">Fin campagne<input type="datetime-local" value={form.campaignEndsAt} onChange={(e) => setForm({ ...form, campaignEndsAt: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3 font-normal" /></label>
            <label className="flex items-center gap-2 self-end rounded-xl border border-neutral-200 p-3 text-sm font-bold"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Mettre à la une</label>
            <label className="text-sm font-bold md:col-span-2 lg:col-span-3">Description<textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-xl border border-neutral-200 p-3 font-normal" /></label>
          </div>
          <button disabled={saving} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-black text-white disabled:opacity-60">{saving ? <ArrowPathIcon className="animate-spin h-4 w-4" /> : <CheckIcon className="h-4 w-4" />} Enregistrer</button>
        </form>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="flex flex-wrap gap-2 border-b border-neutral-200 p-4">
            <div className="relative min-w-52 flex-1"><MagnifyingGlassIcon className="absolute left-3 top-3 text-neutral-400 h-4 w-4" /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Rechercher un tag…" className="min-h-10 w-full rounded-xl border border-neutral-200 pl-9 pr-3 text-sm" /></div>
            <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="min-h-10 rounded-xl border border-neutral-200 px-3 text-sm"><option value="">Tous les types</option>{TYPES.map((value) => <option key={value} value={value}>{TYPE_LABELS[value]}</option>)}</select>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="min-h-10 rounded-xl border border-neutral-200 px-3 text-sm"><option value="">Tous les statuts</option>{STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select>
            <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-neutral-200 px-3 text-xs font-bold"><input type="checkbox" checked={showDeleted} onChange={(e) => { setShowDeleted(e.target.checked); setPage(1); }} /> Corbeille</label>
            <button type="button" onClick={load} className="rounded-xl border border-neutral-200 p-2.5"><ArrowPathIcon className={loading ? 'animate-spin' : ''} className="h-4 w-4" /></button>
            {selected.size > 0 && <button type="button" onClick={bulkDelete} className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 text-xs font-bold text-red-700"><TrashIcon className="h-3.5 w-3.5" /> Supprimer ({selected.size})</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="p-3"><input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={(e) => setSelected(e.target.checked ? new Set(items.map((item) => item._id)) : new Set())} /></th><th className="p-3">TagIcon</th><th className="p-3">Type / état</th><th className="p-3">Données</th><th className="p-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {items.map((tag) => (
                  <tr key={tag._id} className="hover:bg-neutral-50/70">
                    <td className="p-3"><input type="checkbox" checked={selected.has(tag._id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(tag._id)) next.delete(tag._id); else next.add(tag._id); return next; })} /></td>
                    <td className="p-3"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: tag.color }} /><div><p className="font-black text-neutral-900">{tag.name} {tag.featured && <SparklesIcon className="inline text-amber-500 h-[13px] w-[13px]" />}</p><p className="text-xs text-neutral-500">#{tag.slug} · {tag.category?.name || 'Sans catégorie'}</p></div></div></td>
                    <td className="p-3"><p className="font-semibold">{TYPE_LABELS[tag.type] || tag.type}</p><p className="text-xs text-neutral-500">{STATUS_LABELS[tag.status]} · {VISIBILITY_LABELS[tag.visibility]}</p></td>
                    <td className="p-3 text-xs text-neutral-600"><p>{tag.usageCount || 0} usages</p><p>{tag.searchCount || 0} recherches · {tag.conversionCount || 0} conversions</p></td>
                    <td className="p-3"><div className="flex justify-end gap-1">
                      {tag.type === 'seller' && tag.status === 'draft' && !tag.deletedAt && <><button title="Approuver" onClick={() => review(tag, true)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><CheckIcon className="h-4 w-4" /></button><button title="Rejeter" onClick={() => review(tag, false)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><XMarkIcon className="h-4 w-4" /></button></>}
                      {!tag.deletedAt && <><button title="Accueil" onClick={() => toggleFeatured(tag)} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"><SparklesIcon className="h-4 w-4" /></button><button title="Modifier" onClick={() => startEdit(tag)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"><PencilSquareIcon className="h-4 w-4" /></button><button title="Fusionner" onClick={() => merge(tag)} className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"><ArrowsPointingInIcon className="h-4 w-4" /></button><button title="Supprimer" onClick={() => remove(tag)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><TrashIcon className="h-4 w-4" /></button></>}
                      {tag.deletedAt && <button title="Restaurer" onClick={() => restore(tag)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><ArrowPathIcon className="h-4 w-4" /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && items.length === 0 && <div className="p-10 text-center text-sm text-neutral-500">Aucun tag trouvé.</div>}
          <div className="flex items-center justify-between border-t border-neutral-200 p-3 text-xs font-semibold text-neutral-500"><span>{pagination.total || 0} tags</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Précédent</button><button disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Suivant</button></div></div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="flex items-center gap-2 font-black"><TagIcon className="h-[17px] w-[17px]" /> Catégories de tags</h2>
            <form onSubmit={createCategory} className="mt-3 flex gap-2"><input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Nouvelle catégorie" className="min-h-10 min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 text-sm" /><button className="rounded-xl bg-neutral-950 px-3 text-white"><PlusIcon className="h-4 w-4" /></button></form>
            <button type="button" onClick={() => mutate(() => api.post('/tags/admin/categories/seed'), 'Catégories par défaut ajoutées.')} className="mt-2 text-xs font-bold text-orange-600">Installer les catégories par défaut</button>
            <div className="mt-3 flex flex-wrap gap-2">{categories.map((category) => <span key={category._id} className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: `${category.color || '#64748B'}55`, color: category.color || '#64748B' }}>{category.name}</span>)}</div>
          </section>
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="flex items-center gap-2 font-black"><ChartBarIcon className="h-[17px] w-[17px]" /> Tendances</h2>
            <div className="mt-3 space-y-2">{(analytics?.trending || []).slice(0, 8).map((tag, index) => <div key={tag._id} className="flex items-center gap-2 text-sm"><span className="w-5 text-xs font-black text-neutral-400">{index + 1}</span><span className="h-2.5 w-2.5 rounded-full" style={{ background: tag.color }} /><span className="min-w-0 flex-1 truncate font-semibold">{tag.name}</span><span className="text-xs text-neutral-500">{Math.round(tag.popularityScore || 0)}</span></div>)}</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
