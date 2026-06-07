const vibrate = (pattern) => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch { /* unsupported */ }
};

export const lightTap = () => vibrate(10);
export const mediumTap = () => vibrate(15);
export const heavyTap = () => vibrate(25);
export const successNotification = () => vibrate([10, 50, 10]);
export const errorNotification = () => vibrate([30, 60, 30]);
export const selectionChanged = () => vibrate(5);

export default { lightTap, mediumTap, heavyTap, successNotification, errorNotification, selectionChanged };
