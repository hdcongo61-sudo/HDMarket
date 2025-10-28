const clients = new Map(); // userId -> Set(res)
const heartbeats = new Map(); // res -> intervalId

const ensureSet = (userId) => {
  const key = String(userId);
  if (!clients.has(key)) {
    clients.set(key, new Set());
  }
  return clients.get(key);
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

  res.write(`retry: 5000\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  const set = ensureSet(key);
  set.add(res);

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, 25000);
  heartbeats.set(res, heartbeat);

  const remove = () => cleanupClient(key, res);
  res.on('close', remove);
  res.on('error', remove);
  res.on('finish', remove);
};

export const emitNotification = (userId, payload) => {
  const key = String(userId);
  const set = clients.get(key);
  if (!set || !set.size) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  set.forEach((res) => {
    if (!res.writableEnded) {
      res.write(data);
    }
  });
};
