import type { ChatEngineResult } from "@shared/mediai/chatSafety";

export function ChatEnginePanel({ result }: { result: ChatEngineResult }) {
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
        <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5">
          Medication check: {result.audit.status}. {result.audit.findings[0]}
        </p>
      )}
      {result.verdicts.length > 0 && (
        <ul className="space-y-1 text-muted-foreground">
          {result.verdicts.map((v) => (
            <li key={v.claimId}>
              <span
                className={
                  v.status === "supported"
                    ? "text-foreground"
                    : v.status === "contradicted"
                      ? "text-destructive underline decoration-wavy"
                      : "underline decoration-dotted decoration-warning"
                }
              >
                {v.text.length > 140 ? `${v.text.slice(0, 137)}…` : v.text}
              </span>
              <span className="ml-1 uppercase tracking-wide">
                {v.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
