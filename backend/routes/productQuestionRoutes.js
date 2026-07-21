import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  listQuestionsForProduct,
  askQuestion,
  answerQuestion,
  upvoteQuestion,
  deleteQuestion
} from '../controllers/productQuestionController.js';

const router = express.Router();

router.get('/product/:productId', listQuestionsForProduct);
router.post('/', protect, askQuestion);
router.post('/:id/answers', protect, answerQuestion);
router.post('/:id/upvote', protect, upvoteQuestion);
router.delete('/:id', protect, deleteQuestion);

export default router;
