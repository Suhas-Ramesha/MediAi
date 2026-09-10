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
import { lookupLocal, type RxNormHit } from "./rxnorm.ts";
import { verifyClaims, type ClaimVerdict } from "./verifier.ts";

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
}

export function emptySafetyGraph(patientId: string, allergies: string[] = []): SafetyGraph {
  return {
    patientId,
    allergies,
    organFlags: { kidneyImpairment: false, liverImpairment: false },
    medications: [],
  };
}

export function analyzeChatTurn(input: {
  userText: string;
  assistantText: string;
  graph: SafetyGraph;
  evidence?: string[];
  appointmentDaysOut?: number;
  doctorId?: string;
  startedOn?: string;
}): ChatEngineResult {
  const evidence = (input.evidence ?? [input.userText]).filter((e) => e.trim());
  const verdicts = verifyClaims(input.assistantText, evidence);
  const escalation = waitingWindowEscalation({
    newText: `${input.userText}\n${input.assistantText}`,
    appointmentDaysOut: input.appointmentDaysOut ?? 12,
  });

  const combined = `${input.userText}\n${input.assistantText}`;
  const extracted = extractDrugMentionsFromText(combined);
  const mentions = extracted.map((m) => ({
    raw: m.raw,
    rxcui: m.hit?.rxcui ?? lookupLocal(m.raw)?.rxcui ?? null,
    generic: m.hit?.generic ?? lookupLocal(m.raw)?.generic ?? null,
  }));

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

  return { verdicts, escalation, mentions, audit, incomplete, graph };
}

export function hitFromMention(raw: string): RxNormHit | null {
  return lookupLocal(raw);
}
