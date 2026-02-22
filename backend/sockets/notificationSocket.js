import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { initRedis, getRedisClient, isRedisReady } from '../config/redisClient.js';

const ENV = String(process.env.CACHE_ENV || process.env.NODE_ENV || 'dev')
  .toLowerCase()
  .startsWith('prod')
  ? 'prod'
  : 'dev';
const ONLINE_TTL_SECONDS = Math.max(30, Number(process.env.NOTIFICATION_ONLINE_TTL_SECONDS || 90));
const ONLINE_PREFIX = `${ENV}:notifications:online:user:`;
const HEARTBEAT_MS = Math.max(10_000, Math.min(ONLINE_TTL_SECONDS * 500, 30_000));

let notificationNamespace = null;
const localPresence = new Map(); // userId -> count

const onlineKey = (userId) => `${ONLINE_PREFIX}${String(userId)}`;

const getTokenFromSocket = (socket) =>
  socket?.handshake?.auth?.token ||
  socket?.handshake?.query?.token ||
  socket?.handshake?.headers?.authorization?.split(' ')[1] ||
  null;

const withRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

const setOnline = async (userId) => {
  const client = await withRedis();
  if (!client) return;
  await client.set(onlineKey(userId), '1', { EX: ONLINE_TTL_SECONDS });
};

const clearOnline = async (userId) => {
  const client = await withRedis();
  if (!client) return;
  await client.del(onlineKey(userId));
};

const incLocalPresence = (userId) => {
  const key = String(userId);
  const current = Number(localPresence.get(key) || 0);
  localPresence.set(key, current + 1);
};

const decLocalPresence = (userId) => {
  const key = String(userId);
  const current = Number(localPresence.get(key) || 0);
  if (current <= 1) {
    localPresence.delete(key);
  } else {
    localPresence.set(key, current - 1);
  }
};

export const isUserOnline = async (userId) => {
  const key = String(userId || '');
  if (!key) return false;
  if (Number(localPresence.get(key) || 0) > 0) return true;
  const client = await withRedis();
  if (!client) return false;
  const exists = await client.exists(onlineKey(key));
  return Number(exists || 0) > 0;
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id role isBlocked');
      if (!user || user.isBlocked) return next(new Error('NOT_AUTHORIZED'));

      socket.data.user = {
        id: String(user._id),
        role: user.role
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

    incLocalPresence(userId);
    socket.join(`user:${userId}`);
    void setOnline(userId);

    const heartbeat = setInterval(() => {
      void setOnline(userId);
    }, HEARTBEAT_MS);

    const cleanup = () => {
      clearInterval(heartbeat);
      decLocalPresence(userId);
      if (!localPresence.has(String(userId))) {
        void clearOnline(userId);
      }
    };

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
