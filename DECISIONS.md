# Decisions (autonomous session)

Log of judgment calls not specified in the master prompt. Newest last.

- Stay on a feature branch `cursor/mediai-feature-build-5aef` rather than committing this volume of new work directly to `main`.
- Keep the existing Vite + Express + React stack. The prompt redesigns the current site; it does not require a Next.js migration.
- Do not call Gemini (or any LLM) inside unit tests or core scoring loops. Engines are deterministic so tests are reproducible and cannot hallucinate a pass.
- Claim verifier uses conservative lexical/negation entailment against retrieved evidence only. Empty evidence flags every claim. False negatives on unsupported claims are treated as worse than extra flags.
- Live prescription OCR is **removed**. Typed names resolve through RxNorm / RxNav. Unknown tokens return `incomplete` (HTTP 409). NLM RxNav is on outside unit tests (`liveRxnormNetwork`). DDI table is the ONC high-priority published subset plus optional live RxNav pairs.
- D5 clinical synthesis translates colloquial phrases only through `COLLOQUIAL_LEXICON`. Each clinical extra token must come from a mapping whose source span is in the patient transcript. Unmapped wording stays verbatim. Unsourced clinical terms (e.g. haematuria) still throw. Chat can stash the live transcript into `/handoff-review` in one click.
- Risk slider (B1) uses a local monotonic surrogate over the same clinical inputs as the existing forms, labeled as a projection surface. It does not silently pretend to be the Hugging Face Gradio models (those are not guaranteed monotonic or <200ms).
- Counterfactuals (B2) are a seeded constrained search over plausibility bounds, not the Python DiCE package (not in this stack). Ranking is deterministic given the seed. Rank by combined diabetes+heart+kidney drop so systolic candidates are not discarded just because they do not move the diabetes score. Demo copy uses the live top-ranked change rather than a hardcoded 118 mg/dL line.
- Causal estimates (E2) use propensity-score matching implemented here, not DoWhy/EconML, so tests do not depend on a Python scientific stack.
- Environmental data uses a synthetic/local series in tests. Live Open-Meteo is optional and never invents a correlation when the null check fails. Null threshold r = 0.35 on |Pearson|.
- D4 red-flag list is conservative (breathing variants, chest pain, anaphylaxis, meningism, suicidal ideation, bleeding, stroke signs). Waiting-window N = 3 days is recorded on the event, but a red flag always escalates even if the appointment is tomorrow. False negatives are treated as the costly failure. Negated mentions ("no chest pain") do not escalate.
- Handoff briefs never reach a doctor view unless `patientReview.status === "approved"` or an explicit `waiver` object is present.
- Medication interaction engine ships on a curated local graph. If a drug is unknown, the audit returns `incomplete` (visible), not a silent all-clear. Penicillin allergy cross-reacts with amoxicillin.
- Landing copy em-dashes from the prompt are rewritten to commas or periods to keep the existing no-em-dash visual rule.
- Hero and trust-chip copy are applied only after Groups A–F have a shipped engine behind each claim.
- D5 clinical synthesis organises the patient's own fragments in time and translates colloquial language only through a sourced phrase map. Triage ranking is a separately labeled engine snapshot, never mixed into sourced patient statements.
- Section 7 keeps the existing explained-risk card and adds the BMI slider/counterfactual demo beneath it (extend, do not replace).
- Visual regression + Lighthouse CI is not in this repo's toolchain. Reduced-motion is handled in the new demos via `useReducedMotion` (static end-state). A Chromium pass is attempted in-session; absence of Lighthouse is logged as a follow-up, not papered over.
- Gemini client init is lazy. Importing the SPA (and the marketing landing) must not throw if `VITE_GEMINI_API_KEY` is absent; chat still fails visibly when a reply is requested.
