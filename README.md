# Voice AI Observability Copilot

An Agent Observability Copilot built for HighLevel Voice AI that automates the **Monitor** and **Analyze** phases for agents. It eliminates manual transcript auditing by pulling agent and call data from HighLevel, deriving agent-specific KPIs from the live prompt/script, evaluating transcripts against those KPIs, and surfacing actionable recommendations inside the HighLevel agent detail page.

**Live Demo:** [https://ghl-observability.vercel.app/](https://ghl-observability.vercel.app/)

---

## Architecture

```
HighLevel Marketplace (OAuth 2.0)
           │
           ▼
┌──────────────────────────────────────────────────┐
│               Express Backend (Node.js)           │
│                                                  │
│  ┌──────────────────┐   ┌──────────────────────┐ │
│  │  Agent Sync      │   │  Call Sync           │ │
│  │  + KPI Derivation│   │  + Transcript Store  │ │
│  │  (LLM)           │   │                      │ │
│  └────────┬─────────┘   └──────────┬───────────┘ │
│           │                        │             │
│           └────────────┬───────────┘             │
│                        ▼                         │
│           ┌──────────────────────────┐           │
│           │  Transcript Evaluation   │           │
│           │  (LLM, per-KPI scoring)  │           │
│           └──────────────────────────┘           │
│                        │                         │
│                        ▼                         │
│           ┌──────────────────────────┐           │
│           │  Aggregation + Synthesis │           │
│           │  + Prompt Apply          │           │
│           └──────────────────────────┘           │
└──────────────────────┬───────────────────────────┘
                       │
                  MongoDB Atlas
                       │
                       ▼
          ┌─────────────────────────┐
          │     Vue 3 Frontend      │
          │  (Vite + Tailwind CSS)  │
          │   Embedded in HighLevel │
          └─────────────────────────┘
```

### Service Breakdown

| Service | Role |
|---|---|
| `agentKpiDerivationService` | Reads the agent's live script from HL, calls GPT-4.1-mini to derive 4–6 plain-English KPIs specific to that agent's goal and workflow |
| `transcriptEvaluationService` | Full LLM evaluation of each transcript against the agent's KPI blueprint. Returns per-KPI status (`achieved / deviated / failed / missed / unreachable`), evidence, human follow-up flags, and a suggested fix |
| `agentSynthesisService` | Reads aggregated KPI performance + the live agent script and generates prioritized recommendations across `prompt`, `operations`, and `qa` owners. It also generates prompt patches when selected prompt recommendations are applied |
| `agentFeedbackFlywheelService` | Assembles the feedback cycle snapshot: health status, weakest KPIs, and recommendations |
| `contextAuthService` | Issues the app JWT used by the embedded iframe UI after `/auth/verify` confirms the app is installed for the current HighLevel location |

---

## Observability Loops

### Loop 1 — Monitor

1. `POST /calls/sync?locationId=&agentId=` pulls new calls from the HL Voice AI API
2. Calls are stored locally with transcript, summary, extracted data, and metadata
3. The synced data becomes the observability base layer for KPI evaluation, transcript drill-down, and recommendation synthesis

### Loop 2 — Analyze (LLM-powered, on demand)

1. `POST /agents/:agentId/analyze` evaluates the agent's synced calls against its KPI blueprint
2. `transcriptEvaluationService` sends the full transcript + the agent's KPI blueprint to GPT-4.1-mini
3. The LLM classifies each KPI, cites verbatim evidence from the transcript, flags calls requiring human follow-up, and suggests a per-KPI prompt fix
4. Per-KPI counters (`achieved / deviated / failed / missed`) are aggregated and persisted on the agent
5. Recommendation synthesis reads aggregate failure patterns + the live agent script and returns recommendations with specific next actions
6. Selected `prompt` recommendations can be batch-applied to the live HighLevel agent, after confirmation, and the UI marks analysis as stale until new calls are analyzed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, TypeScript |
| Frontend | Vue 3, Vite, Tailwind CSS |
| Database | MongoDB Atlas |
| LLM | OpenAI API — `gpt-4.1-mini` via Responses API |
| Integration | HighLevel Marketplace OAuth 2.0 + HighLevel Custom JS + iframe postMessage bridge |

---

## Prerequisites

- Node.js 18+
- MongoDB Atlas cluster (free tier works)
- OpenAI API key
- HighLevel Marketplace sandbox account with a published app (OAuth 2.0, Voice AI read scopes)
- [ngrok](https://ngrok.com) or equivalent to expose the backend for OAuth callbacks and webhook testing

---

## Installation

### 1. Clone the repo

```bash
git clone <repo-url>
cd highlevel-voice-ai-observability
```

### 2. Backend

```bash
cd backend
npm install
```

Create `.env`:

```env
PORT=3001
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/
MONGO_DB_NAME=voice_ai_observability

HIGHLEVEL_CLIENT_ID=your_client_id
HIGHLEVEL_CLIENT_SECRET=your_client_secret
HIGHLEVEL_REDIRECT_URI=https://your-ngrok-url/oauth/callback
HIGHLEVEL_TOKEN_URL=https://services.leadconnectorhq.com/oauth/token
HIGHLEVEL_API_BASE_URL=https://services.leadconnectorhq.com
HIGHLEVEL_CONTEXT_SECRET=your_highlevel_app_context_secret

OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_API_BASE_URL=https://api.openai.com/v1

```

```bash
npm run dev   # starts on http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
```

Create `.env`:

```env
VITE_API_BASE_URL=http://localhost:3001
```

```bash
npm run dev   # starts on http://localhost:5173
```

### 4. Expose the backend for OAuth

```bash
ngrok http 3001
```

Update `HIGHLEVEL_REDIRECT_URI` in `.env` and in your HL Marketplace app settings to match the generated ngrok URL.

---

## HighLevel Sandbox Setup

1. Create a Marketplace app in your HL developer account with the following scopes:
   - `voice-ai.agents.readonly`
   - `voice-ai.calls.readonly`
2. Set the OAuth redirect URI to your ngrok URL + `/oauth/callback`
3. Configure the app install webhook URL to hit your backend webhook route
4. Install the app into your sandbox location by visiting the OAuth authorization URL
5. The backend handles the token exchange and stores the access/refresh tokens in MongoDB
6. The install/uninstall webhook updates installation state; `UNINSTALL` immediately disables `/auth/verify`
7. Add your Custom JS in HighLevel so the Observability tab is injected on the Voice AI agent detail page

### Embedded Custom JS Flow

1. GHL Custom JS detects the current location and agent route
2. It calls `POST /auth/verify` with `{ locationId }`
3. If the app is installed for that location, the backend returns an app JWT
4. Custom JS injects the `Observability` tab and opens your frontend inside an iframe
5. The parent page sends the JWT + `locationId` into the iframe using `postMessage`
6. The iframe app stores the JWT in `localStorage` under `ghl_obs_token` and uses it for all backend API calls
7. If the app is uninstalled, `/auth/verify` returns `401`, the token is cleared, and the tab is not shown

### Custom JS Responsibilities

The HighLevel Custom JS is the parent-shell bootstrap for the embedded app. It is responsible for:

- detecting when the user is on a Voice AI agent detail route inside HighLevel
- reading the current HighLevel `locationId`
- calling `/auth/verify` to confirm the app is installed for that location
- injecting the `Observability` tab only after backend verification succeeds
- rendering the Vue app inside an iframe on tab click
- passing the short-lived app JWT and `locationId` into the iframe via `postMessage`
- responding to iframe auth requests after initial load
- removing or hiding the tab when verification fails or the app has been uninstalled

This keeps the install check in the parent HighLevel context, while the iframe app stays focused on the observability UI and authenticated backend API calls.

For this assignment build, the initial auth bootstrap is intentionally simplified: the parent Custom JS sends only the current `locationId` to `POST /auth/verify`, and the backend issues the app JWT if that location has an active installation record. In a production implementation, this initial verification should use HighLevel's signed payload / signed context so the backend can cryptographically verify that the request genuinely originated from the HighLevel parent context, instead of trusting the `locationId` alone.

### Parent → Iframe Auth Handshake

```text
HighLevel Agent Detail Page
  └─ Custom JS boots
      ├─ get current locationId
      ├─ POST /auth/verify { locationId }
      ├─ if valid: inject Observability tab
      ├─ user opens tab
      ├─ parent renders iframe: /agents/:agentId
      ├─ parent postMessage({ token, locationId })
      └─ iframe stores token as ghl_obs_token and starts API requests
```

---

## Usage Workflow

```
Sync Agents  →  Sync Calls  →  Analyze Transcripts  →  Review Recommendations  →  Apply Selected Prompt Fixes
```

| Step | Action | What happens |
|---|---|---|
| 1 | **Sync Agents** | Pulls all Voice AI agents from HL. For each agent, reads the live script and derives a KPI blueprint via LLM. Fingerprint-cached — skips LLM if the agent hasn't changed. |
| 2 | **Sync Calls** | Pulls call records from HL and stores them locally with transcript metadata. Deduplicates by call ID. |
| 3 | **Analyze Transcripts** | Runs full LLM evaluation on the synced calls. Computes per-KPI aggregates across all evaluated calls. |
| 4 | **Review Recommendations** | Displays synthesized recommendations grouped by owner: `prompt`, `operations`, and `qa`. Only `prompt` recommendations are auto-applicable. |
| 5 | **Apply Selected Prompt Fixes** | User selects multiple prompt recommendations, confirms the change in the UI, and the backend patches the live HighLevel agent prompt in one batch. After apply, the UI asks the user to sync/analyze new calls again. |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/auth/verify` | Verify app installation for a location and mint the iframe app JWT |
| `POST` | `/oauth/exchange` | Exchange OAuth code for stored HL tokens (frontend callback helper) |
| `POST` | `/webhooks` | Receive `INSTALL` and `UNINSTALL` app events from HighLevel |
| `POST` | `/agents/sync` | Sync agents + derive KPIs from live scripts |
| `GET` | `/agents` | List stored agents with aggregates |
| `GET` | `/agents/:id` | Full workspace payload: agent + KPI blueprint + calls + evaluations |
| `POST` | `/agents/:id/analyze` | Run LLM evaluation on the synced calls and regenerate recommendations |
| `POST` | `/agents/:id/apply-recommendation` | Backward-compatible single prompt recommendation apply |
| `POST` | `/agents/:id/apply-recommendations` | Batch-apply selected prompt recommendations to the live HighLevel agent |
| `POST` | `/calls/sync?agentId=` | Sync calls for a specific agent |
| `GET` | `/oauth/callback` | HighLevel OAuth redirect handler |

---

## What is Functional vs Mocked

### Fully Functional

- **HighLevel OAuth** — full token exchange, automatic refresh, and per-location token storage in MongoDB
- **Install-state-aware auth** — `POST /auth/verify` mints your app JWT only if the app is still installed for that location
- **Install and uninstall webhooks** — `INSTALL` and `UNINSTALL` are recorded, and uninstall immediately blocks new app JWT issuance
- **Agent sync** — live pull from HL Voice AI API including the raw agent script and configured actions
- **KPI derivation** — LLM reads the agent's live script and derives agent-specific, testable KPIs. SHA-256 fingerprint of the agent metadata prevents redundant re-derivation
- **Call sync** — live pull with deduplication by call ID
- **Transcript evaluation** — full LLM evaluation with per-KPI status, verbatim evidence, human follow-up flags, and prompt fix suggestions
- **KPI aggregation** — per-KPI counters maintained across all evaluated calls
- **Recommendations synthesis** — LLM reads aggregated failure data + the live agent script and produces recommendations with `prompt`, `operations`, and `qa` owners
- **Batch prompt apply** — multiple prompt recommendations can be selected and applied together after a confirmation modal; the live HighLevel prompt is patched in one shot
- **Iframe auth bridge** — parent Custom JS passes the app JWT into the embedded frontend via `postMessage`, and the iframe stores it as `ghl_obs_token`
- **Feedback flywheel** — health status, weakest KPIs, and recommendations assembled per agent into a single snapshot

### Mocked / Not Production-Ready

- No webhook-based real-time ingestion — calls are synced on demand via the UI. The manual sync button exists for development and debugging purposes. In a production setup this would be replaced by a webhook-driven queue: HighLevel pushes call events to a webhook endpoint, the backend enqueues each event (e.g. SQS, BullMQ), and a worker processes calls from the queue — eliminating the need to poll on demand.
- The embedded app currently relies on Custom JS + iframe communication for auth bootstrap. In production, this can be hardened further with stricter origin validation and a more explicit parent-child handshake contract.
- Using a synchronous request-response mechanism for all processing (KPI derivation, transcript evaluation, synthesis) instead of a queue-based pipeline. For this assignment calls are processed inline during the API request. In production, each step would be pushed to a job queue and processed asynchronously by workers, preventing timeouts on large call volumes and enabling retries on failure.
- KPI re-derivation is still tied to agent sync, not to prompt-apply. After a prompt update, the UI correctly marks analysis stale and expects the user to sync/analyze fresh calls before trusting the new recommendation state.

---

## Team of One — Ownership

**Product** — Defined the two observability loops (Monitor + Analyze). Chose the KPI-first model: derive KPIs from the agent's own script rather than hardcoding categories, so the system works for any agent regardless of industry or goal. Framed recommendations across `prompt`, `operations`, and `qa`, with only prompt-owned items being auto-applicable.

**Design** — Built the Vue 3 UI as a HighLevel-embedded app opened from a dynamically injected `Observability` tab inside the Voice AI agent detail page. The agent detail page now keeps Insights focused on recommendations, uses a confirmation modal before live prompt changes, and shows a stale-analysis warning after prompt updates.

**Engineering** — TypeScript end-to-end with strict types. MongoDB with upsert-based sync so re-syncing is idempotent. SHA-256 fingerprinting on agent metadata and transcript content prevents duplicate LLM calls. The embedded iframe receives a short-lived app JWT from the parent Custom JS via `postMessage`, and uninstall webhooks immediately disable future auth bootstrap. All LLM tasks (KPI derivation, transcript evaluation, synthesis, prompt patch generation) use structured JSON output with explicit enum validation and fallback handling on every parse.

**QA** — The `unreachable` KPI status prevents penalizing agents for calls that ended before a KPI could be addressed. Fingerprint-based deduplication prevents double-billing on re-syncs. Recommendation owners are validated to `prompt | operations | qa`, and only prompt-owned fixes can be auto-applied. All LLM-returned enums are validated against known values before persistence — unknown values fall back to safe defaults rather than crashing.
