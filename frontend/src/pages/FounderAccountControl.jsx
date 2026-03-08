import React, { useContext, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Ban,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  Store,
  Trash2,
  UserRound,
  X
} from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import BaseModal, { ModalBody, ModalFooter, ModalHeader } from '../components/modals/BaseModal';

const CONFIRM_WORD = 'SUPPRIMER';

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
};

const getInitials = (name = '') =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join('') || 'U';

function Avatar({ name, image }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="h-12 w-12 rounded-xl object-cover shadow-sm"
        loading="lazy"
      />
    );
  }
  return (
    <div className="h-12 w-12 rounded-xl bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-bold shadow-sm">
      {getInitials(name)}
    </div>
  );
}

export default function FounderAccountControl() {
  const { user } = useContext(AuthContext);
  const canAccess = user?.role === 'founder';
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('accounts');
  const [search, setSearch] = useState('');
  const [accountType, setAccountType] = useState('all');
  const [blacklistSearch, setBlacklistSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    target: null,
    reason: '',
    confirmValue: ''
  });
  const [reverseModal, setReverseModal] = useState({
    open: false,
    target: null,
    reason: ''
  });
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const deletionCandidatesQuery = useQuery({
    queryKey: ['founder', 'deletion-candidates', search, accountType],
    queryFn: async () => {
      const { data } = await api.get('/founder/deletion-candidates', {
        params: {
          search: search.trim() || undefined,
          accountType: accountType === 'all' ? undefined : accountType,
          limit: 100
        }
      });
      return data;
    },
    staleTime: 30_000,
    enabled: canAccess
  });

  const blacklistQuery = useQuery({
    queryKey: ['founder', 'phone-blacklist', blacklistSearch, showInactive],
    queryFn: async () => {
      const { data } = await api.get('/founder/phone-blacklist', {
        params: {
          search: blacklistSearch.trim() || undefined,
          active: showInactive ? 'all' : 'true',
          limit: 100
        }
      });
      return data;
    },
    staleTime: 15_000,
    enabled: canAccess
  });

  const auditQuery = useQuery({
    queryKey: ['founder', 'deletion-audit'],
    queryFn: async () => {
      const { data } = await api.get('/founder/audit-logs', {
        params: { page: 1, limit: 30 }
      });
      return data;
    },
    staleTime: 15_000,
    enabled: canAccess
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ target, reason }) => {
      const { data } = await api.post(`/founder/hard-delete/${target._id}`, {
        reason,
        entityType: target.accountType === 'shop' ? 'shop' : 'user'
      });
      return data;
    },
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Suppression définitive effectuée.' });
      setDeleteModal({ open: false, target: null, reason: '', confirmValue: '' });
      queryClient.invalidateQueries({ queryKey: ['founder', 'deletion-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['founder', 'phone-blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['founder', 'deletion-audit'] });
    },
    onError: (error) => {
      setFeedback({
        type: 'error',
        message: error?.response?.data?.message || 'Suppression impossible.'
      });
    }
  });

  const reverseMutation = useMutation({
    mutationFn: async ({ target, reason }) => {
      const { data } = await api.post(`/founder/phone-blacklist/${target._id}/reverse`, { reason });
      return data;
    },
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Blacklist retirée avec succès.' });
      setReverseModal({ open: false, target: null, reason: '' });
      queryClient.invalidateQueries({ queryKey: ['founder', 'phone-blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['founder', 'deletion-audit'] });
    },
    onError: (error) => {
      setFeedback({
        type: 'error',
        message: error?.response?.data?.message || 'Reverse blacklist impossible.'
      });
    }
  });

  const deletionCandidates = useMemo(
    () => (Array.isArray(deletionCandidatesQuery.data?.items) ? deletionCandidatesQuery.data.items : []),
    [deletionCandidatesQuery.data]
  );
  const blacklistEntries = useMemo(
    () => (Array.isArray(blacklistQuery.data?.items) ? blacklistQuery.data.items : []),
    [blacklistQuery.data]
  );
  const auditEntries = useMemo(() => {
    const items = Array.isArray(auditQuery.data?.items) ? auditQuery.data.items : [];
    return items.filter((entry) =>
      String(entry?.actionType || '').startsWith('founder_hard_delete_account') ||
      String(entry?.actionType || '').startsWith('founder_phone_blacklist')
    );
  }, [auditQuery.data]);

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-red-600 font-semibold">Accès refusé</p>
          <h1 className="mt-2 text-xl font-bold text-gray-900">Founder Account Control</h1>
          <p className="mt-2 text-sm text-gray-600">Seul le fondateur peut ouvrir cette page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 md:px-5 md:py-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                <ShieldAlert size={14} />
                Founder only
              </p>
              <h1 className="mt-2 text-xl font-bold text-gray-900">Suppression définitive & blacklist</h1>
              <p className="mt-1 text-sm text-gray-600">
                Supprime un compte définitivement puis bloque son numéro de téléphone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['founder', 'deletion-candidates'] });
                queryClient.invalidateQueries({ queryKey: ['founder', 'phone-blacklist'] });
                queryClient.invalidateQueries({ queryKey: ['founder', 'deletion-audit'] });
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>
        </header>

        {feedback.message ? (
          <div
            className={`rounded-2xl p-3 text-sm font-medium ${
              feedback.type === 'error'
                ? 'bg-red-50 text-red-700'
                : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <section className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTab('accounts')}
              className={`min-h-[44px] rounded-xl text-sm font-semibold ${
                tab === 'accounts' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Comptes
            </button>
            <button
              type="button"
              onClick={() => setTab('blacklist')}
              className={`min-h-[44px] rounded-xl text-sm font-semibold ${
                tab === 'blacklist' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Numéros blacklistés
            </button>
          </div>
        </section>

        {tab === 'accounts' ? (
          <section className="space-y-3">
            <div className="rounded-2xl bg-white p-3 shadow-sm space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher nom, email, téléphone..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                />
              </div>
              <select
                value={accountType}
                onChange={(event) => setAccountType(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
              >
                <option value="all">Tous les comptes</option>
                <option value="person">Utilisateurs</option>
                <option value="shop">Boutiques</option>
              </select>
            </div>

            {deletionCandidatesQuery.isLoading ? (
              <div className="rounded-2xl bg-white p-5 shadow-sm text-sm text-gray-600 inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Chargement des comptes...
              </div>
            ) : null}

            {!deletionCandidatesQuery.isLoading && deletionCandidates.length === 0 ? (
              <div className="rounded-2xl bg-white p-5 shadow-sm text-sm text-gray-600">
                Aucun compte trouvé avec ces filtres.
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {deletionCandidates.map((candidate) => (
                <article key={candidate._id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar name={candidate.name} image={candidate.profileImage} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{candidate.name}</p>
                        <p className="truncate text-xs text-gray-500">{candidate.email || 'Email non défini'}</p>
                        <p className="mt-1 text-xs text-gray-600">{candidate.phone || 'Téléphone absent'}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        candidate.accountType === 'shop'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {candidate.accountType === 'shop' ? 'SHOP' : 'USER'}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                    <p>Rôle: {candidate.role || 'user'}</p>
                    <p>Créé: {formatDateTime(candidate.createdAt)}</p>
                  </div>

                  {candidate.accountType === 'shop' && candidate.shopName ? (
                    <p className="mt-2 text-xs text-gray-600 inline-flex items-center gap-1">
                      <Store size={13} />
                      {candidate.shopName}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      setFeedback({ type: '', message: '' });
                      setDeleteModal({
                        open: true,
                        target: candidate,
                        reason: '',
                        confirmValue: ''
                      });
                    }}
                    className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    <Trash2 size={16} />
                    Supprimer définitivement
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'blacklist' ? (
          <section className="space-y-3">
            <div className="rounded-2xl bg-white p-3 shadow-sm space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={blacklistSearch}
                  onChange={(event) => setBlacklistSearch(event.target.value)}
                  placeholder="Rechercher un numéro blacklisté..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(event) => setShowInactive(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Afficher aussi les numéros déjà réactivés
              </label>
            </div>

            {blacklistQuery.isLoading ? (
              <div className="rounded-2xl bg-white p-5 shadow-sm text-sm text-gray-600 inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Chargement blacklist...
              </div>
            ) : null}

            {!blacklistQuery.isLoading && blacklistEntries.length === 0 ? (
              <div className="rounded-2xl bg-white p-5 shadow-sm text-sm text-gray-600">
                Aucun numéro blacklisté.
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {blacklistEntries.map((entry) => (
                <article key={entry._id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{entry.phoneNormalized || 'N/A'}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Bloqué le {formatDateTime(entry.blockedAt)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        entry.isActive ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {entry.isActive ? 'ACTIF' : 'RÉACTIVÉ'}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-gray-600">
                    <p>
                      Type: {entry.blockedEntityType === 'shop' ? 'Boutique' : 'Utilisateur'}
                    </p>
                    <p>
                      Compte cible: {entry.blockedEntitySnapshot?.name || 'N/A'}{' '}
                      {entry.blockedEntitySnapshot?.email ? `(${entry.blockedEntitySnapshot.email})` : ''}
                    </p>
                    <p>Motif: {entry.reason || 'Aucun motif renseigné'}</p>
                  </div>

                  {entry.isActive ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFeedback({ type: '', message: '' });
                        setReverseModal({ open: true, target: entry, reason: '' });
                      }}
                      className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gray-900 text-sm font-semibold text-white"
                    >
                      <Ban size={16} />
                      Reverse blacklist
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Audit (actions founder)</h2>
          <div className="mt-3 space-y-2">
            {auditQuery.isLoading ? (
              <p className="text-sm text-gray-500">Chargement audit...</p>
            ) : null}
            {!auditQuery.isLoading && auditEntries.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune action de suppression/blacklist récente.</p>
            ) : null}
            {auditEntries.slice(0, 10).map((entry) => (
              <div key={entry._id} className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <p className="font-semibold text-gray-800">{entry.actionType}</p>
                <p>
                  {entry?.targetUser?.name || entry?.targetUser?.email || 'Compte supprimé'} ·{' '}
                  {formatDateTime(entry.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <BaseModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, target: null, reason: '', confirmValue: '' })}
        size="lg"
        mobileSheet
        ariaLabel="Suppression définitive"
      >
        <ModalHeader
          title="Suppression définitive"
          subtitle="Action irréversible"
          icon={<AlertTriangle size={16} className="text-red-600" />}
          onClose={() => setDeleteModal({ open: false, target: null, reason: '', confirmValue: '' })}
        />
        <ModalBody className="space-y-3">
          <p className="text-sm text-gray-700">
            Vous allez supprimer définitivement{' '}
            <span className="font-semibold">{deleteModal.target?.name}</span>. Son numéro sera blacklisté.
          </p>
          <textarea
            value={deleteModal.reason}
            onChange={(event) =>
              setDeleteModal((prev) => ({ ...prev, reason: event.target.value }))
            }
            rows={3}
            placeholder="Motif obligatoire..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
          />
          <input
            value={deleteModal.confirmValue}
            onChange={(event) =>
              setDeleteModal((prev) => ({ ...prev, confirmValue: event.target.value }))
            }
            placeholder={`Tapez ${CONFIRM_WORD} pour confirmer`}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
          />
        </ModalBody>
        <ModalFooter>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDeleteModal({ open: false, target: null, reason: '', confirmValue: '' })}
              className="min-h-[44px] rounded-xl bg-gray-100 text-sm font-semibold text-gray-700"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={
                deleteMutation.isPending ||
                !deleteModal.reason.trim() ||
                deleteModal.confirmValue.trim().toUpperCase() !== CONFIRM_WORD
              }
              onClick={() =>
                deleteMutation.mutate({
                  target: deleteModal.target,
                  reason: deleteModal.reason.trim()
                })
              }
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:opacity-60"
            >
              {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Supprimer
            </button>
          </div>
        </ModalFooter>
      </BaseModal>

      <BaseModal
        isOpen={reverseModal.open}
        onClose={() => setReverseModal({ open: false, target: null, reason: '' })}
        size="md"
        mobileSheet
        ariaLabel="Reverse blacklist"
      >
        <ModalHeader
          title="Reverse blacklist"
          subtitle="Retirer un numéro de la blacklist"
          onClose={() => setReverseModal({ open: false, target: null, reason: '' })}
        />
        <ModalBody className="space-y-3">
          <p className="text-sm text-gray-700">
            Retirer {reverseModal.target?.phoneNormalized} de la blacklist.
          </p>
          <textarea
            value={reverseModal.reason}
            onChange={(event) =>
              setReverseModal((prev) => ({ ...prev, reason: event.target.value }))
            }
            rows={3}
            placeholder="Motif optionnel..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
          />
        </ModalBody>
        <ModalFooter>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setReverseModal({ open: false, target: null, reason: '' })}
              className="min-h-[44px] rounded-xl bg-gray-100 text-sm font-semibold text-gray-700"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={reverseMutation.isPending}
              onClick={() =>
                reverseMutation.mutate({
                  target: reverseModal.target,
                  reason: reverseModal.reason.trim()
                })
              }
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gray-900 text-sm font-semibold text-white disabled:opacity-60"
            >
              {reverseMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserRound size={16} />}
              Confirmer
            </button>
          </div>
        </ModalFooter>
      </BaseModal>
    </div>
  );
}
