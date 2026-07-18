import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import cn from '../../lib/utils';

/**
 * Backwards-compatible card used by the delivery workspace.
 * The historical component name is retained so consumers do not need to
 * change, but the visual treatment follows the standard HDMarket card style.
 */
export const LiquidGlassCard = ({
  children,
  className = '',
  draggable = true,
  expandable = false,
  width,
  height,
  expandedWidth,
  expandedHeight,
  borderRadius = '14px',
  blurIntensity: _blurIntensity,
  glowIntensity: _glowIntensity,
  shadowIntensity: _shadowIntensity,
  ...props
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const variants = useMemo(() => {
    if (!expandable) return undefined;
    return {
      collapsed: { width: width || 'auto', height: height || 'auto' },
      expanded: {
        width: expandedWidth || width || 'auto',
        height: expandedHeight || height || 'auto'
      }
    };
  }, [expandable, expandedHeight, expandedWidth, height, width]);

  const MotionComponent = draggable || expandable ? motion.div : 'div';
  const motionProps = draggable || expandable
    ? {
        variants,
        animate: expandable ? (isExpanded ? 'expanded' : 'collapsed') : undefined,
        transition: { duration: 0.18, ease: 'easeOut' },
        onClick: expandable
          ? (event) => {
              if (event?.target?.closest?.('a, button, input, select, textarea')) return;
              setIsExpanded((current) => !current);
            }
          : undefined,
        drag: draggable,
        dragConstraints: draggable ? { left: 0, right: 0, top: 0, bottom: 0 } : undefined,
        dragElastic: draggable ? 0.08 : undefined
      }
    : {};

  return (
    <MotionComponent
      className={cn(
        'relative overflow-hidden border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900',
        draggable ? 'cursor-grab active:cursor-grabbing' : '',
        expandable ? 'cursor-pointer' : '',
        className
      )}
      style={{
        borderRadius,
        ...(width && !expandable ? { width } : {}),
        ...(height && !expandable ? { height } : {})
      }}
      {...motionProps}
      {...props}
    >
      {children}
    </MotionComponent>
  );
};

export default LiquidGlassCard;
