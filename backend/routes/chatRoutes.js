import express from 'express';
import {
  listChatHistory,
  listChatTemplates,
  updateChatTemplate,
  deleteChatTemplate,
  uploadChatAttachment,
  addReaction,
  removeReaction,
  searchMessages
} from '../controllers/chatController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { chatUpload } from '../utils/chatUpload.js';

const router = express.Router();

router.get('/history', protect, listChatHistory);
router.get('/templates', listChatTemplates);
router.get('/search', protect, searchMessages);
router.post('/upload', protect, chatUpload.single('file'), uploadChatAttachment);
router.post('/messages/:messageId/reactions', protect, addReaction);
router.delete('/messages/:messageId/reactions', protect, removeReaction);
router.patch('/templates/:id', protect, requireRole(['admin']), updateChatTemplate);
router.delete('/templates/:id', protect, requireRole(['admin']), deleteChatTemplate);

export default router;
