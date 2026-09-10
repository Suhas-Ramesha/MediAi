/** Shared event and domain types for MediAI Groups A–F. */

export type ConditionId =
  | "viral_uri"
  | "strep_pharyngitis"
  | "influenza"
  | "pneumonia_suspect"
  | "migraine"
  | "tension_headache"
  | "gerd"
  | "uti"
  | "covid";

export type AnswerValue = "yes" | "no" | "unknown";

export interface ConditionProbability {
  condition: ConditionId;
  probability: number;
}

export type CanvasEvent =
  | {
      type: "triage.distribution";
      turn: number;
      conditions: ConditionProbability[];
    }
  | {
      type: "triage.question";
      turn: number;
      questionId: string;
      text: string;
      informationGain: number;
    }
  | {
      type: "triage.stopped";
      turn: number;
      reason: "confidence" | "max_questions" | "red_flag";
    }
  | {
      type: "verifier.claim";
      claimId: string;
      text: string;
      status: "supported" | "unsupported" | "contradicted";
      confidence: number;
    }
  | {
      type: "consilium.persona";
      persona: "generalist" | "specialist" | "skeptic" | "moderator";
      text: string;
    }
  | {
      type: "consilium.resolution";
      resolution: string;
      dissent: string;
    }
  | {
      type: "engine.error";
      engine: "triage" | "verifier" | "consilium";
      message: string;
    };

export const FEATURE_FLAGS = {
  /** Real camera OCR is off until a reviewed engine exists. */
  liveOcr: false,
  /** Live Gradio models are not used for the slider projection. */
  liveMlForSimulator: false,
} as const;

export function entropy(probs: number[]): number {
  return probs.reduce((h, p) => {
    if (p <= 0) return h;
    return h - p * Math.log2(p);
  }, 0);
}
