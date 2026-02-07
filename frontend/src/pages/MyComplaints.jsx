import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  FileText,
  MessageCircle,
  Paperclip,
  User
} from 'lucide-react';

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '';

const STATUS_LABELS = {
  pending: 'En attente',
  in_review: 'En cours',
  resolved: 'Résolue'
};

const STATUS_STYLES = {
  pending: 'bg-orange-100 text-orange-700',
  in_review: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-700'
};

export default function MyComplaints() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const filesBase = React.useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    return apiBase.replace(/\/api\/?$/, '');
  }, []);

  const normalizeUrl = useCallback(
    (url) => {
      if (!url) return '';
      const cleaned = String(url).replace(/\\/g, '/');
      if (/^https?:\/\//i.test(cleaned)) return cleaned;
      return `${filesBase}/${cleaned.replace(/^\/+/, '')}`;
    },
    [filesBase]
  );

  const loadComplaints = useCallback(async () => {
    if (!user) {
      setComplaints([]);
      setListError('');
      return;
    }
    setLoading(true);
    setListError('');
    try {
      const { data } = await api.get('/users/complaints');
      const list = Array.isArray(data) ? data : [];
      setComplaints(
        list.map((c) => ({
          ...c,
          attachments: (Array.isArray(c.attachments) ? c.attachments : []).map((a) => ({
            ...a,
            url: normalizeUrl(a.path || a.url || '')
          }))
        }))
      );
    } catch (err) {
      setListError(
        err.response?.data?.message || err.message || 'Impossible de charger vos réclamations.'
      );
    } finally {
      setLoading(false);
    }
  }, [user, normalizeUrl]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  const onFilesChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    const remaining = Math.max(0, 2 - files.length);
    const added = selected.slice(0, remaining);
    setFiles((prev) => [...prev, ...added]);
    e.target.value = '';
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setSubmitError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');
    if (!message.trim()) {
      setSubmitError('Veuillez détailler votre réclamation.');
      return;
    }
    setSubmitLoading(true);
    try {
      const payload = new FormData();
      payload.append('subject', subject.trim());
      payload.append('message', message.trim());
      files.forEach((file) => payload.append('attachments', file));
      await api.post('/users/complaints', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSubmitSuccess('Votre réclamation a bien été envoyée.');
      setSubject('');
      setMessage('');
      setFiles([]);
      showToast('Réclamation envoyée', { variant: 'success' });
      await loadComplaints();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Une erreur est survenue.';
      setSubmitError(msg);
      showToast(msg, { variant: 'error' });
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
            <div className="w-2 h-6 bg-rose-600 rounded-full" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Réclamations</h1>
              <p className="text-sm text-gray-500">
                Signalez un problème ou partagez une capture d’écran : vous pouvez joindre deux fichiers.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <FileText className="w-4 h-4 text-rose-500" />
                Objet (facultatif)
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                placeholder="Ex : Annonce non conforme"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setSubmitError(''); }}
                disabled={submitLoading}
                maxLength={150}
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <MessageCircle className="w-4 h-4 text-rose-500" />
                Description *
              </label>
              <textarea
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-rose-500 focus:border-transparent placeholder-gray-400"
                rows={4}
                value={message}
                onChange={(e) => { setMessage(e.target.value); setSubmitError(''); }}
                placeholder="Expliquez en détail votre problème."
                disabled={submitLoading}
                required
                maxLength={1500}
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Paperclip className="w-4 h-4 text-rose-500" />
                Fichiers (max 2)
              </label>
              <label className="flex items-center justify-between rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600 hover:border-rose-300 hover:bg-rose-50 cursor-pointer">
                <span>Ajouter un fichier</span>
                <span className="text-[11px] text-gray-400">PNG, JPG, PDF</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={onFilesChange}
                  disabled={submitLoading}
                />
              </label>
            </div>
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600"
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      disabled={submitLoading}
                      className="text-xs font-semibold text-red-600 hover:text-red-500"
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            )}
            {(submitError || submitSuccess) && (
              <div
                className={`flex items-center gap-2 text-sm ${
                  submitError ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {submitError ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                <span>{submitError || submitSuccess}</span>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
              >
                {submitLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Envoi...
                  </span>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    Envoyer la réclamation
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vos réclamations</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : listError ? (
            <p className="text-sm text-red-600">{listError}</p>
          ) : complaints.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune réclamation pour le moment.</p>
          ) : (
            <ul className="space-y-3">
              {complaints.map((complaint) => (
                <li
                  key={complaint._id}
                  className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{complaint.subject || 'Sans objet'}</p>
                      <p className="text-[11px] text-gray-500">{formatDate(complaint.createdAt)}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold shrink-0 ${
                        STATUS_STYLES[complaint.status] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {STATUS_LABELS[complaint.status] || complaint.status}
                    </span>
                  </div>
                  <p className="mt-2 text-gray-600 whitespace-pre-line break-words">{complaint.message}</p>
                  {complaint.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {complaint.attachments
                        .filter((a) => a.url)
                        .map((a, idx) => (
                          <a
                            key={idx}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:border-rose-200"
                          >
                            <Paperclip className="w-3 h-3" />
                            {a.originalName || a.filename || 'Pièce jointe'}
                          </a>
                        ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
