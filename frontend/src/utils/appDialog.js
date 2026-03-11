const defaultBridge = {
  alert: async (message) => {
    if (typeof window !== 'undefined') {
      window.alert(String(message || ''));
    }
  },
  confirm: async (message) => {
    if (typeof window === 'undefined') return true;
    return window.confirm(String(message || ''));
  }
};

let bridge = { ...defaultBridge };

export function bindAppDialogBridge(nextBridge = {}) {
  bridge = {
    ...defaultBridge,
    ...nextBridge
  };
  return () => {
    bridge = { ...defaultBridge };
  };
}

export function appAlert(message, options = {}) {
  return bridge.alert(message, options);
}

export function appConfirm(message, options = {}) {
  return bridge.confirm(message, options);
}

