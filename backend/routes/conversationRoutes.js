import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware.js';
import { chatUpload } from '../utils/chatUpload.js';
import {
  postStartConversation,
  getConversationMessages,
  sendConversationMessage,
  getUnreadCount,
  getUnreadCountsByOrder,
  getAllOrderConversations,
  archiveOrderConversation,
  unarchiveOrderConversation,
  deleteOrderConversation,
  uploadOrderMessageAttachment,
  addOrderMessageReaction,
  removeOrderMessageReaction,
  deleteOrderMessage,
  updateOrderMessage,
  getSellerAutoReply,
  upsertSellerAutoReply,
  deleteSellerAutoReply,
  getSellerTemplates,
  createSellerTemplate,
  updateSellerTemplate,
  deleteSellerTemplate
} from '../controllers/messageController.js';

const router = express.Router();

router.use(protect);

router.get('/unread/orders', getUnreadCountsByOrder);
router.get('/unread', getUnreadCount);
router.get('/', getAllOrderConversations);
router.post('/', idempotencyMiddleware(), validate(schemas.startConversation), postStartConversation);

router.post('/messages/upload', chatUpload.single('file'), uploadOrderMessageAttachment);
router.post('/messages/:messageId/reactions', idempotencyMiddleware(), addOrderMessageReaction);
router.delete('/messages/:messageId/reactions', idempotencyMiddleware(), removeOrderMessageReaction);

router.get('/:id/messages', validate(schemas.idParam, 'params'), getConversationMessages);
router.post(
  '/:id/messages',
  validate(schemas.idParam, 'params'),
  idempotencyMiddleware(),
  validate(schemas.orderMessage),
  sendConversationMessage
);
router.patch(
  '/:id/messages/:messageId',
  idempotencyMiddleware(),
  validate(schemas.orderMessageUpdate, 'body'),
  updateOrderMessage
);
router.delete('/:id/messages/:messageId', idempotencyMiddleware(), deleteOrderMessage);

router.post('/:id/archive', validate(schemas.idParam, 'params'), idempotencyMiddleware(), archiveOrderConversation);
router.post('/:id/unarchive', validate(schemas.idParam, 'params'), idempotencyMiddleware(), unarchiveOrderConversation);
router.post('/:id/delete', validate(schemas.idParam, 'params'), idempotencyMiddleware(), deleteOrderConversation);

// Seller auto-reply
router.get('/seller/auto-reply', getSellerAutoReply);
router.put('/seller/auto-reply', upsertSellerAutoReply);
router.delete('/seller/auto-reply', deleteSellerAutoReply);

// Seller message templates
router.get('/seller/templates', getSellerTemplates);
router.post('/seller/templates', createSellerTemplate);
router.patch('/seller/templates/:templateId', updateSellerTemplate);
router.delete('/seller/templates/:templateId', deleteSellerTemplate);

export default router;
