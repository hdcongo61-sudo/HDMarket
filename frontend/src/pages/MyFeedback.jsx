import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  MessageCircle,
  User,
  X
} from 'lucide-react';

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '';

export default function MyFeedback() {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, remaining: 5 });
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [modalItem, setModalItem] = useState(null);

  const loadFeedback = useCallback(async () => {
    if (!user) {
      setItems([]);
      setStats({ total: 0, remaining: 5 });
      setListError('');
      return;
    }
    setListLoading(true);
    setListError('');
    try {
      const { data } = await api.get('/users/feedback');
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
      setStats({
        total: Number(data?.total ?? list.length ?? 0),
        remaining: Number.isFinite(Number(data?.remaining))
          ? Number(data.remaining)
          : Math.max(0, 5 - Number(data?.total ?? list.length ?? 0))
      });
    } catch (err) {
      setItems([]);
      setStats({ total: 0, remaining: 5 });
      setListError(
        err.response?.data?.message || err.message || 'Impossible de charger vos avis.'
      );
    } finally {
      setListLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');
    if (!subject.trim()) {
      setSubmitError('Veuillez renseigner un sujet.');
      return;
    }
    if (!body.trim()) {
      setSubmitError('Veuillez détailler votre avis.');
      return;
    }
    if (stats.remaining <= 0) {
      setSubmitError('Vous avez atteint la limite de 5 avis.');
      return;
    }
    setSubmitLoading(true);
    try {
      const { data } = await api.post('/users/feedback', {
        subject: subject.trim(),
        body: body.trim()
      });
      setSubmitSuccess('Merci ! Votre avis a été envoyé.');
      setSubject('');
      setBody('');
      if (data?.feedback) {
        setItems((prev) => [data.feedback, ...prev].slice(0, 5));
      }
      if (typeof data?.remaining === 'number') {
        setStats((prev) => ({ total: prev.total + 1, remaining: data.remaining }));
      } else {
        await loadFeedback();
      }
    } catch (err) {
      setSubmitError(
        err.response?.data?.message || err.message || 'Impossible d’envoyer votre avis.'
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-500">Vous devez être connecté pour accéder à cette page.</p>
          <Link
            to="/login"
            className="mt-4 inline-flex items-center gap-2 text-indigo-600 font-medium"
          >
            <ArrowLeft size={16} />
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-indigo-600 mb-6"
        >
          <ArrowLeft size={18} />
          Retour au profil
        </Link>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-6">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 mb-4">
            <div className="w-2 h-6 bg-emerald-600 rounded-full" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Avis sur l’amélioration</h1>
              <p className="text-sm text-gray-500">
                Partagez vos idées pour améliorer HDMarket. Limité à 5 avis par utilisateur.
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-gray-500">Vos avis envoyés</p>
              <span className="text-xs font-semibold text-gray-500">{stats.total} / 5</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <FileText className="w-4 h-4 text-emerald-500" />
                Sujet *
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Ex : Nouvelle fonctionnalité"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setSubmitError(''); setSubmitSuccess(''); }}
                maxLength={150}
                disabled={submitLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                Votre avis *
              </label>
              <textarea
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-gray-400"
                rows={4}
                value={body}
                onChange={(e) => { setBody(e.target.value); setSubmitError(''); setSubmitSuccess(''); }}
                placeholder="Expliquez votre idée ou votre suggestion."
                disabled={submitLoading}
                maxLength={2000}
                required
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
              <span>
                {stats.remaining > 0
                  ? `Il vous reste ${stats.remaining} avis sur 5.`
                  : 'Limite atteinte : 5 avis envoyés.'}
              </span>
              <span>{stats.total} envoyé{stats.total > 1 ? 's' : ''}</span>
            </div>
            {(submitError || submitSuccess) && (
              <div
                className={`flex items-center gap-2 text-sm ${
                  submitError ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {submitError ? (
                  <span>{submitError}</span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>{submitSuccess}</span>
                  </>
                )}
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitLoading || stats.remaining <= 0}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Envoi...
                  </span>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4" />
                    Envoyer l’avis
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vos avis envoyés</h2>
          {listLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-gray-100 bg-gray-50 p-4"
                >
                  <div className="h-4 w-1/2 rounded bg-gray-200" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : listError ? (
            <p className="text-sm text-red-600">{listError}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun avis envoyé pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const isRead = Boolean(item.readAt);
                return (
                  <button
                    type="button"
                    key={item._id}
                    onClick={() => setModalItem(item)}
                    className="w-full text-left rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 shadow-sm hover:border-emerald-200 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.subject}</p>
                        <p className="text-xs text-gray-500">{formatDate(item.createdAt)}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold shrink-0 ${
                          isRead ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {isRead ? 'Lu' : 'Non lu'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 line-clamp-2">{item.body}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setModalItem(null)}
            aria-hidden
          />
          <div
            className="relative w-full max-w-lg rounded-3xl bg-white shadow-xl border border-gray-100 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Avis sur l’amélioration</p>
                <h3 className="text-lg font-semibold text-gray-900">{modalItem.subject}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalItem(null)}
                className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{formatDate(modalItem.createdAt)}</span>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                    modalItem.readAt ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {modalItem.readAt ? 'Lu' : 'Non lu'}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-line">{modalItem.body}</p>
              {modalItem.readAt && (
                <p className="text-xs text-gray-500">Lu le {formatDate(modalItem.readAt)}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
