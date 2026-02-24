export const SETTINGS_REFRESH_EVENT = 'hdmarket:settings-refresh';
const SETTINGS_REFRESH_CHANNEL = 'hdmarket:settings-refresh-channel';
const SETTINGS_REFRESH_STORAGE_KEY = 'hdmarket:settings-refresh-ts';

const canUseWindow = () => typeof window !== 'undefined';

const createPayload = () => ({
  ts: Date.now()
});

const getBroadcastChannel = () => {
  if (!canUseWindow()) return null;
  if (typeof window.BroadcastChannel !== 'function') return null;
  try {
    return new window.BroadcastChannel(SETTINGS_REFRESH_CHANNEL);
  } catch {
    return null;
  }
};

export const emitSettingsRefresh = () => {
  if (!canUseWindow()) return;

  const payload = createPayload();
  window.dispatchEvent(new CustomEvent(SETTINGS_REFRESH_EVENT, { detail: payload }));

  try {
    window.localStorage.setItem(SETTINGS_REFRESH_STORAGE_KEY, String(payload.ts));
  } catch {
    // Ignore storage failures (private mode / quota).
  }

  const channel = getBroadcastChannel();
  if (!channel) return;
  try {
    channel.postMessage(payload);
  } finally {
    channel.close();
  }
};

export const subscribeToSettingsRefresh = (handler) => {
  if (!canUseWindow() || typeof handler !== 'function') {
    return () => {};
  }

  const onWindowEvent = () => {
    handler();
  };

  const onStorage = (event) => {
    if (event?.key !== SETTINGS_REFRESH_STORAGE_KEY) return;
    handler();
  };

  const channel = getBroadcastChannel();
  const onChannelMessage = () => {
    handler();
  };

  window.addEventListener(SETTINGS_REFRESH_EVENT, onWindowEvent);
  window.addEventListener('storage', onStorage);
  if (channel) {
    channel.addEventListener('message', onChannelMessage);
  }

  return () => {
    window.removeEventListener(SETTINGS_REFRESH_EVENT, onWindowEvent);
    window.removeEventListener('storage', onStorage);
    if (channel) {
      channel.removeEventListener('message', onChannelMessage);
      channel.close();
    }
  };
};

