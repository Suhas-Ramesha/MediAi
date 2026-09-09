import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import {
  fadeUp,
  staggerContainer,
  transition,
  viewportOnce,
} from "@/lib/motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Seconds to wait before this element starts animating. */
  delay?: number;
  variants?: Variants;
  as?: "div" | "section" | "header" | "li" | "span";
};

/**
 * Reveals its children once, the first time they scroll into view.
 *
 * When the user has asked for reduced motion this renders a plain element
 * with no animation at all, rather than a faster animation.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  variants = fadeUp,
  as = "div",
}: RevealProps) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as];

  if (reduceMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={{ ...transition.slow, delay }}
    >
      {children}
    </MotionTag>
  );
}

type RevealGroupProps = {
  children: React.ReactNode;
  className?: string;
  /** Seconds between each child starting. */
  stagger?: number;
  delay?: number;
  as?: "div" | "section" | "ul";
};

/**
 * Staggers a set of `RevealItem` children so a grid or list reads as a
 * single gesture instead of several unrelated ones.
 */
export function RevealGroup({
  children,
  className,
  stagger = 0.06,
  delay = 0,
  as = "div",
}: RevealGroupProps) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as];

  if (reduceMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      variants={staggerContainer(stagger, delay)}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
    >
      {children}
    </MotionTag>
  );
}

export function RevealItem({
  children,
  className,
  variants = fadeUp,
  as = "div",
}: Omit<RevealProps, "delay">) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as];

  if (reduceMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag className={className} variants={variants}>
      {children}
    </MotionTag>
  );
}

/** Thin progress bar showing how far down the page the reader is. */
export function ScrollProgress({ className }: { className?: string }) {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setProgress(scrollable > 0 ? doc.scrollTop / scrollable : 0);
    };

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5",
        className,
      )}
    >
      <div
        className="h-full origin-left bg-primary transition-transform duration-100 ease-out"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
