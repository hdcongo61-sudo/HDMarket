import React, { useState } from 'react';
import api from '../services/api';
import { appConfirm } from '../utils/appDialog';

const money = value => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

export default function OrderCashCollection({ order, seller = false, onRecorded }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cash = Number(order?.cashCollectedAmount || 0);
  const canCollect = seller && order?.paymentType !== 'installment' && Number(order?.remainingAmount) > 0 &&
    !order?.disputeOpened && !order?.cancellationRefundRequired && !['pending', 'processed'].includes(order?.refundStatus) &&
    ['ready_for_pickup', 'delivering', 'out_for_delivery', 'delivery_proof_submitted', 'delivered', 'picked_up_confirmed', 'confirmed_by_client', 'completed'].includes(order?.status);
  if (!cash && !canCollect) return null;
  const record = async () => {
    if (saving || !await appConfirm(`Confirmez-vous avoir reçu ${money(order.remainingAmount)} en espèces pour cette commande ?`)) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post(`/orders/seller/${order._id}/cash-collection`, { amount: Number(order.remainingAmount), method: 'CASH' });
      onRecorded?.(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible d’enregistrer cet encaissement.');
    } finally { setSaving(false); }
  };
  return <div className="space-y-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-gray-800">
    {cash > 0 && <>
      <p>Espèces reçues : <strong>{money(cash)}</strong></p>
      <p>Total réglé : <strong>{money(Number(order.paidAmount || 0) + cash)}</strong></p>
      {(order.cashCollections || []).map((entry, index) => <p key={entry._id || index} className="text-xs text-gray-600">
        {money(entry.amount)} · espèces · {new Date(entry.collectedAt).toLocaleString('fr-FR')} · confirmé par le vendeur
      </p>)}
    </>}
    {canCollect && <button type="button" onClick={record} disabled={saving} className="hd-primary-button w-full rounded-xl px-3 py-2 font-semibold disabled:opacity-50">
      {saving ? 'Enregistrement…' : `Confirmer ${money(order.remainingAmount)} reçus en espèces`}
    </button>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
