let redisClient = null;
let isReady = false;
let connectPromise = null;
let createClientFn = null;

const REDIS_ENABLED = Boolean(
  process.env.REDIS_URL ||
    (process.env.REDIS_HOST && process.env.REDIS_PORT)
);

const buildRedisOptions = () => {
  if (process.env.REDIS_URL) {
    return {
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 200, 3000)
      }
    };
  }

  return {
    socket: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      reconnectStrategy: (retries) => Math.min(retries * 200, 3000)
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: Number(process.env.REDIS_DB || 0)
  };
};

export const initRedis = async () => {
  if (!REDIS_ENABLED) {
    return null;
  }
  if (isReady && redisClient) {
    return redisClient;
  }
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    if (!createClientFn) {
      try {
        const redisModule = await import('redis');
        createClientFn = redisModule?.createClient || null;
      } catch {
        createClientFn = null;
      }
    }

    if (!createClientFn) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[cache] Redis package not installed. Falling back to in-memory cache only.');
      }
      return null;
    }

    const client = createClientFn(buildRedisOptions());

    client.on('ready', () => {
      isReady = true;
      if (process.env.NODE_ENV !== 'test') {
        console.log('[cache] Redis ready');
      }
    });

    client.on('end', () => {
      isReady = false;
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[cache] Redis connection closed');
      }
    });

    client.on('error', (error) => {
      isReady = false;
      if (process.env.NODE_ENV !== 'test') {
        console.error('[cache] Redis error:', error?.message || error);
      }
    });

    await client.connect();
    redisClient = client;
    return redisClient;
  })()
    .catch((error) => {
      connectPromise = null;
      isReady = false;
      if (process.env.NODE_ENV !== 'test') {
        console.error('[cache] Redis init failed:', error?.message || error);
      }
      return null;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};

export const getRedisClient = () => (isReady ? redisClient : null);

export const isRedisReady = () => Boolean(isReady && redisClient);

export const closeRedis = async () => {
  if (!redisClient) return;
  try {
    await redisClient.quit();
  } catch {
    try {
      redisClient.disconnect();
    } catch {
      // noop
    }
  } finally {
    redisClient = null;
    isReady = false;
    connectPromise = null;
  }
};

export default {
  initRedis,
  getRedisClient,
  isRedisReady,
  closeRedis
};
