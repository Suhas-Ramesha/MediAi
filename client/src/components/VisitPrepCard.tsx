import type { PrepResult } from "@shared/mediai/intake";

export function VisitPrepCard({ prep }: { prep: PrepResult }) {
  return (
    <article className="surface p-5">
      <h2 className="text-sm font-semibold">Walk in ready to talk</h2>
      <p className="mt-2 text-sm">{prep.guideline}</p>
      {prep.urgent && (
        <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {prep.urgent}
        </p>
      )}
      {prep.tell.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Say this first</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {prep.tell.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {prep.bring.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">
            Bring only if you already have it
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {prep.bring.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {prep.ask.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Ask the doctor</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {prep.ask.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {prep.doNot.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
          {prep.doNot.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
