import { useState } from "react";

import type { ChatEngineResult } from "@shared/mediai/chatSafety";

export function ChatEnginePanel({ result }: { result: ChatEngineResult }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const flagged = result.verdicts.filter((v) => v.status !== "supported");
  const lead = result.differential?.[0];
  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
      {result.escalation.escalate && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-destructive">
          Red flag: {result.escalation.flags.join(", ")}. Seek urgent care now.
        </p>
      )}
      {result.incomplete && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-foreground">
          Incomplete: a medicine name could not be resolved to RxNorm. No
          all-clear.
        </p>
      )}
      {result.audit && result.audit.status !== "clear" && result.audit.status !== "incomplete" && (
        <ul className="space-y-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5">
          {result.audit.findings.map((f) => (
            <li key={f}>Medication check: {result.audit?.status}. {f}</li>
          ))}
        </ul>
      )}
      {result.mentions.filter((m) => m.rxcui).length > 0 && (
        <ul className="rounded-md border border-border bg-muted/40 px-2 py-1.5">
          {result.mentions
            .filter((m) => m.rxcui)
            .map((m) => (
              <li key={`${m.raw}-${m.rxcui}`}>
                {m.generic || m.raw} · RxCUI {m.rxcui}
              </li>
            ))}
        </ul>
      )}
      {lead && (
        <p className="text-muted-foreground">
          Engine ranking: {lead.condition.replace(/_/g, " ")}{" "}
          {Math.round(lead.probability * 100)}%
        </p>
      )}
      {result.consilium && (
        <div>
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() => setShowReasoning((v) => !v)}
          >
            {showReasoning ? "Hide four-model reasoning" : "Show four-model reasoning"}
          </button>
          {showReasoning && (
            <ul className="mt-2 space-y-2 rounded-md border border-border bg-muted/40 p-2">
              {result.consilium.personas.map((p) => (
                <li key={p.persona}>
                  <p className="font-medium capitalize">{p.persona}</p>
                  <p className="mt-0.5 text-muted-foreground">{p.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {flagged.length > 0 && (
        <p className="text-muted-foreground">
          Dotted underline = not supported by your words. Wavy = contradicted.
        </p>
      )}
    </div>
  );
}
