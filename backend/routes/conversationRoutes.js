import { chatWriteLimiter, chatUploadLimiter, requireMessagingEnabled, requireUploadConversation } from '../middlewares/chatSecurity.js';
import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware.js';
import { chatUpload, validateChatUpload } from '../utils/chatUpload.js';
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
  delegateOrderConversation,
  uploadOrderMessageAttachment,
  addOrderMessageReaction,
  removeOrderMessageReaction,
  deleteOrderMessage,
  updateOrderMessage
} from '../controllers/messageController.js';

const router = express.Router();

router.use(protect);
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.use((req, res, next) => ['POST', 'PATCH', 'DELETE'].includes(req.method) ? chatWriteLimiter(req, res, () => requireMessagingEnabled(req, res, next)) : next());

router.get('/unread/orders', getUnreadCountsByOrder);
router.get('/unread', getUnreadCount);
router.get('/', getAllOrderConversations);
router.post('/', idempotencyMiddleware(), validate(schemas.startConversation), postStartConversation);

router.post('/messages/upload', requireUploadConversation, chatUploadLimiter, chatUpload.single('file'), validateChatUpload, uploadOrderMessageAttachment);
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
router.post('/:id/delegate', validate(schemas.idParam, 'params'), delegateOrderConversation);

export default router;
