# Hybent AI Agent (voice engine)

The calling engine shared by HYBENT Hiring and HYBENT Sales. Design: [docs/voice-agent/PLAN.md](../docs/voice-agent/PLAN.md).

```
voice/
  api.py          HTTP API for clients (X-Voice-Key) + starts the scheduler
  scheduler.py    dials due tasks, retries, stale-call sweep, analysis, callbacks
  services.py     task lifecycle (create, finish attempt, settle, callback payload)
  policy.py       calling hours + retry rules (pure)
  dialer.py       LiveKitDialer (real) / FakeDialer (dev, tests)
  analyzer.py     post-call analysis: rules + Groq review
  extract.py      "12 LPA", "two months" -> numbers (pure)
  recommend.py    advisory RECOMMEND / HOLD / NOT_RECOMMENDED (pure)
  notifier.py     signed callback delivery with backoff
  agent/          LiveKit worker: prompts, providers, the phone conversation
alembic/          migrations for schema "voice"
scripts/          create_client.py
```

## Local setup

```bash
cd hybent-voice-agent
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt        # or requirements-dev.txt for tests only
cp .env.example .env                                  # set DATABASE_URL
.venv/Scripts/python -m alembic upgrade head          # creates schema "voice"
.venv/Scripts/python -m scripts.create_client hiring http://localhost:8000/v1/voice/callbacks
.venv/Scripts/uvicorn voice.api:app --port 8100       # API + scheduler (DIALER=fake)
```

With `DIALER=fake`, every call ends instantly. Script the outcome per task with
`context._fake`, e.g. `{"outcome": "NO_ANSWER"}` or
`{"outcome": "COMPLETED", "answers": {"current_ctc": {"raw": "12 LPA"}}}`.

## Tests

```bash
.venv/Scripts/python -m pytest -q                     # SQLite
VOICE_TEST_DATABASE_URL=postgresql+asyncpg://.../throwaway_db .venv/Scripts/python -m pytest -q
```

## Real calls (needs accounts — Plan §10)

1. LiveKit Cloud project → `LIVEKIT_URL/API_KEY/API_SECRET`.
2. Plivo: KYC, Indian number, SIP trunk; register it in LiveKit as an outbound trunk → `SIP_OUTBOUND_TRUNK_ID`.
3. `SARVAM_API_KEY`, `GROQ_API_KEY` (paid tier).
4. `DIALER=livekit`, then run the worker next to the API:
   `python -m voice.agent.worker start` (run it in AWS Mumbai for low latency).

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/tasks` | 201 created, 200 if `client_ref` already exists, 409 if the number opted out, 422 invalid |
| GET | `/v1/tasks/{id}` | attempts, transcripts, results (own tasks only) |
| POST | `/v1/tasks/{id}/cancel` | no further attempts |
| POST | `/v1/opt-outs` | never call this number again (per client + scope) |

Callbacks: `POST <client callback_url>` with `X-Voice-Timestamp` and
`X-Voice-Signature: sha256=HMAC(secret, "<ts>.<body>")`. One callback per
finished attempt; `final: true` on the last. Retried with backoff until 2xx.
