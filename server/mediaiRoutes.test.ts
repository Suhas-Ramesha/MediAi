import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerMediaiRoutes } from "./mediaiRoutes.ts";
import type { Server } from "http";

describe("mediai HTTP integration", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerMediaiRoutes(app);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it("A: canvas turn reaches the frontend event contract", async () => {
    const r = await fetch(`${base}/api/mediai/canvas/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: { answers: { fever: "yes" }, turn: 1 },
        answerText: "Fever often accompanies influenza.",
        evidence: ["Fever often accompanies influenza."],
      }),
    });
    const data = await r.json();
    expect(r.status).toBe(200);
    const types = data.events.map((e: { type: string }) => e.type);
    expect(types).toContain("triage.distribution");
    expect(types).toContain("verifier.claim");
    expect(types).toContain("consilium.resolution");
  });

  it("C: ingest then cross-doctor audit", async () => {
    await fetch(`${base}/api/mediai/medication/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: "px",
        doctorId: "doc1",
        text: "warfarin 5mg",
        startedOn: "2026-07-01",
      }),
    });
    const r = await fetch(`${base}/api/mediai/medication/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: "px",
        doctorId: "doc2",
        newDrug: "ibuprofen",
      }),
    });
    const data = await r.json();
    expect(data.status).toBe("interaction");
  });

  it("D5: doctor view is blocked until patient review", async () => {
    const created = await fetch(`${base}/api/mediai/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fragments: ["fever since yesterday"],
        medications: [],
        differential: [{ condition: "viral_uri", probability: 0.4 }],
      }),
    }).then((r) => r.json());
    const blocked = await fetch(`${base}/api/mediai/handoff/${created.id}/doctor`);
    expect(blocked.status).toBe(403);
    await fetch(`${base}/api/mediai/handoff/${created.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    const ok = await fetch(`${base}/api/mediai/handoff/${created.id}/doctor`);
    expect(ok.status).toBe(200);
  });

  it("C: image ingest is refused; typed corpus still merges", async () => {
    const r = await fetch(`${base}/api/mediai/medication/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: "aaaa", text: "" }),
    });
    expect(r.status).toBe(409);
    const data = await r.json();
    expect(data.status).toBe("incomplete");
  });

  it("C: typed Glucophage + Amoxil merge to RxNorm without false merges", async () => {
    const r = await fetch(`${base}/api/mediai/medication/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: "photo-corpus",
        doctorId: "doc1",
        text: "GLUCOPHAGE 500 MG\nAMOXIL 500MG",
        startedOn: "2026-08-01",
      }),
    });
    expect(r.status).toBe(200);
    const data = await r.json();
    const cuis = data.graph.medications.map((m: { rxcui: string }) => m.rxcui).sort();
    expect(cuis).toEqual(["6809", "723"]);
    const again = await fetch(`${base}/api/mediai/medication/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: "photo-corpus",
        doctorId: "doc2",
        text: "Metformin 500 mg",
        startedOn: "2026-08-02",
      }),
    }).then((x) => x.json());
    expect(again.graph.medications.filter((m: { rxcui: string }) => m.rxcui === "6809")).toHaveLength(
      1,
    );
  });

  it("previews a second-clinic Rx against a patient-owned graph without using the silo store", async () => {
    const r = await fetch(`${base}/api/mediai/medication/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctorId: "gp",
        startedOn: "2026-09-10",
        text: "ibuprofen 400mg",
        graph: {
          patientId: "p-cross",
          allergies: [],
          organFlags: { kidneyImpairment: false, liverImpairment: false },
          medications: [
            {
              id: "1",
              rxcui: "11289",
              genericName: "warfarin",
              sourceDoctorId: "cardiologist",
              startedOn: "2026-07-01",
              rawText: "warfarin",
            },
          ],
        },
      }),
    });
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.audit.status).toBe("interaction");
    expect(data.audit.findings.join(" ")).toMatch(/cross-doctor/);
  });

  it("B: projection stays under the slider latency budget", async () => {
    const r = await fetch(`${base}/api/mediai/risk/project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: {
          fastingGlucose: 142,
          bmi: 31.4,
          age: 46,
          systolic: 138,
          familyHistory: true,
        },
        bmi: 26,
      }),
    });
    const data = await r.json();
    expect(data.latencyMs).toBeLessThan(200);
    expect(data.now.diabetes).toBeLessThan(50);
  });

  it("A: verifier failure does not drop triage or consilium events", async () => {
    const r = await fetch(`${base}/api/mediai/canvas/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: { answers: { fever: "yes" }, turn: 1 },
        failVerifier: true,
      }),
    });
    const data = await r.json();
    const types = data.events.map((e: { type: string; engine?: string }) => e.type);
    expect(types).toContain("engine.error");
    expect(types).toContain("triage.distribution");
    expect(types).toContain("consilium.resolution");
    expect(types).not.toContain("verifier.claim");
  });

  it("D4: red-flag escalation is visible on the intake endpoint", async () => {
    const r = await fetch(`${base}/api/mediai/intake/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newText: "sudden chest pain while waiting",
        appointmentDaysOut: 12,
      }),
    });
    const data = await r.json();
    expect(data.escalate).toBe(true);
    const quiet = await fetch(`${base}/api/mediai/intake/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newText: "mild sore throat still",
        appointmentDaysOut: 12,
      }),
    }).then((x) => x.json());
    expect(quiet.escalate).toBe(false);
  });

  it("D5: unsourced extra claims never mint a doctor-visible brief", async () => {
    const created = await fetch(`${base}/api/mediai/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fragments: [] }),
    });
    expect(created.status).toBe(422);
  });

  it("D5: colloquial input is translated and still blocked until review", async () => {
    const created = await fetch(`${base}/api/mediai/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fragments: [
          "Been running a temp since yesterday",
          "my throat is killing me",
        ],
        medications: [],
        differential: [{ condition: "viral_uri", probability: 0.4 }],
      }),
    }).then((r) => r.json());
    expect(created.chiefComplaint).toMatch(/fever|sore throat/i);
    expect(created.synthesis).toMatch(/fever|sore throat/i);
    expect(created.patientWords.join(" ")).toMatch(/killing me|running a temp/i);
    expect(
      (await fetch(`${base}/api/mediai/handoff/${created.id}/doctor`)).status,
    ).toBe(403);
  });

  it("D5: waiver is an explicit gate, not a silent skip", async () => {
    const created = await fetch(`${base}/api/mediai/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fragments: ["fever since yesterday", "sore throat"],
        medications: [],
        differential: [{ condition: "viral_uri", probability: 0.4 }],
      }),
    }).then((r) => r.json());
    expect(
      (await fetch(`${base}/api/mediai/handoff/${created.id}/doctor`)).status,
    ).toBe(403);
    await fetch(`${base}/api/mediai/handoff/${created.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "waived", note: "patient waived review" }),
    });
    expect(
      (await fetch(`${base}/api/mediai/handoff/${created.id}/doctor`)).status,
    ).toBe(200);
  });

  it("F: environment infer recovers a lagged signal over HTTP", async () => {
    const env = Array.from({ length: 40 }, (_, i) => Math.sin(i / 4));
    const symptoms = env.map((_, i) => (i >= 2 ? env[i - 2] : 0));
    const r = await fetch(`${base}/api/mediai/environment/infer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ env, symptoms }),
    });
    const data = await r.json();
    expect(data.signal).toBe(true);
    expect(data.lag).toBe(2);
  });

  it("E: plan diff is non-editorial over HTTP", async () => {
    const r = await fetch(`${base}/api/mediai/outcomes/diff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        a: {
          drug: "amoxicillin",
          dose: "500mg",
          duration: "7d",
          investigations: ["throat swab"],
        },
        b: {
          drug: "azithromycin",
          dose: "500mg",
          duration: "3d",
          investigations: ["throat swab", "CBC"],
        },
      }),
    });
    const data = await r.json();
    expect(data.copy).not.toMatch(/better|worse|superior/i);
    expect(data.diffs.some((d: { field: string }) => d.field === "drug")).toBe(
      true,
    );
  });

  it("chat analyze runs verifier and red-flag engines", async () => {
    const r = await fetch(`${base}/api/mediai/chat/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userText: "sudden chest pain while waiting",
        assistantText: "You may have a pulled muscle. You definitely have leukaemia.",
        patientId: "chat-demo",
      }),
    });
    const data = await r.json();
    expect(r.status).toBe(200);
    expect(data.escalation.escalate).toBe(true);
    expect(
      data.verdicts.some(
        (v: { text: string; status: string }) =>
          /leukaemia|leukemia/i.test(v.text) && v.status === "unsupported",
      ),
    ).toBe(true);
  });
});
