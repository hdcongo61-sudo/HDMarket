import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail,
  Phone,
  MessageSquare,
  Shield,
  FileText,
  Save,
  Edit3,
  RefreshCcw,
  AlertCircle
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import { useNetworks, getFirstNetworkPhone } from '../hooks/useNetworks';

function ContactPhoneDisplay() {
  const { networks } = useNetworks();
  const contactPhone = getFirstNetworkPhone(networks) || '+242 06 000 00 00';
  return (
    <p className="flex items-center gap-2">
      <Phone size={16} className="text-green-600" />
      {contactPhone}
    </p>
  );
}

const defaultConditions = [
  {
    title: 'Paiements sécurisés',
    description:
      'Tous les paiements vers ETS HD Tech Filial sont vérifiés manuellement avant la mise en ligne d’une annonce.'
  },
  {
    title: 'Vendeurs vérifiés',
    description:
      'Les boutiques et les particuliers doivent fournir des informations valides pour publier sur HDMarket.'
  },
  {
    title: 'Service client réactif',
    description:
      'Notre support répond sous 24h ouvrées par email ou WhatsApp pour toute réclamation ou assistance.'
  }
];

function addLocalIds(items = []) {
  const stamp = Date.now();
  return items.map((item, index) => ({
    ...item,
    id: item.id || `condition-${stamp}-${index}`
  }));
}

function toPayload(items = []) {
  return items.map(({ title, description }) => ({
    title: (title || '').trim(),
    description: (description || '').trim()
  }));
}

export default function HelpCenter() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';
  const [companyName, setCompanyName] = useState('ETS HD Tech Filial');
  const [conditions, setConditions] = useState(() => addLocalIds(defaultConditions));
  const [formState, setFormState] = useState({ title: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/support/help-center');
        if (!active) return;
        const remoteConditions =
          Array.isArray(data?.conditions) && data.conditions.length
            ? data.conditions
            : defaultConditions;
        setCompanyName(data?.companyName || 'ETS HD Tech Filial');
        setConditions(addLocalIds(remoteConditions));
        setError('');
      } catch (err) {
        if (!active) return;
        setConditions(addLocalIds(defaultConditions));
        setError(
          err.response?.data?.message ||
            err.message ||
            'Impossible de charger les conditions pour le moment.'
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  const companyHighlights = useMemo(
    () => [
      { label: 'Entreprise', value: companyName },
      { label: 'Siège social', value: 'Brazzaville, Congo' },
      { label: 'Support 24/7', value: 'support@hdmarket.cg' },
      { label: 'WhatsApp', value: getFirstNetworkPhone(networks) || '+242 06 000 00 00' }
    ],
    [companyName, networks]
  );

  const persistConditions = useCallback(
    async (nextConditions, successMsg) => {
      if (!isAdmin) {
        setStatusMessage('Seuls les administrateurs peuvent enregistrer des changements.');
        return false;
      }
      setSaving(true);
      try {
        const payload = {
          companyName,
          conditions: toPayload(nextConditions)
        };
        const { data } = await api.put('/support/help-center', payload);
        const updated =
          Array.isArray(data?.conditions) && data.conditions.length
            ? data.conditions
            : toPayload(nextConditions);
        setConditions(addLocalIds(updated));
        setCompanyName(data?.companyName || companyName);
        setStatusMessage(successMsg || 'Modifications enregistrées.');
        setError('');
        return true;
      } catch (err) {
        setStatusMessage(
          err.response?.data?.message ||
            err.message ||
            'Impossible d’enregistrer les modifications.'
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [companyName, isAdmin]
  );

  const startEdit = (item) => {
    if (!isAdmin) {
      setStatusMessage('Seuls les administrateurs peuvent modifier les conditions.');
      return;
    }
    setEditingId(item.id);
    setFormState({ title: item.title, description: item.description });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isAdmin) {
      setStatusMessage('Seuls les administrateurs peuvent enregistrer des changements.');
      return;
    }
    if (!formState.title.trim() || !formState.description.trim()) {
      setStatusMessage('Merci de renseigner un titre et un contenu.');
      return;
    }

    const normalized = {
      title: formState.title.trim(),
      description: formState.description.trim()
    };

    const nextConditions = editingId
      ? conditions.map((condition) =>
          condition.id === editingId ? { ...condition, ...normalized } : condition
        )
      : [{ id: `condition-${Date.now()}`, ...normalized }, ...conditions];

    const success = await persistConditions(
      nextConditions,
      editingId ? 'Condition mise à jour avec succès.' : 'Nouvelle condition ajoutée.'
    );

    if (success) {
      setFormState({ title: '', description: '' });
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormState({ title: '', description: '' });
  };

  const handleRestoreDefaults = async () => {
    if (!isAdmin) {
      setStatusMessage('Seuls les administrateurs peuvent restaurer la version officielle.');
      return;
    }
    const defaultsWithIds = addLocalIds(defaultConditions);
    const success = await persistConditions(
      defaultsWithIds,
      'Conditions par défaut restaurées.'
    );
    if (success) {
      setEditingId(null);
      setFormState({ title: '', description: '' });
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            {companyName}
          </p>
          <h1 className="text-3xl font-extrabold text-gray-900">Aide et service client</h1>
          <p className="text-sm text-gray-600 max-w-2xl">
            Retrouvez les conditions d&apos;utilisation de la plateforme HDMarket, gérée par ETS HD
            Tech Filial, et mettez-les à jour facilement grâce au formulaire dédié.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-100 p-3 text-indigo-600">
                <Shield size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Conditions vérifiées</h2>
                <p className="text-sm text-gray-500">Politique de confiance et modération.</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              {companyHighlights.map((item) => (
                <li key={item.label}>
                  <span className="font-semibold">{item.label} :</span> {item.value}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Contactez-nous</h2>
            <div className="space-y-3 text-sm text-gray-700">
              <p className="flex items-center gap-2">
                <Mail size={16} className="text-indigo-600" />
                support@hdmarket.cg
              </p>
              <ContactPhoneDisplay />
              <p className="flex items-center gap-2">
                <MessageSquare size={16} className="text-emerald-600" />
                Assistance WhatsApp disponible 7j/7
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Retourner aux annonces
            </Link>
          </article>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText size={20} className="text-indigo-600" />
              Conditions d&apos;utilisation actuelles
            </h2>
            {isAdmin ? (
              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                disabled={saving}
              >
                <RefreshCcw size={14} />
                Restaurer la version officielle
              </button>
            ) : (
              <p className="text-xs font-medium text-gray-500">
                Lecture seule — modifiable par les administrateurs.
              </p>
            )}
          </div>
          <ul className="space-y-4">
            {loading ? (
              <li className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                Chargement des conditions…
              </li>
            ) : (
              conditions.map((condition) => (
                <li
                  key={condition.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold text-gray-900">{condition.title}</p>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => startEdit(condition)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        <Edit3 size={14} />
                        Modifier
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-gray-600">{condition.description}</p>
                </li>
              ))
            )}
          </ul>
        </section>

        {isAdmin && (
          <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
                <FileText size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Ajouter ou mettre à jour une condition
                </h2>
                <p className="text-sm text-gray-500">
                  Ce formulaire vous permet de garder les conditions à jour sans écrire de code.
                </p>
              </div>
            </div>

            {statusMessage && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <AlertCircle size={16} />
                {statusMessage}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">Titre</label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Ex: Politique de remboursement"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">Description</label>
                <textarea
                  value={formState.description}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Décrivez clairement la condition d'utilisation."
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  disabled={saving}
                >
                  <Save size={16} />
                  {saving ? 'Enregistrement…' : editingId ? 'Mettre à jour' : 'Ajouter la condition'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-sm font-semibold text-gray-600 hover:text-gray-800"
                    disabled={saving}
                  >
                    Annuler la modification
                  </button>
                )}
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
