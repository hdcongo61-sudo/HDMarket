import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Filter, MessageSquare, Search, User, FileText, UserPlus, UserMinus, Download, FileDown } from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';

const STATUS_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'unread', label: 'Non lus' },
  { key: 'read', label: 'Lus' }
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
  const isAdmin = user?.role === 'admin';

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
      doc.text(`Filtre: ${STATUS_FILTERS.find(f => f.key === statusFilter)?.label || 'Tous'}`, 14, 40);

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
      alert('Impossible d\'exporter en PDF: ' + (err.response?.data?.message || err.message));
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
      alert('Impossible d\'exporter en PDF: ' + err.message);
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
    console.log('Toggle feedback reader - userId:', userId);
    console.log('userId type:', typeof userId);
    console.log('userId length:', userId?.length);

    if (!userId || typeof userId !== 'string') {
      console.error('Invalid userId - not a string:', userId);
      alert('ID utilisateur invalide');
      return;
    }

    // Check if userId is a valid MongoDB ObjectId (24 hex characters)
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      console.error('Invalid MongoDB ObjectId format:', userId);
      alert(`Format d'ID invalide: ${userId}`);
      return;
    }

    try {
      console.log('Making API request to:', `/admin/feedback-readers/${userId}/toggle`);
      const { data } = await api.patch(`/admin/feedback-readers/${userId}/toggle`);
      alert(data.message || 'Statut mis a jour');
      await loadFeedbackReaders();
      setFoundUsers([]);
      setUserSearchQuery('');
    } catch (err) {
      console.error('Toggle feedback reader error:', err);
      console.error('Error response:', err.response?.data);
      alert(err.response?.data?.message || 'Erreur lors de la mise a jour');
    }
  };

  const handleSearchUsers = async () => {
    if (!userSearchQuery.trim()) return;
    setSearchingUsers(true);
    try {
      const { data } = await api.get(`/admin/users?search=${encodeURIComponent(userSearchQuery.trim())}&limit=10`);
      const users = Array.isArray(data) ? data.filter(u => u.role !== 'admin') : [];
      console.log('Search results:', users);
      console.log('First user structure:', users[0]);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Avis sur l'amelioration</h1>
              <p className="text-sm text-gray-500">
                Centralisez les retours utilisateurs et marquez-les comme lus.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600">
              <Filter className="h-4 w-4" />
              {paginationLabel}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={exporting || items.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{exporting ? 'Export en cours...' : 'Exporter en PDF'}</span>
              <span className="sm:hidden">{exporting ? 'Export...' : 'PDF'}</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setShowReaders(!showReaders);
                  if (!showReaders && readers.length === 0) {
                    loadFeedbackReaders();
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-3xl bg-white border-2 border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 active:scale-95 transition-all duration-200"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Gerer les lecteurs</span>
                <span className="sm:hidden">Lecteurs</span>
              </button>
            )}
          </div>
        </header>

        {isAdmin && showReaders && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Lecteurs d'avis autorises</h2>
              <button
                onClick={() => setShowReaders(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Rechercher un utilisateur (nom, email, telephone)..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={handleSearchUsers}
                  disabled={searchingUsers || !userSearchQuery.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {foundUsers.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs text-gray-500 font-semibold">Resultats de recherche:</p>
                  {foundUsers.map((user) => (
                    <div
                      key={user._id || user.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email} · {user.phone}</p>
                      </div>
                      <button
                        onClick={() => handleToggleFeedbackReader(user._id || user.id)}
                        className="ml-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 active:scale-95 transition-all"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Ajouter
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 font-semibold mb-2">Lecteurs actuels ({readers.length}):</p>
                {loadingReaders ? (
                  <p className="text-sm text-gray-500">Chargement...</p>
                ) : readers.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun lecteur autorise pour le moment.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {readers.map((reader) => (
                      <div
                        key={reader._id || reader.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-gray-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{reader.name}</p>
                          <p className="text-xs text-gray-500 truncate">{reader.email} · {reader.phone}</p>
                        </div>
                        <button
                          onClick={() => handleToggleFeedbackReader(reader._id || reader.id)}
                          className="ml-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 active:scale-95 transition-all"
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

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setStatusFilter(filter.key)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    statusFilter === filter.key
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Rechercher un avis"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="animate-pulse rounded-2xl border border-gray-100 bg-gray-50 p-4"
                >
                  <div className="h-4 w-1/3 rounded bg-gray-200" />
                  <div className="mt-3 h-3 w-full rounded bg-gray-200" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
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
                    className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-indigo-500" />
                          <h3 className="text-base font-semibold text-gray-900">
                            {item.subject}
                          </h3>
                        </div>
                          <p className="text-xs text-gray-500">
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

                    <p className="text-sm text-gray-600 whitespace-pre-line break-words">{item.body}</p>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>{author}</span>
                        {item.user?.phone ? <span>- {item.user.phone}</span> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportSinglePDF(item)}
                          disabled={exportingItemId === item._id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-60 transition-all"
                          title="Exporter cet avis en PDF"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          {exportingItemId === item._id ? 'Export...' : 'PDF'}
                        </button>
                        {isRead ? (
                          <p className="text-xs text-gray-500">
                            Lu le {formatDateTime(item.readAt)}
                            {item.readBy?.name ? ` - ${item.readBy.name}` : ''}
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMarkRead(item._id)}
                            disabled={actionId === item._id}
                            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
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
                className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:border-gray-300 disabled:opacity-50"
              >
                Precedent
              </button>
              <span className="text-xs text-gray-500">
                Page {page} / {meta.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                disabled={page >= meta.totalPages}
                className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:border-gray-300 disabled:opacity-50"
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
