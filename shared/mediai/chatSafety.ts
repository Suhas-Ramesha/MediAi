/**
 * One chat turn through the safety engines (not Gemini).
 * Verifier + red-flag NLP + RxNorm NER + interaction audit.
 */

import { waitingWindowEscalation } from "./intake.ts";
import {
  extractDrugMentionsFromText,
  forwardAudit,
  mergeIntoGraph,
  type AuditResult,
  type SafetyGraph,
} from "./medication.ts";
import {
  fetchRxnavInteractions,
  lookupLocal,
  resolveDrug,
  type RxNormHit,
} from "./rxnorm.ts";
import { isRxnavLive } from "./types.ts";
import { verifyClaims, type ClaimVerdict } from "./verifier.ts";
import { inferTriageFromTranscript } from "./triage.ts";
import { runConsilium, type ConsiliumResult } from "./consilium.ts";

export interface ChatEngineResult {
  verdicts: ClaimVerdict[];
  escalation: {
    escalate: boolean;
    flags: string[];
    daysOut: number;
    thresholdDays: number;
  };
  mentions: { raw: string; rxcui: string | null; generic: string | null }[];
  audit: AuditResult | null;
  incomplete: boolean;
  graph: SafetyGraph;
  differential: { condition: string; probability: number }[];
  consilium: ConsiliumResult;
}

export function emptySafetyGraph(patientId: string, allergies: string[] = []): SafetyGraph {
  return {
    patientId,
    allergies,
    organFlags: { kidneyImpairment: false, liverImpairment: false },
    medications: [],
  };
}

function hitFor(
  raw: string,
  extractedHit: ReturnType<typeof lookupLocal>,
  extraHits?: Record<string, RxNormHit>,
): RxNormHit | null {
  if (extractedHit) return extractedHit;
  const local = lookupLocal(raw);
  if (local) return local;
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  const first = raw.split(/\s+/)[0]?.toLowerCase() ?? "";
  return (
    extraHits?.[key] ??
    extraHits?.[raw.toLowerCase()] ??
    extraHits?.[first] ??
    extraHits?.[first.replace(/[^a-z0-9]/g, "")] ??
    null
  );
}

export function analyzeChatTurn(input: {
  userText: string;
  assistantText: string;
  graph: SafetyGraph;
  evidence?: string[];
  appointmentDaysOut?: number;
  doctorId?: string;
  startedOn?: string;
  extraHits?: Record<string, RxNormHit>;
}): ChatEngineResult {
  const evidence = (input.evidence ?? [input.userText]).filter((e) => e.trim());
  const verdicts = verifyClaims(input.assistantText, evidence);
  const escalation = waitingWindowEscalation({
    newText: `${input.userText}\n${input.assistantText}`,
    appointmentDaysOut: input.appointmentDaysOut ?? 12,
  });

  const combined = `${input.userText}\n${input.assistantText}`;
  const extracted = extractDrugMentionsFromText(combined);
  const mentions = extracted.map((m) => {
    const hit = hitFor(m.raw, m.hit as RxNormHit | null, input.extraHits);
    return {
      raw: m.raw,
      rxcui: hit?.rxcui ?? null,
      generic: hit?.generic ?? null,
    };
  });

  let graph = input.graph;
  let audit: AuditResult | null = null;
  const doctorId = input.doctorId ?? "chat";
  const startedOn = input.startedOn ?? new Date().toISOString().slice(0, 10);

  for (const m of mentions) {
    if (!m.rxcui || !m.generic) {
      audit = {
        status: "incomplete",
        findings: [
          ...(audit?.findings ?? []),
          `Unknown drug token "${m.raw}". Cannot certify an all-clear.`,
        ],
      };
      continue;
    }
    const next = forwardAudit(graph, m.generic, doctorId);
    if (next.status !== "clear") audit = next;
    const merged = mergeIntoGraph(graph, [
      {
        rxcui: m.rxcui,
        genericName: m.generic,
        sourceDoctorId: doctorId,
        startedOn,
        rawText: m.raw,
      },
    ]);
    graph = merged.graph;
  }

  const incomplete =
    audit?.status === "incomplete" || mentions.some((m) => !m.rxcui);

  const findings = [
    ...escalation.flags,
    ...mentions.filter((m) => m.generic).map((m) => `medicine:${m.generic}`),
  ];
  if (/\bfever\b/i.test(input.userText)) findings.push("fever");
  if (/\bheadache\b/i.test(input.userText)) findings.push("headache");
  const differential = inferTriageFromTranscript(input.userText);
  const consilium = runConsilium(differential, findings.length ? findings : [input.userText.slice(0, 180)]);

  return {
    verdicts,
    escalation,
    mentions,
    audit,
    incomplete,
    graph,
    differential,
    consilium,
  };
}

export function hitFromMention(raw: string): RxNormHit | null {
  return lookupLocal(raw);
}

/**
 * Same as analyzeChatTurn, then resolve leftover tokens and DDI pairs
 * through NLM RxNav when the live flag is on.
 */
export async function analyzeChatTurnLive(
  input: Parameters<typeof analyzeChatTurn>[0] & {
    fetchImpl?: typeof fetch;
  },
): Promise<ChatEngineResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const extraHits: Record<string, RxNormHit> = { ...(input.extraHits ?? {}) };

  if (isRxnavLive()) {
    const extracted = extractDrugMentionsFromText(
      `${input.userText}\n${input.assistantText}`,
    );
    for (const m of extracted) {
      if (m.hit || lookupLocal(m.raw) || extraHits[m.raw.toLowerCase()]) continue;
      const live = await resolveDrug(m.raw, { fetchImpl, liveNetwork: true });
      if (!live) continue;
      extraHits[m.raw.toLowerCase()] = live;
      extraHits[live.generic.replace(/[^a-z0-9]/g, "")] = live;
    }
  }

  const result = analyzeChatTurn({ ...input, extraHits });

  if (!isRxnavLive() || result.graph.medications.length < 2) return result;

  const pairs = await fetchRxnavInteractions(
    result.graph.medications.map((m) => m.rxcui),
    fetchImpl,
  );
  if (!pairs.length) return result;

  const findings = [
    ...(result.audit?.findings ?? []),
    ...pairs.map((p) => p.note),
  ];
  return {
    ...result,
    audit: {
      status: result.audit?.status === "allergy" ? result.audit.status : "interaction",
      findings,
    },
  };
}
