import {
  BODY_REGIONS,
  type BodyHit,
  type BodyMapResult,
} from "@shared/mediai/bodyMap";

function Marker({
  hit,
  active,
  onSelect,
}: {
  hit: BodyHit;
  active: boolean;
  onSelect: () => void;
}) {
  const region = BODY_REGIONS[hit.regionId];
  const labelX = region.x >= 100 ? 168 : 8;
  const anchor = region.x >= 100 ? 164 : 36;
  return (
    <g>
      <line
        x1={region.x}
        y1={region.y}
        x2={anchor}
        y2={region.y}
        className={hit.urgency === "red" ? "stroke-destructive" : "stroke-primary"}
        strokeWidth={active ? 1.8 : 1.1}
      />
      <polygon
        points={
          region.x >= 100
            ? `${region.x + 7},${region.y} ${region.x + 1},${region.y - 4} ${region.x + 1},${region.y + 4}`
            : `${region.x - 7},${region.y} ${region.x - 1},${region.y - 4} ${region.x - 1},${region.y + 4}`
        }
        className={hit.urgency === "red" ? "fill-destructive" : "fill-primary"}
      />
      <circle
        cx={region.x}
        cy={region.y}
        r={active ? 7 : 5.5}
        className={
          hit.urgency === "red"
            ? "fill-destructive/20 stroke-destructive"
            : "fill-primary/20 stroke-primary"
        }
        strokeWidth={1.5}
      />
      <circle cx={region.x} cy={region.y} r={2.2} className="fill-foreground" />
      <foreignObject x={labelX} y={region.y - 14} width={56} height={28}>
        <button
          type="button"
          onClick={onSelect}
          className={`w-full rounded-md px-1 py-0.5 text-left text-[10px] leading-tight ${
            active
              ? "bg-primary text-primary-foreground"
              : "bg-card text-card-foreground shadow-xs"
          }`}
        >
          {hit.label}
        </button>
      </foreignObject>
    </g>
  );
}

function BodyOutline() {
  return (
    <g
      fill="none"
      className="stroke-foreground/70"
      strokeWidth={1.6}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <ellipse cx="100" cy="40" rx="22" ry="26" />
      <path d="M88 64c2 10 6 14 12 14s10-4 12-14" />
      <path d="M84 80c-22 18-30 46-28 78" />
      <path d="M116 80c22 18 30 46 28 78" />
      <path d="M56 158c-8 22-6 40 2 52" />
      <path d="M144 158c8 22 6 40-2 52" />
      <path d="M78 80c-4 8-8 22-8 40v70c0 16 6 28 14 36l6 92" />
      <path d="M122 80c4 8 8 22 8 40v70c0 16-6 28-14 36l-6 92" />
      <path d="M90 318c-4 48-2 86 2 118" />
      <path d="M110 318c4 48 2 86-2 118" />
      <path d="M84 438c-10 4-14 10-12 16" />
      <path d="M116 438c10 4 14 10 12 16" />
      <path d="M78 190c8 6 14 8 22 8s14-2 22-8" className="stroke-foreground/35" />
    </g>
  );
}

export function SymptomBodyMap({
  map,
  selectedId,
  onSelect,
}: {
  map: BodyMapResult;
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const selected =
    map.hits.find((h) => h.regionId === selectedId) ?? map.hits[0] ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,220px)_1fr] lg:items-start">
      <div className="mx-auto w-full max-w-[220px]">
        <svg
          viewBox="0 0 200 480"
          className="h-auto w-full"
          role="img"
          aria-label="Body outline with reported symptom sites"
        >
          <BodyOutline />
          {map.hits.map((hit) => (
            <Marker
              key={hit.regionId}
              hit={hit}
              active={selected?.regionId === hit.regionId}
              onSelect={() => onSelect?.(hit.regionId)}
            />
          ))}
        </svg>
        {map.hits.length === 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            No site mapped from these words yet.
          </p>
        )}
      </div>

      <div className="space-y-4 text-sm">
        <div>
          <p className="text-xs font-medium text-muted-foreground">When it started</p>
          <p className="mt-1">{map.onsetSummary}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Booked visit</p>
          <p className="mt-1">
            {map.visit
              ? `${map.visit.when}${map.visit.doctorName ? ` · ${map.visit.doctorName}` : ""}`
              : "No upcoming slot stored on this device."}
          </p>
        </div>
        {map.redFlags.length > 0 && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
            Urgent phrases: {map.redFlags.join(", ")}. Do not wait on a routine slot.
          </p>
        )}
        {map.findings.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              From your words
            </p>
            <p className="mt-1">{map.findings.join(", ")}</p>
          </div>
        )}
        {selected && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <p className="font-medium">{selected.label}</p>
            {selected.sourcePhrases.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {selected.sourcePhrases.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              Doctors often ask next
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {selected.relatedToAsk.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
