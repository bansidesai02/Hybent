# Hybent AI Agent (Voice): Architecture and Implementation Plan

Status: Draft v1 · Date: 2026-10-20 · Scope: HR calls (HYBENT Hiring) + warm-lead sales calls (HYBENT Sales)
Requirements source: *Hybent Hiring – AI Call Agent: Developer Documentation* (Draft v1, 18 pages). This plan does not restate it; section numbers like "Spec §4.3" refer to it.

---

## 1. Decisions taken

| # | Decision |
|---|---|
| D1 | One voice engine, **Hybent AI Agent**, serves two clients: HYBENT Hiring (HR) and HYBENT Sales (internal). |
| D2 | The engine is a **separate service in the same repo**: `hybent-voice-agent/`, deployed as its own container next to `backend` and `worker`. It is not a new repo or a new product. |
| D3 | The browser (hybent.com) never talks to the engine. Hiring frontend → Hiring backend → engine (internal API). The engine posts results back to the backend. |
| D4 | We build the engine ourselves on LiveKit Agents (open source) and buy models and telephony as APIs. |
| D5 | Sales calls go **only to warm leads** (a lead who replied, asked for a demo or called us). No AI cold calling in any market. |
| D6 | Target markets: India, US, Australia, Singapore, Germany, UAE. Launch in India first. |
| D7 | Caller identity is "Hybent" for now. The agent says "Hybent AI Agent" in its first sentence. |
| D8 | The AI recommends and HR decides. No auto-reject, no salary negotiation (Spec §1). |
| D9 | Languages: **English and Hindi** (Hinglish handled as Hindi/English code-switching). No Gujarati in v1. |
| D10 | Market order: India first, then **US and UAE**. Australia, Singapore and Germany come later. |
| D11 | Branded caller name (Truecaller Business etc.) comes later. |

## 2. Scope

### In scope

| Client | Call type | Trigger | Phase |
|---|---|---|---|
| Hiring | `PRESCREEN` | HR clicks *Start AI Pre-screen* (single or bulk), or stage auto-trigger | 1 |
| Hiring | `AVAILABILITY` | HR clicks *Check Availability*, or stage *Interview – scheduling pending* | 2 |
| Hiring | `REMINDER` | Interview scheduled (day before 6 PM, and 1 h before) | 2 |
| Sales | `DEMO_BOOKING` | Lead replied with interest and agreed to a call | 3 |
| Sales | `DEMO_REMINDER` | Demo scheduled | 3 |
| Sales | `INBOUND_QUALIFY` | Someone calls the Hybent sales number | 4 |

`AVAILABILITY` and `DEMO_BOOKING` use the same slot-booking flow, and `REMINDER` and `DEMO_REMINDER` use the same reminder flow. Only the script and the result handler differ.

### Out of scope (v1)

AI cold calling · technical interviews · offers or salary negotiation · WhatsApp calls · calls to job seekers outside a tenant's own candidate list.

## 3. Architecture

```
 hybent.com (React)                         Sales tracker / n8n (internal)
        │ existing API                                  │
        ▼                                               │ engine API (sales key)
 Hiring backend (FastAPI) ── engine API (hiring key) ──┐│
        ▲                                              ▼▼
        │ result callbacks              ┌───────────────────────────────┐
        └───────────────────────────────│ hybent-voice-agent            │
                                        │  api        create/cancel tasks│
 Sales DB ◄── result webhook ───────────│  scheduler  due tasks, retries │
                                        │  dialer     LiveKit SIP calls  │
                                        │  agent      conversation       │
                                        │  analyzer   post-call JSON     │
                                        └──────┬──────────────┬──────────┘
                                               │              │
                                     LiveKit (rooms, SIP)   STT / LLM / TTS APIs
                                               │
                                     Plivo / Twilio ──► phone network ──► candidate / lead
```

### 3.1 Engine modules

These follow the module names in Spec §3, inside one service.

| Module | Responsibility |
|---|---|
| `api` | `POST /tasks`, `POST /tasks/{id}/cancel`, `GET /tasks/{id}`. Authenticated per client. |
| `scheduler` | Polls due tasks every 30 s, enforces calling hours in the callee's time zone, retry policy, idempotency, per-client rate limits (Spec §4.3, §4.4, §9.3). |
| `dialer` | Creates the LiveKit room and dispatch, then dials through the SIP trunk. Maps SIP outcomes to `NO_ANSWER` / `BUSY` / `UNREACHABLE` / `FAILED`. |
| `agent` | The LiveKit Agents worker: script template, tools, language switching, voicemail detection, opt-out handling. |
| `analyzer` | After the call: extraction, normalisation, communication scores, summary and recommendation as strict JSON (Spec §5.6–5.9, §6.7, §7.6). Retries from a queue if the LLM is down (Spec §11). |
| `notifier` | Signed callback to the owning client with the final result. |

### 3.2 Deployment

- One new service, `voice-agent`, in `deploy/docker-compose.prod.yml`. It ships through the existing CI and ECR pipeline.
- Media latency needs the agent worker close to callers. Phase 1 runs it in **AWS Mumbai (ap-south-1)** or LiveKit Cloud with an India region. The API and scheduler can sit with the backend.
- Phase 3+ (US, AU, SG, DE, UAE): LiveKit Cloud multi-region, or extra worker regions. This is decided when the first non-India market goes live.

## 4. Integration contract

### 4.1 Client → engine

`POST /tasks` with header `X-Voice-Key: <client key>`:

```json
{
  "client_ref": "hiring:org_123:cand_1042:prescreen:1",   // idempotency key, unique per client
  "type": "PRESCREEN",
  "callee": { "name": "Riya Shah", "phone_e164": "+9198xxxxxxxx", "timezone": "Asia/Kolkata", "language_pref": "en" },
  "context": { "company_name": "...", "job_title": "...", "questions": [...], "slots": [...] },
  "schedule_at": null,                 // null = as soon as calling hours allow
  "callback_url": "https://api.hybent.com/v1/voice/callbacks",
  "consent": { "type": "APPLICATION_FORM", "captured_at": "2026-10-18T10:00:00Z" }
}
```

- The engine rejects a task without a consent record, or one for a phone on that client's opt-out list.
- A repeat `client_ref` returns the existing task instead of creating a second one.

### 4.2 Engine → client

`POST {callback_url}` signed with HMAC-SHA256 (`X-Voice-Signature`). The body is the per-type result JSON from the Spec (§5.9, §6.7, §7.6) plus `task_id`, `client_ref`, `attempt_no` and `status`. It is retried with backoff until it gets a 2xx (Spec §11: never lose call data).

### 4.3 Auth and isolation

| Rule | How |
|---|---|
| Each client has its own key | `hiring` and `sales` keys, stored hashed in the engine |
| Hiring tenant isolation | The engine stores `org_id` from the hiring backend and never accepts it from the browser. Results go only to that client's callback. |
| Sales data never enters the Hiring DB | Sales results go to the Sales webhook only |
| No public dialing | The engine API is reachable only from the backend and n8n networks (private network or IP allowlist). There is no endpoint that dials an arbitrary number without a task and consent. |

## 5. Data model (engine, Postgres schema `voice`)

This is the Spec §8 model, extended so two clients can share it.

| Table | Key columns |
|---|---|
| `clients` | `id`, `name` (hiring, sales), `key_hash`, `callback_url`, `rate_limit_per_min` |
| `call_tasks` | `id`, `client_id`, `client_ref` (unique per client), `org_id` (nullable, hiring only), `type`, `callee_phone_e164`, `callee_tz`, `language_pref`, `context` (jsonb), `consent` (jsonb), `scheduled_at`, `attempt_no`, `max_attempts`, `status`, `config_snapshot` |
| `call_records` | `id`, `task_id`, `provider_call_id`, `started_at`, `ended_at`, `duration_sec`, `status`, `language_detected`, `audio_quality`, `recording_key`, `transcript` (jsonb) |
| `call_results` | `record_id`, `structured_data` (jsonb), `summary_text`, `communication_scores`, `recommendation`, `flags`, `analyzer_version` |
| `opt_outs` | `client_id`, `org_id`, `phone_e164`, `reason`, `created_at`. Unique per client+org+phone. |
| `call_events` | Append-only audit log: task created, dialed, answered, ended, callback delivered, opt-out |

Recordings live in S3 with server-side encryption. They are deleted after 90 days unless held (Spec §10).

## 6. Conversation engine

### 6.1 Provider matrix

| Layer | India | US / AU / SG / UAE (English) | Germany |
|---|---|---|---|
| STT | Sarvam (en, hi, Hinglish) | Deepgram | Deepgram (de) |
| TTS | Sarvam Bulbul | Cartesia or ElevenLabs | Cartesia or ElevenLabs (de) |
| LLM in call | Groq (fast model) | same | same |
| LLM post-call | Groq (larger model) | same | same |
| Telephony | Plivo | Twilio or Plivo (local numbers) | Twilio or Plivo |

Providers sit behind one interface per layer, so changing one is a config change.

### 6.2 Scripts

- One template per call type, with variables from `context`. Common blocks from Spec §4 (opening, identity check, consent, callback, human request, opt-out) are shared by all templates.
- The agent captures answers through tools (`record_field`, `propose_slot`, `confirm_slot`, `request_callback`, `opt_out`, `flag_human`, `end_call`), so the result is structured, not guessed from the transcript later.
- Slot confirmation needs a spoken "yes" after a full date, day and time read-back (Spec §6.5). The slot is locked through the client at confirm time.
- Retrieved text (job descriptions, company data) is passed as data, never as instructions.

### 6.3 Communication assessment

This follows Spec §5.7: six dimensions plus an overall score. Inputs are the transcript plus timing signals (pauses, repeats) and an audio-quality estimate. Poor audio sets `LOW_CONFIDENCE`. Prompts forbid scoring accent, gender, age or region, and this is tested (§11).

## 7. Changes in HYBENT Hiring

| Area | Change |
|---|---|
| Backend | `voice_calls` link table (candidate, job, interview, task_id, status, result). New router: start pre-screen, availability, cancel, and the callback receiver. Event hooks on `interview.scheduled/rescheduled/cancelled` create and cancel reminder tasks. |
| Consent | An application-form checkbox for AI calls, stored with a timestamp. HR-added candidates need consent captured before an AI call. |
| Profile updates | Experience, CTC, ECTC and notice period are auto-filled with an audit note "source: AI pre-screen". Low-confidence values go to HR for confirmation instead of being written. |
| Calendar | v1: HR defines slot windows. v2: interviewer free/busy from Google Calendar (the current `calendar_service` only creates and cancels events). |
| Notifications | In-app and email at launch. SMS confirmations through Plivo (DLT templates in India). Slack later. |
| Billing | Call minutes metered through `ai_metering` as AI credits per tenant. |
| Frontend | Buttons on the candidate and interview pages, a call status timeline, and a result panel (summary, scores, transcript, recording). Per-job question-set editor. |

## 7A. Product UI (based on market research, Oct 2026)

Recruiting voice tools (Classet Joy, JobTalk, Workstream VoiceAI, Phenom, HeyMilo) and voice platforms (Retell, Vapi, Bland) converge on the same screens and behaviours. We adopt these.

### Screens in the Hiring portal

| Screen | What it shows | Market reference |
|---|---|---|
| **Job → AI Call setup** | Question set (template + job-specific), must-have criteria (min experience, budget, notice), on/off for auto-trigger at a stage, language | Classet script per job, JobTalk templates, HeyMilo per-role setups |
| **Candidate list** | Call status chip per candidate (Scheduled, Calling, Completed, No answer, Callback, Opted out) and fit badge; bulk select → *Start AI Pre-screen*; sort by fit | Trembit/Classet ranked shortlist |
| **Candidate → AI Call tab** | Recommendation + fit (Strong / Good / Borderline / Weak) at the top; each must-have marked **met / not met with the candidate's own quote**; extracted fields (CTC, ECTC, notice…); communication scores; red flags; candidate questions; recording player synced to the transcript; attempt history | Classet "fast-track" with quotes, Workstream pass/fail + Q&A |
| **Interview → scheduling status** | Availability call outcome, confirmed slot, reminder status (sent / confirmed / reschedule requested) | Workstream reminders, Classet booking status |
| **AI Calls dashboard** | Funnel: Queued → Dialed → Connected → Completed; connect rate, completion rate, average duration, HR agreement rate, no-show rate before vs after reminders; most-missed criteria per job | Retell batch funnel, Classet AI Insights |
| **Settings → AI Calls** | Calling hours, retry policy, caller number, recording retention, consent text, minutes used (credits) | — |

The sales side gets a smaller version inside the sales tracker: call status per lead, outcome, booked demo, transcript and recording.

### Placement in the existing portal (by role)

| Role (existing) | Where AI Calls appears |
|---|---|
| Recruiter (`/hiring/recruiter`) | New sidebar item **AI Calls** in *Main*, after *Schedule* (queue, needs action, history, insights). *Start AI Pre-screen* action on All/My Candidates (bulk) and on the candidate page. New **AI Call** tab on the candidate page. Call status chip on Pipeline cards. Reminder status on *Schedule*. AI Call section in the job create/edit flow. |
| Admin (`/hiring/admin`) | Everything above, plus **Settings → AI Calls** (enable, calling hours, retries, thresholds, consent text, retention, script approval). Minutes in *AI Credits*. Call triggers in *Audit Logs*. |
| Interviewer (`/hiring/interviewer`) | Read-only candidate confirmation status on *My Interviews* |
| Super admin (`/hiring/super-admin`) | AI Calls on/off per client in *Feature flags*, per-minute credit price in *AI credits*, engine status in *Health monitor*, cross-client call metrics in *Analytics*, phone numbers and compliance in *Global settings* |
| Candidate portal (`/hiring/portal`) | AI call consent at apply, AI call opt-out in *My Profile*, confirmed slot in *My Interviews* |
| Sales (not in the portal) | The internal sales tracker |

### Behaviours to copy

| Situation | Behaviour |
|---|---|
| No answer | Retry on the configured cadence, plus an **SMS with a callback/booking link** after the first miss (JobTalk) |
| Voicemail | Asynchronous voicemail detection; the agent waits ~1–2 s before speaking so detection can finish, then leaves a short message or hangs up (Retell/Telnyx guidance) |
| Call drops mid-way | Keep the partial transcript and scores, mark `PARTIAL`, schedule a retry and SMS the candidate |
| Candidate calls back | The inbound number reaches the same agent, which resumes the pending task for that phone number |
| Asks for a human | Flag `HUMAN_REQUESTED` (v1). Live transfer with context comes later. |
| Qualified candidate | Optional: SMS a self-booking link right after the call (Classet) |
| HR disagrees with AI | One click to override the fit or recommendation; overrides feed the HR agreement metric and threshold tuning |

### Post-call analysis pattern

Retell's model is fixed fields (summary, sentiment, successful, in_voicemail) plus custom extraction fields (Boolean / Text / Number / Selector) defined per agent. We use the same pattern: the Spec's fields are the defaults, and HR can add job-specific fields. Past calls can be re-analysed after a prompt change.

## 8. Changes in HYBENT Sales

| Area | Change |
|---|---|
| Trigger | A warm lead (status *Replied – interested* in the outreach tracker) is marked "OK to call" with the consent source (email reply link and timestamp). n8n then creates a `DEMO_BOOKING` task. |
| Slots | Bansi's demo calendar windows |
| Results | A webhook into the Sales DB updates lead status (*Demo booked*, *Callback*, *Not interested*, *Opt-out*). Opt-outs also go to the email suppression list. |
| Number | A separate Hybent sales number and caller ID, never the HR number |

## 9. Compliance

| Market | Required before launch there |
|---|---|
| India | DLT registration through the telephony provider. Automated calls declared with caller IDs (TRAI amendment, 18 Sep 2026). HR calls rely on candidate consent from the application form. |
| US | Prior express written consent for AI-voice calls (TCPA). Sales: warm leads with recorded consent only. |
| Germany | Explicit prior consent for marketing calls. GDPR: DPA with every provider, EU data handling review. |
| Australia | Do Not Call Register check for sales calls |
| Singapore | DNC Registry check, PDPA |
| UAE | Telemarketing rules on registered numbers and permitted hours |

All markets also need: an AI and recording disclosure in the first sentence, opt-out honoured immediately and permanently, calling hours in the callee's local time, and recording encryption with 90-day retention. Legal sign-off is needed per market before its first call.

## 10. Accounts and setup needed

| Item | Provider | Owner action |
|---|---|---|
| STT/TTS (India) | Sarvam | Account + API key + prepaid credits |
| LLM | Groq | Move to paid tier |
| Realtime + SIP | LiveKit Cloud (start) | Project + keys |
| Telephony India | Plivo | Company KYC, number, SIP trunk, DLT |
| Recordings | AWS S3 (Mumbai) | Bucket + IAM role |
| Later markets | Deepgram, Cartesia/ElevenLabs, Twilio | When each market starts |

Start Plivo KYC and DLT first: they take 1–3 weeks and block real calls.

## 11. Testing and metrics

- Testing follows Spec §13, plus: multi-client isolation (a sales key can't read hiring tasks, and an org can't see another org's calls), callback signature and retry, idempotent `client_ref`, an opt-out blocking future tasks across call types, and bias checks (the same answers in different accents must score the same).
- Metrics follow Spec §12, split by client and market.

## 12. Phases

| Phase | Deliverable | Estimate (1 developer) |
|---|---|---|
| 0 | Accounts, Plivo KYC, DLT, scripts approved by HR and legal | 1–3 weeks, in parallel |
| 1 | Engine core (api, scheduler, dialer, agent, analyzer, notifier) + Hiring `PRESCREEN` end to end, pilot with one job category | 5–6 weeks |
| 2 | Hiring `AVAILABILITY` + `REMINDER`, slot locking, SMS | 3–4 weeks |
| 3 | Sales `DEMO_BOOKING` + `DEMO_REMINDER` (reuses phase 2 flows) | 1–2 weeks |
| 4 | Sales inbound + first non-India market (provider + compliance) | 2–3 weeks per market |

### Status (2026-10-21)

| Phase | State |
|---|---|
| 1 | Built and tested with the fake dialer: engine, pre-screen, Hiring integration, UI, consent, billing (AI credits per connected minute at `VOICE_COST_PER_MINUTE_USD`), notifications. Real calls wait on Plivo / LiveKit / Sarvam accounts. |
| 2 | Built and tested with the fake dialer: availability calls with HR slot windows minus panelists' interviews, a mid-call slot lock (engine → `POST /v1/voice-calls/actions`, per-org advisory lock), automatic booking through the same code as the Schedule screen, and reminder calls that are re-planned on every create / reschedule / cancel. Not yet: SMS confirmations (need Plivo + DLT templates), Google Calendar free/busy, auto-freeing the slot when a candidate cancels (HR decides). |

## 13. Open decisions

Resolved 2026-10-20: languages English + Hindi (D9), next markets US and UAE (D10), branded caller later (D11).

Still open:
1. **Pass thresholds per role:** the minimum communication score and how far above budget an ECTC can be before the AI says HOLD. Proposed default: communication ≥ 3.5 for client-facing roles and ≥ 3.0 otherwise; ECTC up to 10% over budget = RECOMMEND, 10–25% = HOLD, more = NOT_RECOMMENDED. Editable per job.
2. **Script approval owner:** proposed that HR writes, legal signs off on the opening/consent lines, and product signs off before go-live.
