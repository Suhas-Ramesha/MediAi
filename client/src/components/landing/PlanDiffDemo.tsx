import { diffPlans } from "@shared/mediai/outcomes";

const DIFF = diffPlans(
  {
    drug: "amoxicillin",
    dose: "500mg",
    duration: "7d",
    investigations: ["throat swab"],
  },
  {
    drug: "azithromycin",
    dose: "500mg",
    duration: "3d",
    investigations: ["throat swab", "CBC"],
  },
);

export function PlanDiffDemo() {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-2 border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <p className="px-3 py-2">Plan A</p>
        <p className="px-3 py-2">Plan B</p>
      </div>
      {DIFF.diffs.map((d) => (
        <div
          key={`${d.field}-${d.a}-${d.b}`}
          className="grid grid-cols-2 border-b border-border last:border-b-0 text-sm"
        >
          <p className="px-3 py-2">
            <span className="text-xs uppercase text-muted-foreground">
              {d.field}
            </span>
            <br />
            {d.a}
          </p>
          <p className="px-3 py-2">
            <span className="text-xs uppercase text-muted-foreground">
              {d.field}
            </span>
            <br />
            {d.b}
          </p>
        </div>
      ))}
      <p className="px-3 py-2 text-xs text-muted-foreground">{DIFF.copy}</p>
    </div>
  );
}
