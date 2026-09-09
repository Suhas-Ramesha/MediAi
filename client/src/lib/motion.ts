import type { Transition, Variants } from "framer-motion";

/**
 * Shared motion vocabulary.
 *
 * The principles this encodes:
 *
 * 1. Motion explains a change; it is never decoration. Elements enter from
 *    the direction they conceptually come from, and travel a short distance.
 * 2. Short durations. Interface motion above ~400ms reads as sluggish, so
 *    entrances sit at 220–360ms and hover feedback at 150ms.
 * 3. One easing family. Entrances decelerate (fast out, slow in); exits
 *    accelerate so dismissals feel immediate.
 * 4. Small distances. 8–16px of travel is legible; 40px+ looks like a
 *    slideshow and causes layout shift on mobile.
 * 5. Entrances play once. Re-animating on every scroll pass is the single
 *    most common reason a landing page feels cheap.
 * 6. Reduced motion is honoured. See `useMotionSafe` below.
 */

/** Fast out, slow in. Default for anything entering the screen. */
export const EASE_EMPHASIZED = [0.22, 1, 0.36, 1] as const;

/** Accelerating. For anything leaving the screen. */
export const EASE_EXIT = [0.4, 0, 1, 1] as const;

export const DURATION = {
  fast: 0.15,
  base: 0.22,
  slow: 0.36,
} as const;

export const transition = {
  fast: { duration: DURATION.fast, ease: EASE_EMPHASIZED },
  base: { duration: DURATION.base, ease: EASE_EMPHASIZED },
  slow: { duration: DURATION.slow, ease: EASE_EMPHASIZED },
  exit: { duration: DURATION.fast, ease: EASE_EXIT },
} satisfies Record<string, Transition>;

/**
 * Viewport config for scroll-triggered reveals.
 *
 * `once: true` is the important part: without it, framer-motion replays the
 * entrance every time the element re-enters the viewport.
 */
export const viewportOnce = { once: true, amount: 0.25 } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: transition.slow },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.slow },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: transition.slow },
};

/** Slide in from the side. Distance stays small on purpose. */
export const slideIn = (from: "left" | "right"): Variants => ({
  hidden: { opacity: 0, x: from === "left" ? -16 : 16 },
  visible: { opacity: 1, x: 0, transition: transition.slow },
});

/**
 * Parent container that staggers its children. Pair with `fadeUp` on each
 * child so a group reads as one gesture rather than several.
 */
export const staggerContainer = (stagger = 0.06, delay = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

/** Standard hover/press feedback for cards and tiles. */
export const interactive = {
  whileHover: { y: -2, transition: transition.fast },
  whileTap: { scale: 0.99, transition: transition.fast },
} as const;
