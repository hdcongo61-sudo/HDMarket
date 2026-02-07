import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  AlertCircle,
  Paperclip,
  RefreshCw,
  Search,
  UserPlus,
  UserMinus
} from 'lucide-react';

const complaintStatusLabels = {
  pending: 'En attente',
  in_review: 'En cours',
  resolved: 'Résolue'
};

const complaintStatusStyles = {
  pending: 'bg-orange-100 text-orange-800',
  in_review: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800'
};

const complaintStatusFilterOptions = [
  { value: '', label: 'Toutes' },
  { value: 'pending', label: 'En attente' },
  { value: 'in_review', label: 'En cours' },
  { value: 'resolved', label: 'Résolues' }
];

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

export default function AdminComplaints() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintsError, setComplaintsError] = useState('');
  const [complaintsFilter, setComplaintsFilter] = useState('pending');
  const [complaintActioningId, setComplaintActioningId] = useState('');
  const [managers, setManagers] = useState([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [foundUsers, setFoundUsers] = useState([]);
  const [togglingUserId, setTogglingUserId] = useState('');

  const isAdmin = user?.role === 'admin';

  const filesBase = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    return apiBase.replace(/\/api\/?$/, '');
  }, []);

  const normalizeUrl = useCallback(
    (url) => {
      if (!url) return url;
      const cleaned = String(url).replace(/\\/g, '/');
      if (/^https?:\/\//i.test(cleaned)) return cleaned;
      return `${filesBase}/${cleaned.replace(/^\/+/, '')}`;
    },
    [filesBase]
  );

  const loadComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    setComplaintsError('');
    try {
      const params = complaintsFilter ? { status: complaintsFilter } : {};
      const { data } = await api.get('/admin/complaints', { params });
      const list = Array.isArray(data) ? data : [];
      const normalized = list.map((item) => ({
        ...item,
        attachments: (Array.isArray(item.attachments) ? item.attachments : []).map((att) => ({
          ...att,
          url: normalizeUrl(att.path || att.url || '')
        }))
      }));
      setComplaints(normalized);
    } catch (e) {
      setComplaintsError(e.response?.data?.message || e.message || 'Erreur lors du chargement des réclamations.');
    } finally {
      setComplaintsLoading(false);
    }
  }, [complaintsFilter, normalizeUrl]);

  const loadManagers = useCallback(async () => {
    if (!isAdmin) return;
    setManagersLoading(true);
    try {
      const { data } = await api.get('/admin/complaint-managers');
      setManagers(data.managers || []);
    } catch (e) {
      console.error('Load complaint managers error:', e);
    } finally {
      setManagersLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  useEffect(() => {
    loadManagers();
  }, [loadManagers]);

  const handleComplaintStatusChange = useCallback(
    async (complaintId, nextStatus) => {
      if (!complaintId || !nextStatus) return;
      setComplaintActioningId(complaintId);
      try {
        await api.patch(`/admin/complaints/${complaintId}/status`, { status: nextStatus });
        showToast('Statut de la réclamation mis à jour.', { variant: 'success' });
        await loadComplaints();
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Impossible de mettre à jour le statut.';
        showToast(msg, { variant: 'error' });
      } finally {
        setComplaintActioningId('');
      }
    },
    [loadComplaints, showToast]
  );

  const handleSearchUsers = async () => {
    if (!userSearchQuery.trim()) return;
    setSearchingUsers(true);
    try {
      const { data } = await api.get(`/admin/users?search=${encodeURIComponent(userSearchQuery.trim())}&limit=10`);
      const users = Array.isArray(data) ? data : [];
      setFoundUsers(users.filter((u) => u.role !== 'admin'));
    } catch (e) {
      setFoundUsers([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleToggleManager = async (userId) => {
    if (!userId) return;
    setTogglingUserId(userId);
    try {
      const { data } = await api.patch(`/admin/complaint-managers/${userId}/toggle`);
      showToast(data.message || 'Permission mise à jour.', { variant: 'success' });
      await loadManagers();
      setFoundUsers([]);
      setUserSearchQuery('');
    } catch (e) {
      showToast(e.response?.data?.message || 'Erreur lors de la mise à jour.', { variant: 'error' });
    } finally {
      setTogglingUserId('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/20 lg:min-h-0 lg:bg-transparent">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-6 border-b border-gray-200/60">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
              <AlertCircle size={24} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Réclamations</h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Consultez les plaintes et gérez les responsables.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadComplaints}
            disabled={complaintsLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={complaintsLoading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </header>

        {/* Responsables réclamations - admin only */}
        {isAdmin && (
          <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <UserPlus size={20} className="text-indigo-600" />
              Responsables des réclamations
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Les utilisateurs ajoutés ici pourront consulter et traiter les réclamations (changer le statut).
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <input
                type="text"
                placeholder="Rechercher un utilisateur (nom, email, téléphone)..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleSearchUsers}
                disabled={searchingUsers || !userSearchQuery.trim()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Search size={18} />
                Rechercher
              </button>
            </div>
            {foundUsers.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500">Résultats :</p>
                {foundUsers.map((u) => {
                  const id = u._id || u.id;
                  const isManager = managers.some((m) => m.id === id);
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-500">{u.email} · {u.phone}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleManager(id)}
                        disabled={togglingUserId === id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          isManager
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        } disabled:opacity-50`}
                      >
                        {isManager ? <UserMinus size={14} /> : <UserPlus size={14} />}
                        {isManager ? 'Retirer' : 'Ajouter'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {managersLoading ? (
              <p className="text-sm text-gray-500">Chargement…</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">
                  {managers.length} responsable{managers.length !== 1 ? 's' : ''}
                </p>
                {managers.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun responsable ajouté. Recherchez un utilisateur ci-dessus.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {managers.map((m) => (
                      <li key={m.id} className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-700">{m.name} · {m.email}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleManager(m.id)}
                          disabled={togglingUserId === m.id}
                          className="text-xs font-semibold text-amber-600 hover:text-amber-700"
                        >
                          Retirer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {/* Liste des réclamations */}
        <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Liste des réclamations</h2>
            <select
              value={complaintsFilter}
              onChange={(e) => setComplaintsFilter(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {complaintStatusFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {complaintsError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-center gap-3 text-red-800 text-sm">
              <AlertCircle size={20} />
              {complaintsError}
            </div>
          )}

          {complaintsLoading ? (
            <div className="py-12 flex justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            </div>
          ) : complaints.length === 0 ? (
            <p className="text-sm text-gray-500 py-8">Aucune réclamation pour ce filtre.</p>
          ) : (
            <ul className="space-y-4">
              {complaints.map((complaint) => (
                <li key={complaint._id} className="rounded-2xl border border-gray-100 p-4 space-y-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{complaint.subject || 'Sans objet'}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {complaint.user?.name || 'Anonyme'} · {complaint.user?.email || '—'} · {complaint.user?.phone || '—'}
                      </p>
                      <p className="text-xs text-gray-400">{formatDateTime(complaint.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          complaintStatusStyles[complaint.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {complaintStatusLabels[complaint.status] || complaint.status}
                      </span>
                      <select
                        value={complaint.status}
                        onChange={(e) => handleComplaintStatusChange(complaint._id, e.target.value)}
                        disabled={complaintActioningId === complaint._id}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500"
                      >
                        {Object.entries(complaintStatusLabels).map(([k, label]) => (
                          <option key={k} value={k}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-line break-words">{complaint.message}</p>
                  {complaint.attachments?.filter((a) => a.url).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {complaint.attachments.filter((a) => a.url).map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 hover:border-indigo-200"
                        >
                          <Paperclip size={14} />
                          {att.originalName || att.filename}
                        </a>
                      ))}
                    </div>
                  )}
                  {complaint.adminNote && (
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">Note admin :</span> {complaint.adminNote}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
