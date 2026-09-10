import { describe, expect, it } from "vitest";
import {
  FEATURE_FLAGS,
} from "./types.ts";
import {
  forwardAudit,
  mergeIntoGraph,
  parsePrescriptionText,
  sideEffectWatch,
  type SafetyGraph,
} from "./medication.ts";
import {
  assertTranscriptSupport,
  buildHandoffBrief,
  comePrepared,
  correctBrief,
  doctorMayView,
  markReviewed,
  reconstructTimeline,
  specialtyGuard,
  waitingWindowEscalation,
} from "./intake.ts";
import {
  SLIDER_LATENCY_BUDGET_MS,
  counterfactuals,
  projectRisk,
  timeProjection,
  type RiskInputs,
} from "./risk.ts";
import { inferTrigger, shuffle } from "./environment.ts";
import {
  day7Rate,
  diffPlans,
  matchedEffect,
  naiveMean,
  synthesizeConfoundedCohort,
} from "./outcomes.ts";

const emptyGraph = (meds: SafetyGraph["medications"] = []): SafetyGraph => ({
  patientId: "p1",
  allergies: ["penicillin"],
  organFlags: { kidneyImpairment: false, liverImpairment: false },
  medications: meds,
});

describe("C medication graph", () => {
  it("merges brand/generic of the same drug and does not merge different drugs", () => {
    const messy = [
      "Glucophage 500 mg PO BID",
      "blurry scan: m3tf0rmin?? skip",
      "Amoxil 500mg TID x 7d",
      "Metformin 500 mg",
    ].join("\n");
    const parsed = parsePrescriptionText(messy, "doc1", "2026-08-01");
    expect(parsed.entries.some((e) => e.rxcui === "6809")).toBe(true);
    expect(parsed.entries.some((e) => e.rxcui === "723")).toBe(true);
    const g0 = emptyGraph();
    const once = mergeIntoGraph(g0, parsed.entries.filter((e) => e.rxcui === "6809"));
    const twice = mergeIntoGraph(once.graph, [
      {
        rxcui: "6809",
        genericName: "metformin",
        brandName: "Glucophage",
        sourceDoctorId: "doc2",
        startedOn: "2026-08-01",
        rawText: "Glucophage",
      },
    ]);
    expect(twice.merged).toBe(1);
    expect(twice.graph.medications.filter((m) => m.rxcui === "6809")).toHaveLength(1);
    const withAmox = mergeIntoGraph(twice.graph, parsed.entries.filter((e) => e.rxcui === "723"));
    expect(withAmox.graph.medications.map((m) => m.rxcui).sort()).toEqual(["6809", "723"]);
  });

  it("fires a cross-doctor interaction", () => {
    const g = emptyGraph([
      {
        id: "1",
        rxcui: "11289",
        genericName: "warfarin",
        sourceDoctorId: "doc1",
        startedOn: "2026-07-01",
        rawText: "warfarin",
      },
    ]);
    const audit = forwardAudit(g, "ibuprofen 400mg", "doc2");
    expect(audit.status).toBe("interaction");
    expect(audit.findings[0]).toMatch(/doc1/);
    expect(audit.findings[0]).toMatch(/doc2/);
  });

  it("flags penicillin-class allergy against amoxicillin from another doctor", () => {
    const g = emptyGraph([]);
    g.allergies = ["penicillin"];
    const audit = forwardAudit(g, "Amoxil 500mg", "doc2");
    expect(audit.status).toBe("allergy");
  });

  it("does not silently clear an empty or contradictory graph check", () => {
    const g = emptyGraph([]);
    g.organFlags.kidneyImpairment = true;
    expect(forwardAudit(g, "metformin", "doc2").status).toBe("organ");
    expect(forwardAudit(g, "", "doc2").status).toBe("incomplete");
  });

  it("unknown drug is incomplete, not a silent all-clear", () => {
    const audit = forwardAudit(emptyGraph(), "xyzalorpha 10mg", "doc2");
    expect(audit.status).toBe("incomplete");
  });

  it("SIDER pair within onset window flags; unrelated symptom does not", () => {
    const g = emptyGraph([
      {
        id: "1",
        rxcui: "6809",
        genericName: "metformin",
        sourceDoctorId: "doc1",
        startedOn: "2026-09-01",
        rawText: "metformin",
      },
    ]);
    const hit = sideEffectWatch(g, "watery diarrhea since this morning", "2026-09-08");
    expect(hit.matches[0]?.effect).toBe("diarrhea");
    const miss = sideEffectWatch(g, "ankle sprain after football", "2026-09-08");
    expect(miss.matches).toHaveLength(0);
    const outsideWindow = sideEffectWatch(g, "watery diarrhea", "2027-01-01");
    expect(outsideWindow.matches).toHaveLength(0);
  });

  it("live OCR stays disabled", () => {
    expect(FEATURE_FLAGS.liveOcr).toBe(false);
  });
});

describe("D intake", () => {
  it("reconstructs out-of-order fragments", () => {
    const events = reconstructTimeline([
      "Then the cough started",
      "Fever began 3 days ago",
      "Yesterday the throat got worse",
    ]);
    expect(events[0].text).toMatch(/Fever/);
    expect(events[events.length - 1].text).toMatch(/cough|Then/i);
    expect(events[0].t).toBeLessThan(events[events.length - 1].t);
  });

  it("flags specialty mismatch and not a correct match", () => {
    const bad = specialtyGuard("itchy rash on both arms", "cardiology");
    expect(bad.mismatch).toBe(true);
    const good = specialtyGuard("itchy rash on both arms", "dermatology");
    expect(good.mismatch).toBe(false);
  });

  it("returns guideline labs or an explicit no-prep state", () => {
    const dm = comePrepared("polyuria and polydipsia, possible diabetes");
    expect(dm.state).toBe("prep_needed");
    expect(dm.labs).toContain("fasting glucose");
    const pharyngitis = comePrepared("sore throat and fever for two days");
    expect(pharyngitis.state).toBe("no_prep_needed");
    expect(pharyngitis.labs).toHaveLength(0);
  });

  it("escalates red flags even on a near appointment; skips negated and mild text", () => {
    const hot = waitingWindowEscalation({
      newText: "sudden trouble breathing tonight",
      appointmentDaysOut: 10,
    });
    expect(hot.escalate).toBe(true);
    const near = waitingWindowEscalation({
      newText: "sudden trouble breathing tonight",
      appointmentDaysOut: 1,
    });
    expect(near.escalate).toBe(true);
    const colloquial = waitingWindowEscalation({
      newText: "I cannot breathe and my lips look blue",
      appointmentDaysOut: 10,
    });
    expect(colloquial.escalate).toBe(true);
    const denied = waitingWindowEscalation({
      newText: "no chest pain, just a mild cough",
      appointmentDaysOut: 10,
    });
    expect(denied.escalate).toBe(false);
    const mild = waitingWindowEscalation({
      newText: "mild sore throat still",
      appointmentDaysOut: 10,
    });
    expect(mild.escalate).toBe(false);
    const missing = waitingWindowEscalation({
      newText: "",
      appointmentDaysOut: 30,
    });
    expect(missing.escalate).toBe(false);
  });

  it("handoff brief traces every statement and blocks doctor view until review", () => {
    const brief = buildHandoffBrief({
      fragments: [
        "fever since yesterday",
        "sore throat for 3 days ago wait 3 days",
      ],
      medications: ["metformin"],
      differential: [{ condition: "viral_uri", probability: 0.5 }],
    });
    expect(brief.chiefComplaint).toMatch(/fever/i);
    expect(brief.traces.length).toBeGreaterThan(0);
    expect(brief.patientReview.status).toBe("draft");
    expect(doctorMayView(brief)).toBe(false);
    for (const t of brief.traces) {
      expect(
        brief.patientWords.some((w) =>
          w.toLowerCase().includes(t.sourceText.toLowerCase().slice(0, 8)),
        ),
      ).toBe(true);
    }
    const verdictOk = assertTranscriptSupport(
      brief.traces.map((t) => t.statement),
      brief.patientWords,
    );
    expect(verdictOk).toBeUndefined();
    expect(() =>
      assertTranscriptSupport(
        ["The patient has haematuria and a new heart murmur."],
        brief.patientWords,
      ),
    ).toThrow(/unsourced_claim/);
    const edited = correctBrief(brief, [
      "fever since yesterday",
      "sore throat for 3 days",
      "cough started after that",
    ]);
    expect(edited.patientReview.status).toBe("draft");
    expect(doctorMayView(edited)).toBe(false);
    const approved = markReviewed(edited, "approved");
    expect(doctorMayView(approved)).toBe(true);
  });

  it("empty fragments fail visibly rather than inventing a complaint", () => {
    expect(() =>
      buildHandoffBrief({ fragments: [], medications: [], differential: [] }),
    ).toThrow(/unsourced_claim/);
  });
});

describe("B risk simulator", () => {
  const base: RiskInputs = {
    fastingGlucose: 142,
    bmi: 31.4,
    age: 46,
    systolic: 138,
    familyHistory: true,
  };

  it("lowering BMI never increases projected risk", () => {
    const hi = projectRisk(base);
    const lo = projectRisk({ ...base, bmi: 26 });
    expect(lo.diabetes).toBeLessThanOrEqual(hi.diabetes);
    expect(lo.heart).toBeLessThanOrEqual(hi.heart);
    expect(lo.kidney).toBeLessThanOrEqual(hi.kidney);
  });

  it("meets the slider latency budget", () => {
    const { ms } = timeProjection(base, 26);
    expect(ms).toBeLessThan(SLIDER_LATENCY_BUDGET_MS);
  });

  it("returns bounded, stably ranked counterfactuals", () => {
    const a = counterfactuals(base, 42);
    const b = counterfactuals(base, 42);
    expect(a.length).toBeGreaterThan(1);
    expect(a.length).toBe(11);
    expect(a.map((c) => c.description)).toEqual(b.map((c) => c.description));
    for (const c of a) {
      if (typeof c.to === "number" && c.feature === "bmi") {
        expect(c.to).toBeGreaterThanOrEqual(16);
        expect(c.to).toBeLessThanOrEqual(50);
      }
      if (typeof c.to === "number" && c.feature === "fastingGlucose") {
        expect(c.to).toBeGreaterThanOrEqual(70);
        expect(c.to).toBeLessThan(base.fastingGlucose);
      }
    }
  });
});

describe("F environmental triggers", () => {
  it("recovers a known lag", () => {
    const env = Array.from({ length: 60 }, (_, i) => Math.sin(i / 4));
    const symptoms = env.map((_, i) => (i >= 2 ? env[i - 2] : 0));
    const inf = inferTrigger(env, symptoms);
    expect(inf.signal).toBe(true);
    expect(inf.lag).toBe(2);
  });

  it("does not invent a signal on shuffled series", () => {
    const env = Array.from({ length: 60 }, (_, i) => Math.sin(i / 4));
    const symptoms = shuffle(
      env.map((_, i) => (i >= 2 ? env[i - 2] : 0)),
      99,
    );
    const inf = inferTrigger(env, symptoms);
    expect(inf.signal).toBe(false);
  });
});

describe("E outcomes", () => {
  it("naive mean is misleading; matching recovers the true direction", () => {
    const cohort = synthesizeConfoundedCohort(240, 7);
    const treated = cohort.filter((e) => e.treated);
    const control = cohort.filter((e) => !e.treated);
    const naive =
      treated.reduce((s, e) => s + e.timeToResolutionDays, 0) / treated.length -
      control.reduce((s, e) => s + e.timeToResolutionDays, 0) / control.length;
    const matched = matchedEffect(cohort, "drugA");
    expect(matched.insufficient).toBe(false);
    expect(naive).toBeGreaterThan(0);
    expect(matched.estimate).toBeLessThan(-1);
    expect(Math.abs(matched.estimate - -3)).toBeLessThan(1.6);
    void naiveMean;
  });

  it("PRO dashboard uses an explicit insufficient-data state", () => {
    const small = synthesizeConfoundedCohort(8, 1);
    const q = day7Rate(small, "d1");
    expect(q.insufficient).toBe(true);
    const big = synthesizeConfoundedCohort(200, 1);
    const q2 = day7Rate(big);
    expect(q2.insufficient).toBe(false);
    expect(q2.n).toBeGreaterThan(15);
  });

  it("plan diff is correct and non-editorial", () => {
    const d = diffPlans(
      {
        drug: "amoxicillin",
        dose: "500mg",
        duration: "7d",
        investigations: ["throat swab"],
      },
      {
        drug: "azithromycin",
        dose: "500mg",
        duration: "3d",
        investigations: ["throat swab", "CBC"],
      },
    );
    expect(d.diffs.some((x) => x.field === "drug")).toBe(true);
    expect(d.diffs.some((x) => x.field === "duration")).toBe(true);
    expect(d.diffs.some((x) => x.field === "investigation" && /cbc/i.test(x.b))).toBe(
      true,
    );
    expect(d.copy).not.toMatch(/better|worse|should have|superior/i);
  });
});
