import type { Express, Request, Response } from "express";
import { runCanvasTurn } from "../shared/mediai/canvas.ts";
import {
  inferTrigger,
} from "../shared/mediai/environment.ts";
import {
  buildHandoffBrief,
  comePrepared,
  correctBrief,
  doctorMayView,
  markReviewed,
  reconstructTimeline,
  specialtyGuard,
  waitingWindowEscalation,
  type HandoffBrief,
} from "../shared/mediai/intake.ts";
import { isRxnavLive } from "../shared/mediai/types.ts";
import { analyzeChatTurn } from "../shared/mediai/chatSafety.ts";
import { fetchRxnavInteractions, resolveDrug } from "../shared/mediai/rxnorm.ts";
import {
  forwardAudit,
  mergeIntoGraph,
  parsePrescriptionText,
  sideEffectWatch,
  type SafetyGraph,
} from "../shared/mediai/medication.ts";
import {
  day7Rate,
  diffPlans,
  matchedEffect,
  synthesizeConfoundedCohort,
} from "../shared/mediai/outcomes.ts";
import {
  counterfactuals,
  projectCurve,
  projectRisk,
  timeProjection,
  type RiskInputs,
} from "../shared/mediai/risk.ts";
import type { TriageState } from "../shared/mediai/triage.ts";

const graphs = new Map<string, SafetyGraph>();
const briefs = new Map<string, HandoffBrief>();
const DEMO_COHORT = synthesizeConfoundedCohort(220, 3);

function graphFor(patientId: string): SafetyGraph {
  if (!graphs.has(patientId)) {
    graphs.set(patientId, {
      patientId,
      allergies: [],
      organFlags: { kidneyImpairment: false, liverImpairment: false },
      medications: [],
    });
  }
  return graphs.get(patientId)!;
}

export function registerMediaiRoutes(app: Express): void {
  app.post("/api/mediai/canvas/turn", (req: Request, res: Response) => {
    const state = (req.body?.state ?? { answers: {}, turn: 0 }) as TriageState;
    const events = runCanvasTurn({
      state,
      answerText: req.body?.answerText,
      evidence: req.body?.evidence ?? [],
      failVerifier: Boolean(req.body?.failVerifier),
    });
    res.json({ events });
  });

  app.post("/api/mediai/chat/analyze", (req: Request, res: Response) => {
    const patientId = String(req.body?.patientId ?? "demo");
    const graph = req.body?.graph ?? graphFor(patientId);
    const result = analyzeChatTurn({
      userText: String(req.body?.userText ?? ""),
      assistantText: String(req.body?.assistantText ?? ""),
      graph,
      evidence: req.body?.evidence,
      appointmentDaysOut: Number(req.body?.appointmentDaysOut ?? 12),
    });
    graphs.set(patientId, result.graph);
    res.json(result);
  });

  app.post("/api/mediai/medication/ingest", async (req: Request, res: Response) => {
    const patientId = String(req.body?.patientId ?? "demo");
    const doctorId = String(req.body?.doctorId ?? "unknown");
    const startedOn = String(req.body?.startedOn ?? "2026-09-01");

    if (req.body?.imageBase64) {
      return res.status(409).json({
        status: "incomplete",
        message: "Photo ingest is not available. Submit prescription text.",
      });
    }

    let parsed = parsePrescriptionText(
      String(req.body?.text ?? ""),
      doctorId,
      startedOn,
    );
    if (isRxnavLive()) {
      for (const token of [...parsed.unknownTokens]) {
        const live = await resolveDrug(token, {
          fetchImpl: fetch,
          liveNetwork: true,
        });
        if (!live) continue;
        parsed = parsePrescriptionText(
          `${req.body?.text ?? ""}\n${live.generic}`,
          doctorId,
          startedOn,
        );
      }
    }
    if (!parsed.entries.length && String(req.body?.text ?? "").trim()) {
      return res.status(409).json({
        status: "incomplete",
        unknownTokens: parsed.unknownTokens,
        message: "No token resolved to a RxNorm CUI. Nothing was guessed.",
      });
    }
    const merged = mergeIntoGraph(graphFor(patientId), parsed.entries);
    graphs.set(patientId, merged.graph);
    let livePairs: { a: string; b: string; note: string }[] = [];
    if (isRxnavLive() && merged.graph.medications.length >= 2) {
      livePairs = await fetchRxnavInteractions(
        merged.graph.medications.map((m) => m.rxcui),
        fetch,
      );
    }
    res.json({
      graph: merged.graph,
      merged: merged.merged,
      added: merged.added,
      unknownTokens: parsed.unknownTokens,
      rxnavInteractions: livePairs,
    });
  });

  app.post("/api/mediai/medication/audit", (req: Request, res: Response) => {
    const g = graphFor(String(req.body?.patientId ?? "demo"));
    const audit = forwardAudit(
      g,
      String(req.body?.newDrug ?? ""),
      String(req.body?.doctorId ?? "unknown"),
    );
    res.json(audit);
  });

  app.post("/api/mediai/medication/watch", (req: Request, res: Response) => {
    const g = graphFor(String(req.body?.patientId ?? "demo"));
    res.json(
      sideEffectWatch(
        g,
        String(req.body?.symptom ?? ""),
        String(req.body?.today ?? "2026-09-10"),
      ),
    );
  });

  app.post("/api/mediai/intake/timeline", (req: Request, res: Response) => {
    res.json({ events: reconstructTimeline(req.body?.fragments ?? []) });
  });

  app.post("/api/mediai/intake/guard", (req: Request, res: Response) => {
    res.json(
      specialtyGuard(String(req.body?.text ?? ""), String(req.body?.specialty ?? "general")),
    );
  });

  app.post("/api/mediai/intake/prep", (req: Request, res: Response) => {
    res.json(comePrepared(String(req.body?.presentation ?? "")));
  });

  app.post("/api/mediai/intake/escalate", (req: Request, res: Response) => {
    res.json(
      waitingWindowEscalation({
        newText: String(req.body?.newText ?? ""),
        appointmentDaysOut: Number(req.body?.appointmentDaysOut ?? 0),
      }),
    );
  });

  app.post("/api/mediai/handoff", (req: Request, res: Response) => {
    try {
      const brief = buildHandoffBrief({
        fragments: req.body?.fragments ?? [],
        medications: req.body?.medications ?? [],
        differential: req.body?.differential ?? [],
      });
      briefs.set(brief.id, brief);
      res.json(brief);
    } catch {
      res.status(422).json({ error: "unsourced_claim" });
    }
  });

  app.post("/api/mediai/handoff/:id/review", (req: Request, res: Response) => {
    const brief = briefs.get(req.params.id);
    if (!brief) return res.status(404).json({ error: "not_found" });
    const status = req.body?.status;
    if (status !== "approved" && status !== "waived") {
      return res.status(400).json({ error: "status_must_be_approved_or_waived" });
    }
    try {
      const next = markReviewed(brief, status, req.body?.note);
      briefs.set(next.id, next);
      res.json(next);
    } catch {
      res.status(422).json({ error: "unsourced_claim" });
    }
  });

  app.post("/api/mediai/handoff/:id/correct", (req: Request, res: Response) => {
    const brief = briefs.get(req.params.id);
    if (!brief) return res.status(404).json({ error: "not_found" });
    try {
      const next = correctBrief(brief, req.body?.fragments ?? brief.patientWords);
      briefs.set(next.id, next);
      res.json(next);
    } catch {
      res.status(422).json({ error: "unsourced_claim" });
    }
  });

  app.get("/api/mediai/handoff/:id/doctor", (req: Request, res: Response) => {
    const brief = briefs.get(req.params.id);
    if (!brief) return res.status(404).json({ error: "not_found" });
    if (!doctorMayView(brief)) {
      return res.status(403).json({
        error: "patient_review_required",
        message: "Brief cannot reach the doctor-facing view without patient review or waiver.",
      });
    }
    res.json(brief);
  });

  app.post("/api/mediai/risk/project", (req: Request, res: Response) => {
    const inputs = req.body?.inputs as RiskInputs;
    const bmi = Number(req.body?.bmi ?? inputs?.bmi);
    const timed = timeProjection(inputs, bmi);
    res.json({
      now: projectRisk({ ...inputs, bmi }),
      curve: projectCurve({ ...inputs, bmi }),
      latencyMs: timed.ms,
      source: "local_monotonic_surface",
    });
  });

  app.post("/api/mediai/risk/counterfactuals", (req: Request, res: Response) => {
    res.json({ items: counterfactuals(req.body?.inputs as RiskInputs) });
  });

  app.post("/api/mediai/environment/infer", (req: Request, res: Response) => {
    res.json(inferTrigger(req.body?.env ?? [], req.body?.symptoms ?? []));
  });

  app.get("/api/mediai/outcomes/dashboard", (req: Request, res: Response) => {
    const doctorId = req.query.doctorId ? String(req.query.doctorId) : undefined;
    const rate = day7Rate(DEMO_COHORT, doctorId);
    const effect = matchedEffect(DEMO_COHORT, "drugA");
    res.json({ day7: rate, effect });
  });

  app.post("/api/mediai/outcomes/diff", (req: Request, res: Response) => {
    try {
      res.json(diffPlans(req.body?.a, req.body?.b));
    } catch {
      res.status(422).json({ error: "editorial_language" });
    }
  });
}

export const __testStores = { graphs, briefs };
