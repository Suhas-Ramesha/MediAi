# Clinical tables — sources (not a clinician signature)

These lists are **curated from published references** for the prototype. They are not a substitute for a named clinician’s review before production.

| Table | File | Source used |
| --- | --- | --- |
| RxNorm CUIs | `shared/mediai/rxnorm.ts` | NLM RxNav / RxNorm (e.g. metformin 6809, warfarin 11289) |
| DDI pairs | `shared/mediai/medication.ts` `INTERACTIONS` | ONC 2014 high-priority drug–drug interaction list, grounded to RxNorm ingredient CUIs |
| Live DDI | `fetchRxnavInteractions` | NLM RxNav Interaction API (`interaction/list.json`) |
| Allergy classes | `ALLERGY_CLASSES` | Standard beta-lactam / sulfa / NSAID / opioid cross-reactivity (conservative) |
| Red flags | `intake.ts` `RED_FLAGS` | NICE/CDC-style emergency features (airway, ACS, meningism, stroke, bleed, suicide) |
| Triage P(yes\|condition) | `triage.ts` | Expert priors for a teaching differential, plus gastroenteritis; not fitted on EHR data |
| Colloquial map | `colloquial.ts` | Lay → clinical phrasebook; unmapped text stays verbatim |

Unknown medicine → `incomplete`. Unsourced clinical extra in a brief → throw. Doctor view → 403 until approve/waiver.
