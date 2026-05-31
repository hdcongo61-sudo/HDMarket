import { useEffect } from 'react';

const CLICK_PENDING_CLASS = 'hd-click-pending';
const MIN_TEXT_LENGTH = 2;

const isSkippable = (element) => {
  if (!element) return true;
  if (element.disabled || element.getAttribute('aria-disabled') === 'true') return true;
  if (element.dataset?.noClickSpinner === 'true') return true;
  if (element.dataset?.loading === 'true' || element.getAttribute('aria-busy') === 'true') return true;
  if (element.classList?.contains('no-click-spinner')) return true;

  const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
  if (text.length < MIN_TEXT_LENGTH) return true;

  const rect = element.getBoundingClientRect();
  if (rect.width < 54 || rect.height < 34) return true;

  return false;
};

export default function AppButtonFeedback() {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const timers = new WeakMap();

    const clearPending = (element) => {
      if (!element) return;
      element.classList.remove(CLICK_PENDING_CLASS);
      const timer = timers.get(element);
      if (timer) {
        window.clearTimeout(timer);
        timers.delete(element);
      }
    };

    const onClick = (event) => {
      const element = event.target?.closest?.('button, [role="button"]');
      if (!(element instanceof HTMLElement) || isSkippable(element)) return;

      clearPending(element);
      element.classList.add(CLICK_PENDING_CLASS);
      const timeout = window.setTimeout(() => clearPending(element), 900);
      timers.set(element, timeout);
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return null;
}
