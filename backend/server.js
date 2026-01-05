import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import userRoutes from './routes/userRoutes.js';
import shopRoutes from './routes/shopRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';

import User from './models/userModel.js';
import ChatMessage from './models/chatMessageModel.js';
import { setChatSocket } from './sockets/chatSocket.js';
import { requestTracker, getDailyRequestStats } from './middlewares/requestTracker.js';

connectDB();

// const logCloudinaryEnv = () => {
//   if (process.env.NODE_ENV === 'production') return;
//   console.log('Cloudinary credentials:', {
//     CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '(not set)',
//     CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '(not set)',
//     CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? '********' : '(not set)'
//   });
// };
// logCloudinaryEnv();

const app = express();
app.set('trust proxy', 1);
// ✅ CORS setup for local development (Vite 5173)
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

// Use CORS before all other middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests

app.use(requestTracker);

// Rate limit global (skip long-lived streams + allow higher burst during dev)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: Number(process.env.RATE_LIMIT_MAX ?? 3000),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, veuillez réessayer plus tard.' },
  skip: (req) =>
    req.originalUrl?.startsWith('/api/users/notifications/stream') ||
    (process.env.NODE_ENV === 'development' && req.ip === '::1')
});
app.use(limiter);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

// Static for local uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.json({ ok: true, name: 'HDMarket API' }));
app.get('/api/health/requests', (req, res) => {
  res.json({
    success: true,
    ...getDailyRequestStats()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/settings', settingsRoutes);

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const httpServer = http.createServer(app);
const socketCors = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
};

const io = new Server(httpServer, { cors: socketCors });

setChatSocket(io);

io.use(async (socket, next) => {
  const token =
    socket.handshake.auth?.token || socket.handshake.query?.token || socket.handshake.headers?.authorization?.split(' ')[1];
  if (!token) {
    socket.data.user = {
      id: `guest-${socket.id}`,
      name: 'Visiteur',
      role: 'user'
    };
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('name role isBlocked blockedReason');
    if (!user || user.isBlocked) {
      return next(new Error('Not authorized'));
    }
    socket.data.user = {
      id: user._id.toString(),
      name: user.name || 'Utilisateur',
      role: user.role
    };
    return next();
  } catch (error) {
    return next(new Error('Token invalid'));
  }
});

io.on('connection', (socket) => {
  socket.join('support');
  socket.emit('connected', { user: socket.data.user });

  socket.on('sendMessage', async ({ text, metadata }) => {
    if (!text) return;
    const isGuest = String(socket.data.user.id || '').startsWith('guest-');
    const message = await ChatMessage.create({
      user: isGuest ? undefined : socket.data.user.id,
      username: socket.data.user.name,
      text,
      metadata,
      from: socket.data.user.role === 'admin' ? 'support' : 'user'
    });
    const payload = {
      id: message._id.toString(),
      from: message.from,
      text: message.text,
      username: message.username,
      metadata: message.metadata,
      createdAt: message.createdAt
    };
    io.emit('message', payload);
  });
});

const port = process.env.PORT || 5010;
httpServer.listen(port, () => console.log(`Server running on port ${port}`));
