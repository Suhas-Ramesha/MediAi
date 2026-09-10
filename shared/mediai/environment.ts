/** Pearson correlation of x[t] with y[t+lag]. */
export function laggedCorrelation(
  x: number[],
  y: number[],
  lag: number,
): number {
  if (lag < 0) return laggedCorrelation(y, x, -lag);
  const n = Math.min(x.length, y.length) - lag;
  if (n < 8) return 0;
  const xs = x.slice(0, n);
  const ys = y.slice(lag, lag + n);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = xs[i] - mx;
    const vy = ys[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

export function bestLag(
  env: number[],
  symptoms: number[],
  maxLag = 5,
): { lag: number; r: number } {
  let best = { lag: 0, r: 0 };
  for (let lag = 0; lag <= maxLag; lag++) {
    const r = laggedCorrelation(env, symptoms, lag);
    if (Math.abs(r) > Math.abs(best.r)) best = { lag, r };
  }
  return best;
}

const NULL_THRESHOLD = 0.35;

export function inferTrigger(
  env: number[],
  symptoms: number[],
): { lag: number; r: number; signal: boolean } {
  const { lag, r } = bestLag(env, symptoms);
  return { lag, r, signal: Math.abs(r) >= NULL_THRESHOLD };
}

export function shuffle<T>(arr: T[], seed = 1): T[] {
  const out = [...arr];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (1664525 * s + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
