# Exposed credentials: what happened and what you must do

The repository `suhas-ramesha/MediAi` is **public**, and these files were committed
to it: `.env`, `client/.env`, `client/.env.local`. Anyone who cloned or viewed the
repository could read every value in them.

Removing the files from the repository does **not** undo the exposure. The values
are still present in the git history, and GitHub retains cached views and any
forks. **The only real fix is to revoke each key and issue a new one.**

---

## 1. Keys you must rotate now

### Gemini API key — highest priority

Exposed value began `AIzaSyCcHZ…`. It was in both `.env` and `client/.env`.

An exposed Gemini key can be used by anyone to make billed requests against your
Google Cloud project until you revoke it.

1. Open <https://aistudio.google.com/apikey> (or Google Cloud Console → APIs &
   Services → Credentials).
2. **Delete** the existing key. Delete it; do not merely rename it.
3. Create a new key.
4. Put the new key in your local `.env` as `GEMINI_API_KEY` — **without** the
   `VITE_` prefix. See section 2 for why this matters.
5. Check Google Cloud Console → Billing for unexpected usage while the key was public.

### Deepgram API key

Exposed value began `ba5963…`, in `client/.env`.

1. Open the Deepgram console → API Keys.
2. Revoke the existing key and create a replacement.
3. Store it as `DEEPGRAM_API_KEY` (no `VITE_` prefix).

### Cloudinary unsigned upload preset

Cloud name `daj6qscdv`, preset `medica…`.

An unsigned upload preset is designed to be public, so this is lower severity.
However, anyone holding it can upload arbitrary files into your Cloudinary
account. In the Cloudinary console, under Settings → Upload, either restrict the
preset to specific allowed formats and a maximum file size, or rotate it and
enable signed uploads.

---

## 2. Why rotating the Gemini key is not enough on its own

Vite inlines **every** variable prefixed with `VITE_` directly into the
JavaScript bundle that is sent to the browser. `VITE_GEMINI_API_KEY` was
therefore readable by any visitor to the deployed site, entirely independently of
the git leak. Anyone could open developer tools and read it out of the bundle.

This means that if you rotate the key and keep using `VITE_GEMINI_API_KEY`, the
new key becomes public again the moment you deploy.

The structural fix is to call Gemini from the Express server instead of from the
browser, and have the browser call your own server:

```text
browser  →  POST /api/ai/chat  (your Express server)  →  Gemini API
                                    ↑
                        key lives here only, never sent to the browser
```

Concretely:

1. Add `GEMINI_API_KEY` (no `VITE_` prefix) to the server environment.
2. Add a route in `server/routes.ts` that accepts the chat payload, calls Gemini
   server-side, and streams the response back.
3. Change `client/src/lib/aiService.ts` to `fetch('/api/ai/chat', …)` rather than
   constructing `GoogleGenerativeAI` in the browser.
4. Remove `VITE_GEMINI_API_KEY` from all env files.

This also lets you add rate limiting so a scraper cannot drain your quota.

### Firebase web config is a different case

`VITE_FIREBASE_API_KEY` and the other Firebase values are **not** secrets.
Google documents them as safe to embed in client code. Firebase security is
enforced by two things instead:

- `firestore.rules` — already correctly scoped in this project. Every collection
  checks `request.auth.uid` against the document's `userId`, so one user cannot
  read another user's consultations.
- **Authorized domains** — Firebase Console → Authentication → Settings →
  Authorized domains. Keep this list restricted to `localhost` and your real
  deployed domain so the config cannot be reused on an attacker's site.

You do not need to rotate the Firebase config. You should verify the authorized
domain list.

---

## 3. Repository hygiene applied in this branch

| Change | Effect |
| --- | --- |
| `.env`, `client/.env`, `client/.env.local` untracked | Future commits will not include them |
| `.gitignore` hardened | Covers `.env*`, `*.pem`, `*.key`, service-account JSON |
| `console.log('API Key loaded:', apiKey)` removed from `aiService.ts` | Key no longer printed into the browser console |
| `venv/` and `ml_service/.venv/` untracked (5,254 files, ~91 MB) | Repository shrinks substantially; these must never be committed |
| `.env.example` and `client/.env.example` added | Documents required variables without real values |

After pulling this branch, recreate your local env files from the examples:

```bash
cp .env.example .env
cp client/.env.example client/.env
# then paste in your NEW rotated keys
```

---

## 4. Optional: scrubbing git history

The old keys remain in history at commits `a72e0a3`, `0322463`, `ace942b` and
`b1fbbe6`. Once the keys are revoked, those history entries are harmless — they
are strings that no longer authenticate anything.

If you still want them gone (for example because the repository is being
submitted for evaluation), history can be rewritten with `git filter-repo`:

```bash
pip install git-filter-repo
git filter-repo --path .env --path client/.env --path client/.env.local --invert-paths
git push --force --all
```

Be aware of the consequences before running this:

- It **rewrites every commit hash** in the repository.
- It requires a force push, which breaks every existing clone and fork.
- Anyone else working on the repository must re-clone from scratch.
- It does not remove GitHub's cached views of the old commits; you have to ask
  GitHub Support for that.

I have deliberately **not** done this, because rewriting shared history is
destructive and should be your explicit decision. Rotating the keys achieves the
actual security goal. Say the word and I will run it.

---

## 5. Checklist

- [ ] Gemini key deleted and replaced
- [ ] Google Cloud billing checked for unexpected usage
- [ ] Deepgram key revoked and replaced
- [ ] Cloudinary upload preset restricted or rotated
- [ ] Firebase authorized-domain list verified
- [ ] Local `.env` files recreated from the examples with new keys
- [ ] Gemini calls moved server-side so the new key is not re-exposed
- [ ] (Optional) git history rewritten
