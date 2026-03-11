import React from 'react';
import { createPortal } from 'react-dom';
import cn from '../../lib/utils';
import { buttonVariants } from './button';

const AlertDialogContext = React.createContext(null);

function useAlertDialogContext(componentName) {
  const context = React.useContext(AlertDialogContext);
  if (!context) {
    throw new Error(`${componentName} must be used within AlertDialog`);
  }
  return context;
}

const AlertDialog = ({ open, defaultOpen = false, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = React.useState(Boolean(defaultOpen));
  const isControlled = typeof open === 'boolean';
  const dialogOpen = isControlled ? open : internalOpen;

  const setOpen = React.useCallback(
    (next) => {
      if (!isControlled) setInternalOpen(Boolean(next));
      onOpenChange?.(Boolean(next));
    },
    [isControlled, onOpenChange]
  );

  const value = React.useMemo(
    () => ({
      open: dialogOpen,
      setOpen
    }),
    [dialogOpen, setOpen]
  );

  return <AlertDialogContext.Provider value={value}>{children}</AlertDialogContext.Provider>;
};

const AlertDialogTrigger = React.forwardRef(function AlertDialogTrigger(
  { asChild = false, onClick, children, ...props },
  ref
) {
  const { setOpen } = useAlertDialogContext('AlertDialogTrigger');

  const handleClick = React.useCallback(
    (event) => {
      onClick?.(event);
      if (!event.defaultPrevented) {
        setOpen(true);
      }
    },
    [onClick, setOpen]
  );

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      onClick: handleClick
    });
  }

  return (
    <button ref={ref} type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
});

const AlertDialogPortal = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

const AlertDialogOverlay = React.forwardRef(function AlertDialogOverlay(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'fixed inset-0 z-[1200] bg-black/70 backdrop-blur-sm animate-in fade-in-0',
        className
      )}
      {...props}
    />
  );
});

const AlertDialogContent = React.forwardRef(function AlertDialogContent(
  { className, children, ...props },
  ref
) {
  const { open, setOpen } = useAlertDialogContext('AlertDialogContent');

  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay onClick={() => setOpen(false)} />
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        className={cn(
          'fixed left-1/2 top-1/2 z-[1201] grid w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
          'gap-4 rounded-2xl border border-white/25 bg-white/95 p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900/95',
          'max-h-[calc(100%-3rem)] overflow-y-auto',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </AlertDialogPortal>
  );
});

const AlertDialogHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-1 text-center sm:text-left', className)} {...props} />
);

const AlertDialogFooter = ({ className, ...props }) => (
  <div
    className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3', className)}
    {...props}
  />
);

const AlertDialogTitle = React.forwardRef(function AlertDialogTitle({ className, ...props }, ref) {
  return <h2 ref={ref} className={cn('text-lg font-semibold text-slate-900 dark:text-white', className)} {...props} />;
});

const AlertDialogDescription = React.forwardRef(function AlertDialogDescription(
  { className, ...props },
  ref
) {
  return (
    <p
      ref={ref}
      className={cn('text-sm leading-relaxed text-slate-600 dark:text-slate-300', className)}
      {...props}
    />
  );
});

const AlertDialogAction = React.forwardRef(function AlertDialogAction(
  { className, onClick, ...props },
  ref
) {
  const { setOpen } = useAlertDialogContext('AlertDialogAction');
  return (
    <button
      ref={ref}
      className={cn(buttonVariants(), className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      }}
      {...props}
    />
  );
});

const AlertDialogCancel = React.forwardRef(function AlertDialogCancel(
  { className, onClick, ...props },
  ref
) {
  const { setOpen } = useAlertDialogContext('AlertDialogCancel');
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant: 'outline' }), 'mt-2 sm:mt-0', className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      }}
      {...props}
    />
  );
});

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger
};

