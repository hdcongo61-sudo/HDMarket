let deferredPrompt = null;
let started = false;
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener(Boolean(deferredPrompt)));

const onBeforeInstallPrompt = (event) => {
  event.preventDefault();
  deferredPrompt = event;
  notify();
};

const onInstalled = () => {
  deferredPrompt = null;
  notify();
};

const pwaInstallService = {
  start() {
    if (started || typeof window === 'undefined') return;
    started = true;
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
  },

  canInstall() {
    return Boolean(deferredPrompt);
  },

  isInstalled() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async requestInstall() {
    if (!deferredPrompt) return { outcome: 'unavailable' };
    const prompt = deferredPrompt;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice?.outcome === 'accepted') deferredPrompt = null;
    notify();
    return choice || { outcome: 'dismissed' };
  }
};

export default pwaInstallService;
