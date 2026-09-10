export interface RiskInputs {
  fastingGlucose: number;
  bmi: number;
  age: number;
  systolic: number;
  familyHistory: boolean;
}

export interface ProjectionPoint {
  year: number;
  diabetes: number;
  heart: number;
  kidney: number;
}

const BOUNDS = {
  fastingGlucose: [70, 250],
  bmi: [16, 50],
  age: [18, 90],
  systolic: [90, 200],
} as const;

function clip(n: number, [lo, hi]: readonly [number, number]): number {
  return Math.min(hi, Math.max(lo, n));
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/** Local monotonic surface. Positive coefficients raise risk. */
export function projectRisk(inputs: RiskInputs): {
  diabetes: number;
  heart: number;
  kidney: number;
} {
  const g = clip(inputs.fastingGlucose, BOUNDS.fastingGlucose);
  const bmi = clip(inputs.bmi, BOUNDS.bmi);
  const age = clip(inputs.age, BOUNDS.age);
  const sys = clip(inputs.systolic, BOUNDS.systolic);
  const fam = inputs.familyHistory ? 1 : 0;

  const diabetes = sigmoid(
    -3.93 + 0.01 * g + 0.04 * bmi + 0.01 * age + 0.3 * fam,
  );
  const heart = sigmoid(
    -4.1 + 0.008 * sys + 0.035 * bmi + 0.012 * age + 0.004 * g,
  );
  const kidney = sigmoid(
    -3.8 + 0.04 * bmi + 0.01 * age + 0.006 * sys + 0.003 * g,
  );
  return {
    diabetes: diabetes * 100,
    heart: heart * 100,
    kidney: kidney * 100,
  };
}

export function projectCurve(
  base: RiskInputs,
  years = 5,
  bmiDeltaPerYear = 0,
): ProjectionPoint[] {
  const points: ProjectionPoint[] = [];
  for (let y = 0; y <= years; y++) {
    const r = projectRisk({ ...base, bmi: base.bmi + bmiDeltaPerYear * y, age: base.age + y });
    points.push({ year: y, ...r });
  }
  return points;
}

export interface Counterfactual {
  feature: keyof RiskInputs;
  from: number | boolean;
  to: number | boolean;
  diabetesDrop: number;
  riskDrop: number;
  description: string;
}

function summedDrop(
  before: ReturnType<typeof projectRisk>,
  after: ReturnType<typeof projectRisk>,
): number {
  return (
    before.diabetes - after.diabetes +
    (before.heart - after.heart) +
    (before.kidney - after.kidney)
  );
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Constrained search over physiologically plausible single-feature changes.
 * Seeded so ranking is stable across re-runs.
 */
export function counterfactuals(base: RiskInputs, seed = 42): Counterfactual[] {
  const rand = seeded(seed);
  void rand;
  const baseline = projectRisk(base);
  const candidates: Counterfactual[] = [];

  const glucoseTargets = [126, 118, 110, 100, 90];
  for (const to of glucoseTargets) {
    if (to >= base.fastingGlucose) continue;
    if (to < BOUNDS.fastingGlucose[0]) continue;
    const next = projectRisk({ ...base, fastingGlucose: to });
    candidates.push({
      feature: "fastingGlucose",
      from: base.fastingGlucose,
      to,
      diabetesDrop: baseline.diabetes - next.diabetes,
      riskDrop: summedDrop(baseline, next),
      description: `reduce fasting glucose to ${to} mg/dL`,
    });
  }

  const bmiTargets = [30, 28, 26, 24];
  for (const to of bmiTargets) {
    if (to >= base.bmi) continue;
    if (to < BOUNDS.bmi[0]) continue;
    const next = projectRisk({ ...base, bmi: to });
    candidates.push({
      feature: "bmi",
      from: base.bmi,
      to,
      diabetesDrop: baseline.diabetes - next.diabetes,
      riskDrop: summedDrop(baseline, next),
      description: `reduce BMI to ${to}`,
    });
  }

  const sysTargets = [130, 120];
  for (const to of sysTargets) {
    if (to >= base.systolic) continue;
    const next = projectRisk({ ...base, systolic: to });
    candidates.push({
      feature: "systolic",
      from: base.systolic,
      to,
      diabetesDrop: baseline.diabetes - next.diabetes,
      riskDrop: summedDrop(baseline, next),
      description: `reduce systolic to ${to} mmHg`,
    });
  }

  for (const c of candidates) {
    const trial: RiskInputs = { ...base };
    if (c.feature === "familyHistory") continue;
    (trial[c.feature] as number) = c.to as number;
    const lo = BOUNDS[c.feature as "bmi"];
    if (lo && ((c.to as number) < lo[0] || (c.to as number) > lo[1])) {
      throw new Error("bound_violation");
    }
  }

  return candidates
    .filter((c) => c.riskDrop > 0)
    .sort((a, b) => b.riskDrop - a.riskDrop);
}

export const SLIDER_LATENCY_BUDGET_MS = 200;

export function timeProjection(base: RiskInputs, bmi: number): {
  ms: number;
  points: ProjectionPoint[];
} {
  const t0 = performance.now();
  const points = projectCurve({ ...base, bmi }, 5, 0);
  return { ms: performance.now() - t0, points };
}
