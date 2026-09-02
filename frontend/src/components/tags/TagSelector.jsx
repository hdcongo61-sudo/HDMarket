import React, { useEffect, useMemo, useState } from 'react';
import { ArrowPathIcon, ArrowTrendingUpIcon, CheckIcon, PlusIcon, SparklesIcon, TagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

const normalizeItems = (payload) => (Array.isArray(payload) ? payload : payload?.items || []);

export default function TagSelector({
  value = [],
  aiValue = [],
  initialTags = [],
  onChange,
  onAiChange,
  productContext = {},
  max = 10
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [knownTags, setKnownTags] = useState(() => new Map());
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setKnownTags((current) => {
      const next = new Map(current);
      initialTags.forEach((tag) => {
        if (tag?._id) next.set(String(tag._id), tag);
      });
      return next;
    });
  }, [initialTags]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/tags', { params: { q: query.trim() || undefined, limit: 20 } });
        if (!active) return;
        const nextItems = normalizeItems(data);
        setItems(nextItems);
        setKnownTags((current) => {
          const next = new Map(current);
          nextItems.forEach((tag) => {
            const existing = next.get(String(tag._id));
            next.set(String(tag._id), existing ? { ...tag, assignmentSource: existing.assignmentSource } : tag);
          });
          return next;
        });
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const lockedTags = initialTags.filter((tag) => tag?.assignmentSource && !['manual', 'ai'].includes(tag.assignmentSource));
  const lockedIds = useMemo(() => new Set(lockedTags.map((tag) => String(tag._id))), [initialTags]);
  const selectedIds = useMemo(
    () => new Set([...(value || []), ...(aiValue || []), ...lockedIds].map(String)),
    [aiValue, lockedIds, value]
  );
  const selectedTags = [...(value || []), ...(aiValue || []), ...lockedIds]
    .map((id) => knownTags.get(String(id)) || lockedTags.find((tag) => String(tag._id) === String(id)))
    .filter(Boolean);

  const toggle = (tag) => {
    const id = String(tag?._id || '');
    if (!id) return;
    setKnownTags((current) => new Map(current).set(id, tag));
    if (lockedIds.has(id)) {
      setMessage('Ce tag est géré automatiquement par HDMarket.');
      return;
    }
    if ((aiValue || []).some((item) => String(item) === id)) {
      onAiChange((aiValue || []).filter((item) => String(item) !== id));
      return;
    }
    if ((value || []).some((item) => String(item) === id)) {
      onChange((value || []).filter((item) => String(item) !== id));
      return;
    }
    if (tag.confidence && typeof onAiChange === 'function') {
      setMessage('Suggestion IA acceptée. Les tags IA ne comptent pas dans la limite manuelle.');
      onAiChange([...(aiValue || []), id]);
      return;
    }
    if ((value || []).length >= max) {
      setMessage(`Maximum ${max} tags manuels.`);
      return;
    }
    setMessage('');
    onChange([...(value || []), id]);
  };

  const loadAiSuggestions = async () => {
    setSuggesting(true);
    setMessage('');
    try {
      const { data } = await api.post('/tags/suggestions', { ...productContext, limit: 20 });
      const suggestions = data?.suggestions || [];
      setItems(suggestions);
      setKnownTags((current) => {
        const next = new Map(current);
        suggestions.forEach((tag) => next.set(String(tag._id), tag));
        return next;
      });
      setMessage(suggestions.length ? 'Suggestions basées sur votre annonce.' : 'Aucune suggestion pertinente pour le moment.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Suggestions indisponibles.');
    } finally {
      setSuggesting(false);
    }
  };

  // Selects a freshly created (or already existing) active tag right away —
  // seller tags are auto-approved, so there is no review step to wait for.
  const adoptTag = (tag) => {
    const id = String(tag?._id || '');
    if (!id || tag.status !== 'active') return false;
    setKnownTags((current) => new Map(current).set(id, tag));
    if (selectedIds.has(id)) {
      setMessage(`Le tag « ${tag.name} » est déjà sur votre annonce.`);
      return true;
    }
    if ((value || []).length >= max) {
      setMessage(`TagIcon « ${tag.name} » disponible, mais maximum ${max} tags manuels atteint.`);
      return true;
    }
    onChange([...(value || []), id]);
    setMessage(`TagIcon « ${tag.name} » créé et ajouté à votre annonce.`);
    return true;
  };

  const requestTag = async () => {
    const name = query.trim();
    if (name.length < 2) return;
    setRequesting(true);
    setMessage('');
    try {
      const { data } = await api.post('/tags/requests', { name, description: `TagIcon proposé depuis une annonce: ${productContext.title || ''}` });
      setQuery('');
      if (!adoptTag(data?.tag)) setMessage(data?.message || 'TagIcon créé.');
    } catch (error) {
      // A duplicate is just as usable: select the existing tag directly.
      if (error.response?.status === 409 && adoptTag(error.response?.data?.tag)) {
        setQuery('');
      } else {
        setMessage(error.response?.data?.message || 'Impossible de créer ce tag.');
      }
    } finally {
      setRequesting(false);
    }
  };

  const exactMatch = items.some((tag) => tag.name?.toLocaleLowerCase('fr') === query.trim().toLocaleLowerCase('fr'));

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-neutral-900"><TagIcon className="h-4 w-4" /> Tags de découverte</p>
          <p className="mt-0.5 text-xs text-neutral-500">Jusqu’à {max} tags manuels, plus les tags IA et système.</p>
        </div>
        <button
          type="button"
          onClick={loadAiSuggestions}
          disabled={suggesting}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-100 px-3 text-xs font-bold text-violet-700 disabled:opacity-60"
        >
          {suggesting ? <ArrowPathIcon className="animate-spin h-3.5 w-3.5" /> : <SparklesIcon className="h-3.5 w-3.5" />}
          Suggestions IA
        </button>
      </div>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <button
              type="button"
              key={tag._id}
              onClick={() => toggle(tag)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold"
              style={{ borderColor: tag.color || '#CBD5E1', color: tag.color || '#334155', backgroundColor: `${tag.color || '#64748B'}12` }}
            >
              #{tag.name} {lockedIds.has(String(tag._id)) ? <span className="text-[10px] opacity-60">Auto</span> : <XMarkIcon className="h-[13px] w-[13px]" />}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher: gaming, promotion, Apple…"
          className="min-h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 pr-10 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          spellCheck="true"
        />
        {loading && <ArrowPathIcon className="absolute right-3 top-3.5 animate-spin text-neutral-400 h-4 w-4" />}
      </div>

      <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
        {items.map((tag) => {
          const selected = selectedIds.has(String(tag._id));
          return (
            <button
              type="button"
              key={tag._id}
              onClick={() => toggle(tag)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${selected ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'}`}
            >
              {tag.popularityScore > 0 && <ArrowTrendingUpIcon className="h-3 w-3" />}
              {tag.name}
              {selected && <CheckIcon className="h-[13px] w-[13px]" />}
              {tag.confidence ? <span className="text-[10px] opacity-60">{Math.round(tag.confidence * 100)}%</span> : null}
            </button>
          );
        })}
        {query.trim().length >= 2 && !exactMatch && (
          <button
            type="button"
            onClick={requestTag}
            disabled={requesting}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-blue-300 bg-blue-50 px-3 text-xs font-bold text-blue-700 disabled:opacity-60"
          >
            {requesting ? <ArrowPathIcon className="animate-spin h-[13px] w-[13px]" /> : <PlusIcon className="h-[13px] w-[13px]" />}
            Proposer “{query.trim()}”
          </button>
        )}
      </div>
      {message && <p className="text-xs font-medium text-neutral-600">{message}</p>}
    </div>
  );
}
