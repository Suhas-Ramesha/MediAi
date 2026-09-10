# Where to show the engines (viva)

Chat replies still use Gemini for wording. Everything below is **our code**, not Gemini.

| What to say | Open this file | What to point at |
| --- | --- | --- |
| NLP claim checker (underlines) | `shared/mediai/verifier.ts` | `splitClaims`, `tokens`, synonym fold, scoped negation, `verifyClaims` |
| Red-flag NLP | `shared/mediai/intake.ts` | `RED_FLAGS`, `isNegatedAt`, `waitingWindowEscalation` |
| Colloquial → clinical map | `shared/mediai/colloquial.ts` | `COLLOQUIAL_LEXICON`, `assertMappedSourcing` |
| Drug NER + DDI graph | `shared/mediai/medication.ts` | `extractDrugMentionsFromText`, `INTERACTIONS` (ONC list), `ALLERGY_CLASSES`, `forwardAudit` |
| RxNorm + live RxNav | `shared/mediai/rxnorm.ts` | `RXNORM`, `lookupRxnav`, `parseRxnavInteractions` |
| One chat turn through all of the above | `shared/mediai/chatSafety.ts` | `analyzeChatTurn` |
| Wired into the actual chat UI | `client/src/components/MedicalChat.tsx` | after Gemini stream: `analyzeChatTurn` + `ChatEnginePanel` |
| Underlines in the bubble | `client/src/components/ChatEnginePanel.tsx` | dotted = unsupported, wavy = contradicted |
| Chat → doctor brief | same MedicalChat **Send to doctor brief** + `client/src/pages/handoff-review.tsx` | `takeStashedHandoff` |
| Persist graph / audit / brief | `client/src/lib/engineStore.ts` + `firestore.rules` | Firestore `users/{uid}/mediai*` plus localStorage fallback |
| HTTP for the same engines | `server/mediaiRoutes.ts` | `POST /api/mediai/chat/analyze` |

Demo path: Dashboard chat → type “I take warfarin and started ibuprofen, also sudden chest pain” → wait for underlines / red flag / interaction → **Send to doctor brief** → Approve.

Tables are curated from published sources (ONC high-priority DDI, RxNorm, NICE/CDC-style red flags). They still need a named clinician to sign off before real patients.
