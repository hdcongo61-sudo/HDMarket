import express from 'express';
import {
  listChatHistory,
  listChatTemplates,
  updateChatTemplate,
  deleteChatTemplate
} from '../controllers/chatController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

const router = express.Router();

router.get('/history', protect, listChatHistory);
router.get('/templates', listChatTemplates);
router.patch('/templates/:id', protect, requireRole(['admin']), updateChatTemplate);
router.delete('/templates/:id', protect, requireRole(['admin']), deleteChatTemplate);

export default router;
