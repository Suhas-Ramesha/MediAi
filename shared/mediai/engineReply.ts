/**
 * Deterministic assistant draft from the safety engines.
 * Used when Gemini is missing or fails. Wording is grounded in the patient's
 * text, the phrase map, and engine flags — it does not invent a diagnosis.
 */

import { toClinicalText } from "./colloquial.ts";
import type { ChatEngineResult } from "./chatSafety.ts";

export function draftEngineReply(
  userText: string,
  preview: ChatEngineResult,
): string {
  const reported = userText.trim().slice(0, 240);
  const clinical = toClinicalText(userText).trim().slice(0, 240);
  const lines: string[] = [
    "**What this could mean**",
    `- You reported: ${reported || "no symptom text yet"}`,
  ];
  if (clinical && clinical.toLowerCase() !== (reported || "").toLowerCase()) {
    lines.push(`- Phrase map: ${clinical}`);
  }
  if (preview.escalation.escalate) {
    lines.push(
      `- Red-flag features in your words: ${preview.escalation.flags.join(", ")}.`,
    );
  } else {
    lines.push(
      "- Not enough information for a diagnosis from this message alone.",
    );
  }

  lines.push("", "**What you can do now**");
  if (preview.audit && preview.audit.status !== "clear") {
    lines.push(`- Medication check: ${preview.audit.findings[0]}`);
  }
  if (preview.incomplete) {
    lines.push(
      "- A medicine name could not be resolved to RxNorm, so this check is incomplete.",
    );
  }
  lines.push("- Rest, hydrate, and note when each symptom started.");
  lines.push(
    "- Do not start, stop, or combine prescription medicines from this chat.",
  );

  lines.push("", "**When to seek urgent care**");
  if (preview.escalation.escalate) {
    lines.push(
      "- Seek emergency care now for the red-flag features in your words.",
    );
  } else {
    lines.push(
      "- Seek emergency care if sudden chest pain, trouble breathing, or one-sided weakness starts.",
    );
  }
  return lines.join("\n");
}
