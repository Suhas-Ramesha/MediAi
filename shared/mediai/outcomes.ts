export interface Episode {
  id: string;
  patientId: string;
  doctorId: string;
  treatment: string;
  confounder: number;
  treated: boolean;
  resolvedDay7: boolean;
  timeToResolutionDays: number;
}

export function naiveMean(episodes: Episode[], treatment: string): number {
  const rows = episodes.filter((e) => e.treatment === treatment);
  if (!rows.length) return NaN;
  return rows.reduce((s, e) => s + e.timeToResolutionDays, 0) / rows.length;
}

function propensity(confounder: number): number {
  return 1 / (1 + Math.exp(-(confounder - 0.5) * 4));
}

/** 1:1 nearest-neighbour matching on propensity. */
export function matchedEffect(
  episodes: Episode[],
  treatment: string,
): { estimate: number; nPairs: number; insufficient: boolean } {
  const treated = episodes.filter((e) => e.treatment === treatment && e.treated);
  const control = episodes.filter((e) => e.treatment === treatment && !e.treated);
  if (treated.length < 20 || control.length < 20) {
    return { estimate: NaN, nPairs: 0, insufficient: true };
  }
  const used = new Set<string>();
  const diffs: number[] = [];
  for (const t of treated) {
    const pt = propensity(t.confounder);
    let best: Episode | null = null;
    let bestD = Infinity;
    for (const c of control) {
      if (used.has(c.id)) continue;
      const d = Math.abs(pt - propensity(c.confounder));
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best && bestD < 0.15) {
      used.add(best.id);
      diffs.push(t.timeToResolutionDays - best.timeToResolutionDays);
    }
  }
  if (diffs.length < 15) {
    return { estimate: NaN, nPairs: diffs.length, insufficient: true };
  }
  const estimate = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return { estimate, nPairs: diffs.length, insufficient: false };
}

export function synthesizeConfoundedCohort(n = 200, seed = 7): Episode[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const episodes: Episode[] = [];
  for (let i = 0; i < n; i++) {
    const confounder = rand();
    const treated = rand() < propensity(confounder);
    const trueEffect = treated ? -3 : 0;
    const time = 8 + 15 * confounder + trueEffect + (rand() - 0.5);
    episodes.push({
      id: `e${i}`,
      patientId: `p${i}`,
      doctorId: treated ? "d1" : "d2",
      treatment: "drugA",
      confounder,
      treated,
      resolvedDay7: time <= 7,
      timeToResolutionDays: Math.max(1, time),
    });
  }
  return episodes;
}

export function day7Rate(
  episodes: Episode[],
  doctorId?: string,
): { rate: number; n: number; insufficient: boolean } {
  const rows = doctorId
    ? episodes.filter((e) => e.doctorId === doctorId)
    : episodes;
  if (rows.length < 15) {
    return { rate: NaN, n: rows.length, insufficient: true };
  }
  const rate = rows.filter((e) => e.resolvedDay7).length / rows.length;
  return { rate, n: rows.length, insufficient: false };
}

export interface Plan {
  drug: string;
  dose: string;
  duration: string;
  investigations: string[];
}

export interface PlanDiff {
  field: "drug" | "dose" | "duration" | "investigation";
  a: string;
  b: string;
}

const EDITORIAL = /(better|worse|superior|should have|incorrect|wrong|prefer)/i;

export function diffPlans(a: Plan, b: Plan): { diffs: PlanDiff[]; copy: string } {
  const diffs: PlanDiff[] = [];
  if (a.drug.toLowerCase() !== b.drug.toLowerCase()) {
    diffs.push({ field: "drug", a: a.drug, b: b.drug });
  }
  if (a.dose !== b.dose) diffs.push({ field: "dose", a: a.dose, b: b.dose });
  if (a.duration !== b.duration) {
    diffs.push({ field: "duration", a: a.duration, b: b.duration });
  }
  const invA = new Set(a.investigations.map((x) => x.toLowerCase()));
  const invB = new Set(b.investigations.map((x) => x.toLowerCase()));
  for (const x of Array.from(invA)) {
    if (!invB.has(x)) diffs.push({ field: "investigation", a: x, b: "(not listed)" });
  }
  for (const x of Array.from(invB)) {
    if (!invA.has(x)) diffs.push({ field: "investigation", a: "(not listed)", b: x });
  }
  const copy = diffs.length
    ? diffs
        .map((d) => `${d.field}: plan A ${d.a}; plan B ${d.b}`)
        .join(". ")
    : "The two plans list the same drug, dose, duration, and investigations.";
  if (EDITORIAL.test(copy)) {
    throw new Error("editorial_language");
  }
  return { diffs, copy };
}
