import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  GlobeAltIcon,
  KeyIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';

const PERMISSION_GROUPS = [
  {
    key: 'admin',
    label: 'Administration',
    items: ['view_admin_dashboard', 'manage_users', 'manage_settings', 'manage_permissions', 'assign_roles', 'revoke_roles', 'view_logs']
  },
  {
    key: 'commerce',
    label: 'Commerce',
    items: ['manage_orders', 'manage_products', 'manage_sellers', 'manage_complaints', 'manage_delivery', 'manage_boosts', 'verify_payments', 'read_feedback', 'manage_chat_templates', 'manage_help_center']
  },
  {
    key: 'marketing',
    label: 'Marketing & notifications',
    items: ['manage_notification_campaigns', 'send_notification_campaigns', 'view_notification_analytics', 'manage_onboarding', 'manage_social_commerce', 'view_social_analytics']
  },
  {
    key: 'security',
    label: 'Sécurité & comptes',
    items: ['lock_accounts', 'reset_passwords', 'force_logout']
  },
  {
    key: 'founder',
    label: 'Fondateur uniquement',
    items: ['founder_override', 'access_founder_analytics', 'manage_social_channels']
  }
];

const PERMISSION_LABELS = {
  view_admin_dashboard: 'Voir le tableau de bord admin',
  manage_users: 'Gérer les utilisateurs',
  manage_orders: 'Gérer les commandes',
  manage_sellers: 'Gérer les boutiques',
  manage_settings: 'Gérer les paramètres',
  manage_permissions: 'Gérer les permissions des admins',
  assign_roles: 'Promouvoir des admins',
  revoke_roles: 'Révoquer des admins',
  view_logs: 'Voir les journaux / audits',
  manage_products: 'Modérer les produits',
  manage_complaints: 'Gérer les réclamations',
  manage_delivery: 'Gérer la livraison & livreurs',
  manage_boosts: 'Gérer les boosts',
  verify_payments: 'Vérifier les paiements',
  read_feedback: 'Lire les retours utilisateurs',
  manage_chat_templates: 'Gérer les modèles de chat',
  manage_help_center: 'Gérer le centre d’aide',
  manage_notification_campaigns: 'Gérer les campagnes de notifications',
  send_notification_campaigns: 'Envoyer des campagnes de notifications',
  view_notification_analytics: 'Voir les analytics des campagnes',
  manage_onboarding: 'Gérer les séquences d’onboarding',
  manage_social_commerce: 'Gérer le social commerce',
  view_social_analytics: 'Voir les analytics sociaux',
  lock_accounts: 'Verrouiller / déverrouiller des comptes',
  reset_passwords: 'Réinitialiser des mots de passe',
  force_logout: 'Forcer la déconnexion',
  founder_override: 'Outils de contrôle fondateur (suppression définitive…)',
  access_founder_analytics: 'Accéder aux analytics fondateur',
  manage_social_channels: 'Gérer les canaux sociaux (fondateur uniquement)',
  edit_user_profile: 'Modifier son profil',
  courier_view_assignments: 'Voir les missions livreur',
  courier_accept_assignment: 'Accepter des missions',
  courier_update_status: 'Mettre à jour le statut des missions',
  courier_upload_proof: 'Téléverser des preuves de livraison'
};

const FOUNDER_ONLY_PERMISSIONS = new Set(['founder_override', 'access_founder_analytics', 'manage_social_channels']);

const normalizePermissionList = (list = []) => Array.from(new Set(Array.isArray(list) ? list : []));

export default function FounderAdminPermissions() {
  const [items, setItems] = useState([]);
  const [roleDefaults, setRoleDefaults] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/founder/admins/permissions');
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
      setRoleDefaults(normalizePermissionList(data?.roleDefaults?.admin));
      setAvailablePermissions(normalizePermissionList(data?.availablePermissions));
      const initialDrafts = {};
      list.forEach((item) => {
        initialDrafts[item.id] = {
          mode: item.permissionMode === 'custom' ? 'custom' : 'role',
          permissions: normalizePermissionList(
            item.permissionMode === 'custom' ? item.permissions : item.effectivePermissions
          )
        };
      });
      setDrafts(initialDrafts);
      setExpandedId(null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Impossible de charger les admins.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const groupedPermissions = useMemo(() => {
    const used = new Set();
    const groups = PERMISSION_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((permission) => availablePermissions.includes(permission))
    })).filter((group) => group.items.length > 0);
    groups.forEach((group) => group.items.forEach((permission) => used.add(permission)));
    const remaining = availablePermissions.filter((permission) => !used.has(permission));
    if (remaining.length) {
      groups.push({ key: 'other', label: 'Autres', items: remaining });
    }
    return groups;
  }, [availablePermissions]);

  const togglePermission = (adminId, permission) => {
    setDrafts((current) => {
      const draft = current[adminId] || { mode: 'role', permissions: [] };
      const has = draft.permissions.includes(permission);
      return {
        ...current,
        [adminId]: {
          ...draft,
          mode: 'custom',
          permissions: has
            ? draft.permissions.filter((item) => item !== permission)
            : [...draft.permissions, permission]
        }
      };
    });
    setSaveMessage('');
  };

  const setMode = (adminId, mode) => {
    setDrafts((current) => {
      const draft = current[adminId] || { mode: 'role', permissions: [] };
      if (mode === 'role') {
        return { ...current, [adminId]: { mode: 'role', permissions: [...roleDefaults] } };
      }
      return { ...current, [adminId]: { ...draft, mode: 'custom' } };
    });
    setSaveMessage('');
  };

  const isDirty = (adminId) => {
    const item = items.find((entry) => entry.id === adminId);
    const draft = drafts[adminId];
    if (!item || !draft) return false;
    const currentPermissions =
      item.permissionMode === 'custom'
        ? normalizePermissionList(item.permissions)
        : normalizePermissionList(item.effectivePermissions);
    if (draft.mode !== (item.permissionMode === 'custom' ? 'custom' : 'role')) return true;
    const a = [...draft.permissions].sort();
    const b = [...currentPermissions].sort();
    return JSON.stringify(a) !== JSON.stringify(b);
  };

  const save = async (admin) => {
    if (savingId) return;
    setSavingId(admin.id);
    setSaveMessage('');
    const draft = drafts[admin.id] || { mode: 'role', permissions: [] };
    try {
      const { data } = await api.patch(`/founder/admins/${admin.id}/permissions`, {
        permissionMode: draft.mode,
        permissions: draft.permissions
      });
      setItems((current) =>
        current.map((item) =>
          item.id === admin.id
            ? {
                ...item,
                permissionMode: data?.item?.permissionMode || draft.mode,
                permissions: data?.item?.permissions || draft.permissions,
                effectivePermissions: data?.item?.effectivePermissions || draft.permissions
              }
            : item
        )
      );
      setSaveMessage(`Permissions de ${admin.name || 'cet admin'} enregistrées. Sa session a été invalidée.`);
      setExpandedId(null);
    } catch (err) {
      setSaveMessage(err?.response?.data?.message || err?.message || 'Échec de l’enregistrement.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-3 py-4 sm:px-5 md:px-6 lg:px-8">
      <header className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 bg-neutral-50/50 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0E4] text-[#e85d00]">
                <KeyIcon className="h-[18px] w-[18px]" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#e85d00]">Fondateur</p>
                <h1 className="text-xl font-black tracking-tight text-neutral-900 sm:text-2xl">
                  Permissions des administrateurs
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/admin"
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" />
                Dashboard
              </Link>
              <button
                type="button"
                onClick={load}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
              >
                <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-neutral-500">
            Choisissez ce que chaque admin a le droit de faire. « Rôle par défaut » applique les permissions
            standards du rôle admin ; « Personnalisé » vous laisse accorder ou retirer chaque permission
            individuellement (le changement invalide la session de l’admin).
          </p>
          {saveMessage && (
            <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{saveMessage}</p>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-16 text-center">
          <ArrowPathIcon className="mx-auto h-5 w-5 animate-spin text-neutral-300" />
          <p className="mt-3 text-sm text-neutral-400">Chargement des admins…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-16 text-center text-sm text-neutral-400">
          Aucun administrateur trouvé.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((admin) => {
            const draft = drafts[admin.id] || { mode: 'role', permissions: [] };
            const expanded = expandedId === admin.id;
            const dirty = isDirty(admin.id);
            const effective = normalizePermissionList(admin.effectivePermissions);
            return (
              <article key={admin.id} className="overflow-hidden rounded-[24px] border border-[#e8ded3] bg-white">
                <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#211b17]">{admin.name || 'Admin'}</p>
                    <p className="truncate text-xs text-[#80766c]">
                      {admin.phone || ''}
                      {admin.phone && admin.email ? ' · ' : ''}
                      {admin.email || ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${admin.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        <CheckCircleIcon className="h-3 w-3" />
                        {admin.isActive ? 'Actif' : 'Inactif'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0E4] px-2 py-0.5 text-[10px] font-bold text-[#e85d00]">
                        <GlobeAltIcon className="h-3 w-3" />
                        {admin.adminCountryIds.length} pays
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                        <ShieldCheckIcon className="h-3 w-3" />
                        {effective.length} permissions
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {dirty && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                        Modifié
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : admin.id)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#e2d8cd] bg-white px-3.5 text-xs font-bold text-[#514940] transition hover:border-[#e85d00]"
                    >
                      {expanded ? 'Fermer' : 'Configurer'}
                      <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-[#f0e9e0] bg-[#faf6f0]/40 px-5 py-4">
                    <div className="mb-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setMode(admin.id, 'role')}
                        className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-4 text-xs font-bold transition ${
                          draft.mode === 'role'
                            ? 'border-[#e85d00] bg-[#FFF0E4] text-[#e85d00]'
                            : 'border-[#e2d8cd] bg-white text-[#514940] hover:border-[#e85d00]'
                        }`}
                      >
                        <ShieldExclamationIcon className="h-4 w-4" />
                        Rôle par défaut
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode(admin.id, 'custom')}
                        className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-4 text-xs font-bold transition ${
                          draft.mode === 'custom'
                            ? 'border-[#e85d00] bg-[#FFF0E4] text-[#e85d00]'
                            : 'border-[#e2d8cd] bg-white text-[#514940] hover:border-[#e85d00]'
                        }`}
                      >
                        <KeyIcon className="h-4 w-4" />
                        Personnalisé
                      </button>
                    </div>

                    {draft.mode === 'custom' ? (
                      <div className="space-y-4">
                        {groupedPermissions.map((group) => (
                          <div key={group.key}>
                            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#80766c]">
                              {group.label}
                            </p>
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              {group.items.map((permission) => {
                                const checked = draft.permissions.includes(permission);
                                const founderOnly = FOUNDER_ONLY_PERMISSIONS.has(permission);
                                return (
                                  <label
                                    key={permission}
                                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs transition ${
                                      checked
                                        ? 'border-[#e85d00] bg-[#FFF0E4] text-[#211b17]'
                                        : 'border-[#e8ded3] bg-white text-[#514940] hover:border-[#e85d00]'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="mt-0.5 h-4 w-4 accent-[#e85d00]"
                                      checked={checked}
                                      onChange={() => togglePermission(admin.id, permission)}
                                    />
                                    <span className="leading-5">
                                      {PERMISSION_LABELS[permission] || permission}
                                      {founderOnly && (
                                        <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                                          FONDATEUR
                                        </span>
                                      )}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[#e8ded3] bg-white px-4 py-4">
                        <p className="text-xs font-bold text-[#211b17]">
                          Permissions standard du rôle admin ({roleDefaults.length}) :
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {roleDefaults.map((permission) => (
                            <span key={permission} className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-600">
                              {PERMISSION_LABELS[permission] || permission}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(null)}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#e2d8cd] bg-white px-4 text-xs font-bold text-[#514940] transition hover:border-[#e85d00]"
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => save(admin)}
                        disabled={!dirty || savingId === admin.id}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#e85d00] px-5 text-xs font-black text-white transition hover:bg-[#c94f00] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingId === admin.id ? 'Enregistrement…' : 'Enregistrer les permissions'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
