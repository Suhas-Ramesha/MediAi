import { describe, expect, it } from "vitest";
import { runCanvasTurn } from "./canvas.ts";
import { runConsilium } from "./consilium.ts";
import {
  nextTriageTurn,
  rankQuestions,
  shouldStop,
  uniformPrior,
  type TriageState,
} from "./triage.ts";
import { verifyClaims } from "./verifier.ts";

describe("A1 active triage", () => {
  it("picks the question that ranks first by expected information gain", () => {
    const state: TriageState = { answers: {}, turn: 0 };
    const turn = nextTriageTurn(state);
    const ranking = rankQuestions(uniformPrior(), new Set());
    expect(turn.nextQuestion?.question.id).toBe(ranking[0].question.id);
    expect(turn.nextQuestion!.informationGain).toBeGreaterThanOrEqual(
      ranking[1].informationGain,
    );
  });

  it("does not stop on sparse data (fewer than two answers)", () => {
    const state: TriageState = { answers: { fever: "yes" }, turn: 1 };
    expect(shouldStop(state, uniformPrior())).toBeNull();
    expect(nextTriageTurn(state).stop).toBeNull();
    expect(nextTriageTurn(state).nextQuestion).not.toBeNull();
  });

  it("re-ranks after a fixed symptom sequence", () => {
    const s0 = nextTriageTurn({ answers: {}, turn: 0 });
    const firstId = s0.nextQuestion!.question.id;
    const s1 = nextTriageTurn({
      answers: { [firstId]: "yes" },
      turn: 1,
    });
    expect(s1.nextQuestion?.question.id).not.toBe(firstId);
    expect(s1.ranking[0].informationGain).toBeGreaterThanOrEqual(
      s1.ranking[1]?.informationGain ?? 0,
    );
  });
});

describe("A2 claim verifier", () => {
  it("flags a planted unsupported claim", () => {
    const evidence = [
      "Fever and sore throat are common in viral upper respiratory infection.",
    ];
    const answer =
      "Fever often accompanies a viral upper respiratory infection. You definitely have leukaemia based on this visit.";
    const v = verifyClaims(answer, evidence);
    expect(v.some((c) => /leukaemia|leukemia/i.test(c.text) && c.status === "unsupported")).toBe(
      true,
    );
  });

  it("produces zero false positives on a fully supported answer", () => {
    const evidence = [
      "Fever and sore throat are common in viral upper respiratory infection. Seek care if breathing is difficult.",
    ];
    const answer =
      "Fever and sore throat are common in viral upper respiratory infection. Seek care if breathing is difficult.";
    const v = verifyClaims(answer, evidence);
    expect(v.length).toBeGreaterThan(0);
    expect(v.every((c) => c.status === "supported")).toBe(true);
  });

  it("flags everything when the evidence set is empty", () => {
    const v = verifyClaims(
      "This is a confident medical claim. Another unsupported sentence sits here.",
      ["", "  "],
    );
    expect(v.length).toBeGreaterThan(0);
    expect(v.every((c) => c.status === "unsupported" && c.confidence === 1)).toBe(
      true,
    );
  });
});

describe("A3 consilium", () => {
  it("skeptic output is distinguishable from consensus", () => {
    const dist = [
      { condition: "viral_uri" as const, probability: 0.55 },
      { condition: "strep_pharyngitis" as const, probability: 0.25 },
    ];
    const r = runConsilium(dist, ["fever", "sore_throat"]);
    const skeptic = r.personas.find((p) => p.persona === "skeptic")!.text;
    const specialist = r.personas.find((p) => p.persona === "specialist")!.text;
    expect(skeptic).not.toBe(specialist);
    expect(skeptic.toLowerCase()).toMatch(/disagree|missing|cannot|rubber/);
  });

  it("preserves dissent in the final output", () => {
    const dist = [
      { condition: "influenza" as const, probability: 0.6 },
      { condition: "covid" as const, probability: 0.2 },
    ];
    const r = runConsilium(dist, ["fever"]);
    expect(r.dissent.trim().length).toBeGreaterThan(20);
    expect(r.resolution).toMatch(/dissent|not excluded/i);
    expect(r.personas.map((p) => p.persona)).toEqual([
      "generalist",
      "specialist",
      "skeptic",
      "moderator",
    ]);
  });
});

describe("A4 event contract", () => {
  it("emits triage, verifier, and consilium events on a full turn", () => {
    const events = runCanvasTurn({
      state: { answers: { fever: "yes" }, turn: 1 },
      answerText:
        "Fever often accompanies influenza. Seek care if breathing is difficult.",
      evidence: [
        "Fever often accompanies influenza. Seek care if breathing is difficult.",
      ],
    });
    const types = new Set(events.map((e) => e.type));
    expect(types.has("triage.distribution")).toBe(true);
    expect(types.has("triage.question")).toBe(true);
    expect(types.has("verifier.claim")).toBe(true);
    expect(types.has("consilium.resolution")).toBe(true);
  });

  it("keeps triage and consilium events if the verifier fails", () => {
    const events = runCanvasTurn({
      state: { answers: { fever: "yes", cough: "yes" }, turn: 2 },
      failVerifier: true,
    });
    expect(events.some((e) => e.type === "engine.error" && e.engine === "verifier")).toBe(
      true,
    );
    expect(events.some((e) => e.type === "triage.distribution")).toBe(true);
    expect(events.some((e) => e.type === "consilium.resolution")).toBe(true);
    expect(events.some((e) => e.type === "verifier.claim")).toBe(false);
  });
});
