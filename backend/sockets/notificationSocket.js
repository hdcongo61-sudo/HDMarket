import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { initRedis, getRedisClient, isRedisReady } from '../config/redisClient.js';
import { isTokenBlacklisted, wasSessionInvalidated } from '../services/sessionSecurityService.js';
import {
  getPresenceConstants,
  registerPresenceConnection,
  touchPresenceConnection,
  unregisterPresenceConnection
} from '../services/presenceService.js';

const HEARTBEAT_MS = Math.max(10_000, Number(process.env.PRESENCE_HEARTBEAT_MS || 25_000));

let notificationNamespace = null;
const localPresence = new Map();
const presenceConstants = getPresenceConstants();

const getTokenFromSocket = (socket) =>
  socket?.handshake?.auth?.token ||
  socket?.handshake?.query?.token ||
  socket?.handshake?.headers?.authorization?.split(' ')[1] ||
  null;

const withRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

export const isUserOnline = async (userId) => {
  const key = String(userId || '');
  if (!key) return false;
  if (Number(localPresence.get(key) || 0) > 0) return true;
  const client = await withRedis();
  if (!client) return false;
  try {
    const exists = await client.sIsMember(presenceConstants.keys.onlineUsers, key);
    return Boolean(exists);
  } catch {
    return false;
  }
};

export const emitSocketNotification = (userId, payload = {}) => {
  if (!notificationNamespace || !userId) return;
  notificationNamespace.to(`user:${String(userId)}`).emit('notification', payload);
  notificationNamespace.to(`user:${String(userId)}`).emit('notifications:refresh', {
    userId: String(userId),
    notificationId: payload?.notificationId || '',
    type: payload?.type || 'refresh'
  });
};

export const registerNotificationSocket = (io) => {
  if (!io || notificationNamespace) return notificationNamespace;
  notificationNamespace = io.of('/notifications');

  notificationNamespace.use(async (socket, next) => {
    const token = getTokenFromSocket(socket);
    if (!token) return next(new Error('NOT_AUTHENTICATED'));

    try {
      if (await isTokenBlacklisted(token)) return next(new Error('TOKEN_BLACKLISTED'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select(
        '_id role accountType city isBlocked isActive isLocked sessionsInvalidatedAt'
      );
      if (!user || user.isBlocked || !user.isActive || user.isLocked || wasSessionInvalidated(user, decoded)) {
        return next(new Error('NOT_AUTHORIZED'));
      }

      socket.data.user = {
        id: String(user._id),
        role: user.role,
        accountType: user.accountType || 'person',
        city: user.city || ''
      };
      return next();
    } catch {
      return next(new Error('TOKEN_INVALID'));
    }
  });

  notificationNamespace.on('connection', (socket) => {
    const userId = socket?.data?.user?.id;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    const localKey = String(userId);
    localPresence.set(localKey, Number(localPresence.get(localKey) || 0) + 1);
    socket.join(`user:${userId}`);
    const userRole = socket?.data?.user?.role || 'user';
    const accountType = socket?.data?.user?.accountType || 'person';
    const city = socket?.data?.user?.city || '';
    const userAgent = socket?.handshake?.headers?.['user-agent'] || '';
    const forwardedFor = socket?.handshake?.headers?.['x-forwarded-for'];
    const ip = String(forwardedFor || socket?.handshake?.address || '').split(',')[0].trim();
    socket.data.presenceNamespace = '/notifications';
    const presenceRegistrationPromise = registerPresenceConnection({
      userId,
      role: userRole,
      accountType,
      socketId: socket.id,
      namespace: '/notifications',
      userAgent,
      ip,
      city
    }).then((result) => {
      socket.data.presenceSessionId = result?.sessionId || '';
      return result;
    });

    const heartbeat = setInterval(() => {
      void touchPresenceConnection({
        userId,
        role: userRole,
        accountType,
        socketId: socket.id,
        namespace: '/notifications'
      });
    }, HEARTBEAT_MS);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      clearInterval(heartbeat);
      const current = Number(localPresence.get(localKey) || 0);
      if (current <= 1) localPresence.delete(localKey);
      else localPresence.set(localKey, current - 1);
      void Promise.resolve(presenceRegistrationPromise)
        .catch(() => null)
        .then((registrationResult) => {
          return unregisterPresenceConnection({
            userId,
            socketId: socket.id,
            namespace: socket.data.presenceNamespace || '/notifications',
            sessionId: socket.data.presenceSessionId || registrationResult?.sessionId || ''
          });
        });
    };

    socket.on('presence:heartbeat', () => {
      void touchPresenceConnection({
        userId,
        role: userRole,
        accountType,
        socketId: socket.id,
        namespace: '/notifications'
      });
    });
    socket.on('disconnect', cleanup);
    socket.on('error', cleanup);
  });

  return notificationNamespace;
};

export const getNotificationNamespace = () => notificationNamespace;

export const configureSocketRedisAdapter = async (io) => {
  if (!io) return false;
  try {
    const [{ createAdapter }, redisModule] = await Promise.all([
      import('@socket.io/redis-adapter'),
      import('redis')
    ]);
    const createClient = redisModule?.createClient;
    if (!createAdapter || !createClient) return false;

    const redisOptions = process.env.REDIS_URL
      ? { url: process.env.REDIS_URL }
      : {
          socket: {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: Number(process.env.REDIS_PORT || 6379)
          },
          password: process.env.REDIS_PASSWORD || undefined,
          database: Number(process.env.REDIS_DB || 0)
        };

    const pubClient = createClient(redisOptions);
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    return true;
  } catch {
    return false;
  }
};
