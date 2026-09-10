/** Official RxNorm CUIs for the local lexicon. Network lookup is optional. */

export interface RxNormHit {
  rxcui: string;
  generic: string;
  matchedName: string;
  source: "local" | "rxnav";
}

/**
 * Brand and generic names share a CUI. Values are published RxNorm identifiers
 * (e.g. metformin 6809, warfarin 11289), not invented IDs.
 */
export const RXNORM: Record<string, { rxcui: string; generic: string }> = {
  metformin: { rxcui: "6809", generic: "metformin" },
  glucophage: { rxcui: "6809", generic: "metformin" },
  amoxicillin: { rxcui: "723", generic: "amoxicillin" },
  amoxil: { rxcui: "723", generic: "amoxicillin" },
  warfarin: { rxcui: "11289", generic: "warfarin" },
  coumadin: { rxcui: "11289", generic: "warfarin" },
  ibuprofen: { rxcui: "5640", generic: "ibuprofen" },
  advil: { rxcui: "5640", generic: "ibuprofen" },
  lisinopril: { rxcui: "29046", generic: "lisinopril" },
  simvastatin: { rxcui: "36567", generic: "simvastatin" },
  acetaminophen: { rxcui: "161", generic: "acetaminophen" },
  tylenol: { rxcui: "161", generic: "acetaminophen" },
  paracetamol: { rxcui: "161", generic: "acetaminophen" },
  aspirin: { rxcui: "1191", generic: "aspirin" },
  atorvastatin: { rxcui: "83367", generic: "atorvastatin" },
  lipitor: { rxcui: "83367", generic: "atorvastatin" },
  amlodipine: { rxcui: "17767", generic: "amlodipine" },
  norvasc: { rxcui: "17767", generic: "amlodipine" },
};

export const RXNORM_NAMES = Object.keys(RXNORM);

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

function fold(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve a token against the local RxNorm lexicon only.
 * Fuzzy matches are unique, length-gated, and never invent a CUI.
 */
export function lookupLocal(raw: string): RxNormHit | null {
  const key = fold(raw);
  if (key.length < 4) return null;

  for (const name of RXNORM_NAMES) {
    if (key.includes(name) || (name.includes(key) && key.length >= 6)) {
      const hit = RXNORM[name];
      return { rxcui: hit.rxcui, generic: hit.generic, matchedName: name, source: "local" };
    }
  }

  if (key.length < 6) return null;
  let best: { name: string; d: number } | null = null;
  let ties = 0;
  for (const name of RXNORM_NAMES) {
    const d = levenshtein(key, name);
    if (d > 2) continue;
    if (!best || d < best.d) {
      best = { name, d };
      ties = 1;
    } else if (d === best.d) {
      ties += 1;
    }
  }
  if (!best || ties !== 1) return null;
  const hit = RXNORM[best.name];
  return {
    rxcui: hit.rxcui,
    generic: hit.generic,
    matchedName: best.name,
    source: "local",
  };
}

export function parseRxnavBody(data: unknown): string | null {
  const id = (data as { idGroup?: { rxnormId?: string[] } })?.idGroup?.rxnormId?.[0];
  if (typeof id === "string" && /^\d+$/.test(id)) return id;
  return null;
}

export async function lookupRxnav(
  raw: string,
  fetchImpl: typeof fetch,
  timeoutMs = 2500,
): Promise<RxNormHit | null> {
  const name = raw.trim();
  if (name.length < 4) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}`;
    const r = await fetchImpl(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    const id = parseRxnavBody(await r.json());
    if (!id) return null;
    const local = lookupLocal(name);
    return {
      rxcui: id,
      generic: local?.generic ?? fold(name),
      matchedName: name.toLowerCase(),
      source: "rxnav",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveDrug(
  raw: string,
  opts?: { fetchImpl?: typeof fetch; liveNetwork?: boolean },
): Promise<RxNormHit | null> {
  const local = lookupLocal(raw);
  if (local) return local;
  if (!opts?.liveNetwork || !opts.fetchImpl) return null;
  return lookupRxnav(raw, opts.fetchImpl);
}
