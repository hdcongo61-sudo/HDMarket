import express from 'express';
import { protect, admin } from '../middlewares/authMiddleware.js';
import { upload } from '../utils/upload.js';
import {
  requireWalletEnabled,
  getMyWallet,
  getMyTransactions,
  requestMyWithdrawal,
  requestMyDeposit,
  adminDeposit,
  adminGetWalletStats,
  adminGetPendingWithdrawals,
  adminProcessWithdrawal,
  adminGetUserWallet,
  adminGetPendingDeposits,
  adminApproveDeposit,
  adminRejectDeposit,
  walletStatus
} from '../controllers/walletController.js';

const router = express.Router();

// ─── PUBLIC ───────────────────────────────────────────────
router.get('/status', walletStatus);

// ─── USER (protected) ─────────────────────────────────────
router.get('/', protect, requireWalletEnabled, getMyWallet);
router.get('/transactions', protect, requireWalletEnabled, getMyTransactions);
router.post('/withdraw', protect, requireWalletEnabled, requestMyWithdrawal);
router.post(
  '/deposit-request',
  protect,
  requireWalletEnabled,
  upload.fields([{ name: 'proof', maxCount: 1 }]),
  requestMyDeposit
);

// ─── ADMIN ────────────────────────────────────────────────
router.get('/admin/stats', protect, admin, adminGetWalletStats);
router.get('/admin/pending-withdrawals', protect, admin, adminGetPendingWithdrawals);
router.get('/admin/pending-deposits', protect, admin, adminGetPendingDeposits);
router.post('/admin/deposit', protect, admin, adminDeposit);
router.post('/admin/process-withdrawal', protect, admin, adminProcessWithdrawal);
router.post('/admin/approve-deposit', protect, admin, adminApproveDeposit);
router.post('/admin/reject-deposit', protect, admin, adminRejectDeposit);
router.get('/admin/user/:userId', protect, admin, adminGetUserWallet);

export default router;
