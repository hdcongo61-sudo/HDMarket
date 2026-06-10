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

export const getOrCreateWallet = async (userId, { createIfMissing = true } = {}) => {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet && createIfMissing) {
    wallet = await Wallet.create({
      user: userId,
      balance: 0,
      frozenBalance: 0,
      pendingBalance: 0,
      currency: 'XAF',
      transactions: []
    });
  }
  return wallet;
};

const formatXAF = (amount) =>
  `${Number(amount || 0).toLocaleString('fr-FR')} FCFA`;

const normalizePhoneDigits = (value = '') => String(value || '').replace(/\D/g, '');

const normalizeMoneyAmount = (amount) => {
  const value = Number(amount || 0);
  return Number.isFinite(value) ? Math.round(value) : 0;
};

const toOrderKey = (orderId = '') => String(orderId || '').trim();

const isSameOrderTransaction = (txn, orderKey) => {
  if (!orderKey) return false;
  return String(txn?.metadata?.orderId || txn?.reference || '').trim() === orderKey;
};

const getTransactionDirection = (txn = {}) => {
  if (txn.status === 'failed') return 'neutral';
  if (txn?.metadata?.reversal || txn.type === 'sale_reversal') return 'debit';
  if (['deposit', 'refund', 'sale', 'sale_pending', 'sale_release'].includes(txn.type)) return 'credit';
  if (['withdrawal', 'purchase', 'commission'].includes(txn.type)) return 'debit';

  const before = Number(txn.balanceBefore);
  const after = Number(txn.balanceAfter);
  if (Number.isFinite(before) && Number.isFinite(after)) {
    if (after > before) return 'credit';
    if (after < before) return 'debit';
  }
  return 'neutral';
};

const decorateTransaction = (txn = {}) => {
  const plain = typeof txn.toObject === 'function' ? txn.toObject() : { ...txn };
  const direction = getTransactionDirection(plain);
  const absoluteAmount = Math.abs(normalizeMoneyAmount(plain.amount));
  const signedAmount =
    direction === 'credit'
      ? absoluteAmount
      : direction === 'debit'
        ? -absoluteAmount
        : 0;

  return {
    ...plain,
    direction,
    signedAmount,
    displayAmount: absoluteAmount,
    isCredit: direction === 'credit',
    isDebit: direction === 'debit'
  };
};

const hasCompletedBuyerRefund = (wallet, orderKey, amount) =>
  Boolean(
    orderKey &&
      (wallet.transactions || []).some(
        (txn) =>
          txn.type === 'refund' &&
          txn.status === 'completed' &&
          !txn?.metadata?.reversal &&
          isSameOrderTransaction(txn, orderKey) &&
          normalizeMoneyAmount(txn.amount) === normalizeMoneyAmount(amount)
      )
  );

const hasCompletedSellerReversal = (wallet, orderKey, amount) =>
  Boolean(
    orderKey &&
      (wallet.transactions || []).some(
        (txn) =>
          (txn.type === 'sale_reversal' || (txn.type === 'refund' && txn?.metadata?.reversal)) &&
          txn.status === 'completed' &&
          isSameOrderTransaction(txn, orderKey) &&
          normalizeMoneyAmount(txn.amount) === normalizeMoneyAmount(amount)
      )
  );

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
    deepLink: '/wallet',
    actionLink: '/wallet'
  });

  return { balance: wallet.balance, availableBalance: wallet.availableBalance };
};

/**
 * Withdrawal — Seller requests payout to Mobile Money.
 */
export const requestWithdrawal = async ({ userId, amount, reference = '' }) => {
  if (!amount || amount <= 0) throw new Error('Le montant doit être supérieur à 0');

  const wallet = await getOrCreateWallet(userId);
  const owner = await User.findById(userId).select('phone').lean();
  const accountPhone = String(owner?.phone || '').trim();
  const normalizedAccountPhone = normalizePhoneDigits(accountPhone);
  const normalizedReference = normalizePhoneDigits(reference || accountPhone);
  if (!normalizedAccountPhone) {
    throw new Error('Aucun numéro de téléphone n’est associé à ce compte.');
  }
  if (!normalizedReference || normalizedReference !== normalizedAccountPhone) {
    throw new Error('Le retrait est autorisé uniquement vers le numéro de téléphone du compte.');
  }
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
    reference: accountPhone,
    status: 'pending', // Admin must approve
    note: 'Demande de retrait vers Mobile Money',
    metadata: { reference: accountPhone, payoutPhone: accountPhone, accountPhone }
  });

  await wallet.save();
  const lastTxn = wallet.transactions[wallet.transactions.length - 1];

  return {
    balance: wallet.balance,
    availableBalance: wallet.availableBalance,
    totalBalance: wallet.totalBalance,
    pendingBalance: wallet.pendingBalance || 0,
    transactionId: lastTxn._id,
    transaction: decorateTransaction(lastTxn)
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

  const owner = await User.findById(wallet.user).select('phone').lean();
  const accountPhone = String(owner?.phone || '').trim();
  const payoutPhone = String(txn?.metadata?.payoutPhone || txn.reference || '').trim();

  if (!approved) {
    // Reject → refund back to balance
    wallet.balance += txn.amount;
    txn.status = 'failed';
    txn.note = note || 'Retrait refusé par l\'administration';
    txn.processedBy = processedBy;
    txn.processedAt = new Date();
    txn.balanceAfter = wallet.balance;

    await wallet.save();

    // Fire-and-forget notification (non-blocking)
    createNotification({
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
      deepLink: '/wallet',
      actionLink: '/wallet'
    }).catch(() => {});

    return { status: 'failed', balance: wallet.balance };
  }

  // Soft phone validation — warn but don't block approval
  const normalizedAccount = normalizePhoneDigits(accountPhone);
  const normalizedPayout = normalizePhoneDigits(payoutPhone);
  if (!normalizedAccount || !normalizedPayout) {
    throw new Error('Numéro de téléphone manquant pour le compte ou la demande de retrait.');
  }
  if (normalizedPayout !== normalizedAccount) {
    // Admin can still approve; log a warning
    console.warn(`[wallet] Withdrawal ${transactionId}: payout phone ${payoutPhone} differs from account phone ${accountPhone} — admin override.`);
  }

  txn.status = 'completed';
  txn.processedBy = processedBy;
  txn.processedAt = new Date();
  txn.note = note || 'Retrait validé — fonds envoyés via Mobile Money';

  await wallet.save();

  // Fire-and-forget notification (non-blocking)
  createNotification({
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
    deepLink: '/wallet',
    actionLink: '/wallet'
  }).catch(() => {});

  return { status: 'completed', balance: wallet.balance };
};

/**
 * Purchase — Deduct from buyer wallet at checkout.
 */
export const purchaseFromWallet = async ({
  userId,
  amount,
  orderId = '',
  reference = '',
  purpose = 'order',
  note = '',
  metadata = {}
}) => {
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
    note: note || `Achat — commande ${orderId || reference}`,
    metadata: { orderId, reference, purpose, ...metadata }
  });

  await wallet.save();

  const lastTxn = wallet.transactions[wallet.transactions.length - 1];
  return {
    balance: wallet.balance,
    availableBalance: wallet.availableBalance,
    transactionId: lastTxn?._id,
    transaction: lastTxn ? decorateTransaction(lastTxn) : null
  };
};

/**
 * Refund — Credit back to buyer wallet (from dispute resolution or cancellation).
 */
export const refundToWallet = async ({ userId, amount, orderId = '', processedBy = null, note = '' }) => {
  if (!amount || amount <= 0) throw new Error('Le montant doit être supérieur à 0');

  const wallet = await getOrCreateWallet(userId);
  const orderKey = toOrderKey(orderId);
  if (hasCompletedBuyerRefund(wallet, orderKey, amount)) {
    return {
      balance: wallet.balance,
      availableBalance: wallet.availableBalance,
      alreadyRefunded: true
    };
  }
  const balanceBefore = wallet.balance;

  wallet.balance += amount;
  wallet.transactions.push({
    type: 'refund',
    amount,
    balanceBefore,
    balanceAfter: wallet.balance,
    reference: orderKey,
    status: 'completed',
    processedBy,
    processedAt: new Date(),
    note: note || `Remboursement — commande ${orderKey}`,
    metadata: { orderId: orderKey, role: 'buyer_refund' }
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
    deepLink: '/wallet',
    actionLink: '/wallet'
  });

  return { balance: wallet.balance, availableBalance: wallet.availableBalance, alreadyRefunded: false };
};

/**
 * Sale — Hold seller wallet funds after buyer pays with HDMarket wallet.
 */
export const creditSellerWalletSale = async ({ userId, amount, orderId = '', buyerId = '', reference = '' }) => {
  if (!amount || amount <= 0) throw new Error('Le montant doit être supérieur à 0');

  const wallet = await getOrCreateWallet(userId);
  const orderKey = toOrderKey(orderId);
  if (orderKey) {
    const alreadyCredited = (wallet.transactions || []).some(
      (txn) =>
        ['sale', 'sale_pending'].includes(txn.type) &&
        ['pending', 'completed'].includes(txn.status) &&
        String(txn?.metadata?.orderId || txn.reference || '') === orderKey
    );
    if (alreadyCredited) {
      return {
        balance: wallet.balance,
        pendingBalance: wallet.pendingBalance || 0,
        availableBalance: wallet.availableBalance,
        alreadyCredited: true
      };
    }
  }

  const balanceBefore = wallet.balance;
  const pendingBefore = wallet.pendingBalance || 0;
  wallet.pendingBalance = pendingBefore + amount;
  wallet.transactions.push({
    type: 'sale_pending',
    amount,
    balanceBefore,
    balanceAfter: wallet.balance,
    reference: orderKey || reference,
    status: 'pending',
    processedAt: new Date(),
    note: `Vente portefeuille HDMarket en attente — commande ${orderKey || reference}`,
    metadata: {
      orderId: orderKey,
      buyerId,
      reference,
      role: 'seller_sale_escrow',
      escrowStatus: 'held',
      pendingBefore,
      pendingAfter: wallet.pendingBalance
    }
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
      message: `Vous avez reçu ${formatXAF(amount)} via Portefeuille HDMarket. Les fonds seront disponibles après confirmation de la commande.`,
      walletBalance: wallet.balance,
      pendingBalance: wallet.pendingBalance,
      orderId: orderKey
    },
    entityType: 'payment',
    entityId: orderKey || String(wallet.transactions[wallet.transactions.length - 1]._id),
    deepLink: '/wallet',
    actionLink: '/wallet'
  });

  return {
    balance: wallet.balance,
    pendingBalance: wallet.pendingBalance || 0,
    availableBalance: wallet.availableBalance,
    alreadyCredited: false
  };
};

export const releaseSellerWalletSale = async ({ userId, orderId = '', processedBy = null }) => {
  const wallet = await getOrCreateWallet(userId, { createIfMissing: false });
  const orderKey = toOrderKey(orderId);
  if (!wallet || !orderKey) return null;

  const alreadyReleased = (wallet.transactions || []).some(
    (txn) =>
      txn.type === 'sale_release' &&
      txn.status === 'completed' &&
      isSameOrderTransaction(txn, orderKey)
  );
  if (alreadyReleased) {
    return {
      balance: wallet.balance,
      pendingBalance: wallet.pendingBalance || 0,
      availableBalance: wallet.availableBalance,
      alreadyReleased: true
    };
  }

  const pendingTransactions = (wallet.transactions || []).filter(
    (txn) =>
      txn.type === 'sale_pending' &&
      txn.status === 'pending' &&
      isSameOrderTransaction(txn, orderKey) &&
      txn?.metadata?.escrowStatus !== 'released' &&
      txn?.metadata?.escrowStatus !== 'reversed'
  );
  const releaseAmount = pendingTransactions.reduce(
    (sum, txn) => sum + normalizeMoneyAmount(txn.amount),
    0
  );
  if (releaseAmount <= 0) {
    return {
      balance: wallet.balance,
      pendingBalance: wallet.pendingBalance || 0,
      availableBalance: wallet.availableBalance,
      noPendingFunds: true
    };
  }

  const balanceBefore = wallet.balance;
  const pendingBefore = wallet.pendingBalance || 0;
  wallet.pendingBalance = Math.max(0, pendingBefore - releaseAmount);
  wallet.balance += releaseAmount;
  pendingTransactions.forEach((txn) => {
    txn.status = 'completed';
    txn.processedBy = processedBy;
    txn.processedAt = new Date();
    txn.metadata = {
      ...(txn.metadata || {}),
      escrowStatus: 'released',
      releasedAt: new Date().toISOString(),
      releasedBy: processedBy
    };
  });
  wallet.transactions.push({
    type: 'sale_release',
    amount: releaseAmount,
    balanceBefore,
    balanceAfter: wallet.balance,
    reference: orderKey,
    status: 'completed',
    processedBy,
    processedAt: new Date(),
    note: `Fonds libérés — commande ${orderKey}`,
    metadata: {
      orderId: orderKey,
      role: 'seller_sale_release',
      pendingBefore,
      pendingAfter: wallet.pendingBalance
    }
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
      amount: releaseAmount,
      message: `${formatXAF(releaseAmount)} sont maintenant disponibles dans votre portefeuille HDMarket.`,
      walletBalance: wallet.balance,
      pendingBalance: wallet.pendingBalance,
      orderId: orderKey
    },
    entityType: 'payment',
    entityId: orderKey,
    deepLink: '/wallet',
    actionLink: '/wallet'
  });

  return {
    balance: wallet.balance,
    pendingBalance: wallet.pendingBalance || 0,
    availableBalance: wallet.availableBalance,
    alreadyReleased: false
  };
};

/**
 * Reverse a seller sale credit — used when a wallet order is cancelled.
 * Deducts even if balance is insufficient (goes negative), so the reversal is always recorded.
 */
export const reverseSellerCredit = async ({ userId, amount, orderId = '', processedBy = null }) => {
  if (!amount || amount <= 0) throw new Error('Le montant doit être supérieur à 0');

  const wallet = await getOrCreateWallet(userId);
  const orderKey = toOrderKey(orderId);
  if (hasCompletedSellerReversal(wallet, orderKey, amount)) {
    return {
      balance: wallet.balance,
      pendingBalance: wallet.pendingBalance || 0,
      availableBalance: wallet.availableBalance,
      alreadyReversed: true
    };
  }
  const pendingForOrder = (wallet.transactions || []).reduce((sum, txn) => {
    if (
      txn.type === 'sale_pending' &&
      txn.status === 'pending' &&
      isSameOrderTransaction(txn, orderKey) &&
      txn?.metadata?.escrowStatus !== 'released' &&
      txn?.metadata?.escrowStatus !== 'reversed'
    ) {
      return sum + normalizeMoneyAmount(txn.amount);
    }
    return sum;
  }, 0);
  const balanceBefore = wallet.balance;
  const pendingBefore = wallet.pendingBalance || 0;
  const pendingDebit = Math.min(normalizeMoneyAmount(amount), pendingForOrder, pendingBefore);
  const availableDebit = normalizeMoneyAmount(amount) - pendingDebit;

  if (pendingDebit > 0) {
    let remainingPendingDebit = pendingDebit;
    (wallet.transactions || []).forEach((txn) => {
      if (
        remainingPendingDebit > 0 &&
        txn.type === 'sale_pending' &&
        txn.status === 'pending' &&
        isSameOrderTransaction(txn, orderKey) &&
        txn?.metadata?.escrowStatus !== 'released' &&
        txn?.metadata?.escrowStatus !== 'reversed'
      ) {
        remainingPendingDebit -= normalizeMoneyAmount(txn.amount);
        txn.status = 'reversed';
        txn.processedBy = processedBy;
        txn.processedAt = new Date();
        txn.metadata = {
          ...(txn.metadata || {}),
          escrowStatus: 'reversed',
          reversedAt: new Date().toISOString(),
          reversedBy: processedBy
        };
      }
    });
    wallet.pendingBalance = Math.max(0, pendingBefore - pendingDebit);
  }
  if (availableDebit > 0) {
    wallet.balance -= availableDebit;
  }
  wallet.transactions.push({
    type: 'sale_reversal',
    amount,
    balanceBefore,
    balanceAfter: wallet.balance,
    reference: orderKey,
    status: 'completed',
    processedBy,
    processedAt: new Date(),
    note: `Annulation commande ${orderKey} — retour des fonds à l'acheteur.`,
    metadata: {
      orderId: orderKey,
      reversal: true,
      role: 'seller_sale_reversal',
      pendingDebit,
      availableDebit,
      pendingBefore,
      pendingAfter: wallet.pendingBalance || 0
    }
  });

  await wallet.save();

  if (availableDebit > 0 && wallet.balance < 0) {
    console.warn(`[wallet] Seller ${userId} wallet went negative (${wallet.balance} XAF) after order ${orderId} cancellation reversal.`);
  }

  return {
    balance: wallet.balance,
    pendingBalance: wallet.pendingBalance || 0,
    availableBalance: wallet.availableBalance,
    alreadyReversed: false
  };
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
    pendingBalance: wallet.pendingBalance || 0,
    availableBalance: wallet.availableBalance,
    totalBalance: wallet.totalBalance,
    currency: wallet.currency,
    isActive: wallet.isActive,
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt
  };
};

const WALLET_TRANSACTION_TYPES = new Set([
  'deposit',
  'withdrawal',
  'purchase',
  'refund',
  'commission',
  'sale',
  'sale_pending',
  'sale_release',
  'sale_reversal'
]);

const WALLET_TRANSACTION_STATUSES = new Set(['pending', 'completed', 'failed', 'reversed']);
const WALLET_TRANSACTION_DIRECTIONS = new Set(['credit', 'debit', 'neutral']);

const normalizeTransactionTypeFilter = (type = '') => {
  const values = String(type || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const allowed = values.filter((value) => WALLET_TRANSACTION_TYPES.has(value));
  return new Set(allowed);
};

const transactionMatchesSearch = (txn = {}, search = '') => {
  const needle = String(search || '').trim().toLowerCase();
  if (!needle) return true;
  const metadata = txn.metadata || {};
  const haystack = [
    txn.type,
    txn.status,
    txn.reference,
    txn.note,
    metadata.orderId,
    metadata.reference,
    metadata.paymentMethod,
    metadata.payoutPhone,
    metadata.accountPhone
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  return haystack.includes(needle);
};

export const getWalletTransactions = async (
  userId,
  { page = 1, limit = 20, type = '', status = '', direction = '', search = '' } = {}
) => {
  const wallet = await Wallet.findOne({ user: userId })
    .select('transactions')
    .lean();

  if (!wallet) return { items: [], total: 0, page, pages: 0 };

  const normalizedTypes = normalizeTransactionTypeFilter(type);
  const normalizedStatus = String(status || '').trim().toLowerCase();
  const normalizedDirection = String(direction || '').trim().toLowerCase();
  const filteredTxns = (wallet.transactions || [])
    .map(decorateTransaction)
    .filter((txn) => {
      if (normalizedTypes.size > 0 && !normalizedTypes.has(txn.type)) {
        return false;
      }
      if (
        normalizedStatus &&
        WALLET_TRANSACTION_STATUSES.has(normalizedStatus) &&
        String(txn.status || '').toLowerCase() !== normalizedStatus
      ) {
        return false;
      }
      if (
        normalizedDirection &&
        WALLET_TRANSACTION_DIRECTIONS.has(normalizedDirection) &&
        String(txn.direction || '').toLowerCase() !== normalizedDirection
      ) {
        return false;
      }
      return transactionMatchesSearch(txn, search);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = filteredTxns.length;
  const skip = (page - 1) * limit;
  const items = filteredTxns.slice(skip, skip + limit);

  return { items, total, page, pages: Math.ceil(total / limit) };
};

const emptyTransactionSummary = () => ({
  count: 0,
  amount: 0
});

const addTransactionSummary = (target, amount) => {
  target.count += 1;
  target.amount += normalizeMoneyAmount(amount);
};

const buildAdminWalletStatsWindow = (now = new Date()) => ({
  today: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
  last7Days: now.getTime() - 7 * 24 * 60 * 60 * 1000,
  last30Days: now.getTime() - 30 * 24 * 60 * 60 * 1000
});

export const getAdminWalletStats = async () => {
  const wallets = await Wallet.find({})
    .select('user balance frozenBalance pendingBalance isActive transactions updatedAt createdAt')
    .populate('user', 'name phone email role')
    .lean();

  const stats = {
    wallets: {
      total: wallets.length,
      active: 0,
      inactive: 0,
      withAvailableBalance: 0
    },
    balances: {
      available: 0,
      pending: 0,
      frozen: 0,
      totalExposure: 0
    },
    actionQueue: {
      pendingDeposits: emptyTransactionSummary(),
      pendingWithdrawals: emptyTransactionSummary()
    },
    completed: {
      deposits: emptyTransactionSummary(),
      withdrawals: emptyTransactionSummary(),
      purchases: emptyTransactionSummary(),
      orderPurchases: emptyTransactionSummary(),
      boostPurchases: emptyTransactionSummary(),
      shopConversionPurchases: emptyTransactionSummary(),
      refunds: emptyTransactionSummary(),
      sellerReleased: emptyTransactionSummary()
    },
    walletPayments: {
      orders: emptyTransactionSummary(),
      boosts: emptyTransactionSummary(),
      shopConversions: emptyTransactionSummary(),
      other: emptyTransactionSummary()
    },
    volume: {
      today: emptyTransactionSummary(),
      last7Days: emptyTransactionSummary(),
      last30Days: emptyTransactionSummary()
    },
    byType: {},
    byStatus: {},
    recentTransactions: []
  };

  const now = new Date();
  const windows = buildAdminWalletStatsWindow(now);

  wallets.forEach((wallet) => {
    const balance = Number(wallet.balance || 0);
    const frozenBalance = Number(wallet.frozenBalance || 0);
    const pendingBalance = Number(wallet.pendingBalance || 0);
    const availableBalance = Math.max(0, balance - frozenBalance);

    if (wallet.isActive === false) stats.wallets.inactive += 1;
    else stats.wallets.active += 1;
    if (availableBalance > 0) stats.wallets.withAvailableBalance += 1;

    stats.balances.available += availableBalance;
    stats.balances.pending += pendingBalance;
    stats.balances.frozen += frozenBalance;
    stats.balances.totalExposure += availableBalance + pendingBalance + frozenBalance;

    (wallet.transactions || []).forEach((txn) => {
      const amount = normalizeMoneyAmount(txn.amount);
      const type = String(txn.type || 'unknown');
      const status = String(txn.status || 'unknown');
      const createdAt = txn.createdAt ? new Date(txn.createdAt).getTime() : 0;

      if (!stats.byType[type]) stats.byType[type] = emptyTransactionSummary();
      if (!stats.byStatus[status]) stats.byStatus[status] = emptyTransactionSummary();
      addTransactionSummary(stats.byType[type], amount);
      addTransactionSummary(stats.byStatus[status], amount);

      if (status === 'pending' && type === 'deposit') {
        addTransactionSummary(stats.actionQueue.pendingDeposits, amount);
      }
      if (status === 'pending' && type === 'withdrawal') {
        addTransactionSummary(stats.actionQueue.pendingWithdrawals, amount);
      }

      if (status === 'completed') {
        if (type === 'deposit') addTransactionSummary(stats.completed.deposits, amount);
        if (type === 'withdrawal') addTransactionSummary(stats.completed.withdrawals, amount);
        if (type === 'purchase') {
          addTransactionSummary(stats.completed.purchases, amount);
          const purpose = String(txn?.metadata?.purpose || '').trim().toLowerCase();
          if (purpose === 'boost' || purpose === 'annonce_boost') {
            addTransactionSummary(stats.completed.boostPurchases, amount);
            addTransactionSummary(stats.walletPayments.boosts, amount);
          } else if (purpose === 'shop_conversion') {
            addTransactionSummary(stats.completed.shopConversionPurchases, amount);
            addTransactionSummary(stats.walletPayments.shopConversions, amount);
          } else if (purpose === 'order' || txn?.metadata?.orderId) {
            addTransactionSummary(stats.completed.orderPurchases, amount);
            addTransactionSummary(stats.walletPayments.orders, amount);
          } else {
            addTransactionSummary(stats.walletPayments.other, amount);
          }
        }
        if (type === 'refund') addTransactionSummary(stats.completed.refunds, amount);
        if (type === 'sale_release') addTransactionSummary(stats.completed.sellerReleased, amount);
      }

      if (createdAt >= windows.today) addTransactionSummary(stats.volume.today, amount);
      if (createdAt >= windows.last7Days) addTransactionSummary(stats.volume.last7Days, amount);
      if (createdAt >= windows.last30Days) addTransactionSummary(stats.volume.last30Days, amount);

      stats.recentTransactions.push({
        _id: txn._id,
        walletId: wallet._id,
        userId: wallet.user?._id,
        userName: wallet.user?.name || '',
        userPhone: wallet.user?.phone || '',
        type,
        status,
        amount,
        reference: txn.reference || '',
        note: txn.note || '',
        purpose: txn?.metadata?.purpose || '',
        boostRequestId: txn?.metadata?.boostRequestId || '',
        shopConversionRequestId: txn?.metadata?.shopConversionRequestId || '',
        orderId: txn?.metadata?.orderId || '',
        createdAt: txn.createdAt,
        updatedAt: txn.updatedAt
      });
    });
  });

  stats.recentTransactions = stats.recentTransactions
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 8)
    .map(decorateTransaction);

  return stats;
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
  const pendingBefore = Number(wallet.pendingBalance || 0);

  wallet.pendingBalance = pendingBefore + amount;
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
      role: 'wallet_deposit_request',
      affectsPendingBalance: true,
      submittedAt: new Date().toISOString(),
      pendingBefore,
      pendingAfter: wallet.pendingBalance
    }
  });

  await wallet.save();

  const lastTxn = wallet.transactions[wallet.transactions.length - 1];

  // Do not block the user response on admin notification delivery.
  User.find({ role: { $in: ['admin', 'founder', 'manager'] } })
    .select('_id')
    .lean()
    .then((admins) =>
      Promise.all(
        admins.map((admin) =>
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
        )
      )
    )
    .catch(() => {});

  return {
    transactionId: lastTxn._id,
    transaction: decorateTransaction(lastTxn),
    status: 'pending',
    balance: wallet.balance,
    pendingBalance: wallet.pendingBalance || 0,
    availableBalance: wallet.availableBalance,
    totalBalance: wallet.totalBalance
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
  const affectsPendingBalance = txn?.metadata?.affectsPendingBalance === true;
  const pendingBefore = Number(wallet.pendingBalance || 0);
  wallet.balance += txn.amount;
  if (affectsPendingBalance) {
    wallet.pendingBalance = Math.max(0, pendingBefore - Number(txn.amount || 0));
  }
  txn.balanceAfter = wallet.balance;
  txn.status = 'completed';
  txn.processedBy = processedBy;
  txn.processedAt = new Date();
  txn.note = note || 'Dépôt vérifié par l\'administrateur';
  txn.metadata = {
    ...(txn.metadata || {}),
    pendingBefore,
    pendingAfter: wallet.pendingBalance || 0,
    affectsPendingBalance
  };

  await wallet.save();

  // Fire-and-forget notification (non-blocking)
  createNotification({
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
    deepLink: '/wallet',
    actionLink: '/wallet'
  }).catch(() => {});

  return {
    status: 'completed',
    balance: wallet.balance,
    pendingBalance: wallet.pendingBalance || 0,
    availableBalance: wallet.availableBalance,
    totalBalance: wallet.totalBalance
  };
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

  const affectsPendingBalance = txn?.metadata?.affectsPendingBalance === true;
  const pendingBefore = Number(wallet.pendingBalance || 0);
  if (affectsPendingBalance) {
    wallet.pendingBalance = Math.max(0, pendingBefore - Number(txn.amount || 0));
  }
  txn.status = 'failed';
  txn.processedBy = processedBy;
  txn.processedAt = new Date();
  txn.note = note || 'Dépôt refusé par l\'administrateur';
  txn.metadata = {
    ...(txn.metadata || {}),
    pendingBefore,
    pendingAfter: wallet.pendingBalance || 0,
    affectsPendingBalance
  };

  await wallet.save();

  // Fire-and-forget notification (non-blocking)
  createNotification({
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
    deepLink: '/wallet',
    actionLink: '/wallet'
  }).catch(() => {});

  return {
    status: 'failed',
    balance: wallet.balance,
    pendingBalance: wallet.pendingBalance || 0,
    availableBalance: wallet.availableBalance,
    totalBalance: wallet.totalBalance
  };
};
