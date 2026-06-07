/**
 * Wallet Service — In-App Digital Wallet & Balance
 * Proposal 6 of HDMarket Taobao-Inspired Improvements
 *
 * Flow:
 *  1. User sends Mobile Money → provides transaction code
 *  2. Admin verifies → deposit credited
 *  3. User spends from wallet during checkout
 *  4. Refunds go back to wallet
 *  5. Sellers withdraw earnings
 *  6. Platform deducts commission from seller wallets
 */

import Wallet from '../models/walletModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';

// ─── HELPERS ──────────────────────────────────────────────

export const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = await Wallet.create({
      user: userId,
      balance: 0,
      frozenBalance: 0,
      currency: 'XAF',
      transactions: []
    });
  }
  return wallet;
};

const formatXAF = (amount) =>
  `${Number(amount || 0).toLocaleString('fr-FR')} FCFA`;

// ─── CORE OPERATIONS ──────────────────────────────────────

/**
 * Deposit — User sends Mobile Money, admin verifies and credits wallet.
 */
export const deposit = async ({ userId, amount, reference = '', processedBy = null, note = '' }) => {
  if (!amount || amount <= 0) throw new Error('Le montant doit être supérieur à 0');

  const wallet = await getOrCreateWallet(userId);
  const balanceBefore = wallet.balance;

  wallet.balance += amount;
  wallet.transactions.push({
    type: 'deposit',
    amount,
    balanceBefore,
    balanceAfter: wallet.balance,
    reference,
    status: 'completed',
    processedBy,
    processedAt: new Date(),
    note: note || 'Dépôt Mobile Money vérifié',
    metadata: { reference }
  });

  await wallet.save();

  // Notify user
  await createNotification({
    userId,
    actorId: processedBy || userId,
    type: 'payment_validated',
    allowSelf: true,
    priority: 'HIGH',
    pushEnabled: true,
    metadata: {
      amount,
      message: `Votre portefeuille a été crédité de ${formatXAF(amount)}.`,
      walletBalance: wallet.balance
    },
    entityType: 'payment',
    entityId: String(wallet.transactions[wallet.transactions.length - 1]._id),
    deepLink: '/wallet'
  });

  return { balance: wallet.balance, availableBalance: wallet.availableBalance };
};

/**
 * Withdrawal — Seller requests payout to Mobile Money.
 */
export const requestWithdrawal = async ({ userId, amount, reference = '' }) => {
  if (!amount || amount <= 0) throw new Error('Le montant doit être supérieur à 0');

  const wallet = await getOrCreateWallet(userId);
  if (wallet.availableBalance < amount) {
    throw new Error(`Solde insuffisant. Disponible: ${formatXAF(wallet.availableBalance)}`);
  }

  const balanceBefore = wallet.balance;
  wallet.balance -= amount;
  wallet.transactions.push({
    type: 'withdrawal',
    amount,
    balanceBefore,
    balanceAfter: wallet.balance,
    reference,
    status: 'pending', // Admin must approve
    note: 'Demande de retrait vers Mobile Money',
    metadata: { reference }
  });

  await wallet.save();

  return {
    balance: wallet.balance,
    availableBalance: wallet.availableBalance,
    transactionId: wallet.transactions[wallet.transactions.length - 1]._id
  };
};

/**
 * Admin approves or rejects a withdrawal.
 */
export const processWithdrawal = async ({ walletId, transactionId, approved = true, processedBy = null, note = '' }) => {
  const wallet = await Wallet.findById(walletId);
  if (!wallet) throw new Error('Portefeuille introuvable');

  const txn = wallet.transactions.id(transactionId);
  if (!txn) throw new Error('Transaction introuvable');
  if (txn.type !== 'withdrawal') throw new Error('Cette transaction n\'est pas un retrait');
  if (txn.status !== 'pending') throw new Error('Cette transaction a déjà été traitée');

  if (!approved) {
    // Reject → refund back to balance
    wallet.balance += txn.amount;
    txn.status = 'failed';
    txn.note = note || 'Retrait refusé par l\'administration';
    txn.processedBy = processedBy;
    txn.processedAt = new Date();
    txn.balanceAfter = wallet.balance;

    await wallet.save();

    await createNotification({
      userId: wallet.user,
      actorId: processedBy || wallet.user,
      type: 'payment_validated',
      allowSelf: true,
      priority: 'HIGH',
      metadata: {
        amount: txn.amount,
        message: `Votre demande de retrait de ${formatXAF(txn.amount)} a été refusée. Le montant a été remboursé sur votre portefeuille.${note ? ` Motif: ${note}` : ''}`
      },
      entityType: 'payment',
      deepLink: '/wallet'
    });

    return { status: 'failed', balance: wallet.balance };
  }

  txn.status = 'completed';
  txn.processedBy = processedBy;
  txn.processedAt = new Date();
  txn.note = note || 'Retrait validé — fonds envoyés via Mobile Money';

  await wallet.save();

  await createNotification({
    userId: wallet.user,
    actorId: processedBy || wallet.user,
    type: 'payment_validated',
    allowSelf: true,
    priority: 'HIGH',
    metadata: {
      amount: txn.amount,
      message: `Votre retrait de ${formatXAF(txn.amount)} a été validé. Les fonds seront transférés sur votre compte Mobile Money.`
    },
    entityType: 'payment',
    deepLink: '/wallet'
  });

  return { status: 'completed', balance: wallet.balance };
};

/**
 * Purchase — Deduct from buyer wallet at checkout.
 */
export const purchaseFromWallet = async ({ userId, amount, orderId = '', reference = '' }) => {
  if (!amount || amount <= 0) throw new Error('Le montant doit être supérieur à 0');

  const wallet = await getOrCreateWallet(userId);
  if (wallet.availableBalance < amount) {
    throw new Error(`Solde insuffisant. Disponible: ${formatXAF(wallet.availableBalance)}, requis: ${formatXAF(amount)}`);
  }

  const balanceBefore = wallet.balance;
  wallet.balance -= amount;
  wallet.transactions.push({
    type: 'purchase',
    amount,
    balanceBefore,
    balanceAfter: wallet.balance,
    reference,
    status: 'completed',
    processedAt: new Date(),
    note: `Achat — commande ${orderId || reference}`,
    metadata: { orderId, reference }
  });

  await wallet.save();

  return { balance: wallet.balance, availableBalance: wallet.availableBalance };
};

/**
 * Refund — Credit back to buyer wallet (from dispute resolution or cancellation).
 */
export const refundToWallet = async ({ userId, amount, orderId = '', processedBy = null, note = '' }) => {
  if (!amount || amount <= 0) throw new Error('Le montant doit être supérieur à 0');

  const wallet = await getOrCreateWallet(userId);
  const balanceBefore = wallet.balance;

  wallet.balance += amount;
  wallet.transactions.push({
    type: 'refund',
    amount,
    balanceBefore,
    balanceAfter: wallet.balance,
    reference: orderId,
    status: 'completed',
    processedBy,
    processedAt: new Date(),
    note: note || `Remboursement — commande ${orderId}`,
    metadata: { orderId }
  });

  await wallet.save();

  await createNotification({
    userId,
    actorId: processedBy || userId,
    type: 'payment_validated',
    allowSelf: true,
    priority: 'HIGH',
    pushEnabled: true,
    metadata: {
      amount,
      message: `Un remboursement de ${formatXAF(amount)} a été crédité sur votre portefeuille.`
    },
    entityType: 'payment',
    deepLink: '/wallet'
  });

  return { balance: wallet.balance, availableBalance: wallet.availableBalance };
};

/**
 * Sale — Credit seller wallet after buyer pays with HDMarket wallet.
 */
export const creditSellerWalletSale = async ({ userId, amount, orderId = '', buyerId = '', reference = '' }) => {
  if (!amount || amount <= 0) throw new Error('Le montant doit être supérieur à 0');

  const wallet = await getOrCreateWallet(userId);
  const orderKey = String(orderId || '').trim();
  if (orderKey) {
    const alreadyCredited = (wallet.transactions || []).some(
      (txn) =>
        txn.type === 'sale' &&
        txn.status === 'completed' &&
        String(txn?.metadata?.orderId || txn.reference || '') === orderKey
    );
    if (alreadyCredited) {
      return { balance: wallet.balance, availableBalance: wallet.availableBalance, alreadyCredited: true };
    }
  }

  const balanceBefore = wallet.balance;
  wallet.balance += amount;
  wallet.transactions.push({
    type: 'sale',
    amount,
    balanceBefore,
    balanceAfter: wallet.balance,
    reference: orderKey || reference,
    status: 'completed',
    processedAt: new Date(),
    note: `Vente portefeuille HDMarket — commande ${orderKey || reference}`,
    metadata: { orderId: orderKey, buyerId, reference }
  });

  await wallet.save();

  await createNotification({
    userId,
    actorId: buyerId || userId,
    type: 'payment_validated',
    allowSelf: true,
    priority: 'HIGH',
    pushEnabled: true,
    metadata: {
      amount,
      message: `Votre portefeuille a été crédité de ${formatXAF(amount)} pour une commande payée via Portefeuille HDMarket.`,
      walletBalance: wallet.balance,
      orderId: orderKey
    },
    entityType: 'payment',
    entityId: orderKey || String(wallet.transactions[wallet.transactions.length - 1]._id),
    deepLink: orderKey ? `/seller/orders/${orderKey}` : '/wallet'
  });

  return { balance: wallet.balance, availableBalance: wallet.availableBalance, alreadyCredited: false };
};

/**
 * Commission — Platform deducts commission from seller wallet.
 */
export const deductCommission = async ({ userId, amount, orderId = '' }) => {
  if (!amount || amount <= 0) return null;

  const wallet = await getOrCreateWallet(userId);

  // If seller has no wallet balance, just record; don't go negative
  const deductAmount = Math.min(amount, wallet.balance);
  if (deductAmount <= 0) return null;

  const balanceBefore = wallet.balance;
  wallet.balance -= deductAmount;
  wallet.transactions.push({
    type: 'commission',
    amount: deductAmount,
    balanceBefore,
    balanceAfter: wallet.balance,
    reference: orderId,
    status: 'completed',
    processedAt: new Date(),
    note: `Commission plateforme — commande ${orderId}`,
    metadata: { orderId, fullAmount: amount }
  });

  await wallet.save();

  return { balance: wallet.balance, deducted: deductAmount };
};

// ─── QUERIES ──────────────────────────────────────────────

export const getWallet = async (userId) => {
  const wallet = await getOrCreateWallet(userId);
  return {
    _id: wallet._id,
    balance: wallet.balance,
    frozenBalance: wallet.frozenBalance,
    availableBalance: wallet.availableBalance,
    currency: wallet.currency,
    isActive: wallet.isActive,
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt
  };
};

export const getWalletTransactions = async (userId, { page = 1, limit = 20 } = {}) => {
  const wallet = await Wallet.findOne({ user: userId })
    .select('transactions')
    .lean();

  if (!wallet) return { items: [], total: 0, page, pages: 0 };

  const allTxns = (wallet.transactions || []).sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  const total = allTxns.length;
  const skip = (page - 1) * limit;
  const items = allTxns.slice(skip, skip + limit);

  return { items, total, page, pages: Math.ceil(total / limit) };
};

/**
 * Admin: List all pending withdrawals.
 */
export const getPendingWithdrawals = async ({ page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;

  const wallets = await Wallet.find({
    'transactions.type': 'withdrawal',
    'transactions.status': 'pending'
  })
    .select('user transactions')
    .populate('user', 'name phone email')
    .lean();

  const pendingTxns = [];
  for (const wallet of wallets) {
    for (const txn of wallet.transactions) {
      if (txn.type === 'withdrawal' && txn.status === 'pending') {
        pendingTxns.push({
          ...txn,
          walletId: wallet._id,
          userId: wallet.user?._id,
          userName: wallet.user?.name || '',
          userPhone: wallet.user?.phone || ''
        });
      }
    }
  }

  pendingTxns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = pendingTxns.length;
  const items = pendingTxns.slice(skip, skip + limit);

  return { items, total, page, pages: Math.ceil(total / limit) };
};

// ─── USER DEPOSIT REQUEST (with proof) ────────────────────

const PAYMENT_METHOD_LABELS = {
  orange_money: 'Orange Money',
  mtn_money: 'MTN Money',
  airtel_money: 'Airtel Money',
  bank_transfer: 'Virement bancaire',
  other: 'Autre'
};

/**
 * User submits a deposit request with proof of Mobile Money transfer.
 * Funds are NOT credited until an admin approves.
 */
export const submitDepositRequest = async ({
  userId,
  amount,
  reference = '',
  paymentMethod = 'other',
  proofUrls = []
}) => {
  if (!amount || amount <= 0) throw new Error('Le montant doit être supérieur à 0');

  const wallet = await getOrCreateWallet(userId);
  const balanceBefore = wallet.balance;

  wallet.transactions.push({
    type: 'deposit',
    amount,
    balanceBefore,
    balanceAfter: balanceBefore, // Balance unchanged until approved
    reference,
    status: 'pending',
    note: `Dépôt ${PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod} en attente de vérification`,
    metadata: {
      reference,
      paymentMethod,
      proofUrls,
      submittedAt: new Date().toISOString()
    }
  });

  await wallet.save();

  const lastTxn = wallet.transactions[wallet.transactions.length - 1];

  // Notify admins about the pending deposit
  const admins = await User.find({ role: { $in: ['admin', 'founder', 'manager'] } }).select('_id').lean();
  await Promise.all(admins.map((admin) =>
    createNotification({
      userId: admin._id,
      actorId: userId,
      type: 'payment_proof_submitted',
      allowSelf: false,
      priority: 'HIGH',
      pushEnabled: true,
      metadata: {
        amount,
        reference,
        paymentMethod,
        walletId: String(wallet._id),
        transactionId: String(lastTxn._id),
        proofUrls,
        message: `Nouveau dépôt ${PAYMENT_METHOD_LABELS[paymentMethod] || ''} de ${formatXAF(amount)} en attente.`
      },
      entityType: 'payment',
      entityId: String(lastTxn._id),
      deepLink: '/admin/payment-verification'
    }).catch(() => {})
  ));

  return {
    transactionId: lastTxn._id,
    status: 'pending',
    balance: wallet.balance,
    availableBalance: wallet.availableBalance
  };
};

/**
 * Get all pending deposit transactions across all wallets.
 */
export const getPendingDeposits = async ({ page = 1, limit = 20, status = 'pending' } = {}) => {
  const skip = (page - 1) * limit;
  const normalizedStatus = String(status || 'pending').trim().toLowerCase();
  const allowedStatuses = new Set(['pending', 'completed', 'failed', 'reversed']);
  const statusFilter = allowedStatuses.has(normalizedStatus) ? normalizedStatus : 'pending';

  const wallets = await Wallet.find({ 'transactions.type': 'deposit', 'transactions.status': statusFilter })
    .select('user transactions')
    .populate('user', 'name phone email')
    .lean();

  const pendingTxns = [];
  for (const wallet of wallets) {
    for (const txn of wallet.transactions) {
      if (txn.type === 'deposit' && txn.status === statusFilter) {
        pendingTxns.push({
          ...txn,
          walletId: wallet._id,
          userId: wallet.user?._id,
          userName: wallet.user?.name || '',
          userPhone: wallet.user?.phone || ''
        });
      }
    }
  }

  pendingTxns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = pendingTxns.length;
  const items = pendingTxns.slice(skip, skip + limit);

  return { items, total, page, pages: Math.ceil(total / limit) };
};

/**
 * Admin approves a pending deposit — credits the wallet.
 */
export const approveDeposit = async ({ walletId, transactionId, processedBy, note = '' }) => {
  const wallet = await Wallet.findById(walletId);
  if (!wallet) throw new Error('Portefeuille introuvable.');

  const txn = wallet.transactions.id(transactionId);
  if (!txn) throw new Error('Transaction introuvable.');
  if (txn.type !== 'deposit' || txn.status !== 'pending') {
    throw new Error('Cette transaction ne peut pas être approuvée.');
  }

  const balanceBefore = wallet.balance;
  wallet.balance += txn.amount;
  txn.balanceAfter = wallet.balance;
  txn.status = 'completed';
  txn.processedBy = processedBy;
  txn.processedAt = new Date();
  txn.note = note || 'Dépôt vérifié par l\'administrateur';

  await wallet.save();

  // Notify user
  await createNotification({
    userId: wallet.user,
    actorId: processedBy || wallet.user,
    type: 'payment_validated',
    allowSelf: true,
    priority: 'HIGH',
    pushEnabled: true,
    metadata: {
      amount: txn.amount,
      message: `Votre dépôt de ${formatXAF(txn.amount)} a été validé. Votre portefeuille a été crédité.`,
      walletBalance: wallet.balance
    },
    entityType: 'payment',
    entityId: String(transactionId),
    deepLink: '/wallet'
  });

  return { status: 'completed', balance: wallet.balance, availableBalance: wallet.availableBalance };
};

/**
 * Admin rejects a pending deposit — no balance change.
 */
export const rejectDeposit = async ({ walletId, transactionId, processedBy, note = '' }) => {
  const wallet = await Wallet.findById(walletId);
  if (!wallet) throw new Error('Portefeuille introuvable.');

  const txn = wallet.transactions.id(transactionId);
  if (!txn) throw new Error('Transaction introuvable.');
  if (txn.type !== 'deposit' || txn.status !== 'pending') {
    throw new Error('Cette transaction ne peut pas être refusée.');
  }

  txn.status = 'failed';
  txn.processedBy = processedBy;
  txn.processedAt = new Date();
  txn.note = note || 'Dépôt refusé par l\'administrateur';

  await wallet.save();

  // Notify user
  await createNotification({
    userId: wallet.user,
    actorId: processedBy || wallet.user,
    type: 'payment_validated',
    allowSelf: true,
    pushEnabled: true,
    metadata: {
      amount: txn.amount,
      message: `Votre demande de dépôt de ${formatXAF(txn.amount)} a été refusée.${note ? ` Motif: ${note}` : ''}`,
      walletBalance: wallet.balance
    },
    entityType: 'payment',
    entityId: String(transactionId),
    deepLink: '/wallet'
  });

  return { status: 'failed', balance: wallet.balance, availableBalance: wallet.availableBalance };
};
