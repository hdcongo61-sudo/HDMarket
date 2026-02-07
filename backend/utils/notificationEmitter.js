const clients = new Map(); // userId -> Set(res)
const heartbeats = new Map(); // res -> intervalId

const ensureSet = (userId) => {
  const key = String(userId);
  if (!clients.has(key)) {
    clients.set(key, new Set());
  }
  return clients.get(key);
};

const safeWrite = (res, chunk) => {
  if (res.writableEnded) return false;
  try {
    return res.write(chunk);
  } catch (err) {
    return false;
  }
};

const cleanupClient = (userId, res) => {
  const key = String(userId);
  const set = clients.get(key);
  if (set) {
    set.delete(res);
    if (!set.size) {
      clients.delete(key);
    }
  }
  const timer = heartbeats.get(res);
  if (timer) {
    clearInterval(timer);
    heartbeats.delete(res);
  }
  if (!res.writableEnded) {
    try {
      res.end();
    } catch {
      // ignore
    }
  }
};

export const registerNotificationStream = (userId, res) => {
  const key = String(userId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  } else {
    res.writeHead(200);
  }

  const remove = () => cleanupClient(key, res);

  if (!safeWrite(res, 'retry: 5000\n\n') || !safeWrite(res, `data: ${JSON.stringify({ type: 'connected' })}\n\n`)) {
    remove();
    return;
  }

  const set = ensureSet(key);
  set.add(res);

  const heartbeat = setInterval(() => {
    if (res.writableEnded) {
      remove();
      return;
    }
    if (!safeWrite(res, ': heartbeat\n\n')) {
      remove();
    }
  }, 25000);
  heartbeats.set(res, heartbeat);

  res.on('close', remove);
  res.on('error', remove);
  res.on('finish', remove);
};

export const emitNotification = (userId, payload) => {
  const key = String(userId);
  const set = clients.get(key);
  if (!set || !set.size) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  const toRemove = [];
  set.forEach((res) => {
    if (!safeWrite(res, data)) {
      toRemove.push(res);
    }
  });
  toRemove.forEach((res) => cleanupClient(key, res));
};
