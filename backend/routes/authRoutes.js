import express from 'express';
import { login, register } from '../controllers/authController.js';
import { validate, schemas } from '../middlewares/validate.js';
import { upload } from '../utils/upload.js';

const router = express.Router();

router.post('/register', upload.single('shopLogo'), validate(schemas.register), register);
router.post('/login', validate(schemas.login), login);

export default router;
