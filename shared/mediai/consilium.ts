import type { ConditionProbability } from "./types.ts";

export interface ConsiliumResult {
  personas: {
    persona: "generalist" | "specialist" | "skeptic" | "moderator";
    text: string;
  }[];
  resolution: string;
  dissent: string;
}

function label(id: string): string {
  return id.replace(/_/g, " ");
}

function requireObjection(text: string): string {
  const ok =
    /however|but |missing|does not|don't|do not|alternative|against|overweight|insufficient|cannot rule|would not/i.test(
      text,
    );
  if (!ok) {
    return `${text} However, this cannot be accepted without an objection: the leading label is under-specified by the findings collected so far.`;
  }
  return text;
}

/**
 * Four personas share one scratchpad. The skeptic is required to object
 * before it may converge. The moderator preserves that dissent.
 */
export function runConsilium(
  distribution: ConditionProbability[],
  findings: string[],
): ConsiliumResult {
  const [lead, second] = distribution;
  const findingText = findings.length
    ? findings.join("; ")
    : "no positive findings recorded";

  const generalist = `Working impression is ${label(lead.condition)} (${(
    lead.probability * 100
  ).toFixed(0)}%). Findings so far: ${findingText}. This is a ranking, not a diagnosis.`;

  const specialist = `As the ${label(lead.condition)} pass: the pattern of findings is more consistent with ${label(
    lead.condition,
  )} than with neighbours on this list, provided red flags stay negative.`;

  const rawSkeptic = `The skeptic disagrees with treating ${label(
    lead.condition,
  )} as settled. ${label(second?.condition ?? "an alternative")} remains plausible at ${(
    (second?.probability ?? 0) * 100
  ).toFixed(
    0,
  )}%. Missing disconfirming questions mean we cannot rule that out. Agreeing now would be rubber-stamping.`;

  const skeptic = requireObjection(rawSkeptic);

  const dissent = skeptic;
  const resolution = `Resolved working label: ${label(lead.condition)}, with preserved dissent that ${label(
    second?.condition ?? "another condition",
  )} is not excluded. Escalate if breathing, chest pain, or a stiff neck appears. Not a diagnosis.`;

  return {
    personas: [
      { persona: "generalist", text: generalist },
      { persona: "specialist", text: specialist },
      { persona: "skeptic", text: skeptic },
      { persona: "moderator", text: resolution },
    ],
    resolution,
    dissent,
  };
}
