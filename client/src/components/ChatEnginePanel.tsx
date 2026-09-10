import type { ChatEngineResult } from "@shared/mediai/chatSafety";

export function ChatEnginePanel({ result }: { result: ChatEngineResult }) {
  const flagged = result.verdicts.filter((v) => v.status !== "supported");
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
      {flagged.length > 0 && (
        <p className="text-muted-foreground">
          Dotted underline = not supported by your words. Wavy = contradicted.
        </p>
      )}
    </div>
  );
}
