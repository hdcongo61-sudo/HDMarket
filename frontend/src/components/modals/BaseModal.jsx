import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const SIZE_CLASS_MAP = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-6xl'
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const cx = (...parts) => parts.filter(Boolean).join(' ');

const getFocusableElements = (node) => {
  if (!node) return [];
  return Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
};

export default function BaseModal({
  isOpen,
  onClose,
  children,
  size = 'md',
  mobileSheet = true,
  closeOnEsc = true,
  closeOnBackdrop = true,
  lockScroll = true,
  ariaLabel,
  ariaLabelledBy,
  panelClassName = '',
  rootClassName = '',
  backdropClassName = '',
  initialFocusSelector = '[data-autofocus]',
  role = 'dialog'
}) {
  const panelRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscRef = useRef(closeOnEsc);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const sizeClass = SIZE_CLASS_MAP[size] || SIZE_CLASS_MAP.md;
  const rootLayoutClass = mobileSheet
    ? 'items-end justify-center sm:items-center'
    : 'items-center justify-center';

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closeOnEscRef.current = closeOnEsc;
  }, [closeOnEsc]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return undefined;
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const updateInset = () => {
      const overlap = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop
      );
      setKeyboardInset(overlap);
    };

    updateInset();
    viewport.addEventListener('resize', updateInset);
    viewport.addEventListener('scroll', updateInset);
    return () => {
      viewport.removeEventListener('resize', updateInset);
      viewport.removeEventListener('scroll', updateInset);
      setKeyboardInset(0);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    lastFocusedRef.current = document.activeElement;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const previousTouchAction = body.style.touchAction;

    if (lockScroll) {
      const scrollbarWidth = Math.max(
        0,
        window.innerWidth - document.documentElement.clientWidth
      );
      body.style.overflow = 'hidden';
      body.style.touchAction = 'none';
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const onKeyDown = (event) => {
      if (!panelRef.current) return;
      if (event.key === 'Escape' && closeOnEscRef.current) {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = getFocusableElements(panelRef.current);
      if (focusables.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const raf = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const autoFocusNode = panel.querySelector(initialFocusSelector);
      const focusables = getFocusableElements(panel);
      const target =
        (autoFocusNode instanceof HTMLElement && autoFocusNode) ||
        focusables[0] ||
        panel;
      target.focus();
    });

    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      if (lockScroll) {
        body.style.overflow = previousOverflow;
        body.style.paddingRight = previousPaddingRight;
        body.style.touchAction = previousTouchAction;
      }
      if (lastFocusedRef.current instanceof HTMLElement) {
        lastFocusedRef.current.focus();
      }
    };
  }, [isOpen, lockScroll, initialFocusSelector]);

  const panelStyle = useMemo(
    () => ({
      maxHeight:
        'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 0.75rem)',
      marginBottom: mobileSheet
        ? `calc(env(safe-area-inset-bottom, 0px) + ${keyboardInset}px)`
        : undefined
    }),
    [mobileSheet, keyboardInset]
  );

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cx(
        'ui-modal-root fixed inset-0 z-[120] flex p-0 sm:p-4',
        rootLayoutClass,
        rootClassName
      )}
    >
      <button
        type="button"
        aria-label="Fermer"
        className={cx(
          'ui-modal-backdrop absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity',
          backdropClassName
        )}
        onClick={() => {
          if (closeOnBackdrop) onClose?.();
        }}
      />

      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        style={panelStyle}
        className={cx(
          'ui-modal-panel relative z-[1] flex w-full flex-col overflow-hidden border border-slate-200/80 bg-white text-slate-900 shadow-2xl outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100',
          sizeClass,
          mobileSheet ? 'rounded-t-3xl sm:rounded-2xl' : 'rounded-2xl',
          panelClassName
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function BottomSheetModal(props) {
  return <BaseModal {...props} mobileSheet={true} />;
}

export function ModalHeader({
  title,
  subtitle,
  icon,
  onClose,
  closeLabel = 'Fermer',
  titleId,
  actions,
  className = ''
}) {
  return (
    <header
      className={cx(
        'ui-modal-header flex items-center justify-between gap-3 border-b border-slate-200/80 px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5 dark:border-neutral-800',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          {icon ? (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-neutral-900 dark:text-neutral-300">
              {icon}
            </span>
          ) : null}
          <h2 id={titleId} className="truncate text-base font-semibold sm:text-lg">
            {title}
          </h2>
        </div>
        {subtitle ? (
          <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-neutral-400">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {onClose ? (
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function ModalBody({ className = '', children }) {
  return (
    <div
      className={cx(
        'ui-modal-body min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5',
        className
      )}
    >
      {children}
    </div>
  );
}

export function ModalFooter({ sticky = true, className = '', children }) {
  return (
    <footer
      className={cx(
        'ui-modal-footer border-t border-slate-200/80 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 sm:px-6 sm:pb-4 dark:border-neutral-800',
        sticky
          ? 'sticky bottom-0 bg-white/95 backdrop-blur-md dark:bg-neutral-950/95'
          : 'bg-transparent',
        className
      )}
    >
      {children}
    </footer>
  );
}
