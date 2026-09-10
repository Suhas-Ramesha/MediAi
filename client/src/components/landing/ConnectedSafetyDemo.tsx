import { useMemo } from "react";

import { inferTrigger } from "@shared/mediai/environment";
import {
  forwardAudit,
  mergeIntoGraph,
  parsePrescriptionText,
  sideEffectWatch,
  type SafetyGraph,
} from "@shared/mediai/medication";

function demoGraph(): SafetyGraph {
  const parsed = parsePrescriptionText("warfarin 5mg", "doc1", "2026-07-01");
  const metformin = parsePrescriptionText(
    "Glucophage 500 mg",
    "doc1",
    "2026-09-01",
  );
  const empty: SafetyGraph = {
    patientId: "demo",
    allergies: ["penicillin"],
    organFlags: { kidneyImpairment: false, liverImpairment: false },
    medications: [],
  };
  const once = mergeIntoGraph(empty, parsed.entries);
  return mergeIntoGraph(once.graph, metformin.entries).graph;
}

export function ConnectedSafetyDemo() {
  const graph = useMemo(() => demoGraph(), []);
  const audit = useMemo(
    () => forwardAudit(graph, "ibuprofen 400mg", "doc2"),
    [graph],
  );
  const unknown = useMemo(
    () => forwardAudit(graph, "xyzalorpha 10mg", "doc2"),
    [graph],
  );
  const watch = useMemo(
    () => sideEffectWatch(graph, "watery diarrhea since this morning", "2026-09-08"),
    [graph],
  );
  const env = useMemo(() => {
    const air = Array.from({ length: 40 }, (_, i) => Math.sin(i / 4));
    const symptoms = air.map((_, i) => (i >= 2 ? air[i - 2] : 0));
    return inferTrigger(air, symptoms);
  }, []);

  return (
    <div className="mt-10 grid gap-4 md:grid-cols-2">
      <article className="surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cross-doctor audit
        </p>
        <p className="mt-2 text-sm">
          Doctor 1: warfarin. Doctor 2: ibuprofen. Status:{" "}
          <span className="font-semibold text-warning">{audit.status}</span>
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {audit.findings.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        {watch.matches[0] && (
          <p className="mt-3 text-sm text-muted-foreground">
            Side-effect watch: {watch.matches[0].drug} and{" "}
            {watch.matches[0].effect} ({watch.matches[0].daysSinceStart} days
            after start).
          </p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Unknown name &quot;xyzalorpha&quot;: {unknown.status} —{" "}
          {unknown.findings[0]}
        </p>
      </article>
      <article className="surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Local air lag (synthetic series)
        </p>
        {env.signal ? (
          <p className="mt-2 text-sm">
            Symptoms follow the pollution series by {env.lag} day
            {env.lag === 1 ? "" : "s"} (r = {env.r.toFixed(2)}).
          </p>
        ) : (
          <p className="mt-2 text-sm">No lagged correlation above the null threshold.</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Live weather lookup is optional. A shuffled series is treated as no
          signal, not a weak hint.
        </p>
      </article>
    </div>
  );
}
