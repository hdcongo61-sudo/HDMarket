import React, { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import api from '../services/api';

export default function AdminChatTemplates() {
  const [templates, setTemplates] = useState([]);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState('');
  const [editingResponse, setEditingResponse] = useState('');

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/chat/templates');
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Templates load error:', err);
      setError('Impossible de charger les modèles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleAddTemplate = async (event) => {
    event.preventDefault();
    if (!question.trim() || !response.trim()) {
      setError('Question et réponse requises.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/chat/templates', {
        question: question.trim(),
        response: response.trim()
      });
      setQuestion('');
      setResponse('');
      setError('');
      await loadTemplates();
    } catch (err) {
      console.error('Template save error:', err);
      setError(err.response?.data?.message || 'Impossible de créer le modèle.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditStart = (template) => {
    setEditingId(template._id);
    setEditingQuestion(template.question);
    setEditingResponse(template.response);
    setError('');
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editingQuestion.trim() || !editingResponse.trim()) {
      setError('Question et réponse requises.');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/chat/templates/${editingId}`, {
        question: editingQuestion.trim(),
        response: editingResponse.trim()
      });
      setEditingId(null);
      setEditingQuestion('');
      setEditingResponse('');
      await loadTemplates();
    } catch (err) {
      console.error('Template edit error:', err);
      setError(err.response?.data?.message || 'Impossible de mettre à jour.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/chat/templates/${id}`);
      await loadTemplates();
    } catch (err) {
      console.error('Template delete error:', err);
      setError('Impossible de supprimer le modèle.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4">
      <header className="space-y-3 rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-indigo-600" />
          Gestion des modèles de chat
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ajoutez des questions et réponses standards pour guider le support en conversation.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
        <form className="space-y-4" onSubmit={handleAddTemplate}>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Question
            </label>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
              placeholder="Exemple : Quels sont vos délais de livraison ?"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Réponse
            </label>
            <textarea
              rows={3}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
              placeholder="Réponse par défaut du support."
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? 'Enregistrement...' : 'Créer le modèle'}
          </button>
        </form>
      </section>

      {editingId && (
        <section className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm dark:border-yellow-700 dark:bg-yellow-900/80">
          <h3 className="text-base font-semibold text-yellow-800 dark:text-yellow-200">Modifier le modèle</h3>
          <form className="mt-3 space-y-3" onSubmit={handleEditSubmit}>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Question
              </label>
              <input
                value={editingQuestion}
                onChange={(event) => setEditingQuestion(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Réponse
              </label>
              <textarea
                rows={3}
                value={editingResponse}
                onChange={(event) => setEditingResponse(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
            <div className="flex gap-2">
              <button
                className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setEditingQuestion('');
                  setEditingResponse('');
                  setError('');
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-200"
              >
                Annuler
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Modèles existants</h2>
        {loading ? (
          <p className="mt-4 text-sm text-gray-500">Chargement...</p>
        ) : templates.length ? (
          <div className="mt-4 space-y-3">
            {templates.map((template) => (
              <div
                key={template._id}
                className="rounded-2xl border border-gray-100 p-4 text-sm text-gray-800 dark:border-gray-700 dark:text-gray-100"
              >
                <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-indigo-500" />
                  {template.question}
                </p>
                <p className="mt-2 text-gray-600 dark:text-gray-300">{template.response}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditStart(template)}
                    className="rounded-full border border-indigo-200 px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-50 dark:border-gray-700 dark:text-indigo-200"
                  >
                    Éditer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(template._id)}
                    className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-gray-700 dark:text-red-400"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">Aucun modèle renseigné pour le moment.</p>
        )}
      </section>
    </div>
  );
}
