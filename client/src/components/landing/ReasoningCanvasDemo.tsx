import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { runCanvasTurn } from "@shared/mediai/canvas";
import { transition } from "@/lib/motion";

const DEMO_STATE = {
  answers: { fever: "yes" as const, sore_throat: "yes" as const },
  turn: 2,
};

const DEMO_ANSWER =
  "Fever and sore throat are common in viral upper respiratory infection. You definitely have leukaemia based on this visit. Seek care if breathing is difficult.";

const DEMO_EVIDENCE = [
  "Fever and sore throat are common in viral upper respiratory infection. Seek care if breathing is difficult.",
];

export function ReasoningCanvasDemo() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(reduce ? 3 : 0);

  const events = useMemo(
    () =>
      runCanvasTurn({
        state: DEMO_STATE,
        answerText: DEMO_ANSWER,
        evidence: DEMO_EVIDENCE,
      }),
    [],
  );

  const claims = events.filter((e) => e.type === "verifier.claim");
  const conditions = events.find((e) => e.type === "triage.distribution");
  const bars =
    conditions && conditions.type === "triage.distribution"
      ? conditions.conditions.slice(0, 4)
      : [];
  const resolution = events.find((e) => e.type === "consilium.resolution");

  const [showReasoning, setShowReasoning] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const t1 = window.setTimeout(() => setPhase(1), 400);
    const t2 = window.setTimeout(() => setPhase(2), 1100);
    const t3 = window.setTimeout(() => setPhase(3), 1900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [reduce]);

  return (
    <div className="surface-raised overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 border-b border-border p-5 lg:border-b-0 lg:border-r">
          <p className="text-xs font-medium text-muted-foreground">
            Live canvas on a recorded fever-and-sore-throat turn
          </p>
          <p className="max-w-xl rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            I have had a fever and a sore throat since yesterday
          </p>
          <div className="space-y-2 text-sm leading-relaxed">
            {claims.map((c, i) => {
              if (c.type !== "verifier.claim") return null;
              const visible = phase >= 1 || reduce;
              const unsupported = c.status !== "supported";
              return (
                <p
                  key={c.claimId}
                  className={visible ? "text-foreground" : "text-muted-foreground"}
                  style={{
                    textDecorationLine: visible ? "underline" : "none",
                    textDecorationStyle: unsupported ? "dotted" : "solid",
                    textDecorationColor: unsupported
                      ? "hsl(var(--warning))"
                      : "hsl(var(--primary))",
                    textUnderlineOffset: 4,
                    opacity: reduce || phase >= 1 ? 1 : 0.4,
                    transitionDelay: `${i * 80}ms`,
                  }}
                  title={
                    unsupported
                      ? `Not supported by retrieved evidence (${c.status}, ${(c.confidence * 100).toFixed(0)}%)`
                      : `Supported by retrieved evidence (${(c.confidence * 100).toFixed(0)}%)`
                  }
                >
                  {c.text}
                </p>
              );
            })}
          </div>
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setShowReasoning((s) => !s)}
          >
            {showReasoning ? "Hide reasoning" : "Show reasoning"}
          </button>
          {showReasoning && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
              {events
                .filter((e) => e.type === "consilium.persona")
                .map((e) =>
                  e.type === "consilium.persona" ? (
                    <div key={e.persona}>
                      <p
                        className={
                          e.persona === "skeptic"
                            ? "text-xs font-semibold uppercase tracking-wide text-primary"
                            : "text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        }
                      >
                        {e.persona}
                      </p>
                      <p className="mt-1 text-foreground/90">{e.text}</p>
                    </div>
                  ) : null,
                )}
              {resolution && resolution.type === "consilium.resolution" && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Moderator resolution
                  </p>
                  <p>{resolution.resolution}</p>
                  <p className="text-muted-foreground">
                    Preserved dissent: {resolution.dissent}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
        <div className="space-y-3 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Probability mass
          </p>
          {bars.map((c, i) => (
            <div key={c.condition}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{c.condition.replace(/_/g, " ")}</span>
                <span data-numeric>{Math.round(c.probability * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full origin-left rounded-full bg-primary"
                  initial={reduce ? false : { scaleX: 0.15 }}
                  animate={{
                    scaleX: phase >= 2 || reduce ? c.probability : 0.15,
                  }}
                  transition={{ ...transition.slow, delay: reduce ? 0 : i * 0.06 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
