import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Filter, MessageSquare, Search, User, FileText, UserPlus, UserMinus, FileDown, RefreshCw } from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { appAlert } from '../utils/appDialog';
import { AdminCommandHero, AdminSegmentedControl } from '../components/admin/AdminCommandSurface';

const STATUS_FILTERS = [
  { value: 'all', label: 'Tous', icon: MessageSquare },
  { value: 'unread', label: 'Non lus', icon: Filter },
  { value: 'read', label: 'Lus', icon: CheckCircle }
];

const PAGE_SIZE = 12;

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

export default function AdminFeedback() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin' || user?.role === 'founder';

  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('unread');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingItemId, setExportingItemId] = useState('');
  const [readers, setReaders] = useState([]);
  const [showReaders, setShowReaders] = useState(false);
  const [loadingReaders, setLoadingReaders] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [foundUsers, setFoundUsers] = useState([]);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', PAGE_SIZE);
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (searchValue) {
        params.set('search', searchValue);
      }
      const { data } = await api.get(`/admin/feedback?${params.toString()}`);
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
      setMeta({
        total: data?.total ?? list.length,
        totalPages: data?.totalPages ?? 1
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Impossible de charger les avis.');
      setItems([]);
      setMeta({ total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, searchValue, statusFilter]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchValue(searchDraft.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchValue]);

  const handleMarkRead = useCallback(
    async (feedbackId) => {
      if (!feedbackId) return;
      setActionId(feedbackId);
      try {
        const { data } = await api.patch(`/admin/feedback/${feedbackId}/read`);
        const updated = data?.feedback;
        if (updated) {
          setItems((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
          window.dispatchEvent(new CustomEvent('hdmarket:admin-counts-refresh'));
          if (statusFilter === 'unread') {
            setItems((prev) => prev.filter((item) => item._id !== updated._id));
            setMeta((prev) => ({
              ...prev,
              total: Math.max(0, (prev.total || 0) - 1),
              totalPages: Math.max(1, Math.ceil(Math.max(0, (prev.total || 0) - 1) / PAGE_SIZE))
            }));
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Impossible de marquer comme lu.');
      } finally {
        setActionId('');
      }
    },
    [statusFilter]
  );

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchValue) params.set('search', searchValue);

      const { data } = await api.get(`/admin/feedback/export-pdf?${params.toString()}`);
      const feedbackList = data.items || [];

      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('Avis sur l\'amelioration', 14, 20);
      
      // Meta info
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Date d'export: ${new Date().toLocaleDateString('fr-FR')}`, 14, 28);
      doc.text(`Total: ${feedbackList.length} avis`, 14, 34);
      doc.text(`Filtre: ${STATUS_FILTERS.find(f => f.value === statusFilter)?.label || 'Tous'}`, 14, 40);

      // Table
      const tableData = feedbackList.map((item, index) => [
        index + 1,
        item.subject || '-',
        (item.body || '-').substring(0, 100) + (item.body?.length > 100 ? '...' : ''),
        item.user?.name || 'N/A',
        item.user?.phone || '-',
        item.readAt ? 'Oui' : 'Non',
        formatDateTime(item.createdAt)
      ]);

      autoTable(doc, {
        startY: 48,
        head: [['#', 'Sujet', 'Contenu', 'Utilisateur', 'Telephone', 'Lu', 'Date']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 48 }
      });

      // Save PDF
      const filename = `avis-amelioration-${statusFilter}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Export PDF error:', err);
      await appAlert('Impossible d\'exporter en PDF: ' + (err.response?.data?.message || err.message));
    } finally {
      setExporting(false);
    }
  };

  const handleExportSinglePDF = async (item) => {
    setExportingItemId(item._id);
    try {
      const jsPDF = (await import('jspdf')).default;

      const doc = new jsPDF();

      // Title
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text('Avis d\'amelioration', 14, 20);

      // Divider line
      doc.setLineWidth(0.5);
      doc.setDrawColor(79, 70, 229);
      doc.line(14, 25, 196, 25);

      // Feedback details
      let yPos = 35;
      const lineHeight = 7;
      const maxWidth = 180;

      // Subject
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Sujet:', 14, yPos);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(12);
      const subjectLines = doc.splitTextToSize(item.subject || '-', maxWidth - 30);
      doc.text(subjectLines, 40, yPos);
      yPos += subjectLines.length * lineHeight + 5;

      // Author info
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const author = item.user?.name || item.user?.email || 'Utilisateur';
      const phone = item.user?.phone || 'N/A';
      doc.text(`Auteur: ${author} - Tel: ${phone}`, 14, yPos);
      yPos += lineHeight;

      // Date
      doc.text(`Date: ${formatDateTime(item.createdAt)}`, 14, yPos);
      yPos += lineHeight;

      // Status
      const status = item.readAt ? `Lu le ${formatDateTime(item.readAt)}` : 'Non lu';
      const readBy = item.readBy?.name ? ` par ${item.readBy.name}` : '';
      doc.text(`Statut: ${status}${readBy}`, 14, yPos);
      yPos += lineHeight + 8;

      // Content
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text('Contenu:', 14, yPos);
      yPos += lineHeight;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(11);
      const bodyLines = doc.splitTextToSize(item.body || '-', maxWidth);
      doc.text(bodyLines, 14, yPos);

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${i} sur ${pageCount} - Exporte le ${new Date().toLocaleDateString('fr-FR')}`,
          14,
          doc.internal.pageSize.height - 10
        );
      }

      // Save PDF
      const filename = `avis-${item._id}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Export single PDF error:', err);
      await appAlert('Impossible d\'exporter en PDF: ' + err.message);
    } finally {
      setExportingItemId('');
    }
  };

  const loadFeedbackReaders = async () => {
    setLoadingReaders(true);
    try {
      const { data } = await api.get('/admin/feedback-readers');
      setReaders(data.readers || []);
    } catch (err) {
      console.error('Load readers error:', err);
    } finally {
      setLoadingReaders(false);
    }
  };

  const handleToggleFeedbackReader = async (userId) => {
    if (!userId || typeof userId !== 'string') {
      await appAlert('ID utilisateur invalide');
      return;
    }

    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      await appAlert(`Format d'ID invalide: ${userId}`);
      return;
    }

    try {
      const { data } = await api.patch(`/admin/feedback-readers/${userId}/toggle`);
      await appAlert(data.message || 'Statut mis a jour');
      await loadFeedbackReaders();
      setFoundUsers([]);
      setUserSearchQuery('');
    } catch (err) {
      console.error('Toggle feedback reader error:', err);
      console.error('Error response:', err.response?.data);
      await appAlert(err.response?.data?.message || 'Erreur lors de la mise a jour');
    }
  };

  const handleSearchUsers = async () => {
    if (!userSearchQuery.trim()) return;
    setSearchingUsers(true);
    try {
      const { data } = await api.get(`/admin/users?search=${encodeURIComponent(userSearchQuery.trim())}&limit=10`);
      const users = Array.isArray(data) ? data.filter(u => u.role !== 'admin' && u.role !== 'founder') : [];
      setFoundUsers(users);
    } catch (err) {
      console.error('Search users error:', err);
      setFoundUsers([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  const paginationLabel = useMemo(() => {
    if (!meta.total) return '0 avis';
    const totalLabel = meta.total > 1 ? 'avis' : 'avis';
    return `${meta.total} ${totalLabel}`;
  }, [meta.total]);

  const readCount = items.filter((item) => item.readAt).length;
  const unreadCount = items.filter((item) => !item.readAt).length;
  const statusOptions = STATUS_FILTERS.map((option) => ({
    ...option,
    count: option.value === 'all'
      ? meta.total
      : option.value === 'read'
        ? readCount
        : unreadCount
  }));

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-white">
      <div className="mx-auto max-w-6xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
        <AdminCommandHero
          eyebrow="Voix utilisateurs"
          title="Avis d’amélioration"
          subtitle="Centralisez les suggestions, priorisez les retours non lus et gérez les personnes autorisées à lire les avis."
          meta={`${paginationLabel} · page ${page}/${meta.totalPages || 1}`}
          metrics={[
            { label: 'Total', value: meta.total, help: 'Tous avis filtrés', icon: MessageSquare },
            { label: 'Non lus', value: unreadCount, help: 'Sur cette page', icon: Filter },
            { label: 'Lus', value: readCount, help: 'Sur cette page', icon: CheckCircle },
            { label: 'Lecteurs', value: readers.length, help: isAdmin ? 'Autorisés' : 'Admin only', icon: User }
          ]}
          actions={[
            {
              label: 'Actualiser',
              description: 'Recharger les avis',
              icon: RefreshCw,
              tone: 'dark',
              loading,
              onClick: loadFeedback
            },
            {
              label: exporting ? 'Export...' : 'Exporter PDF',
              description: 'Exporter la vue filtrée',
              icon: FileText,
              tone: 'neutral',
              disabled: exporting || items.length === 0,
              loading: exporting,
              onClick: handleExportPDF
            },
            isAdmin
              ? {
                  label: showReaders ? 'Masquer lecteurs' : 'Lecteurs',
                  description: 'Gérer les accès lecture',
                  icon: User,
                  tone: showReaders ? 'emerald' : 'neutral',
                  onClick: () => {
                    setShowReaders((prev) => !prev);
                    if (!showReaders && readers.length === 0) {
                      loadFeedbackReaders();
                    }
                  }
                }
              : null
          ].filter(Boolean)}
        />

        {isAdmin && showReaders && (
          <section className="space-y-4 rounded-[24px] border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-950 dark:text-white">Lecteurs d’avis autorisés</h2>
              <button
                type="button"
                onClick={() => setShowReaders(false)}
                className="grid h-9 w-9 place-items-center rounded-2xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Rechercher un utilisateur (nom, email, téléphone)..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                  className="min-h-[44px] min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none transition focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleSearchUsers}
                  disabled={searchingUsers || !userSearchQuery.trim()}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-neutral-950"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {foundUsers.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Résultats de recherche:</p>
                  {foundUsers.map((user) => (
                    <div
                      key={user._id || user.id}
                      className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{user.name}</p>
                        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{user.email} · {user.phone}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleFeedbackReader(user._id || user.id)}
                        className="ml-3 inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-neutral-950 px-3 text-xs font-bold text-white transition hover:bg-black dark:bg-white dark:text-neutral-950"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Ajouter
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
                <p className="mb-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Lecteurs actuels ({readers.length}):</p>
                {loadingReaders ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Chargement...</p>
                ) : readers.length === 0 ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Aucun lecteur autorisé pour le moment.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {readers.map((reader) => (
                      <div
                        key={reader._id || reader.id}
                        className="flex items-center justify-between rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{reader.name}</p>
                          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{reader.email} · {reader.phone}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleFeedbackReader(reader._id || reader.id)}
                          className="ml-3 inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          Retirer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="space-y-4 rounded-[24px] border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AdminSegmentedControl
              className="border-0 bg-transparent p-0 shadow-none"
              options={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                className="min-h-[44px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm outline-none transition focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                placeholder="Rechercher un avis"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
              />
            </div>
          </div>

          {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="h-4 w-1/3 rounded bg-neutral-200 dark:bg-neutral-800" />
                  <div className="mt-3 h-3 w-full rounded bg-neutral-200 dark:bg-neutral-800" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-neutral-200 dark:bg-neutral-800" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-300">
                <MessageSquare className="h-5 w-5" />
              </div>
              Aucun avis disponible pour ce filtre.
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const isRead = Boolean(item.readAt);
                const author = item.user?.name || item.user?.email || 'Utilisateur';
                return (
                  <article
                    key={item._id}
                    className="space-y-3 rounded-[22px] border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                          <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                            {item.subject}
                          </h3>
                        </div>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Envoye le {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          isRead
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isRead ? 'Lu' : 'Non lu'}
                      </span>
                    </div>

                    <p className="whitespace-pre-line break-words text-sm leading-6 text-neutral-600 dark:text-neutral-300">{item.body}</p>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                        <User className="h-4 w-4 text-neutral-400" />
                        <span>{author}</span>
                        {item.user?.phone ? <span>- {item.user.phone}</span> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportSinglePDF(item)}
                          disabled={exportingItemId === item._id}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                          title="Exporter cet avis en PDF"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          {exportingItemId === item._id ? 'Export...' : 'PDF'}
                        </button>
                        {isRead ? (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Lu le {formatDateTime(item.readAt)}
                            {item.readBy?.name ? ` - ${item.readBy.name}` : ''}
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMarkRead(item._id)}
                            disabled={actionId === item._id}
                            className="inline-flex min-h-[36px] items-center gap-2 rounded-xl bg-neutral-950 px-3 text-xs font-bold text-white transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-neutral-950"
                          >
                            <CheckCircle className="h-4 w-4" />
                            {actionId === item._id ? 'Mise a jour...' : 'Marquer comme lu'}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600 hover:border-neutral-300 disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-300"
              >
                Precedent
              </button>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Page {page} / {meta.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                disabled={page >= meta.totalPages}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600 hover:border-neutral-300 disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-300"
              >
                Suivant
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
