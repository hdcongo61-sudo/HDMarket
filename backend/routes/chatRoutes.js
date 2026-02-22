import express from 'express';
import {
  listChatHistory,
  listChatTemplates,
  listAdminChatTemplates,
  createChatTemplate,
  listRootChatTemplates,
  listChatTemplatesByParent,
  startChatSession,
  updateChatSession,
  getChatSessionByUserId,
  updateChatTemplate,
  deleteChatTemplate,
  uploadChatAttachment,
  addReaction,
  removeReaction,
  searchMessages
} from '../controllers/chatController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requireChatTemplateAccess } from '../middlewares/roleMiddleware.js';
import { chatUpload } from '../utils/chatUpload.js';

const router = express.Router();

router.get('/history', protect, listChatHistory);
router.get('/templates', listChatTemplates);
router.get('/templates/manage', protect, requireChatTemplateAccess, listAdminChatTemplates);
router.post('/templates/manage', protect, requireChatTemplateAccess, createChatTemplate);
router.patch('/templates/manage/:id', protect, requireChatTemplateAccess, updateChatTemplate);
router.delete('/templates/manage/:id', protect, requireChatTemplateAccess, deleteChatTemplate);
router.get('/templates/root', protect, listRootChatTemplates);
router.get('/templates/:parentId', protect, listChatTemplatesByParent);
router.post('/session/start', protect, startChatSession);
router.patch('/session/update', protect, updateChatSession);
router.get('/session/:userId', protect, getChatSessionByUserId);
router.get('/search', protect, searchMessages);
router.post('/upload', protect, chatUpload.single('file'), uploadChatAttachment);
router.post('/messages/:messageId/reactions', protect, addReaction);
router.delete('/messages/:messageId/reactions', protect, removeReaction);
router.patch('/templates/:id', protect, requireChatTemplateAccess, updateChatTemplate);
router.delete('/templates/:id', protect, requireChatTemplateAccess, deleteChatTemplate);

export default router;
