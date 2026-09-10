import { lookupLocal, RXNORM, type RxNormHit } from "./rxnorm.ts";

export { RXNORM };
export type { RxNormHit };

export interface MedicationEntry {
  id: string;
  rxcui: string;
  genericName: string;
  brandName?: string;
  dose?: string;
  sourceDoctorId: string;
  startedOn: string;
  rawText: string;
}

export interface SafetyGraph {
  patientId: string;
  allergies: string[];
  organFlags: { kidneyImpairment: boolean; liverImpairment: boolean };
  medications: MedicationEntry[];
}


export const INTERACTIONS: { a: string; b: string; note: string }[] = [
  { a: "11289", b: "5640", note: "Warfarin + NSAID: bleeding risk" },
  { a: "36567", b: "5640", note: "Statin + ibuprofen: monitor liver and muscle symptoms" },
];

/** Conservative cross-reactivity. Penicillin allergy must flag amoxicillin. */
export const ALLERGY_CLASSES: Record<string, string[]> = {
  penicillin: ["penicillin", "amoxicillin", "ampicillin"],
  amoxicillin: ["penicillin", "amoxicillin", "ampicillin"],
  ampicillin: ["penicillin", "amoxicillin", "ampicillin"],
};

export function allergyConflict(allergies: string[], generic: string): boolean {
  const g = generic.toLowerCase();
  for (const raw of allergies) {
    const a = raw.toLowerCase();
    if (g.includes(a) || a.includes(g)) return true;
    const fromAllergy = ALLERGY_CLASSES[a];
    if (fromAllergy?.includes(g)) return true;
    const fromDrug = ALLERGY_CLASSES[g];
    if (fromDrug?.some((x) => a.includes(x))) return true;
  }
  return false;
}

export const SIDER: {
  rxcui: string;
  effect: string;
  onsetDaysMin: number;
  onsetDaysMax: number;
}[] = [
  { rxcui: "6809", effect: "diarrhea", onsetDaysMin: 1, onsetDaysMax: 21 },
  { rxcui: "723", effect: "rash", onsetDaysMin: 1, onsetDaysMax: 14 },
  { rxcui: "11289", effect: "bruising", onsetDaysMin: 2, onsetDaysMax: 60 },
];

export function normalizeDrugName(raw: string): { rxcui: string; generic: string } | null {
  const hit = lookupLocal(raw);
  if (!hit) return null;
  return { rxcui: hit.rxcui, generic: hit.generic };
}

/** Parse messy OCR / typed prescription text. Does not invent drugs. */
export function parsePrescriptionText(
  text: string,
  sourceDoctorId: string,
  startedOn: string,
): { entries: Omit<MedicationEntry, "id">[]; unknownTokens: string[] } {
  const parts = text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const entries: Omit<MedicationEntry, "id">[] = [];
  const unknownTokens: string[] = [];
  for (const part of parts) {
    const hit =
      normalizeDrugName(part) ??
      part
        .split(/\s+/)
        .map((tok) => normalizeDrugName(tok))
        .find((h) => h) ??
      null;
    if (!hit) {
      if (/[a-z]{4,}/i.test(part)) unknownTokens.push(part);
      continue;
    }
    const dose = part.match(/\d+\s?(mg|mcg|iu)/i)?.[0];
    entries.push({
      rxcui: hit.rxcui,
      genericName: hit.generic,
      brandName: part,
      dose,
      sourceDoctorId,
      startedOn,
      rawText: part,
    });
  }
  return { entries, unknownTokens };
}

export function mergeIntoGraph(
  graph: SafetyGraph,
  incoming: Omit<MedicationEntry, "id">[],
): { graph: SafetyGraph; merged: number; added: number } {
  let merged = 0;
  let added = 0;
  const meds = [...graph.medications];
  for (const item of incoming) {
    const existing = meds.find((m) => m.rxcui === item.rxcui);
    if (existing) {
      merged += 1;
      if (!existing.brandName && item.brandName) existing.brandName = item.brandName;
    } else {
      added += 1;
      meds.push({ ...item, id: `${item.rxcui}-${meds.length}` });
    }
  }
  return { graph: { ...graph, medications: meds }, merged, added };
}

export interface AuditResult {
  status: "clear" | "interaction" | "allergy" | "organ" | "incomplete";
  findings: string[];
}

export function forwardAudit(
  graph: SafetyGraph,
  newDrugRaw: string,
  newDoctorId: string,
): AuditResult {
  const hit = normalizeDrugName(newDrugRaw);
  if (!hit) {
    return {
      status: "incomplete",
      findings: [
        `Unknown drug token "${newDrugRaw}". Cannot certify an all-clear.`,
      ],
    };
  }
  const findings: string[] = [];
  if (allergyConflict(graph.allergies, hit.generic)) {
    findings.push(`Allergy overlap with ${hit.generic}`);
    return { status: "allergy", findings };
  }
  if (hit.generic === "metformin" && graph.organFlags.kidneyImpairment) {
    findings.push("Metformin with kidney impairment needs clinician review");
    return { status: "organ", findings };
  }
  for (const m of graph.medications) {
    const pair = INTERACTIONS.find(
      (i) =>
        (i.a === m.rxcui && i.b === hit.rxcui) ||
        (i.b === m.rxcui && i.a === hit.rxcui),
    );
    if (pair) {
      findings.push(
        `${pair.note} (existing from doctor ${m.sourceDoctorId}, new from ${newDoctorId})`,
      );
    }
  }
  if (findings.length) return { status: "interaction", findings };
  return { status: "clear", findings: [] };
}

export function sideEffectWatch(
  graph: SafetyGraph,
  symptom: string,
  today: string,
): { matches: { drug: string; effect: string; daysSinceStart: number }[] } {
  const day = Date.parse(today);
  const matches = [];
  for (const m of graph.medications) {
    const started = Date.parse(m.startedOn);
    const days = Math.round((day - started) / 86400000);
    for (const s of SIDER) {
      if (s.rxcui !== m.rxcui) continue;
      if (!symptom.toLowerCase().includes(s.effect)) continue;
      if (days < s.onsetDaysMin || days > s.onsetDaysMax) continue;
      matches.push({
        drug: m.genericName,
        effect: s.effect,
        daysSinceStart: days,
      });
    }
  }
  matches.sort((a, b) => a.daysSinceStart - b.daysSinceStart);
  return { matches };
}
