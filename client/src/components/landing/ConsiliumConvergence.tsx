import { motion, useReducedMotion } from "framer-motion";

import { runConsilium } from "@shared/mediai/consilium";
import { transition } from "@/lib/motion";

const RESULT = runConsilium(
  [
    { condition: "viral_uri", probability: 0.55 },
    { condition: "strep_pharyngitis", probability: 0.25 },
  ],
  ["fever", "sore_throat"],
);

/**
 * One diagram of four positions settling into a resolved line.
 * Reduced-motion users get the settled end-state, not a blank freeze.
 */
export function ConsiliumConvergence() {
  const reduce = useReducedMotion();

  return (
    <div className="surface mt-4 p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Four passes, one preserved dissent
      </p>
      <div className="relative mt-5 space-y-3">
        {RESULT.personas.map((p, i) => (
          <motion.div
            key={p.persona}
            initial={reduce ? false : { x: i % 2 === 0 ? -12 : 12, opacity: 0.45 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ ...transition.slow, delay: reduce ? 0 : i * 0.08 }}
            className="rounded-lg border border-border bg-background/80 px-3 py-2"
          >
            <p className="text-xs font-semibold capitalize text-primary">
              {p.persona}
            </p>
            <p className="mt-1 text-sm text-foreground/85">{p.text}</p>
          </motion.div>
        ))}
        <motion.div
          initial={reduce ? false : { scaleX: 0.2, opacity: 0.4 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={transition.slow}
          className="origin-left rounded-lg border border-primary/30 bg-primary/8 px-3 py-2"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Resolved line
          </p>
          <p className="mt-1 text-sm">{RESULT.resolution}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Dissent kept: {RESULT.dissent}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
