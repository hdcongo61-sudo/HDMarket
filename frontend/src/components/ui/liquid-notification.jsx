import React, { useId, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import cn from '../../lib/utils';

export const LiquidGlassCard = ({
  children,
  className = '',
  draggable = true,
  expandable = false,
  width,
  height,
  expandedWidth,
  expandedHeight,
  blurIntensity = 'xl',
  borderRadius = '20px',
  glowIntensity = 'sm',
  shadowIntensity = 'md',
  ...props
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const filterId = useId().replace(/:/g, '');

  const handleToggleExpansion = (event) => {
    if (!expandable) return;
    if (event?.target?.closest?.('a, button, input, select, textarea')) return;
    setIsExpanded((prev) => !prev);
  };

  const blurClasses = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
    xl: 'backdrop-blur-xl',
    '2xl': 'backdrop-blur-2xl'
  };

  const shadowStyles = {
    none: 'inset 0 0 0 0 rgba(255, 255, 255, 0)',
    xs: 'inset 1px 1px 1px 0 rgba(255, 255, 255, 0.28), inset -1px -1px 1px 0 rgba(255, 255, 255, 0.28)',
    sm: 'inset 2px 2px 2px 0 rgba(255, 255, 255, 0.32), inset -2px -2px 2px 0 rgba(255, 255, 255, 0.32)',
    md: 'inset 3px 3px 3px 0 rgba(255, 255, 255, 0.38), inset -3px -3px 3px 0 rgba(255, 255, 255, 0.38)',
    lg: 'inset 4px 4px 4px 0 rgba(255, 255, 255, 0.42), inset -4px -4px 4px 0 rgba(255, 255, 255, 0.42)',
    xl: 'inset 6px 6px 6px 0 rgba(255, 255, 255, 0.5), inset -6px -6px 6px 0 rgba(255, 255, 255, 0.5)',
    '2xl': 'inset 8px 8px 8px 0 rgba(255, 255, 255, 0.56), inset -8px -8px 8px 0 rgba(255, 255, 255, 0.56)'
  };

  const glowStyles = {
    none: '0 4px 8px rgba(2, 6, 23, 0.04)',
    xs: '0 8px 16px rgba(2, 6, 23, 0.08), 0 0 14px rgba(255, 255, 255, 0.06)',
    sm: '0 10px 18px rgba(2, 6, 23, 0.1), 0 0 20px rgba(255, 255, 255, 0.08)',
    md: '0 12px 24px rgba(2, 6, 23, 0.12), 0 0 28px rgba(255, 255, 255, 0.12)',
    lg: '0 16px 28px rgba(2, 6, 23, 0.14), 0 0 36px rgba(255, 255, 255, 0.15)',
    xl: '0 20px 34px rgba(2, 6, 23, 0.16), 0 0 42px rgba(255, 255, 255, 0.18)',
    '2xl': '0 26px 42px rgba(2, 6, 23, 0.2), 0 0 56px rgba(255, 255, 255, 0.22)'
  };

  const variants = useMemo(() => {
    if (!expandable) return undefined;
    return {
      collapsed: {
        width: width || 'auto',
        height: height || 'auto',
        transition: { duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }
      },
      expanded: {
        width: expandedWidth || width || 'auto',
        height: expandedHeight || height || 'auto',
        transition: { duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }
      }
    };
  }, [expandable, expandedHeight, expandedWidth, height, width]);

  const MotionComponent = draggable || expandable ? motion.div : 'div';
  const motionProps =
    draggable || expandable
      ? {
          variants,
          animate: expandable ? (isExpanded ? 'expanded' : 'collapsed') : undefined,
          onClick: expandable ? handleToggleExpansion : undefined,
          drag: draggable,
          dragConstraints: draggable ? { left: 0, right: 0, top: 0, bottom: 0 } : undefined,
          dragElastic: draggable ? 0.2 : undefined,
          dragTransition: draggable
            ? { bounceStiffness: 280, bounceDamping: 16, power: 0.25 }
            : undefined,
          whileDrag: draggable ? { scale: 1.01 } : undefined,
          whileHover: { scale: 1.01 },
          whileTap: { scale: 0.99 }
        }
      : {};

  return (
    <>
      <svg className="hidden" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId} x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.0025 0.006"
              numOctaves="1"
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale="120"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <MotionComponent
        className={cn(
          'relative overflow-hidden border border-white/35 bg-white/12',
          'dark:border-slate-600/45 dark:bg-slate-900/30',
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
        <div
          className={cn('absolute inset-0 z-0', blurClasses[blurIntensity] || blurClasses.xl)}
          style={{
            borderRadius,
            filter: `url(#${filterId})`
          }}
        />

        <div
          className="absolute inset-0 z-10"
          style={{
            borderRadius,
            boxShadow: glowStyles[glowIntensity] || glowStyles.sm
          }}
        />

        <div
          className="absolute inset-0 z-20"
          style={{
            borderRadius,
            boxShadow: shadowStyles[shadowIntensity] || shadowStyles.md
          }}
        />

        <div className={cn('relative z-30')}>{children}</div>
      </MotionComponent>
    </>
  );
};

export default LiquidGlassCard;
