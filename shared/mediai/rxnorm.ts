/** Official RxNorm CUIs. Live NLM RxNav lookup is on outside unit tests. */

import { isRxnavLive } from "./types.ts";

export interface RxNormHit {
  rxcui: string;
  generic: string;
  matchedName: string;
  source: "local" | "rxnav";
}

/**
 * Brand and generic names share a CUI. Values are published RxNorm identifiers
 * (https://mor.nlm.nih.gov/RxNav/), not invented IDs.
 */
export const RXNORM: Record<string, { rxcui: string; generic: string }> = {
  metformin: { rxcui: "6809", generic: "metformin" },
  glucophage: { rxcui: "6809", generic: "metformin" },
  glycomet: { rxcui: "6809", generic: "metformin" },
  amoxicillin: { rxcui: "723", generic: "amoxicillin" },
  amoxil: { rxcui: "723", generic: "amoxicillin" },
  augmentin: { rxcui: "723", generic: "amoxicillin" },
  warfarin: { rxcui: "11289", generic: "warfarin" },
  coumadin: { rxcui: "11289", generic: "warfarin" },
  ibuprofen: { rxcui: "5640", generic: "ibuprofen" },
  advil: { rxcui: "5640", generic: "ibuprofen" },
  brufen: { rxcui: "5640", generic: "ibuprofen" },
  lisinopril: { rxcui: "29046", generic: "lisinopril" },
  simvastatin: { rxcui: "36567", generic: "simvastatin" },
  zocor: { rxcui: "36567", generic: "simvastatin" },
  acetaminophen: { rxcui: "161", generic: "acetaminophen" },
  tylenol: { rxcui: "161", generic: "acetaminophen" },
  paracetamol: { rxcui: "161", generic: "acetaminophen" },
  dolo: { rxcui: "161", generic: "acetaminophen" },
  crocin: { rxcui: "161", generic: "acetaminophen" },
  calpol: { rxcui: "161", generic: "acetaminophen" },
  aspirin: { rxcui: "1191", generic: "aspirin" },
  ecosprin: { rxcui: "1191", generic: "aspirin" },
  atorvastatin: { rxcui: "83367", generic: "atorvastatin" },
  lipitor: { rxcui: "83367", generic: "atorvastatin" },
  storvas: { rxcui: "83367", generic: "atorvastatin" },
  amlodipine: { rxcui: "17767", generic: "amlodipine" },
  norvasc: { rxcui: "17767", generic: "amlodipine" },
  naproxen: { rxcui: "7258", generic: "naproxen" },
  aleve: { rxcui: "7258", generic: "naproxen" },
  diclofenac: { rxcui: "3355", generic: "diclofenac" },
  voltaren: { rxcui: "3355", generic: "diclofenac" },
  clarithromycin: { rxcui: "21212", generic: "clarithromycin" },
  biaxin: { rxcui: "21212", generic: "clarithromycin" },
  erythromycin: { rxcui: "4053", generic: "erythromycin" },
  ciprofloxacin: { rxcui: "2551", generic: "ciprofloxacin" },
  cipro: { rxcui: "2551", generic: "ciprofloxacin" },
  sildenafil: { rxcui: "136411", generic: "sildenafil" },
  viagra: { rxcui: "136411", generic: "sildenafil" },
  nitroglycerin: { rxcui: "4917", generic: "nitroglycerin" },
  glyceryltrinitrate: { rxcui: "4917", generic: "nitroglycerin" },
  spironolactone: { rxcui: "9997", generic: "spironolactone" },
  aldactone: { rxcui: "9997", generic: "spironolactone" },
  tramadol: { rxcui: "10689", generic: "tramadol" },
  ultram: { rxcui: "10689", generic: "tramadol" },
  sertraline: { rxcui: "36437", generic: "sertraline" },
  zoloft: { rxcui: "36437", generic: "sertraline" },
  fluoxetine: { rxcui: "4493", generic: "fluoxetine" },
  prozac: { rxcui: "4493", generic: "fluoxetine" },
  digoxin: { rxcui: "3407", generic: "digoxin" },
  lanoxin: { rxcui: "3407", generic: "digoxin" },
  amiodarone: { rxcui: "703", generic: "amiodarone" },
  cordarone: { rxcui: "703", generic: "amiodarone" },
  fluconazole: { rxcui: "4450", generic: "fluconazole" },
  diflucan: { rxcui: "4450", generic: "fluconazole" },
  metronidazole: { rxcui: "6922", generic: "metronidazole" },
  flagyl: { rxcui: "6922", generic: "metronidazole" },
  methotrexate: { rxcui: "6851", generic: "methotrexate" },
  trimethoprim: { rxcui: "10829", generic: "trimethoprim" },
  sulfamethoxazole: { rxcui: "10180", generic: "sulfamethoxazole" },
  bactrim: { rxcui: "10831", generic: "sulfamethoxazole / trimethoprim" },
  cotrimoxazole: { rxcui: "10831", generic: "sulfamethoxazole / trimethoprim" },
  theophylline: { rxcui: "10438", generic: "theophylline" },
  potassiumchloride: { rxcui: "8591", generic: "potassium chloride" },
  potassium: { rxcui: "8591", generic: "potassium chloride" },
  losartan: { rxcui: "52175", generic: "losartan" },
  telmisartan: { rxcui: "73494", generic: "telmisartan" },
  telma: { rxcui: "73494", generic: "telmisartan" },
  omeprazole: { rxcui: "7646", generic: "omeprazole" },
  pantoprazole: { rxcui: "40790", generic: "pantoprazole" },
  pantocid: { rxcui: "40790", generic: "pantoprazole" },
  azithromycin: { rxcui: "18631", generic: "azithromycin" },
  azithral: { rxcui: "18631", generic: "azithromycin" },
  cephalexin: { rxcui: "2231", generic: "cephalexin" },
  cefixime: { rxcui: "20489", generic: "cefixime" },
  insulin: { rxcui: "5856", generic: "insulin" },
  glimepiride: { rxcui: "25789", generic: "glimepiride" },
  clopidogrel: { rxcui: "32968", generic: "clopidogrel" },
  plavix: { rxcui: "32968", generic: "clopidogrel" },
  prednisone: { rxcui: "8640", generic: "prednisone" },
  prednisolone: { rxcui: "8638", generic: "prednisolone" },
  levothyroxine: { rxcui: "10582", generic: "levothyroxine" },
  thyronorm: { rxcui: "10582", generic: "levothyroxine" },
  alprazolam: { rxcui: "596", generic: "alprazolam" },
  xanax: { rxcui: "596", generic: "alprazolam" },
  diazepam: { rxcui: "3322", generic: "diazepam" },
  morphine: { rxcui: "7052", generic: "morphine" },
  codeine: { rxcui: "2670", generic: "codeine" },
  penicillin: { rxcui: "7980", generic: "penicillin" },
  ampicillin: { rxcui: "733", generic: "ampicillin" },
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

export interface RxnavPair {
  a: string;
  b: string;
  note: string;
}

/** NLM / DrugBank interaction payload. Numeric CUIs only. */
export function parseRxnavInteractions(data: unknown): RxnavPair[] {
  const groups = (data as {
    fullInteractionTypeGroup?: {
      fullInteractionType?: {
        interactionPair?: {
          description?: string;
          interactionConcept?: { minConceptItem?: { rxcui?: string } }[];
        }[];
      }[];
    }[];
  })?.fullInteractionTypeGroup;
  if (!Array.isArray(groups)) return [];
  const out: RxnavPair[] = [];
  for (const g of groups) {
    for (const t of g.fullInteractionType ?? []) {
      for (const pair of t.interactionPair ?? []) {
        const ids = (pair.interactionConcept ?? [])
          .map((c) => c.minConceptItem?.rxcui)
          .filter((id): id is string => typeof id === "string" && /^\d+$/.test(id));
        if (ids.length < 2 || !pair.description) continue;
        out.push({ a: ids[0], b: ids[1], note: pair.description });
      }
    }
  }
  return out;
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

export async function fetchRxnavInteractions(
  cuis: string[],
  fetchImpl: typeof fetch,
  timeoutMs = 3000,
): Promise<RxnavPair[]> {
  const ids = [...new Set(cuis.filter((c) => /^\d+$/.test(c)))];
  if (ids.length < 2) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${ids.join("+")}`;
    const r = await fetchImpl(url, { signal: ctrl.signal });
    if (!r.ok) return [];
    return parseRxnavInteractions(await r.json());
  } catch {
    return [];
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
  const live = opts?.liveNetwork ?? isRxnavLive();
  if (!live || !opts?.fetchImpl) return null;
  return lookupRxnav(raw, opts.fetchImpl);
}
