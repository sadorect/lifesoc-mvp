# LifeSOC

A personal Security Operations Centre for your life — the companion app to *Zero Trust: A Hacker's Blueprint for a Secure Life* by Tosin Omojola.

The book applies ethical-hacking methodology to six life domains (Relationships, Finances, Career, Health, Reputation, Mental & Emotional). This app turns that framework into working tools: a posture dashboard, a personal CVE register, a patch tracker, an incident log, an AI analyst, an IoC scanner, and the full audiobook and ebook.

Access is gated on proof of book ownership — see [Access control](#access-control).

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18 + Vite, installable PWA (`vite-plugin-pwa`) |
| Backend | Vercel serverless functions in `api/` (plain Node — **not** Next.js) |
| Auth | Clerk (`@clerk/clerk-react` client, `@clerk/backend` server) |
| Media | Cloudflare R2, served via short-lived presigned URLs |
| Audiobook | HLS with AES-128 encrypted segments (`hls.js`, native HLS on Safari) |
| Ebook | `react-pdf` |
| Local data | IndexedDB via `idb` |
| AI | Anthropic API (analyst + IoC scanner) |
| Narration | OpenAI TTS (generation-time only, not a runtime dependency) |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in real values
```

Local development needs **two processes**. Vite serves the UI on `:5173` and proxies `/api/*` to `:3000`, where the API runs:

```bash
node selfhost/server.js   # API on :3000 (reads .env.local) — or `vercel dev`
npm run dev               # Vite UI on :5173  ← open this one
```

Running only `npm run dev` will load the UI, but every API call fails — that surfaces as "Could not load the verification question" on the redeem screen.

### Environment variables

| Variable | Used for |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk client SDK (the only var exposed to the browser) |
| `CLERK_SECRET_KEY` | Server-side token verification and metadata writes |
| `BOOK_ACCESS_CODE` | The shared code printed in the book |
| `REVIEWER_CODES` | Per-reviewer codes, `name:CODE` pairs comma-separated — see [Reviewer codes](#reviewer-codes) |
| `ANTHROPIC_API_KEY` | AI Analyst and IoC Scanner |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` | Audiobook and ebook storage |
| `EXTRA_AUTHORIZED_PARTIES` | Optional extra origins accepted on Clerk tokens, comma-separated (e.g. a staging host) |
| `OPENAI_API_KEY` | Audiobook narration scripts only — not needed to run the app |
| `OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE` | Optional narration overrides (default `gpt-4o-mini-tts`, `echo`) |

Changing R2 bucket permissions (e.g. CORS) needs an **Admin Read & Write** R2 token; the regular object token returns `AccessDenied`.

## Access control

Two independent layers:

1. **Clerk sign-in** — everything sits behind `<SignedIn>`.
2. **Book redemption** — a one-time gate on top of Clerk.

On first sign-in, `BookGate` calls `/api/entitlement`; if the user hasn't redeemed, it shows the redeem screen. That screen requests a challenge from `/api/redeem-challenge`, which returns **one** randomly chosen question — its text and a `ref` pointing at the section of the book it came from, never the answer. The user submits the access code and their answer to `/api/redeem`, which validates both together and, on success, writes to Clerk `privateMetadata`:

```json
{ "bookRedeemed": true, "redeemedAt": "<ISO 8601>" }
```

`privateMetadata` is deliberate: it is writable only server-side and is never exposed to the browser, which is why the frontend has to ask `/api/entitlement` rather than reading it from the Clerk session.

A few properties worth preserving if you touch this code:

- **The question pool never leaves the server.** `api/_questions.js` holds all 26 questions with their accepted answer variants and must not be imported from anything in `src/`.
- **Failures are deliberately vague.** A wrong code and a wrong answer return the identical message. Revealing which field failed — via separate steps, a live checkmark, or distinct errors — would let the two be brute-forced independently, and there is no attempt cap.
- **Answers are matched loosely, codes strictly.** Both are lowercased, trimmed, and stripped of trailing punctuation; answers match against any accepted variant.
- **Entitlement is re-checked on every protected request.** The UI gate is convenience; `getEntitlement()` in `api/_entitlement.js` is the boundary.

Entitlement lapses 365 days after `redeemedAt`, after which the app shows a "complimentary year has ended" message. No billing exists yet.

### Reviewer codes

Reviewers redeem with a personal code from `REVIEWER_CODES` (e.g. `ada:REVIEW-ADA-7K2Q,bola:REVIEW-BOLA-M4XP`) in the same code box, leaving the question blank. `/api/redeem` checks reviewer codes first; a match skips the question, writes `accessType: 'reviewer'`, the reviewer's name and code to `privateMetadata`, and sets `publicMetadata.canDownload` so they can download the audiobook.

Reviewer access never lapses, but `getEntitlement()` only treats it as active while that reviewer's code is still in `REVIEWER_CODES` — delete the pair (and redeploy) to revoke them. A wrong reviewer code falls through to the normal check and gets the same generic error. Keep the codes in Vercel only; this repo is public.

## API routes

Every route below verifies the Clerk session. The **Entitled** column marks those that additionally require an active, unexpired redemption and return `403` otherwise.

| Route | Entitled | Purpose |
| --- | :---: | --- |
| `GET /api/entitlement` | – | Returns `{ status: 'none' \| 'active' \| 'expired' }` |
| `GET /api/redeem-challenge` | – | One random question (`questionId`, `questionText`, `ref`) |
| `POST /api/redeem` | – | Validates code + answer, writes `privateMetadata` |
| `GET /api/audiobook/chapters` | – | Chapter list and the `canDownload` flag |
| `GET /api/audiobook/playlist` | ✔ | HLS manifest, segments rewritten to presigned R2 URLs |
| `GET /api/audiobook/key` | ✔ | AES-128 decryption key for a chapter |
| `GET /api/audiobook/download` | ✔ | Presigned MP3 URL — also requires `publicMetadata.canDownload` |
| `GET /api/ebook/url` | ✔ | Presigned PDF URL |
| `POST /api/chat` | ✔ | AI Analyst |
| `POST /api/scan` | ✔ | IoC Scanner |

`chapters` is unentitled because it returns only titles and structure — no content.

### Notes on the media path

Audio segments are fetched **directly from R2** by the browser using presigned URLs; only the manifest and the decryption key pass through the API. Two consequences:

- R2's CORS policy must list every origin the app is served from (`scripts/set-r2-cors.mjs`).
- Presigned segment URLs must carry no `Authorization` header, or R2 rejects the signature. `Audiobook.jsx` attaches the Clerk token via `xhrSetup` only for `/api/audiobook/*`.

iOS Safari uses native HLS and cannot set headers on media requests, so the token is passed as a `?token=` query param and baked into the key URI by `playlist.js`.

### AI cost controls

`/api/chat` and `/api/scan` both spend real money per request, so both require auth **and** entitlement. `chat.js` additionally has a system-prompt scope directive plus `isLikelyOffTopic()`, a keyword/regex pre-check that rejects obvious off-topic prompts (code, trivia, translation) **before** any API call. It only fires when a message matches an off-topic pattern *and* contains none of the book's vocabulary. Treat it as friction, not a hard boundary — auth and entitlement are the real controls.

## Local data

Dashboard scores, CVE register, patch tracker, incident log, scan history, and analyst messages all live in IndexedDB (`src/lib/db.js`) and never leave the browser. There is no server-side store and no cross-device sync — clearing site data clears everything.

## Content pipelines

Source content is gitignored (`ZeroTrust_Audiobook/`, `ebook_src/`, `hls_output/`, `audiobook_keys.json`). Both pipelines need `ffmpeg` on `PATH`.

### Audiobook

```bash
npm run audiobook:split     # manuscript → 38 per-chapter .txt files
npm run audiobook:tts       # → per-chapter MP3s via OpenAI TTS (costs money)
npm run audiobook:process   # → AES-128 encrypted HLS + audiobook_keys.json
npm run audiobook:upload    # → R2 (hls/, originals/, keys/)
```

`split-manuscript.mjs` slices `ZeroTrust_Audio_Manuscript_1.txt` on chapter headings and **aborts if the heading count doesn't match** the 38 entries in `api/audiobook/_chapters.js` — that list is the source of truth for chapter IDs, and IDs are derived from file paths, so renaming a folder invalidates every previously uploaded chapter.

Chapter MP3s are encoded at 24 kHz / 48 kbps mono. That is a size choice, not a security one: it keeps R2 storage and egress down for speech-only audio, and HLS re-encodes to AES-128 AAC for streaming regardless.

`scripts/tts-sample.mjs` renders a short passage across several voices for A/B comparison before committing to a full run.

### Ebook

Drop the PDF at `ebook_src/zerotrust.pdf`, then:

```bash
npm run ebook:upload
```

The reader remembers the last page in `localStorage` and clamps it to the document length on load, so a page remembered from a longer previous edition can't break rendering.

## Deployment

Vercel, auto-deploying from `main`. Set every server-side variable in the Vercel project settings — `.env.local` is local only.

### Self-hosted (Docker)

`selfhost/` runs the same handlers outside Vercel: `server.js` mounts each `api/` file at the path Vercel would give it, serves the built `dist/` with an SPA fallback, and exposes `GET /up` for uptime checks. The container publishes on `127.0.0.1:3010` only; a reverse proxy (Apache) fronts it.

```bash
cp .env.example selfhost/.env   # production values, incl. VITE_CLERK_PUBLISHABLE_KEY (needed at build time)
selfhost/deploy.sh              # pull main, rebuild, swap, health-check; rolls back on failure
selfhost/deploy.sh --rollback   # return to the previously running image
```

Cache headers matter for the PWA: `/assets/*` is immutable, while `index.html`, `sw.js`, `registerSW.js` and the manifest are `no-cache` so installed apps pick up new builds. `vercel.json` is ignored here; a new route needs adding to the table in `selfhost/server.js` as well.

When adding a domain, three places need updating or authenticated requests will fail with `401`:

1. `authorizedParties` in `api/audiobook/_auth.js` (or the `EXTRA_AUTHORIZED_PARTIES` env var, comma-separated origins)
2. `ALLOWED` in `scripts/set-r2-cors.mjs`, then re-run it
3. The Clerk dashboard's allowed domains

## Repository layout

```
api/
  _entitlement.js       getEntitlement() — the server-side access boundary
  _questions.js         verification pool (server-only, never import from src/)
  audiobook/_auth.js    verifyAuth() + the shared Clerk client
  audiobook/_r2.js      R2 client, getObject(), signUrl()
  audiobook/_chapters.js  chapter IDs and titles — source of truth
src/
  App.jsx               tab shell; BookGate wraps everything signed-in
  components/BookGate.jsx  loading / redeem / expired / unlocked states
  lib/db.js             IndexedDB accessors
  lib/api.js            typed fetch wrappers
scripts/                content pipelines (see above)
selfhost/               Express server, Dockerfile, compose + deploy script (self-hosting)
```
