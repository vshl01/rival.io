import type { Variants } from 'framer-motion';

/** Signature easing — a confident, slightly overshooting ease-out. */
export const ease = [0.16, 1, 0.3, 1] as const;
export const easeSpring = { type: 'spring', stiffness: 320, damping: 30, mass: 0.8 } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease } },
};

export const blurUp: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease } },
};

/** Parent that staggers its children's entrance. */
export const staggerContainer = (stagger = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren } },
});

/** Per-character headline reveal (used by KineticHeadline). */
export const charReveal: Variants = {
  hidden: { y: '110%' },
  visible: (i: number) => ({
    y: '0%',
    transition: { duration: 0.7, ease, delay: i },
  }),
};

/** Spring pop for list items / cards entering the layout. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: easeSpring },
  exit: { opacity: 0, scale: 0.96, y: -8, transition: { duration: 0.2, ease } },
};
