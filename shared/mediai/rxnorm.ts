/**
 * Live NLM RxNav REST (published at https://rxnav.nlm.nih.gov/ ).
 * findRxcuiByString: https://lhncbc.nlm.nih.gov/RxNav/APIs/api-RxNorm.findRxcuiByString.html
 * Interactions: https://lhncbc.nlm.nih.gov/RxNav/APIs/InteractionAPIs.html
 */

import { RXNORM_FIXTURE } from "./rxnorm.fixture.ts";
import { isRxnavLive } from "./types.ts";

/** Public RxNav REST origin (NLM). */
export const RXNAV_REST = "https://rxnav.nlm.nih.gov/REST";

export interface RxNormHit {
  rxcui: string;
  generic: string;
  matchedName: string;
  source: "local" | "rxnav";
}

function isVitest(): boolean {
  return typeof process !== "undefined" && Boolean(process.env?.VITEST);
}

function defaultFetch(): typeof fetch | undefined {
  return typeof fetch !== "undefined" ? fetch : undefined;
}

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
 * Vitest-only name → CUI table. The running app uses RxNav REST, not this map.
 */
export function lookupLocal(raw: string): RxNormHit | null {
  if (!isVitest()) return null;
  const table = RXNORM_FIXTURE;
  const names = Object.keys(table);
  const key = fold(raw);
  if (key.length < 4) return null;

  for (const name of names) {
    if (key.includes(name) || (name.includes(key) && key.length >= 6)) {
      const hit = table[name];
      return { rxcui: hit.rxcui, generic: hit.generic, matchedName: name, source: "local" };
    }
  }

  if (key.length < 6) return null;
  let best: { name: string; d: number } | null = null;
  let ties = 0;
  for (const name of names) {
    if (key[0] !== name[0]) continue;
    const d = levenshtein(key, name);
    const prefix3 = key.slice(0, 3) === name.slice(0, 3);
    const ok =
      (d === 1 && Math.abs(key.length - name.length) <= 2) ||
      (d === 2 && prefix3 && key.length >= 8 && name.length >= 8);
    if (!ok) continue;
    if (!best || d < best.d) {
      best = { name, d };
      ties = 1;
    } else if (d === best.d) {
      ties += 1;
    }
  }
  if (!best || ties !== 1) return null;
  const hit = table[best.name];
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

export function parseRxnavRelatedIngredient(data: unknown): { rxcui: string; name: string } | null {
  const groups = (data as {
    relatedGroup?: { conceptGroup?: { tty?: string; conceptProperties?: { rxcui?: string; name?: string }[] }[] };
  })?.relatedGroup?.conceptGroup;
  if (!Array.isArray(groups)) return null;
  for (const tty of ["IN", "MIN", "PIN"]) {
    const group = groups.find((g) => g.tty === tty);
    const first = group?.conceptProperties?.[0];
    if (first?.rxcui && first?.name) return { rxcui: first.rxcui, name: first.name };
  }
  return null;
}

export function parseApproximateRxcui(data: unknown): string | null {
  const candidate = (data as {
    approximateGroup?: { candidate?: { rxcui?: string; score?: string }[] };
  })?.approximateGroup?.candidate?.[0];
  const id = candidate?.rxcui;
  const score = Number(candidate?.score ?? 0);
  if (typeof id === "string" && /^\d+$/.test(id) && score >= 70) return id;
  return null;
}

export function parseRxclassEntries(data: unknown): { classId: string; className: string }[] {
  const infos = (data as {
    rxclassDrugInfoList?: {
      rxclassDrugInfo?: {
        rxclassMinConceptItem?: { classId?: string; className?: string };
      }[];
    };
  })?.rxclassDrugInfoList?.rxclassDrugInfo;
  if (!Array.isArray(infos)) return [];
  const out: { classId: string; className: string }[] = [];
  for (const info of infos) {
    const id = info.rxclassMinConceptItem?.classId;
    const name = info.rxclassMinConceptItem?.className;
    if (id && name) out.push({ classId: id, className: name });
  }
  return out;
}

const ALLERGY_CLASS_NAME =
  /penicillin|cephalo|beta.?lactam|sulfonamide|sulfa|nsaid|anti-inflammatory|opioid|narcotic|macrolide|quinolone|fluoroquinolone|tetracycline|carbapenem|monobactam/i;

async function rxnavGet(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function ingredientForCui(
  rxcui: string,
  fetchImpl: typeof fetch,
): Promise<{ rxcui: string; name: string }> {
  const related = await rxnavGet(
    `${RXNAV_REST}/rxcui/${encodeURIComponent(rxcui)}/related.json?tty=IN+MIN+PIN`,
    fetchImpl,
    2500,
  );
  const ing = related ? parseRxnavRelatedIngredient(related) : null;
  if (ing) return ing;
  const props = await rxnavGet(
    `${RXNAV_REST}/rxcui/${encodeURIComponent(rxcui)}/properties.json`,
    fetchImpl,
    2000,
  );
  const name = (props as { properties?: { name?: string } })?.properties?.name;
  return { rxcui, name: name || rxcui };
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
  const q = encodeURIComponent(name);
  // search=2: exact then normalized; search=9: approximate (NLM findRxcuiByString).
  const exact = await rxnavGet(
    `${RXNAV_REST}/rxcui.json?name=${q}&search=2`,
    fetchImpl,
    timeoutMs,
  );
  let id = exact ? parseRxnavBody(exact) : null;
  if (!id) {
    const fuzzy = await rxnavGet(
      `${RXNAV_REST}/rxcui.json?name=${q}&search=9`,
      fetchImpl,
      timeoutMs,
    );
    id = fuzzy ? parseRxnavBody(fuzzy) : null;
  }
  if (!id) {
    const approx = await rxnavGet(
      `${RXNAV_REST}/approximateTerm.json?term=${q}&maxEntries=1`,
      fetchImpl,
      timeoutMs,
    );
    id = approx ? parseApproximateRxcui(approx) : null;
  }
  if (!id) return null;
  const ing = await ingredientForCui(id, fetchImpl);
  return {
    rxcui: ing.rxcui,
    generic: ing.name.toLowerCase(),
    matchedName: name.toLowerCase(),
    source: "rxnav",
  };
}

export async function fetchRxnavInteractions(
  cuis: string[],
  fetchImpl: typeof fetch,
  timeoutMs = 3000,
): Promise<RxnavPair[]> {
  const ids = [...new Set(cuis.filter((c) => /^\d+$/.test(c)))];
  if (ids.length < 2) return [];
  const data = await rxnavGet(
    `${RXNAV_REST}/interaction/list.json?rxcuis=${ids.join("+")}`,
    fetchImpl,
    timeoutMs,
  );
  return data ? parseRxnavInteractions(data) : [];
}

export async function fetchRxclassEntries(
  rxcui: string,
  fetchImpl: typeof fetch,
): Promise<{ classId: string; className: string }[]> {
  const data = await rxnavGet(
    `${RXNAV_REST}/rxclass/class/byRxcui.json?rxcui=${encodeURIComponent(rxcui)}&relaSource=VA`,
    fetchImpl,
    2500,
  );
  return data ? parseRxclassEntries(data) : [];
}

export async function allergyConflictLive(
  allergies: string[],
  drug: RxNormHit,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  const drugClasses = (await fetchRxclassEntries(drug.rxcui, fetchImpl)).filter((c) =>
    ALLERGY_CLASS_NAME.test(c.className),
  );
  const drugClassIds = new Set(drugClasses.map((c) => c.classId));
  const drugName = drug.generic.toLowerCase();
  for (const raw of allergies) {
    const a = raw.trim().toLowerCase();
    if (!a) continue;
    if (drugName.includes(a) || a.includes(drugName)) return true;
    const aHit = await resolveDrug(a, { fetchImpl, liveNetwork: true });
    if (!aHit) continue;
    if (aHit.rxcui === drug.rxcui) return true;
    const aClasses = (await fetchRxclassEntries(aHit.rxcui, fetchImpl)).filter((c) =>
      ALLERGY_CLASS_NAME.test(c.className),
    );
    if (aClasses.some((c) => drugClassIds.has(c.classId))) return true;
  }
  return false;
}

export async function resolveDrug(
  raw: string,
  opts?: { fetchImpl?: typeof fetch; liveNetwork?: boolean },
): Promise<RxNormHit | null> {
  const live = opts?.liveNetwork ?? isRxnavLive();
  const impl = opts?.fetchImpl ?? defaultFetch();
  if (live && impl) {
    const remote = await lookupRxnav(raw, impl);
    if (remote) return remote;
  }
  if (isVitest()) return lookupLocal(raw);
  return null;
}
