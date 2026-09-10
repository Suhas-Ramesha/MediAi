# Session summary — MediAI feature build + site redesign

This session is **not** a clearance to point these engines at real patients. Green tests here mean the specified unit/integration contracts hold on synthetic and fixture data. They do not mean clinical validity, regulatory readiness, or production safety.

## What was built

Deterministic engines live in `shared/mediai/` and are served from `server/mediaiRoutes.ts` (`/api/mediai/*`). Landing demos import the same engines so they work without Express.

| Group | What shipped | Frontend surface |
| --- | --- | --- |
| A Reasoning Canvas | Information-gain triage, claim verifier (empty evidence flags all), four-persona consilium with mandatory skeptic objection, unified event stream with partial-failure isolation | Section 2 live canvas (claim underlines, probability bars, Show reasoning with all four personas). Section 4 consilium convergence diagram |
| C Medication graph | RxNorm-ish brand/generic merge, cross-doctor interaction audit, SIDER-window side-effect watch, penicillin-class allergy, unknown-drug `incomplete`, live OCR **off** | Section 5 connected copy + cross-doctor audit demo |
| D Intake | Timeline reconstruction, specialty guard, come-prepared (explicit `no_prep_needed`), red-flag escalation, sourced handoff brief with patient review/waiver gate | Section 3 card copy; `/handoff-review` patient gate |
| B Risk simulator | Monotonic local projection, &lt;200ms slider budget, 11 bounded counterfactuals ranked by combined risk drop | Section 7 existing risk card + BMI slider curves |
| F Environment | Lagged Pearson; shuffle/null does not invent a signal | Section 5 environmental demo (synthetic series) |
| E Outcomes | Confounded synthetic cohort, propensity matching, day-7 PRO with insufficient-data state, non-editorial plan diff | Section 4 plan-diff demo; `/clinician/outcomes` |

Hero, trust chips, nav (`Features · How it works · Trust · Risk & simulation · Dashboard`), and the footer disclaimer were updated last, after engines existed for each claim.

## Tests

`npx vitest run` — 42 tests across:

- `shared/mediai/canvas.test.ts` (A1–A4, including verifier failure not dropping triage/consilium)
- `shared/mediai/groups.test.ts` (C, D, B, F, E; adversarial: unknown drug, empty brief, unsourced haematuria, negated red flag, penicillin/amoxicillin)
- `server/mediaiRoutes.test.ts` (HTTP flows into the same contracts, including OCR 409, doctor 403 until review, waiver, env lag, plan diff)

`npm run build` is run in this session for the Vite client. Pre-existing `tsc` errors outside `shared/mediai` were not used as a reason to weaken new checks.

## Stubbed / deferred (and why)

- **Live OCR / NER / real RxNorm** — disabled. Image ingest returns HTTP 409 `incomplete`. Follow-up: a reviewed OCR pipeline.
- **Live Gradio/HF risk models on the slider** — not used. Local monotonic surface, labeled as such.
- **Python DiCE, DoWhy, EconML** — not in this stack. Constrained TS search and TS propensity matching instead.
- **Live Open-Meteo in the marketing demo** — synthetic lagged series so the demo is reproducible offline.
- **Colloquial-to-clinical translation in D5** — not done. Synthesis is chronological organisation of the patient's words, because translation without a sourced mapping would fail the unsourced-claim rule.
- **Visual regression + Lighthouse CI** — not part of the repo toolchain. Reduced-motion end-states are in the components. Manual Chromium pass attempted in-session.
- **Persistent store** — graphs, briefs, and the outcomes cohort are in-process maps/fixtures. They reset on server restart.

## Manual demo script (text)

1. **Claim underline (Section 2)**  
   Open `/`. Scroll to “Watch it think”. Wait for underlines (or use reduced motion: they are already on). Hover the dotted leukaemia line — tooltip says it is not supported. Click **Show reasoning**. Confirm the skeptic paragraph objects and dissent is preserved.

2. **Skeptic visible (Section 4)**  
   Scroll to “Disagreement is not a bug”. Confirm four persona blocks and a resolved line that still names the dissent. Confirm the plan-A / plan-B table has no better/worse language.

3. **Cross-doctor interaction (Section 5)**  
   Scroll to “Everything connected”. The demo panel must show warfarin (doctor 1) + ibuprofen (doctor 2) as `interaction`, not clear. Side-effect watch should mention metformin/diarrhea.

4. **Escalation**  
   From a shell or the network tab: `POST /api/mediai/intake/escalate` with `{ "newText": "sudden chest pain while waiting", "appointmentDaysOut": 12 }` → `escalate: true`. Repeat with `"mild sore throat still"` → `escalate: false`. On `/handoff-review`, Build brief → Open doctor view while still draft → must say Blocked. Approve → Open doctor view → synthesis appears.

5. **BMI slider (Section 7)**  
   Drag BMI from 31.4 toward 26. Diabetes/heart/kidney lines must bend down, not jump. Counterfactual line under the chart updates from the same engine. Reduced motion: chart draws at the final curve without tweening.

## Disclaimer vs copy

Footer now states: not a diagnostic device; claim checks, consilium, curves, audits, escalation, and outcome numbers are decision-support prototypes; they do not verify clinical truth; cross-doctor checks only cover the local graph; causal numbers are adjusted estimates on sample data; emergencies go to local emergency services. OCR photography is not claimed on the page.

## Human review required before real patient data

1. Clinical review of the triage likelihood table, red-flag list, interaction table, SIDER windows, allergy classes, and come-prepared guidelines. These are curated fixtures, not licensed knowledge bases.
2. Replace lexical entailment with a reviewed NLI stack, or keep it and never present “supported” as clinical truth (current disclaimer).
3. Independent safety review of D4 (negation handling can hide a real red flag in odd phrasing) and D5 (doctors must not treat the organised brief as complete history).
4. Wire engines to authenticated persistence, audit logs, and the real chat transcript — not in-memory maps.
5. Turn OCR on only after a measured error rate on a real prescription corpus; until then keep `liveOcr: false`.
6. Do not attach the local risk surface to treatment decisions; if the Gradio models return, prove monotonicity and latency before swapping them into the slider.
7. Privacy, consent, and key rotation (see `docs/SECURITY-KEY-ROTATION.md`) before any production patient traffic.
8. Accessibility and Lighthouse on the new sections in the project's own CI, not only this session's browser pass.

Passing 42 tests does not make this safe to use as a diagnostic, prescribing, or triage device.
