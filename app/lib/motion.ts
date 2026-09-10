export const appleEase = [0.22, 1, 0.36, 1] as const;

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

export const popover = {
  initial: { opacity: 0, y: 6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.98 },
};

export const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.03,
    },
  },
};

export const cardReveal = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: appleEase },
  },
};
