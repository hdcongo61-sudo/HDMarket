import React, { useEffect, useMemo, useState } from 'react';
import { PlusCircle, Save, Trash2, RotateCcw, ArrowRightLeft } from 'lucide-react';

const initialCreateState = {
  name: '',
  slug: '',
  country: '',
  cities: ''
};

export default function CategoryEditor({
  selectedNode,
  saving,
  onSave,
  onSoftDelete,
  onRestore,
  onCreateCategory,
  onCreateSubcategory,
  onOpenReassign
}) {
  const [form, setForm] = useState({
    name: '',
    slug: '',
    iconKey: '',
    imageUrl: '',
    description: '',
    country: '',
    cities: '',
    isActive: true
  });
  const [createRoot, setCreateRoot] = useState(initialCreateState);
  const [createChildName, setCreateChildName] = useState('');

  useEffect(() => {
    if (!selectedNode) return;
    setForm({
      name: selectedNode.name || '',
      slug: selectedNode.slug || '',
      iconKey: selectedNode.iconKey || '',
      imageUrl: selectedNode.imageUrl || '',
      description: selectedNode.description || '',
      country: selectedNode.country || '',
      cities: Array.isArray(selectedNode.cities) ? selectedNode.cities.join(', ') : '',
      isActive: Boolean(selectedNode.isActive)
    });
  }, [selectedNode]);

  const canCreateSubcategory = selectedNode?.level === 0;
  const isDeleted = Boolean(selectedNode?.isDeleted);

  const preview = useMemo(() => {
    if (!selectedNode) return null;
    return {
      title: form.name || selectedNode.name,
      subtitle: form.description || selectedNode.description || 'Sans description',
      badge: isDeleted ? 'Supprimée' : form.isActive ? 'Active' : 'Masquée'
    };
  }, [form, selectedNode, isDeleted]);

  const toCitiesArray = (value) =>
    String(value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

  const handleSave = () => {
    if (!selectedNode) return;
    onSave(selectedNode.id, {
      name: form.name,
      slug: form.slug,
      iconKey: form.iconKey,
      imageUrl: form.imageUrl,
      description: form.description,
      country: form.country,
      cities: toCitiesArray(form.cities),
      isActive: form.isActive
    });
  };

  const handleCreateRoot = () => {
    if (!createRoot.name.trim()) return;
    onCreateCategory({
      name: createRoot.name,
      slug: createRoot.slug,
      country: createRoot.country,
      cities: toCitiesArray(createRoot.cities)
    });
    setCreateRoot(initialCreateState);
  };

  const handleCreateChild = () => {
    if (!createChildName.trim() || !selectedNode) return;
    onCreateSubcategory(selectedNode, { name: createChildName });
    setCreateChildName('');
  };

  return (
    <section className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div>
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Éditeur catégorie</h2>
        <p className="text-xs text-neutral-500">Créer, modifier, désactiver, restaurer et préparer la vue storefront.</p>
      </div>

      <div className="rounded-2xl border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
        <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">Créer une catégorie principale</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={createRoot.name}
            onChange={(e) => setCreateRoot((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Nom"
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <input
            value={createRoot.slug}
            onChange={(e) => setCreateRoot((prev) => ({ ...prev, slug: e.target.value }))}
            placeholder="Slug (optionnel)"
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <input
            value={createRoot.country}
            onChange={(e) => setCreateRoot((prev) => ({ ...prev, country: e.target.value }))}
            placeholder="Country (ex: CG)"
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <input
            value={createRoot.cities}
            onChange={(e) => setCreateRoot((prev) => ({ ...prev, cities: e.target.value }))}
            placeholder="Villes séparées par virgule"
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <button
          type="button"
          onClick={handleCreateRoot}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <PlusCircle size={16} /> Ajouter
        </button>
      </div>

      {!selectedNode ? (
        <p className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
          Sélectionnez une catégorie dans l’arborescence pour éditer ses paramètres.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2">
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nom"
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <input
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
              placeholder="Slug"
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <input
              value={form.iconKey}
              onChange={(e) => setForm((prev) => ({ ...prev, iconKey: e.target.value }))}
              placeholder="Icon key"
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <input
              value={form.imageUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
              placeholder="Image URL"
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Description"
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={form.country}
                onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                placeholder="Country"
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
              <input
                value={form.cities}
                onChange={(e) => setForm((prev) => ({ ...prev, cities: e.target.value }))}
                placeholder="Villes (virgule)"
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-neutral-300 text-indigo-600"
              />
              Active dans storefront
            </label>
          </div>

          {canCreateSubcategory ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
              <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">Créer une sous-catégorie</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={createChildName}
                  onChange={(e) => setCreateChildName(e.target.value)}
                  placeholder="Nom de la sous-catégorie"
                  className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
                <button
                  type="button"
                  onClick={handleCreateChild}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  <PlusCircle size={16} /> Ajouter
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              <Save size={16} /> Enregistrer
            </button>
            {!isDeleted ? (
              <button
                type="button"
                onClick={() => onSoftDelete(selectedNode)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-900/30"
              >
                <Trash2 size={16} /> Soft delete
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRestore(selectedNode)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
              >
                <RotateCcw size={16} /> Restaurer
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenReassign(selectedNode)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <ArrowRightLeft size={16} /> Réassigner produits
            </button>
          </div>

          {preview ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Aperçu storefront</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{preview.title}</p>
              <p className="text-xs text-neutral-500">{preview.subtitle}</p>
              <span className="mt-2 inline-flex rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {preview.badge}
              </span>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
