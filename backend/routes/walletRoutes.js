import express from 'express';
import { protect, admin } from '../middlewares/authMiddleware.js';
import {
  requireWalletEnabled,
  getMyWallet,
  getMyTransactions,
  requestMyWithdrawal,
  adminDeposit,
  adminGetPendingWithdrawals,
  adminProcessWithdrawal,
  adminGetUserWallet,
  walletStatus
} from '../controllers/walletController.js';

const router = express.Router();

// ─── PUBLIC ───────────────────────────────────────────────
router.get('/status', walletStatus);

// ─── USER (protected) ─────────────────────────────────────
router.get('/', protect, requireWalletEnabled, getMyWallet);
router.get('/transactions', protect, requireWalletEnabled, getMyTransactions);
router.post('/withdraw', protect, requireWalletEnabled, requestMyWithdrawal);

// ─── ADMIN ────────────────────────────────────────────────
router.get('/admin/pending-withdrawals', protect, admin, adminGetPendingWithdrawals);
router.post('/admin/deposit', protect, admin, adminDeposit);
router.post('/admin/process-withdrawal', protect, admin, adminProcessWithdrawal);
router.get('/admin/user/:userId', protect, admin, adminGetUserWallet);

export default router;
