import React, { useContext, useEffect, useState } from 'react';
import { MessageCircleQuestion, ThumbsUp, BadgeCheck, Store } from 'lucide-react';
import api, { getApiErrorMessage } from '../services/api';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * ProductQuestionsSection — "Questions & Réponses" tab on the PDP.
 * Any buyer can ask; sellers and verified buyers can answer, and their
 * answers are flagged/sorted first so the most trustworthy reply surfaces.
 */
export default function ProductQuestionsSection({ productId, onCountChange }) {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [questionDraft, setQuestionDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [answeringId, setAnsweringId] = useState('');
  const [openAnswerId, setOpenAnswerId] = useState('');

  const loadQuestions = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/product-questions/product/${productId}`);
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
      onCountChange?.(data?.total ?? list.length);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleAsk = async () => {
    const text = questionDraft.trim();
    if (text.length < 3 || asking) return;
    setAsking(true);
    try {
      await api.post('/product-questions', { productId, question: text });
      setQuestionDraft('');
      showToast('Question envoyée au vendeur.', { variant: 'success' });
      await loadQuestions();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Impossible d’envoyer la question.'), { variant: 'error' });
    } finally {
      setAsking(false);
    }
  };

  const handleAnswer = async (questionId) => {
    const text = String(answerDrafts[questionId] || '').trim();
    if (!text || answeringId) return;
    setAnsweringId(questionId);
    try {
      await api.post(`/product-questions/${questionId}/answers`, { text });
      setAnswerDrafts((prev) => ({ ...prev, [questionId]: '' }));
      setOpenAnswerId('');
      await loadQuestions();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Impossible d’envoyer la réponse.'), { variant: 'error' });
    } finally {
      setAnsweringId('');
    }
  };

  const handleUpvote = async (questionId) => {
    if (!user) return;
    try {
      await api.post(`/product-questions/${questionId}/upvote`);
      await loadQuestions();
    } catch {
      // Non-critical — silently ignore.
    }
  };

  return (
    <div className="space-y-4">
      {user ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
          <textarea
            value={questionDraft}
            onChange={(event) => setQuestionDraft(event.target.value)}
            placeholder="Posez une question sur ce produit (taille, matière, garantie...)"
            rows={2}
            maxLength={500}
            className="w-full resize-none rounded-lg border border-gray-200 bg-white p-2.5 text-sm text-gray-800 outline-none focus:border-[#e85d00]"
          />
          <button
            type="button"
            onClick={handleAsk}
            disabled={asking || questionDraft.trim().length < 3}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#e85d00] px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {asking ? 'Envoi…' : 'Poser la question'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Connectez-vous pour poser une question.</p>
      )}

      {loading && <p className="py-4 text-center text-xs text-gray-400">Chargement…</p>}

      {!loading && items.length === 0 && (
        <p className="py-4 text-center text-xs text-gray-400">
          Aucune question pour ce produit. Soyez le premier à demander !
        </p>
      )}

      {!loading &&
        items.map((qa) => {
          const sortedAnswers = [...(qa.answers || [])].sort((a, b) => {
            const rank = (entry) => (entry.isSeller ? 2 : entry.isVerifiedBuyer ? 1 : 0);
            return rank(b) - rank(a);
          });
          const upvoted = user ? (qa.upvotes || []).some((id) => String(id) === String(user._id || user.id)) : false;

          return (
            <div key={qa._id} className="rounded-xl border border-gray-100 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <MessageCircleQuestion size={16} className="mt-0.5 shrink-0 text-[#e85d00]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{qa.question}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {qa.askedBy?.name || 'Utilisateur'} · {new Date(qa.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpvote(qa._id)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${
                    upvoted ? 'border-[#e85d00] bg-[#fff0e4] text-[#e85d00]' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  <ThumbsUp size={11} />
                  {qa.upvotes?.length || 0}
                </button>
              </div>

              {sortedAnswers.map((answer, index) => (
                <div key={index} className="ml-6 rounded-lg bg-gray-50 p-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                    {answer.isSeller ? (
                      <span className="inline-flex items-center gap-1 text-[#e85d00]">
                        <Store size={11} /> Vendeur
                      </span>
                    ) : answer.isVerifiedBuyer ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <BadgeCheck size={11} /> Acheteur vérifié
                      </span>
                    ) : (
                      <span>{answer.userId?.name || 'Utilisateur'}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{answer.text}</p>
                </div>
              ))}

              {user && (
                <div className="ml-6">
                  {openAnswerId === qa._id ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={answerDrafts[qa._id] || ''}
                        onChange={(event) =>
                          setAnswerDrafts((prev) => ({ ...prev, [qa._id]: event.target.value }))
                        }
                        rows={2}
                        maxLength={1000}
                        placeholder="Votre réponse…"
                        className="w-full resize-none rounded-lg border border-gray-200 p-2 text-xs text-gray-800 outline-none focus:border-[#e85d00]"
                      />
                      <button
                        type="button"
                        onClick={() => handleAnswer(qa._id)}
                        disabled={answeringId === qa._id || !String(answerDrafts[qa._id] || '').trim()}
                        className="inline-flex min-h-8 items-center justify-center rounded-full bg-neutral-950 px-3 text-[11px] font-black text-white disabled:opacity-50"
                      >
                        {answeringId === qa._id ? 'Envoi…' : 'Répondre'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenAnswerId(qa._id)}
                      className="text-[11px] font-bold text-[#e85d00]"
                    >
                      Répondre
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
