export const PAWAPAY_CHECKOUT_WINDOW_NAME = 'hdmarket-pawapay-checkout';
export const PAWAPAY_RESULT_MESSAGE_TYPE = 'hdmarket:pawapay-result';

const PAWAPAY_RESULT_CHANNEL = 'hdmarket:pawapay-result-channel';
const PAWAPAY_RESULT_STORAGE_KEY = 'hdmarket:pawapay-result';
const PAWAPAY_WINDOW_SESSION_KEY = 'hdmarket:pawapay-checkout-window';
const TERMINAL_STATUSES = new Set(['completed', 'failed']);

const canUseWindow = () => typeof window !== 'undefined';

const safeInternalPath = (value, fallback = '/orders') => {
  const path = String(value || '').trim();
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://')
    ? path
    : fallback;
};

const createMessageId = () => {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Fall back to a timestamp-based identifier.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getBroadcastChannel = () => {
  if (!canUseWindow() || typeof window.BroadcastChannel !== 'function') return null;
  try {
    return new window.BroadcastChannel(PAWAPAY_RESULT_CHANNEL);
  } catch {
    return null;
  }
};

export const createPawaPayResultMessage = ({
  status,
  checkoutId,
  path,
  message = ''
} = {}) => ({
  type: PAWAPAY_RESULT_MESSAGE_TYPE,
  messageId: createMessageId(),
  status: String(status || '').toLowerCase(),
  checkoutId: String(checkoutId || '').trim(),
  path: safeInternalPath(path),
  message: String(message || '').trim(),
  sentAt: Date.now()
});

export const isPawaPayResultMessage = (value) =>
  Boolean(
    value &&
      value.type === PAWAPAY_RESULT_MESSAGE_TYPE &&
      value.messageId &&
      TERMINAL_STATUSES.has(value.status) &&
      value.checkoutId &&
      value.path === safeInternalPath(value.path)
  );

export const isPawaPayCheckoutWindow = () => {
  if (!canUseWindow()) return false;
  try {
    if (window.sessionStorage.getItem(PAWAPAY_WINDOW_SESSION_KEY) === '1') return true;
  } catch {
    // Fall back to the browsing-context name when storage is unavailable.
  }
  return window.name === PAWAPAY_CHECKOUT_WINDOW_NAME ||
    window.name.startsWith(`${PAWAPAY_CHECKOUT_WINDOW_NAME}-`);
};

export const openPawaPayCheckoutWindow = () => {
  if (!canUseWindow() || typeof window.open !== 'function') return null;
  let paymentWindow;
  try {
    paymentWindow = window.open(
      '',
      `${PAWAPAY_CHECKOUT_WINDOW_NAME}-${createMessageId()}`,
      'popup=yes,width=480,height=760,resizable=yes,scrollbars=yes'
    );
  } catch {
    return null;
  }
  if (!paymentWindow) return null;

  try {
    paymentWindow.sessionStorage.setItem(PAWAPAY_WINDOW_SESSION_KEY, '1');
  } catch {
    // The browsing-context name remains available as a fallback marker.
  }

  try {
    paymentWindow.document.title = 'Paiement PawaPay';
    paymentWindow.document.body.replaceChildren();
    paymentWindow.document.body.style.cssText =
      'margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f5f2;color:#0f172a;font:600 15px system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box';
    const message = paymentWindow.document.createElement('p');
    message.textContent = 'Ouverture du paiement sécurisé PawaPay…';
    paymentWindow.document.body.appendChild(message);
    paymentWindow.focus();
  } catch {
    // The window itself is still usable if its placeholder cannot be styled.
  }
  return paymentWindow;
};

export const publishPawaPayResult = (result) => {
  if (!canUseWindow()) return null;
  const payload = createPawaPayResultMessage(result);
  if (!isPawaPayResultMessage(payload)) return null;

  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
    }
  } catch {
    // BroadcastChannel and storage remain available as cross-tab fallbacks.
  }

  const channel = getBroadcastChannel();
  if (channel) {
    try {
      channel.postMessage(payload);
    } finally {
      channel.close();
    }
  }

  try {
    window.localStorage.setItem(PAWAPAY_RESULT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures (private mode / quota).
  }

  return payload;
};

export const subscribeToPawaPayResults = (handler) => {
  if (!canUseWindow() || typeof handler !== 'function') return () => {};

  const seenMessageIds = new Set();
  const deliver = (payload) => {
    if (!isPawaPayResultMessage(payload) || seenMessageIds.has(payload.messageId)) return;
    seenMessageIds.add(payload.messageId);
    handler(payload);
  };
  const onWindowMessage = (event) => {
    if (event.origin !== window.location.origin) return;
    deliver(event.data);
  };
  const onStorage = (event) => {
    if (event.key !== PAWAPAY_RESULT_STORAGE_KEY || !event.newValue) return;
    try {
      deliver(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed storage values.
    }
  };
  const channel = getBroadcastChannel();
  const onChannelMessage = (event) => deliver(event.data);

  window.addEventListener('message', onWindowMessage);
  window.addEventListener('storage', onStorage);
  if (channel) channel.addEventListener('message', onChannelMessage);

  return () => {
    window.removeEventListener('message', onWindowMessage);
    window.removeEventListener('storage', onStorage);
    if (channel) {
      channel.removeEventListener('message', onChannelMessage);
      channel.close();
    }
  };
};
