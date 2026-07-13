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
      <div className="hd-products-flow flex min-h-screen items-center justify-center bg-[#f6f2ec] px-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-[#e85d00]">
            <User className="h-8 w-8" />
          </div>
          <p className="text-sm font-semibold text-gray-600">Vous devez être connecté pour accéder à cette page.</p>
          <Link
            to="/login"
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#e85d00] px-5 text-sm font-black text-white"
          >
            <ArrowLeft size={16} />
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="hd-products-flow min-h-screen bg-[#f6f2ec] text-gray-900">
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 pb-24 sm:px-5 sm:py-6">
        <Link
          to="/profile"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-black text-gray-500 shadow-sm transition active:scale-95"
        >
          <ArrowLeft size={18} />
          Retour au profil
        </Link>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
          <div className="hd-products-hero p-5 text-white sm:p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-1.5 ring-1 ring-white/20">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-wide">Voix utilisateur</span>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Avis sur l’amélioration</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/86">
                Partagez vos idées pour améliorer HDMarket. Limité à 5 avis par utilisateur.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-sm">
              <div className="rounded-2xl bg-white/14 p-3 ring-1 ring-white/18">
                <p className="text-[11px] font-black uppercase tracking-wide text-white/70">Envoyés</p>
                <p className="mt-1 text-xl font-black text-white">{stats.total}/5</p>
              </div>
              <div className="rounded-2xl bg-white/14 p-3 ring-1 ring-white/18">
                <p className="text-[11px] font-black uppercase tracking-wide text-white/70">Restants</p>
                <p className="mt-1 text-xl font-black text-white">{stats.remaining}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-black text-gray-800">
                <FileText className="h-4 w-4 text-[#e85d00]" />
                Sujet *
              </label>
              <input
                type="text"
                className="min-h-[52px] w-full rounded-xl border border-gray-200 bg-gray-100/35 px-4 text-sm font-semibold outline-none transition focus:border-[#e85d00] focus:bg-white focus:ring-4 focus:ring-gray-200"
                placeholder="Ex : Nouvelle fonctionnalité"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setSubmitError(''); setSubmitSuccess(''); }}
                maxLength={150}
                disabled={submitLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-black text-gray-800">
                <MessageCircle className="h-4 w-4 text-[#e85d00]" />
                Votre avis *
              </label>
              <textarea
                className="w-full rounded-xl border border-gray-200 bg-gray-100/35 px-4 py-3 text-sm font-semibold outline-none transition placeholder:text-gray-400 focus:border-[#e85d00] focus:bg-white focus:ring-4 focus:ring-gray-200"
                rows={4}
                value={body}
                onChange={(e) => { setBody(e.target.value); setSubmitError(''); setSubmitSuccess(''); }}
                placeholder="Expliquez votre idée ou votre suggestion."
                disabled={submitLoading}
                maxLength={2000}
                required
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-gray-500">
              <span>
                {stats.remaining > 0
                  ? `Il vous reste ${stats.remaining} avis sur 5.`
                  : 'Limite atteinte : 5 avis envoyés.'}
              </span>
              <span>{stats.total} envoyé{stats.total > 1 ? 's' : ''}</span>
            </div>
            {(submitError || submitSuccess) && (
              <div
                className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                  submitError ? 'bg-red-50 text-red-700 ring-1 ring-red-100' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
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
                className="hd-primary-button inline-flex min-h-[50px] items-center gap-2 rounded-full px-6 text-sm font-black disabled:opacity-60"
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

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_14px_34px_rgba(117,75,36,0.08)] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#e85d00]">Historique</p>
              <h2 className="mt-1 text-xl font-black text-gray-900">Vos avis envoyés</h2>
            </div>
          </div>
          {listLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-gray-200 bg-gray-100/35 p-4"
                >
                  <div className="h-4 w-1/2 rounded-full bg-orange-100" />
                  <div className="mt-2 h-3 w-3/4 rounded-full bg-gray-100" />
                </div>
              ))}
            </div>
          ) : listError ? (
            <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 ring-1 ring-red-100">{listError}</p>
          ) : items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-100/35 p-5 text-sm font-semibold text-gray-500">Aucun avis envoyé pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const isRead = Boolean(item.readAt);
                return (
                  <button
                    type="button"
                    key={item._id}
                    onClick={() => setModalItem(item)}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-100/30 px-4 py-3 text-left shadow-sm transition hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-gray-900">{item.subject}</p>
                        <p className="text-xs font-semibold text-gray-500">{formatDate(item.createdAt)}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold shrink-0 ${
                          isRead ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                        }`}
                      >
                        {isRead ? 'Lu' : 'Non lu'}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-gray-600">{item.body}</p>
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
        panelClassName="hd-products-flow"
      >
        {modalItem ? (
          <>
            <ModalHeader
              title={modalItem.subject}
              subtitle="Avis sur l’amélioration"
              onClose={() => setModalItem(null)}
            />
            <ModalBody className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                <span>{formatDate(modalItem.createdAt)}</span>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                    modalItem.readAt ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                  }`}
                >
                  {modalItem.readAt ? 'Lu' : 'Non lu'}
                </span>
              </div>
              <p className="whitespace-pre-line text-sm font-semibold leading-6 text-gray-700">{modalItem.body}</p>
              {modalItem.readAt ? (
                <p className="text-xs font-semibold text-gray-500">Lu le {formatDate(modalItem.readAt)}</p>
              ) : null}
            </ModalBody>
          </>
        ) : null}
      </BaseModal>
    </div>
  );
}
