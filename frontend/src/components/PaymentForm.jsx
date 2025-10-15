import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

export default function PaymentForm({ product, onSubmitted }) {
  const expected = useMemo(() => Math.round(product.price * 0.03 * 100) / 100, [product.price]);
  const [form, setForm] = useState({
    payerName: '',
    operator: 'MTN',
    transactionNumber: '',
    amount: expected
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => setForm((f) => ({ ...f, amount: expected })), [expected]);

  const paymentStatus = product.payment?.status || null;
  const hasPayment = Boolean(product.payment);

  const submit = async (e) => {
    e.preventDefault();
    if (hasPayment) return;

    setLoading(true);
    try {
      await api.post('/payments', { ...form, productId: product._id });
      alert('Paiement soumis. En attente de vérification.');
      if (onSubmitted) await onSubmitted();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  if (hasPayment) {
    const statusCopy = {
      waiting: {
        title: 'Paiement reçu',
        description:
          "Votre paiement est en attente de validation par l’administrateur. Votre annonce sera publiée dès approbation.",
        tone: 'bg-yellow-100 text-yellow-800 border-yellow-200'
      },
      verified: {
        title: 'Annonce validée',
        description:
          "Votre paiement a été vérifié et l’annonce est désormais visible par les acheteurs.",
        tone: 'bg-green-100 text-green-800 border-green-200'
      },
      rejected: {
        title: 'Paiement rejeté',
        description:
          "Votre paiement a été rejeté. Veuillez contacter l’équipe support pour plus de détails ou mettre à jour votre annonce.",
        tone: 'bg-red-100 text-red-800 border-red-200'
      }
    }[paymentStatus || product.status] || {
      title: 'Paiement enregistré',
      description: "Statut en cours de mise à jour.",
      tone: 'bg-gray-100 text-gray-700 border-gray-200'
    };

    return (
      <div className="border rounded p-3 space-y-2">
        <div className={`border rounded p-3 ${statusCopy.tone}`}>
          <h4 className="font-semibold">{statusCopy.title}</h4>
          <p className="text-sm">{statusCopy.description}</p>
        </div>
        <p className="text-xs text-gray-500">
          Montant attendu : {expected} FCFA • Statut actuel : {product.status}
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded p-3">
      <h4 className="font-semibold mb-2">
        Paiement de validation (3%) — attendu: {expected} FCFA
      </h4>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="border p-2"
          placeholder="Nom du payeur"
          value={form.payerName}
          onChange={(e) => setForm({ ...form, payerName: e.target.value })}
          disabled={loading}
          required
        />
        <select
          className="border p-2"
          value={form.operator}
          onChange={(e) => setForm({ ...form, operator: e.target.value })}
          disabled={loading}
        >
          <option>MTN</option>
          <option>Airtel</option>
          <option>Orange</option>
          <option>Moov</option>
          <option>Other</option>
        </select>
        <input
          className="border p-2"
          placeholder="Numéro de transaction"
          value={form.transactionNumber}
          onChange={(e) => setForm({ ...form, transactionNumber: e.target.value })}
          disabled={loading}
          required
        />
        <input
          type="number"
          className="border p-2 bg-gray-100"
          placeholder="Montant (FCFA)"
          value={expected}
          disabled
        />
        <button disabled={loading} className="md:col-span-2 bg-indigo-600 text-white px-4 py-2 rounded">
          {loading ? 'Envoi...' : 'Soumettre le paiement'}
        </button>
      </form>
    </div>
  );
}
