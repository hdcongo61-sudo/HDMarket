import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  FileText,
  Mail,
  Paperclip,
  Pencil,
  Phone,
  Search,
  SendHorizonal,
  Shield,
  Trash2,
  UserCog,
  X
} from 'lucide-react';
import { motion } from 'framer-motion';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { useNetworks, formatNetworksForDisplay } from '../hooks/useNetworks';
import RichEditor from '../components/help/RichEditor';
import useAutosaveDraft from '../hooks/useAutosaveDraft';
import {
  exportHelpContent,
  getPlainTextFromHtml,
  sanitizeHelpHtml
} from '../utils/helpEditorContent';

const HELP_CATEGORIES = [
  { value: 'orders', label: 'Orders' },
  { value: 'payments', label: 'Payments' },
  { value: 'boosts', label: 'Boosts' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'disputes', label: 'Disputes' },
  { value: 'account', label: 'Account' },
  { value: 'other', label: 'Other' }
];

const MAX_CHARS = 8000;
const MAX_ATTACHMENTS = 5;
const ALLOWED_ATTACHMENT = ['image/', 'application/pdf'];

function formatSavedAt(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function conditionDescriptionToHtml(value) {
  const raw = String(value || '').trim();
  if (!raw) return '<p><br></p>';

  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(raw);
  if (hasHtmlTags) return sanitizeHelpHtml(raw) || '<p><br></p>';

  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<p>${escaped.replace(/\n/g, '<br>')}</p>`;
}

function getDraftTemplate() {
  return {
    category: 'orders',
    subject: '',
    contentFormat: 'json',
    content: {
      html: '<p><br></p>',
      plainText: '',
      blocks: []
    },
    paperMode: true,
    pasteWithFormatting: false
  };
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {Icon ? <Icon className="h-4 w-4 text-indigo-500 dark:text-indigo-300" /> : null}
        <h2>{title}</h2>
      </div>
      {subtitle ? <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p> : null}
    </div>
  );
}

export default function HelpPage() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const { networks } = useNetworks();

  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const initializedRef = useRef(false);
  const draftTemplate = useMemo(() => getDraftTemplate(), []);

  const storageKey = useMemo(
    () => `hdmarket:help:draft:${user?._id || 'guest'}`,
    [user?._id]
  );

  const {
    draft,
    setDraft,
    hydrated,
    status: autosaveStatus,
    savedAt,
    clearDraft
  } = useAutosaveDraft(storageKey, draftTemplate, 900);

  const [category, setCategory] = useState('orders');
  const [subject, setSubject] = useState('');
  const [contentFormat, setContentFormat] = useState('json');
  const [editorDocument, setEditorDocument] = useState({
    html: '<p><br></p>',
    plainText: '',
    blocks: []
  });
  const [paperMode, setPaperMode] = useState(true);
  const [pasteWithFormatting, setPasteWithFormatting] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [companyName, setCompanyName] = useState('HDMarket');
  const [conditions, setConditions] = useState([]);

  const [editingConditionIndex, setEditingConditionIndex] = useState(-1);
  const [editingConditionTitle, setEditingConditionTitle] = useState('');
  const [editingConditionDescription, setEditingConditionDescription] = useState('');
  const [conditionActionLoading, setConditionActionLoading] = useState(false);

  const [editorManagers, setEditorManagers] = useState([]);
  const [editorSearch, setEditorSearch] = useState('');
  const [editorCandidates, setEditorCandidates] = useState([]);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorActionUserId, setEditorActionUserId] = useState('');

  const isAdmin = user?.role === 'admin';
  const canUseRichEditor = useMemo(
    () => user?.role === 'admin' || user?.canManageHelpCenter === true,
    [user?.role, user?.canManageHelpCenter]
  );

  const networkDisplay = useMemo(() => {
    const formatted = formatNetworksForDisplay(networks);
    return formatted.length ? formatted.map((item) => item.display).join(' • ') : '';
  }, [networks]);

  const saveIndicator = useMemo(() => {
    if (autosaveStatus === 'saving') return 'Enregistrement du brouillon...';
    if (autosaveStatus === 'saved') return `Brouillon enregistré à ${formatSavedAt(savedAt)}`;
    if (autosaveStatus === 'error') return 'Erreur de sauvegarde locale';
    return 'Autosave actif';
  }, [autosaveStatus, savedAt]);

  useEffect(() => {
    initializedRef.current = false;
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || initializedRef.current) return;
    initializedRef.current = true;

    setCategory(draft.category || 'orders');
    setSubject(draft.subject || '');
    setContentFormat(draft.contentFormat || 'json');
    setEditorDocument({
      html: sanitizeHelpHtml(draft.content?.html || '') || '<p><br></p>',
      plainText: draft.content?.plainText || '',
      blocks: Array.isArray(draft.content?.blocks) ? draft.content.blocks : []
    });
    setPaperMode(Boolean(draft.paperMode ?? true));
    setPasteWithFormatting(Boolean(draft.pasteWithFormatting));
  }, [draft, hydrated]);

  useEffect(() => {
    if (!hydrated || !initializedRef.current) return;

    setDraft({
      category,
      subject,
      contentFormat,
      content: editorDocument,
      paperMode,
      pasteWithFormatting
    });
  }, [
    hydrated,
    category,
    subject,
    contentFormat,
    editorDocument,
    paperMode,
    pasteWithFormatting,
    setDraft
  ]);

  useEffect(() => {
    let active = true;

    const loadHelpCenterData = async () => {
      try {
        const { data } = await api.get('/support/help-center');
        if (!active) return;
        setCompanyName(data?.companyName || 'HDMarket');
        setConditions(Array.isArray(data?.conditions) ? data.conditions : []);
      } catch {
        if (!active) return;
        setConditions([]);
      }
    };

    loadHelpCenterData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setEditorManagers([]);
      return undefined;
    }

    let active = true;
    const loadEditors = async () => {
      setEditorLoading(true);
      try {
        const { data } = await api.get('/admin/help-center-editors');
        if (!active) return;
        setEditorManagers(Array.isArray(data?.editors) ? data.editors : []);
      } catch (error) {
        if (!active) return;
        showToast(
          error?.response?.data?.message || 'Impossible de charger les éditeurs du Help Center.',
          { variant: 'error' }
        );
      } finally {
        if (active) setEditorLoading(false);
      }
    };

    loadEditors();

    return () => {
      active = false;
    };
  }, [isAdmin, showToast]);

  useEffect(() => {
    if (!isAdmin) {
      setEditorCandidates([]);
      return undefined;
    }

    const query = editorSearch.trim();
    if (query.length < 2) {
      setEditorCandidates([]);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/admin/users', {
          params: { search: query, limit: 10 }
        });
        if (!active) return;
        const candidates = (Array.isArray(data) ? data : [])
          .filter((candidate) => candidate?.id && candidate.role !== 'admin')
          .map((candidate) => ({
            id: candidate.id,
            name: candidate.name || 'Utilisateur',
            email: candidate.email || '',
            phone: candidate.phone || '',
            canManageHelpCenter: Boolean(candidate.canManageHelpCenter)
          }));
        setEditorCandidates(candidates);
      } catch {
        if (!active) return;
        setEditorCandidates([]);
      }
    }, 320);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [editorSearch, isAdmin]);

  const onAttachmentsSelect = (event) => {
    const incoming = Array.from(event.target.files || []);
    if (!incoming.length) return;

    const accepted = [];
    incoming.forEach((file) => {
      const isAllowed = ALLOWED_ATTACHMENT.some((type) => file.type.startsWith(type));
      if (isAllowed) accepted.push(file);
    });

    if (!accepted.length) {
      showToast('Fichiers invalides. Utilisez images ou PDF uniquement.', { variant: 'error' });
      return;
    }

    setAttachments((prev) => {
      const next = [...prev, ...accepted];
      if (next.length > MAX_ATTACHMENTS) {
        showToast(`Maximum ${MAX_ATTACHMENTS} fichiers autorisés.`, { variant: 'error' });
      }
      return next.slice(0, MAX_ATTACHMENTS);
    });

    event.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const resetComposer = () => {
    setCategory('orders');
    setSubject('');
    setContentFormat('json');
    setAttachments([]);
    setPaperMode(true);
    setPasteWithFormatting(false);
    editorRef.current?.clear();
    clearDraft();
  };

  const queueRequestLocally = (payload) => {
    try {
      const queueKey = 'hdmarket:support:outbox';
      const raw = localStorage.getItem(queueKey);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift({
        id: `local-${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...payload,
        attachments: payload.attachments || []
      });
      localStorage.setItem(queueKey, JSON.stringify(list.slice(0, 20)));
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    if (submitting || !canUseRichEditor) return;

    const trimmedSubject = subject.trim();
    const liveDoc = editorRef.current?.getDocumentState() || editorDocument;
    const plainBody = String(liveDoc?.plainText || '').trim();

    if (!trimmedSubject || trimmedSubject.length < 4) {
      showToast('Le sujet est requis (minimum 4 caractères).', { variant: 'error' });
      return;
    }

    if (!plainBody || plainBody.length < 15) {
      showToast('Décrivez votre demande avec au moins 15 caractères.', { variant: 'error' });
      return;
    }

    const payload = {
      category,
      subject: trimmedSubject,
      contentFormat,
      content: exportHelpContent(liveDoc, contentFormat),
      attachments: attachments.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type
      }))
    };

    const conditionPayload = {
      title: trimmedSubject,
      descriptionHtml: sanitizeHelpHtml(liveDoc?.html || ''),
      plainText: plainBody
    };

    setSubmitting(true);
    try {
      const { data } = await api.post('/support/help-center/conditions', conditionPayload);
      setConditions(Array.isArray(data?.conditions) ? data.conditions : []);
      showToast('Condition utile publiée avec succès.', { variant: 'success' });
      resetComposer();
    } catch (error) {
      const status = error?.response?.status;
      const fallback = status === 404 || !status;

      if (fallback && queueRequestLocally(payload)) {
        showToast('Demande enregistrée localement. Synchronisation en attente.', {
          variant: 'success'
        });
        resetComposer();
      } else {
        showToast(
          error?.response?.data?.message || 'Impossible d’envoyer la demande pour le moment.',
          { variant: 'error' }
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startConditionEdit = (index, item) => {
    if (!canUseRichEditor) return;
    setEditingConditionIndex(index);
    setEditingConditionTitle(item?.title || '');
    setEditingConditionDescription(getPlainTextFromHtml(item?.description || ''));
  };

  const cancelConditionEdit = () => {
    setEditingConditionIndex(-1);
    setEditingConditionTitle('');
    setEditingConditionDescription('');
  };

  const saveConditionEdit = async (index) => {
    if (!canUseRichEditor || conditionActionLoading) return;

    const title = editingConditionTitle.trim();
    const description = editingConditionDescription.trim();

    if (!title || title.length < 4) {
      showToast('Le titre est requis (minimum 4 caractères).', { variant: 'error' });
      return;
    }
    if (!description || description.length < 15) {
      showToast('La description est requise (minimum 15 caractères).', { variant: 'error' });
      return;
    }

    setConditionActionLoading(true);
    try {
      const { data } = await api.put(`/support/help-center/conditions/${index}`, {
        title,
        description
      });
      setConditions(Array.isArray(data?.conditions) ? data.conditions : []);
      showToast('Condition mise à jour.', { variant: 'success' });
      cancelConditionEdit();
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de modifier cette condition.', {
        variant: 'error'
      });
    } finally {
      setConditionActionLoading(false);
    }
  };

  const deleteCondition = async (index) => {
    if (!canUseRichEditor || conditionActionLoading) return;
    const confirmed = window.confirm('Supprimer cette condition utile ?');
    if (!confirmed) return;

    setConditionActionLoading(true);
    try {
      const { data } = await api.delete(`/support/help-center/conditions/${index}`);
      setConditions(Array.isArray(data?.conditions) ? data.conditions : []);
      showToast('Condition supprimée.', { variant: 'success' });
      if (editingConditionIndex === index) {
        cancelConditionEdit();
      }
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de supprimer cette condition.', {
        variant: 'error'
      });
    } finally {
      setConditionActionLoading(false);
    }
  };

  const toggleEditorAccess = async (targetUser) => {
    if (!isAdmin || !targetUser?.id) return;
    setEditorActionUserId(targetUser.id);

    try {
      const { data } = await api.patch(`/admin/help-center-editors/${targetUser.id}/toggle`);
      const nextUser = data?.user;
      if (!nextUser?.id) return;

      setEditorManagers((prev) => {
        const filtered = prev.filter((editor) => editor.id !== nextUser.id);
        if (nextUser.canManageHelpCenter) {
          return [...filtered, nextUser].sort((a, b) =>
            String(a?.name || '').localeCompare(String(b?.name || ''), 'fr')
          );
        }
        return filtered;
      });

      setEditorCandidates((prev) =>
        prev.map((candidate) =>
          candidate.id === nextUser.id
            ? { ...candidate, canManageHelpCenter: Boolean(nextUser.canManageHelpCenter) }
            : candidate
        )
      );

      showToast(
        data?.message ||
          (nextUser.canManageHelpCenter ? 'Accès éditeur accordé.' : 'Accès éditeur retiré.'),
        { variant: 'success' }
      );
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de modifier cet accès.', {
        variant: 'error'
      });
    } finally {
      setEditorActionUserId('');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-100/60 to-transparent dark:from-indigo-950/20" />

      <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/70 backdrop-blur-xl dark:border-neutral-800/70 dark:bg-neutral-950/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-300">
              {companyName}
            </p>
            <h1 className="truncate text-lg font-semibold">Centre d'aide</h1>
          </div>
          <Link
            to="/"
            className="inline-flex items-center rounded-full border border-neutral-300/80 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            Retour
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <section className="space-y-4">
          {isAdmin ? (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="rounded-3xl border border-neutral-200 bg-white/90 p-4 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/70"
            >
              <SectionTitle
                icon={UserCog}
                title="Gestion accès Help Center"
                subtitle="Accordez l'accès à l'éditeur aux utilisateurs autorisés."
              />

              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={editorSearch}
                  onChange={(event) => setEditorSearch(event.target.value)}
                  placeholder="Rechercher un utilisateur"
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm outline-none ring-indigo-500 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>

              {editorSearch.trim().length >= 2 ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700">
                  {editorCandidates.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                      Aucun utilisateur trouvé.
                    </p>
                  ) : (
                    <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {editorCandidates.map((candidate) => {
                        const isGranted = Boolean(candidate.canManageHelpCenter);
                        const isWorking = editorActionUserId === candidate.id;
                        return (
                          <li
                            key={`candidate-${candidate.id}`}
                            className="flex items-center justify-between gap-3 bg-white px-3 py-2.5 text-xs dark:bg-neutral-950"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                                {candidate.name}
                              </p>
                              <p className="truncate text-neutral-500 dark:text-neutral-400">
                                {candidate.email || candidate.phone || 'Sans contact'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleEditorAccess(candidate)}
                              disabled={isWorking}
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                isGranted
                                  ? 'border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              {isWorking ? '...' : isGranted ? 'Retirer' : 'Accorder'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}

              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Éditeurs autorisés
                </p>
                <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700">
                  {editorLoading ? (
                    <p className="px-3 py-3 text-xs text-neutral-500 dark:text-neutral-400">Chargement...</p>
                  ) : editorManagers.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                      Aucun éditeur additionnel.
                    </p>
                  ) : (
                    <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {editorManagers.map((editor) => {
                        const isWorking = editorActionUserId === editor.id;
                        return (
                          <li
                            key={`editor-${editor.id}`}
                            className="flex items-center justify-between gap-3 bg-white px-3 py-2.5 text-xs dark:bg-neutral-950"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                                {editor.name}
                              </p>
                              <p className="truncate text-neutral-500 dark:text-neutral-400">
                                {editor.email || editor.phone || 'Sans contact'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleEditorAccess(editor)}
                              disabled={isWorking}
                              className="rounded-full border border-red-300 px-3 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                            >
                              {isWorking ? '...' : 'Retirer'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </motion.section>
          ) : null}

          {canUseRichEditor ? (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="rounded-3xl border border-neutral-200 bg-white/90 p-4 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/70"
            >
              <SectionTitle
                icon={CircleHelp}
                title="Rédiger une demande"
                subtitle="Écrivez clairement votre problème pour accélérer le traitement."
              />

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Catégorie
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none ring-indigo-500 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    >
                      {HELP_CATEGORIES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Sujet
                    <input
                      type="text"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      maxLength={140}
                      placeholder="Ex: Paiement non validé"
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none ring-indigo-500 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Format API
                  </span>
                  {['json', 'html', 'markdown'].map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => setContentFormat(format)}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                        contentFormat === format
                          ? 'bg-indigo-600 text-white'
                          : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {format.toUpperCase()}
                    </button>
                  ))}
                </div>

                <RichEditor
                  ref={editorRef}
                  initialHtml={editorDocument.html}
                  maxLength={MAX_CHARS}
                  onDebouncedChange={setEditorDocument}
                  paperMode={paperMode}
                  setPaperMode={setPaperMode}
                  pasteWithFormatting={pasteWithFormatting}
                  setPasteWithFormatting={setPasteWithFormatting}
                  onSubmit={handleSubmit}
                  submitting={submitting || !user}
                  saveIndicator={saveIndicator}
                />

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900/70">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Pièces jointes (images/PDF)
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Ajouter
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    hidden
                    onChange={onAttachmentsSelect}
                  />

                  {attachments.length === 0 ? (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Aucun fichier sélectionné.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {attachments.map((file, index) => (
                        <li
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                        >
                          <span className="truncate pr-2 text-neutral-700 dark:text-neutral-200">
                            {file.name} • {(file.size / 1024).toFixed(0)} KB
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                            aria-label={`Retirer ${file.name}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Raccourcis: Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+U, Ctrl/Cmd+Z
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                  >
                    <SendHorizonal className="h-4 w-4" />
                    {submitting ? 'Envoi...' : 'Envoyer la demande'}
                  </button>
                </div>
              </form>
            </motion.section>
          ) : null}

          {conditions.length > 0 ? (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, ease: 'easeOut' }}
              className="rounded-3xl border border-neutral-200 bg-white/90 p-4 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/70"
            >
              <SectionTitle
                icon={FileText}
                title="Conditions utiles"
                subtitle={`${conditions.length} élément(s)`}
              />

              <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {conditions.map((item, index) => (
                  <li key={`${item.title}-${index}`} className="py-3 first:pt-0 last:pb-0">
                    {editingConditionIndex === index ? (
                      <div className="space-y-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
                        <input
                          value={editingConditionTitle}
                          onChange={(event) => setEditingConditionTitle(event.target.value)}
                          maxLength={140}
                          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-indigo-500 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                        />
                        <textarea
                          value={editingConditionDescription}
                          onChange={(event) => setEditingConditionDescription(event.target.value)}
                          rows={4}
                          className="w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-indigo-500 transition focus:ring-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelConditionEdit}
                            disabled={conditionActionLoading}
                            className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => saveConditionEdit(index)}
                            disabled={conditionActionLoading}
                            className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {item.title}
                          </p>
                          {canUseRichEditor ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startConditionEdit(index, item)}
                                disabled={conditionActionLoading}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                                aria-label="Modifier la condition"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteCondition(index)}
                                disabled={conditionActionLoading}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-300 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                                aria-label="Supprimer la condition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <div
                          className="text-sm leading-6 text-neutral-600 dark:text-neutral-300 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-neutral-200 [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs [&_ul]:list-disc [&_ul]:pl-5 dark:[&_pre]:bg-neutral-800"
                          dangerouslySetInnerHTML={{
                            __html: conditionDescriptionToHtml(item.description)
                          }}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </motion.section>
          ) : null}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="rounded-3xl border border-neutral-200 bg-white/90 p-4 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/70"
          >
            <SectionTitle icon={CircleHelp} title="Contact support" />
            <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-indigo-500" />
                support@hdmarket.cg
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-500" />
                {networkDisplay || 'Numéro indisponible'}
              </p>
              <p className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <Shield className="h-3.5 w-3.5" />
                Les demandes sont historisées et traitées par priorité.
              </p>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="rounded-3xl border border-neutral-200 bg-white/90 p-4 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/70"
          >
            <SectionTitle icon={FileText} title="Bonnes pratiques" />
            <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                Ajoutez l'ID de commande, transaction ou capture utile.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                Décrivez les étapes, la date et l'impact rencontré.
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                Évitez les données sensibles (mot de passe, code OTP).
              </li>
            </ul>
          </motion.section>
        </aside>
      </main>
    </div>
  );
}
