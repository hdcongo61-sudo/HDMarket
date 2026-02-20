export const motionDurations = {
  fast: 0.2,
  normal: 0.26,
  slow: 0.32
};

export const motionEase = [0.22, 1, 0.36, 1];

export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: motionDurations.normal, ease: motionEase }
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04
    }
  }
};
