# Voice AI Observability Copilot

An Agent Observability Copilot built as a HighLevel Marketplace app that automates the **Monitor** and **Analyze** phases for Voice AI agents. It eliminates manual transcript auditing by running a continuous validation flywheel — ingesting calls from HighLevel, scoring them against agent-specific KPIs derived from the agent's own script, and surfacing actionable prompt-level recommendations inside the HighLevel interface.

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
│  │  + KPI Derivation│   │  + Monitor Gate      │ │
│  │  (LLM)           │   │  (Rule-based)        │ │
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
│           │  (LLM recommendations)   │           │
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
| `callMonitoringService` | Rule-based signal scorer — runs on every new call at sync time using phrase matching, required field detection, duration heuristics, and call status. Classifies each call as `achieved / failed / uncertain` without an LLM call |
| `transcriptEvaluationService` | Full LLM evaluation of each flagged transcript against the agent's KPI blueprint. Returns per-KPI status (`achieved / deviated / failed / missed / unreachable`), verbatim evidence quote, and a one-sentence prompt fix |
| `agentSynthesisService` | Reads aggregated KPI performance + the live agent script and generates 3–5 prioritized recommendations, each with the specific wording to add or change in the agent's prompt |
| `agentFeedbackFlywheelService` | Assembles the feedback cycle snapshot: health status, monitor summary, weakest KPIs, and recommendations |

---

## Observability Loops

### Loop 1 — Monitor (runs at sync time, no LLM cost)

1. `POST /calls/sync?locationId=&agentId=` pulls new calls from the HL Voice AI API
2. Each new call is immediately scored by the rule-based monitor gate (weighted signal model across summary, transcript, extracted data, call duration, and call status)
3. The `CallMonitorDecision` is persisted alongside the call — `shouldAnalyze: true/false`
4. High-confidence successes are skipped from LLM analysis, keeping evaluation costs proportional to actual failure volume

### Loop 2 — Analyze (LLM-powered, on demand)

1. `POST /agents/:agentId/analyze` fans out over all calls where `shouldAnalyze: true`
2. `transcriptEvaluationService` sends the full transcript + the agent's KPI blueprint to GPT-4.1-mini
3. The LLM classifies each KPI, cites verbatim evidence from the transcript, flags calls requiring human follow-up, and suggests a per-KPI prompt fix
4. Per-KPI counters (`achieved / deviated / failed / missed`) are aggregated and persisted on the agent
5. `POST /agents/:agentId/synthesize` runs the synthesis step — the LLM reads aggregated failure patterns + the live agent script and returns recommendations with specific prompt changes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, TypeScript |
| Frontend | Vue 3, Vite, Tailwind CSS |
| Database | MongoDB Atlas |
| LLM | OpenAI API — `gpt-4.1-mini` via Responses API |
| Integration | HighLevel Marketplace OAuth 2.0 |

---

## Prerequisites

- Node.js 18+
- MongoDB Atlas cluster (free tier works)
- OpenAI API key
- HighLevel Marketplace sandbox account with a published app (OAuth 2.0, Voice AI read scopes)
- [ngrok](https://ngrok.com) or equivalent to expose the backend for OAuth callbacks

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

OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_API_BASE_URL=https://api.openai.com/v1

FRONTEND_SUCCESS_URL=http://localhost:5173/auth/success
FRONTEND_FAILURE_URL=http://localhost:5173/auth/error
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
3. Install the app into your sandbox location by visiting the OAuth authorization URL
4. The backend handles the token exchange at `GET /oauth/callback` and stores the access/refresh tokens per location in MongoDB
5. Open the frontend, enter your `locationId`, and begin syncing

---

## Usage Workflow

```
Sync Agents  →  Sync Calls  →  Analyze Transcripts  →  Synthesize Insights
```

| Step | Action | What happens |
|---|---|---|
| 1 | **Sync Agents** | Pulls all Voice AI agents from HL. For each agent, reads the live script and derives a KPI blueprint via LLM. Fingerprint-cached — skips LLM if the agent hasn't changed. |
| 2 | **Sync Calls** | Pulls call records from HL. Runs the monitor gate on each new call and persists the decision. Deduplicates by call ID. |
| 3 | **Analyze Transcripts** | Runs full LLM evaluation on calls flagged by the monitor. Computes per-KPI aggregates across all evaluated calls. |
| 4 | **Synthesize** | Reads aggregated failures + the live agent script and generates prioritized recommendations with specific prompt-level fixes. |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/agents/sync?locationId=` | Sync agents + derive KPIs from live scripts |
| `GET` | `/agents?locationId=` | List stored agents with aggregates |
| `GET` | `/agents/:id?locationId=` | Single agent detail |
| `GET` | `/agents/:id/workspace?locationId=` | Full workspace: agent + KPI blueprint + calls + evaluations |
| `POST` | `/agents/:id/analyze?locationId=` | Run LLM evaluation on all flagged calls |
| `POST` | `/agents/:id/synthesize?locationId=` | Generate LLM recommendations |
| `POST` | `/calls/sync?locationId=&agentId=` | Sync calls + run monitor gate |
| `GET` | `/calls?locationId=` | List stored calls |
| `POST` | `/calls/:id/analyze?locationId=` | Evaluate a single call |
| `GET` | `/oauth/callback` | HighLevel OAuth redirect handler |

---

## What is Functional vs Mocked

### Fully Functional

- **HighLevel OAuth** — full token exchange, automatic refresh, and per-location token storage in MongoDB
- **Agent sync** — live pull from HL Voice AI API including the raw agent script and configured actions
- **KPI derivation** — LLM reads the agent's live script and derives agent-specific, testable KPIs. SHA-256 fingerprint of the agent metadata prevents redundant re-derivation
- **Call sync** — live pull with deduplication by call ID
- **Monitor gate** — rule-based signal scoring on every new call at sync time, persisted as a `CallMonitorDecision`
- **Transcript evaluation** — full LLM evaluation with per-KPI status, verbatim evidence, human follow-up flags, and prompt fix suggestions
- **KPI aggregation** — per-KPI counters maintained across all evaluated calls
- **Recommendations synthesis** — LLM reads aggregated failure data + the live agent script and produces prompt-level fixes. `training` is excluded as an owner type since the agent runs on a third-party LLM provider
- **Feedback flywheel** — health status, weakest KPIs, monitor summary, and recommendations assembled per agent into a single snapshot

### Mocked / Not Production-Ready

- The `/dashboard` endpoint and `observabilityService` use a static rule-based analysis pipeline — this is a prototype remnant not used by the main UI. The primary UI path goes through `GET /agents/:id/workspace`
- `POST /calls/ingest` uses the old analysis path (not LLM evaluation) — kept for testing purposes only
- No webhook-based real-time ingestion — calls are synced on demand via the UI

---

## Team of One — Ownership

**Product** — Defined the two observability loops (Monitor + Analyze). Chose the KPI-first model: derive KPIs from the agent's own script rather than hardcoding categories, so the system works for any agent regardless of industry or goal. Designed the feedback flywheel where the monitor gate keeps LLM costs proportional to actual failure volume.

**Design** — Built the Vue 3 UI as a HighLevel-embedded app. The dashboard gives a cross-agent health overview. The agent detail page exposes the full observability stack across four tabs: Insights (recommendations + KPI breakdown), Transcripts (clickable rows with evaluation scores), Agent Info (derived profile), and KPIs (blueprint + issue rates per KPI).

**Engineering** — TypeScript end-to-end with strict types. MongoDB with upsert-based sync so re-syncing is idempotent. SHA-256 fingerprinting on agent metadata and transcript content prevents duplicate LLM calls. Monitor decisions are persisted at sync time so the analyze step never re-evaluates unchanged calls. All three LLM tasks (KPI derivation, transcript evaluation, synthesis) use structured JSON output with explicit enum validation and fallback handling on every parse.

**QA** — The `unreachable` KPI status prevents penalizing agents for calls that ended before a KPI could be addressed. Fingerprint-based deduplication prevents double-billing on re-syncs. Owner categories in recommendations exclude `training` since third-party LLM providers cannot be fine-tuned through this platform. All LLM-returned enums are validated against known values before persistence — unknown values fall back to safe defaults rather than crashing.
