# Where to show the engines (viva)

Chat wording can come from Gemini **or** from our fallback in `shared/mediai/engineReply.ts` when the Gemini key is missing. Everything below is **our code**, not Gemini.

| What to say | Open this file | What to point at |
| --- | --- | --- |
| NLP claim checker (underlines) | `shared/mediai/verifier.ts` | `splitClaims`, `tokens`, `SYNONYMS`, scoped negation, `verifyClaims`, `decorateText` |
| Red-flag NLP | `shared/mediai/intake.ts` | `RED_FLAGS`, `isNegatedAt`, `waitingWindowEscalation` |
| Colloquial → clinical map | `shared/mediai/colloquial.ts` | `COLLOQUIAL_LEXICON`, `assertMappedSourcing` |
| Drug NER + DDI graph | `shared/mediai/medication.ts` | `extractDrugMentionsFromText`, `NER_STOP`, `INTERACTIONS` (ONC list), `ALLERGY_CLASSES`, `forwardAudit` |
| RxNorm + live RxNav | `shared/mediai/rxnorm.ts` | `RXNORM`, `lookupRxnav`, `parseRxnavInteractions` |
| One chat turn through all of the above | `shared/mediai/chatSafety.ts` | `analyzeChatTurn`, `analyzeChatTurnLive` |
| Engine-only reply (no Gemini) | `shared/mediai/engineReply.ts` | `draftEngineReply` |
| Wired into the actual chat UI | `client/src/components/MedicalChat.tsx` | after Gemini (or fallback): `runChatEngines` + `ChatEnginePanel` |
| Underlines **in the bubble** | `MedicalChat.tsx` `renderAssistantText` + `decorateText` | dotted = unsupported, wavy = contradicted |
| Incomplete / red flag / DDI banner | `client/src/components/ChatEnginePanel.tsx` | shown under the same bubble |
| Chat → doctor brief | MedicalChat **Send to doctor brief** + `client/src/pages/handoff-review.tsx` | `takeStashedHandoff` |
| Persist graph / audit / brief / chat | `client/src/lib/engineStore.ts` + `firestore.rules` + `server/mediaiPersist.ts` | Firestore `users/{uid}/mediai*` + localStorage + `data/mediai-store.json` |
| HTTP for the same engines | `server/mediaiRoutes.ts` | `POST /api/mediai/chat/analyze` (live RxNav when not under Vitest) |

## Demo script (tomorrow)

1. Open `/dashboard` (guest is allowed — no login required for the chat engines).
2. Type: `I take warfarin and started ibuprofen, also sudden chest pain`
3. Wait for the reply. You should see:
   - a **red-flag** banner
   - a **medication interaction** banner (warfarin + NSAID)
   - **dotted underlines** on claims that are not in your words
4. Click **Send to doctor brief** → **I approve this brief** → **Open doctor view**.
5. Optional: type `xyzalorpha 10mg` → **Incomplete** (fail-closed, no guessed RxCUI).
6. Do **not** demo photographed labels. Photo → RxCUI was removed on purpose.

Tables are curated from published sources (ONC high-priority DDI, RxNorm, NICE/CDC-style red flags). They still need a named clinician to sign off before real patients.
