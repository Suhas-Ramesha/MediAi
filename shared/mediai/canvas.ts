import { runConsilium } from "./consilium.ts";
import { nextTriageTurn, type TriageState } from "./triage.ts";
import type { CanvasEvent } from "./types.ts";
import { verifyClaims } from "./verifier.ts";

export interface CanvasTurnInput {
  state: TriageState;
  answerText?: string;
  evidence?: string[];
  /** Test hook: force the verifier to throw. */
  failVerifier?: boolean;
  failTriage?: boolean;
  failConsilium?: boolean;
}

/**
 * One event stream. A failure in verifier/triage/consilium is emitted as
 * engine.error and must not drop the other engines' events.
 */
export function runCanvasTurn(input: CanvasTurnInput): CanvasEvent[] {
  const events: CanvasEvent[] = [];
  const findings = Object.entries(input.state.answers)
    .filter(([, v]) => v === "yes")
    .map(([k]) => k);

  let distribution = nextTriageTurn(input.state).distribution;

  try {
    if (input.failTriage) throw new Error("simulated triage failure");
    const turn = nextTriageTurn(input.state);
    distribution = turn.distribution;
    events.push({
      type: "triage.distribution",
      turn: input.state.turn,
      conditions: turn.distribution,
    });
    if (turn.stop) {
      events.push({
        type: "triage.stopped",
        turn: input.state.turn,
        reason: turn.stop,
      });
    } else if (turn.nextQuestion) {
      events.push({
        type: "triage.question",
        turn: input.state.turn,
        questionId: turn.nextQuestion.question.id,
        text: turn.nextQuestion.question.text,
        informationGain: turn.nextQuestion.informationGain,
      });
    }
  } catch (err) {
    events.push({
      type: "engine.error",
      engine: "triage",
      message: err instanceof Error ? err.message : "triage failed",
    });
  }

  try {
    if (input.failVerifier) throw new Error("simulated verifier failure");
    const answer =
      input.answerText ??
      `Most likely ${distribution[0]?.condition.replace(/_/g, " ")}. Two questions remain open. Seek care if breathing becomes difficult.`;
    const verdicts = verifyClaims(answer, input.evidence ?? []);
    for (const v of verdicts) {
      events.push({
        type: "verifier.claim",
        claimId: v.claimId,
        text: v.text,
        status: v.status,
        confidence: v.confidence,
      });
    }
  } catch (err) {
    events.push({
      type: "engine.error",
      engine: "verifier",
      message: err instanceof Error ? err.message : "verifier failed",
    });
  }

  try {
    if (input.failConsilium) throw new Error("simulated consilium failure");
    const consilium = runConsilium(distribution, findings);
    for (const p of consilium.personas) {
      events.push({
        type: "consilium.persona",
        persona: p.persona,
        text: p.text,
      });
    }
    events.push({
      type: "consilium.resolution",
      resolution: consilium.resolution,
      dissent: consilium.dissent,
    });
  } catch (err) {
    events.push({
      type: "engine.error",
      engine: "consilium",
      message: err instanceof Error ? err.message : "consilium failed",
    });
  }

  return events;
}
