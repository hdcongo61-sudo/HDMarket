import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  MessageCircle,
  Send,
  User
} from 'lucide-react';
import BaseModal, { ModalBody, ModalHeader } from '../components/modals/BaseModal';

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
          <div className="w-16 h-16 bg-neutral-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-500">Vous devez être connecté pour accéder à cette page.</p>
          <Link
            to="/login"
            className="mt-4 inline-flex items-center gap-2 text-neutral-600 font-medium"
          >
            <ArrowLeft size={16} />
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-white">
      <div className="mx-auto max-w-4xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
        <Link
          to="/profile"
          className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white"
        >
          <ArrowLeft size={18} />
          Retour au profil
        </Link>

        <section className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:border-neutral-800 dark:bg-neutral-950">
          <div className="border-b border-neutral-200 p-5 dark:border-neutral-800 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">Voix utilisateur</p>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950 dark:text-white">Avis sur l’amélioration</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                Partagez vos idées pour améliorer HDMarket. Limité à 5 avis par utilisateur.
              </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-sm">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">Envoyés</p>
                <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{stats.total}/5</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">Restants</p>
                <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{stats.remaining}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-neutral-700 dark:text-neutral-200">
                <FileText className="w-4 h-4 text-neutral-500" />
                Sujet *
              </label>
              <input
                type="text"
                className="min-h-[48px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none transition focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                placeholder="Ex : Nouvelle fonctionnalité"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setSubmitError(''); setSubmitSuccess(''); }}
                maxLength={150}
                disabled={submitLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-neutral-700 dark:text-neutral-200">
                <MessageCircle className="w-4 h-4 text-neutral-500" />
                Votre avis *
              </label>
              <textarea
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                rows={4}
                value={body}
                onChange={(e) => { setBody(e.target.value); setSubmitError(''); setSubmitSuccess(''); }}
                placeholder="Expliquez votre idée ou votre suggestion."
                disabled={submitLoading}
                maxLength={2000}
                required
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
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
                  submitError ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'
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
                className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-neutral-950 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                {submitLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Envoi...
                  </span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Envoyer l’avis
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-6">
          <h2 className="mb-4 text-lg font-bold text-neutral-950 dark:text-white">Vos avis envoyés</h2>
          {listLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="h-4 w-1/2 rounded bg-gray-200" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : listError ? (
            <p className="text-sm text-red-600 dark:text-red-300">{listError}</p>
          ) : items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">Aucun avis envoyé pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const isRead = Boolean(item.readAt);
                return (
                  <button
                    type="button"
                    key={item._id}
                    onClick={() => setModalItem(item)}
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left shadow-sm transition hover:border-neutral-300 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-950"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-neutral-950 dark:text-white">{item.subject}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{formatDate(item.createdAt)}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold shrink-0 ${
                          isRead ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                        }`}
                      >
                        {isRead ? 'Lu' : 'Non lu'}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-300">{item.body}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <BaseModal
        isOpen={Boolean(modalItem)}
        onClose={() => setModalItem(null)}
        size="md"
        mobileSheet
        ariaLabel="Détail avis"
      >
        {modalItem ? (
          <>
            <ModalHeader
              title={modalItem.subject}
              subtitle="Avis sur l’amélioration"
              onClose={() => setModalItem(null)}
            />
            <ModalBody className="space-y-3">
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
              <p className="whitespace-pre-line text-sm text-gray-700">{modalItem.body}</p>
              {modalItem.readAt ? (
                <p className="text-xs text-gray-500">Lu le {formatDate(modalItem.readAt)}</p>
              ) : null}
            </ModalBody>
          </>
        ) : null}
      </BaseModal>
    </div>
  );
}
