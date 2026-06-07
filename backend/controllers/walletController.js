import asyncHandler from 'express-async-handler';
import {
  getWallet,
  getWalletTransactions,
  deposit,
  requestWithdrawal,
  processWithdrawal,
  getPendingWithdrawals,
  submitDepositRequest,
  getPendingDeposits,
  approveDeposit,
  rejectDeposit
} from '../services/walletService.js';
import { getRuntimeConfig } from '../services/configService.js';

// ─── MIDDLEWARE ───────────────────────────────────────────

const requireWalletEnabled = asyncHandler(async (req, res, next) => {
  const enabled = await getRuntimeConfig('enable_digital_wallet', { fallback: false });
  if (!enabled) {
    return res.status(403).json({ message: 'Le portefeuille numérique est désactivé.' });
  }
  next();
});

// ─── USER ENDPOINTS ───────────────────────────────────────

export const getMyWallet = asyncHandler(async (req, res) => {
  const wallet = await getWallet(req.user.id);
  res.json(wallet);
});

export const getMyTransactions = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const result = await getWalletTransactions(req.user.id, { page, limit });
  res.json(result);
});

export const requestMyWithdrawal = asyncHandler(async (req, res) => {
  const { amount, reference } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: 'Montant invalide.' });
  }

  const minPayout = await getRuntimeConfig('seller_min_payout', { fallback: 5000 });
  if (Number(amount) < minPayout) {
    return res.status(400).json({
      message: `Le montant minimum de retrait est de ${Number(minPayout).toLocaleString('fr-FR')} FCFA.`
    });
  }

  const result = await requestWithdrawal({
    userId: req.user.id,
    amount: Number(amount),
    reference: reference || ''
  });

  res.json({ message: 'Demande de retrait enregistrée. En attente de validation.', ...result });
});

// ─── USER DEPOSIT REQUEST (with proof) ────────────────────

export const requestMyDeposit = asyncHandler(async (req, res) => {
  const { amount, reference, paymentMethod } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: 'Montant invalide.' });
  }

  const allowedMethods = ['orange_money', 'mtn_money', 'airtel_money', 'bank_transfer', 'other'];
  const method = allowedMethods.includes(paymentMethod) ? paymentMethod : 'other';

  // Collect uploaded proof file(s) — multer.fields() returns { proof: [...] }
  const proofField = req.files?.proof || [];
  const proofUrls = Array.isArray(proofField)
    ? proofField.map((f) => f.path || f.location || '').filter(Boolean)
    : [];

  const result = await submitDepositRequest({
    userId: req.user.id,
    amount: Number(amount),
    reference: reference || '',
    paymentMethod: method,
    proofUrls
  });

  res.json({
    message: 'Demande de dépôt envoyée. En attente de vérification par un administrateur.',
    ...result
  });
});

// ─── ADMIN ENDPOINTS ──────────────────────────────────────

export const adminDeposit = asyncHandler(async (req, res) => {
  const { userId, amount, reference, note } = req.body;

  if (!userId || !amount || Number(amount) <= 0) {
    return res.status(400).json({ message: 'userId et amount requis.' });
  }

  const result = await deposit({
    userId,
    amount: Number(amount),
    reference: reference || '',
    processedBy: req.user.id,
    note: note || ''
  });

  res.json({ message: 'Dépôt effectué avec succès.', ...result });
});

export const adminGetPendingWithdrawals = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const result = await getPendingWithdrawals({ page, limit });
  res.json(result);
});

export const adminProcessWithdrawal = asyncHandler(async (req, res) => {
  const { walletId, transactionId, approved, note } = req.body;

  if (!walletId || !transactionId) {
    return res.status(400).json({ message: 'walletId et transactionId requis.' });
  }

  const result = await processWithdrawal({
    walletId,
    transactionId,
    approved: approved !== false,
    processedBy: req.user.id,
    note: note || ''
  });

  res.json({ message: approved !== false ? 'Retrait validé.' : 'Retrait refusé.', ...result });
});

export const adminGetUserWallet = asyncHandler(async (req, res) => {
  const wallet = await getWallet(req.params.userId);
  res.json(wallet);
});

// ─── ADMIN DEPOSIT APPROVAL ───────────────────────────────

export const adminGetPendingDeposits = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const status = String(req.query.status || 'pending').trim().toLowerCase();

  const result = await getPendingDeposits({ page, limit, status });
  res.json(result);
});

export const adminApproveDeposit = asyncHandler(async (req, res) => {
  const { walletId, transactionId, note } = req.body;

  if (!walletId || !transactionId) {
    return res.status(400).json({ message: 'walletId et transactionId requis.' });
  }

  const result = await approveDeposit({
    walletId,
    transactionId,
    processedBy: req.user.id,
    note: note || ''
  });

  res.json({ message: 'Dépôt validé avec succès.', ...result });
});

export const adminRejectDeposit = asyncHandler(async (req, res) => {
  const { walletId, transactionId, note } = req.body;

  if (!walletId || !transactionId) {
    return res.status(400).json({ message: 'walletId et transactionId requis.' });
  }

  const result = await rejectDeposit({
    walletId,
    transactionId,
    processedBy: req.user.id,
    note: note || ''
  });

  res.json({ message: 'Dépôt refusé.', ...result });
});

// ─── PUBLIC STATUS ────────────────────────────────────────

export const walletStatus = asyncHandler(async (req, res) => {
  const enabled = await getRuntimeConfig('enable_digital_wallet', { fallback: false });
  res.json({ enabled });
});

export { requireWalletEnabled };
