import React, { useEffect, useMemo, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { Check, Trash2 } from 'lucide-react';

const ACTION_OFFSET = 88;

export default function SwipeActions({
  children,
  canMarkRead = false,
  onMarkRead,
  onDelete
}) {
  const [openSide, setOpenSide] = useState('none');
  const x = useMotionValue(0);
  const targetX = useMemo(() => {
    if (openSide === 'left') return ACTION_OFFSET;
    if (openSide === 'right') return -ACTION_OFFSET;
    return 0;
  }, [openSide]);

  useEffect(() => {
    const controls = animate(x, targetX, {
      type: 'spring',
      stiffness: 420,
      damping: 36
    });
    return () => controls.stop();
  }, [targetX, x]);

  const closeActions = () => setOpenSide('none');

  const handleDragEnd = (_, info) => {
    if (info.offset.x > 56 && canMarkRead) {
      setOpenSide('left');
      return;
    }
    if (info.offset.x < -56) {
      setOpenSide('right');
      return;
    }
    closeActions();
  };

  const handleMarkRead = () => {
    onMarkRead?.();
    closeActions();
  };

  const handleDelete = () => {
    onDelete?.();
    closeActions();
  };

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
        <button
          type="button"
          onClick={handleMarkRead}
          disabled={!canMarkRead}
          className={`pointer-events-auto inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium transition ${
            canMarkRead
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'bg-neutral-300 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'
          }`}
        >
          <Check className="h-3.5 w-3.5" />
          Lu
        </button>
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <button
          type="button"
          onClick={handleDelete}
          className="pointer-events-auto inline-flex h-9 items-center gap-1 rounded-full bg-rose-600 px-3 text-xs font-medium text-white hover:bg-rose-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Suppr.
        </button>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 120 }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative bg-white dark:bg-neutral-950"
        onClick={() => {
          if (openSide !== 'none') {
            closeActions();
          }
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
