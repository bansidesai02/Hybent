# HYBENT Bug Audit Report

Date: 23 October 2026
Branch: `seo/prerender` (working tree already held uncommitted changes from the earlier Super Admin audit; this audit did not touch them during Phase 1)
Scope of this report: initial findings (Phase 1–2). Fix status is filled in during Phase 3 and summarised in [HYBENT_BUG_FIX_REPORT.md](HYBENT_BUG_FIX_REPORT.md).

## Summary

| Severity | Confirmed | Fixed | Not fixed |
|---|---|---|---|
| Critical | 2 | 2 | 0 |
| High | 4 | 4 | 0 |
| Medium | 5 | 4 | 1 (BUG-010, needs your decision) |
| Low | 5 | 4 | 1 (BUG-016, your local `.env`) |
| **Total** | **16** | **14** | **2** |

### Status per bug

Tests live in `hybent-hiring-backend/tests/test_audit_regressions.py`. Details are in [HYBENT_BUG_FIX_REPORT.md](HYBENT_BUG_FIX_REPORT.md).

| Bug | Status | Fix | Regression test |
|---|---|---|---|
| BUG-001 | Fixed | Deny-by-default candidate guard in `dependencies.py`; `list_interviews` refuses unknown roles | `test_candidate_token_is_refused_by_every_staff_endpoint`, `test_candidate_portal_endpoints_still_work`, `test_interview_list_refuses_unknown_roles` |
| BUG-002 | Fixed | `main.py`: missing resume → 404; lookup and invented PDF removed | `test_missing_resume_does_not_leak_candidate_details` |
| BUG-003 | Fixed | Endpoint removed from `routers/ai.py` | `test_gemini_test_endpoint_removed` |
| BUG-004 | Fixed | `routers/offers.py`: recruiter/admin only | `test_offer_respond_requires_recruiter` |
| BUG-005 | Fixed | `resolve_panelists()` in `interview_scheduling.py`; router validates panelists and application; interviewer list scoped to org | `test_cross_org_panelist_is_rejected`, `test_same_org_panelist_is_added`, `test_cross_org_application_is_rejected` |
| BUG-006 | Fixed | Widget removed from `PortalDashboard.tsx` | Frontend build + BUG-001 test |
| BUG-007 | Fixed | Real average from hired applications, `null` when none | `test_avg_hire_time_is_null_without_hires`, `test_avg_hire_time_is_measured` |
| BUG-008 | Fixed | Correct dependency declarations in `api_compat.py` | `test_compat_routes_authenticate` |
| BUG-009 | Fixed | One `IN` query in `pipeline.py` | `test_pipeline_lists_applicants` |
| BUG-010 | **Open: needs product decision** | — | — |
| BUG-011 | Fixed | Name and email validated in `public.py` | `test_public_apply_rejects_bad_identity` (3 cases) |
| BUG-012 | Fixed | `config.py` requires `SECRET_KEY` everywhere | `test_empty_secret_key_is_refused` |
| BUG-013 | Fixed | `conftest.py` defaults `REDIS_URL` to the compose port | Full suite run without setting `REDIS_URL` |
| BUG-014 | Partly fixed | Mechanical `eslint --fix`: 27 → 10 problems | `npm run lint` |
| BUG-015 | Fixed | Covered by BUG-001's guard | BUG-001 walk test |
| BUG-016 | **Open: your local config** | — | `test_platform_sender.py` |

The most serious problem: **anyone on the internet can create a "candidate" account for any company** (the public `POST /v1/portal/register` only needs the company's slug, which appears in every public apply link). That account can then read the company's whole candidate database, all interviews, offers, applications and the internal activity log, and use the Recruiter Copilot. The cause is one missing rule: most staff endpoints only check "is logged in", not "is staff".

## How the audit was done

| Activity | Result |
|---|---|
| Backend test suite (747+ tests, real Postgres test DB) | Baseline run recorded in the fix report |
| Frontend type check + production build (`npm run build`) | **Passed** |
| Frontend lint (`npm run lint`) | **Failed**: 27 problems (see BUG-014) |
| Role probe: a candidate-portal token sent to every parameterless GET endpoint | 18 staff endpoints answered `200` with org data (BUG-001) |
| Auth probe: every route checked for an authentication dependency | Found BUG-003 and BUG-011 |
| Manual review | Auth/JWT, tenant middleware, every route with an ID in its path that does not mention `organization_id`, uploads/static files, public apply, interviews, offers, pipeline, talent pool, Copilot RAG retrieval, bulk-import dedup, config/CORS/secrets |

### Modules audited
Authentication, tenant isolation, role permissions, candidates, jobs, applications, pipeline, interviews, offers, scorecards, talent pool, activity log, search, chat/messages/notifications (ownership checks), inbox, voice calls, pre-screening (token checks), payments (public links), Copilot RAG retrieval, bulk import dedup, file storage, configuration.

### Not verified (no credentials or out of time)
- Gmail/Outlook sync, Google Calendar/Meet event creation, Stripe checkout, Cloudinary/Supabase storage, live voice-call engine: need external accounts.
- AI scoring/parsing *quality* (only tenant scoping of retrieval was reviewed).
- Super Admin module: covered by the earlier `SUPER_ADMIN_AUDIT_REPORT.md`; not re-audited.
- Frontend responsive layouts and per-page UI behaviour were not walked through in a browser.
- Database migrations/indexes were not reviewed in depth.

---

## Confirmed bugs

### BUG-001: Candidate-portal accounts can read and use staff-only APIs (whole candidate database exposed)
- **Severity:** Critical (security, tenant data exposure, data integrity)
- **Module:** Auth / permissions, across many routers
- **Files:** `app/dependencies.py`, `app/routers/candidates.py`, `jobs.py`, `talent_pool.py`, `applications.py`, `interviews.py`, `offers.py`, `pipeline.py`, `scorecards.py`, `activities.py`, `search.py`, `designations.py`, `copilot.py`, `email_accounts.py`, `inbox.py`, `messages.py`, `chat.py`, `calendar.py`
- **Reproduction:**
  1. `POST /v1/portal/register` with `{email, full_name, password, organization_slug: "<slug from any public apply link>"}`. No login needed.
  2. Use the returned token: `GET /v1/candidates`, `/v1/talent-pool`, `/v1/interviews`, `/v1/offers`, `/v1/applications`, `/v1/activities`, `/v1/pipeline/{job_id}` (job IDs are in public apply links), `/v1/search?q=a`, and `POST` to the Copilot.
- **Expected:** `403` for everything outside the candidate portal.
- **Actual:** `200` with organisation data. Probe result: 18 staff GET endpoints returned 200. `list_interviews` sends every role other than interviewer/recruiter into the "admin sees everything" branch.
- **Root cause:** Staff endpoints use `CurrentUser` / `Depends(get_current_user)` (any logged-in user) instead of a staff role check. Candidate users belong to the hiring organisation, so the `organization_id` filter doesn't help.
- **Impact:** Personal data of every candidate (names, emails, phones, CTC, resumes), interview panels and salary offers exposed to any member of the public. A candidate can also post to the Copilot and spend the company's AI credits.
- **Proposed fix:** Deny by default. In `get_current_user`, a `candidate` user may only reach `/v1/portal/*`, `/v1/auth/*`, `/v1/users/me*` and `/v1/notifications*`. Everything else returns 403. Also fix the `list_interviews` fallback branch.
- **Test:** A regression test that walks **every** route with a candidate token and fails if any non-allowlisted route answers 2xx; plus a test that the portal endpoints still work.

### BUG-002: Unauthenticated cross-tenant leak of candidate details through the resume fallback URL
- **Severity:** Critical (security, PII)
- **Module:** File serving
- **Files:** `app/main.py` (`serve_or_fallback_resume`)
- **Reproduction:** `GET /static/uploads/resumes/<pattern>` with no token, where `<pattern>` is any text that isn't a file on disk, e.g. `resume_a1`. The handler runs `Candidate.resume_url LIKE '%<pattern>%'` across **all** organisations (`%` and `_` in the URL act as wildcards). If exactly one candidate matches, it returns a PDF with that person's name, email, location, title, summary and skills.
- **Expected:** 404 when the file doesn't exist. Never query candidates without auth.
- **Actual:** Personal data is returned to anonymous callers. `/static/` is also excluded from the rate limiter, so enumeration is unthrottled. When nothing matches, it **invents** a resume ("3+ years", "Python, FastAPI, React…"), which is fake data presented as a real document.
- **Root cause:** A "fallback for ephemeral disks" that looks up candidates by an unsanitised substring with no tenant or auth check.
- **Proposed fix:** Serve the file if it exists, otherwise 404. Remove the lookup and the generated PDF.
- **Test:** Request a non-existent resume name that matches a candidate's `resume_url` and assert 404 with no candidate data.

### BUG-003: `/v1/ai/test-gemini` is public and makes a paid AI call on every request
- **Severity:** High (cost abuse, information disclosure)
- **Files:** `app/routers/ai.py`
- **Reproduction:** `GET /v1/ai/test-gemini` with no token. Returns `"status":"success"`, a generated reply and the list of available models.
- **Root cause:** Debug endpoint left in with no auth dependency.
- **Impact:** Anyone can run up the Gemini bill or exhaust the quota for real users.
- **Proposed fix:** Remove the endpoint (nothing in the frontend calls it).
- **Test:** Route no longer exists (404).

### BUG-004: Any user in an organisation can accept or decline any candidate's offer
- **Severity:** High (data integrity)
- **Files:** `app/routers/offers.py` (`respond_to_offer`)
- **Reproduction:** As a candidate (see BUG-001) or interviewer: `GET /v1/offers`, then `POST /v1/offers/{someone_else's_offer}/respond {"accept": false}`.
- **Expected:** Only the candidate who received it (portal endpoint, which checks ownership) or the hiring team can record a response.
- **Actual:** The offer is marked declined.
- **Root cause:** Uses `CurrentUser` with only an org filter. The real candidate flow uses `/v1/portal/offers/{id}/respond`, which does check ownership; the frontend never calls this staff endpoint.
- **Proposed fix:** Require recruiter/admin (recording a response on the candidate's behalf). BUG-001's guard also blocks candidates.
- **Test:** An interviewer and a candidate get 403; a recruiter still succeeds.

### BUG-005: Interview panelists and application are not checked against the organisation
- **Severity:** High (cross-tenant exposure)
- **Files:** `app/services/interview_scheduling.py`, `app/routers/interviews.py`
- **Reproduction:** As a recruiter in Org A, `POST /v1/interviews` with `panelist_ids: [{user_id: <user in Org B>}]`.
- **Actual:** The Org B user is added. Their name and email come back in the response, they receive the calendar invite with the candidate's name, and since `list_interviews` for interviewers has no org filter, they see Org A's interview in their own list. `application_id` is also stored without checking it belongs to the org/candidate, so another org's job title can be pulled into the interview.
- **Root cause:** `select(User).where(User.id == ...)` with no `organization_id` filter; `application_id` not validated.
- **Proposed fix:** Only accept panelists who are active staff of the same organisation (reject otherwise with 400). Validate the application belongs to the organisation and the candidate.
- **Test:** Cross-org panelist → 400; cross-org `application_id` → 404; same-org panelist still works.

### BUG-006: Candidate dashboard shows the company's internal HR activity feed
- **Severity:** High (privacy; the visible symptom of BUG-001)
- **Files:** `hybent-hiring-frontend/src/modules/portal/pages/PortalDashboard.tsx`
- **Reproduction:** Log in to the candidate portal; the dashboard's "Recent activity" lists recruiter actions on other candidates.
- **Root cause:** The portal dashboard reuses the staff `RecentActivityFeed` (`GET /v1/activities`).
- **Proposed fix:** Remove the widget from the portal dashboard. With BUG-001 fixed, the call would 403 anyway.
- **Test:** Frontend build; candidate gets 403 on `/v1/activities`.

### BUG-007: Talent pool "Avg hire time" is a hardcoded `2.1d`
- **Severity:** Medium (fake analytics)
- **Files:** `app/routers/talent_pool.py`
- **Reproduction:** `GET /v1/talent-pool/stats` on an empty organisation returns `"avg_hire_time":"2.1d"`.
- **Root cause:** Placeholder left in code (`# placeholder logic: 2.1d as in reference`).
- **Proposed fix:** Calculate it from real hires (application created → hired), or return `null` when there are none. The UI shows "—" for null.
- **Test:** Empty org → `null`; with a hired application → real figure.

### BUG-008: `/api/*` compatibility routes are broken and unauthenticated
- **Severity:** Medium
- **Files:** `app/routers/api_compat.py`
- **Reproduction:** `GET /api/designations` with or without a token → `422 "query.kwargs Field required"`; passing `?kwargs=x` → 500.
- **Root cause:** `Annotated[RecruiterUser, Depends()]`. `RecruiterUser` is already an `Annotated[..., Depends(...)]` alias, so the outer bare `Depends()` replaces it and FastAPI calls `User(**kwargs)` instead of the auth check.
- **Proposed fix:** Declare `current_user: RecruiterUser` / `CurrentUser` directly.
- **Test:** No token → 401; recruiter token → 200.

### BUG-009: Kanban pipeline runs one query per application (N+1)
- **Severity:** Medium (performance)
- **Files:** `app/routers/pipeline.py`
- **Root cause:** `select(Candidate)` inside the loop over applications.
- **Proposed fix:** Load all candidates in one `IN (...)` query.
- **Test:** Existing pipeline behaviour unchanged; one candidate query.

### BUG-010: Public apply form overwrites an existing candidate's resume and details without verification
- **Severity:** Medium (data integrity), **needs product decision**
- **Files:** `app/routers/public.py`
- **Reproduction:** Submit the public apply form for job B using the email of a candidate who already exists in that organisation. Their stored resume, phone, CTC and parsed profile are replaced by the new submission.
- **Root cause:** Email is the only identity check on an unauthenticated form.
- **Proposed options:** (a) keep the existing profile and attach the new resume as a document, or (b) keep current behaviour (a genuine re-applicant updates their data). This changes product behaviour, so **not fixed without your decision**.

### BUG-011: Public apply accepts any text as email and unbounded name length
- **Severity:** Low
- **Files:** `app/routers/public.py`
- **Root cause:** `email: str` and `full_name: str` with no validation; `full_name` > 255 chars would hit the DB column limit (500 instead of 400).
- **Proposed fix:** Validate email format and limit name length; return 400.
- **Test:** Bad email → 400; 300-char name → 400.

### BUG-012: Signing key may be empty outside production
- **Severity:** Low (hardening)
- **Files:** `app/core/config.py`
- **Detail:** `SECRET_KEY` is only required when `APP_ENV=production`. With it empty, tokens are signed with `""` and anyone can forge them (verified with python-jose). Staging or misconfigured deploys would be exposed. Production configs (render.yaml, deploy guide) do set it.
- **Proposed fix:** Refuse to start with an empty `SECRET_KEY` in every environment.

### BUG-013: Test suite hangs locally because Redis defaults to port 6379 while docker-compose exposes 6380
- **Severity:** Low (developer tooling)
- **Files:** `tests/conftest.py`
- **Detail:** Each test waits on a Redis connection timeout; the full suite effectively never finishes.
- **Proposed fix:** Default `REDIS_URL` to the compose port in `conftest.py` when not set.

### BUG-014: Frontend lint fails (27 problems)
- **Severity:** Low
- **Detail:** `npm run lint` uses `--max-warnings 0` and fails: mostly unused `eslint-disable` directives, one empty `catch` block in `src/utils/formatters.ts`. Would block any CI lint gate.
- **Proposed fix:** Remove stale directives and fix the empty block (no behaviour change).

### BUG-015: `confirm_interview` and `get_interview` open to every role
- **Severity:** Medium (covered by BUG-001's fix)
- **Detail:** A candidate could mark any interview in the org as confirmed. Fixed by the same guard as BUG-001.

### BUG-016: Local `.env` still uses the old "HireOn" brand
- **Severity:** Low (local configuration; found in Phase 4)
- **Files:** `hybent-hiring-backend/.env` (not in git)
- **Detail:** `APP_NAME=HireOn` and `SMTP_FROM_NAME=HireOn`. Emails sent from this machine say "HireOn", and `test_platform_sender.py::test_smtp_sends_as_the_platform_address` fails because the settings read the local `.env`. The code default, `.env.example` and the deployment guide all use "Hybent Hiring", so production is unaffected if it follows the guide.
- **Proposed fix:** Change both values in your local `.env` to `Hybent Hiring`. Left for you because `.env` is your private config file.

---

## Suspected issues (not confirmed)

| ID | Issue | Why unconfirmed |
|---|---|---|
| S-01 | CORS allows `http://localhost*` origins with credentials in production | Auth uses bearer tokens, not cookies, so practical risk is low; needs a deploy-config decision |
| S-02 | Local-disk uploads (`/static/uploads/offers`, `jds`) are served without auth | File names are random UUIDs (unguessable), and production uses cloud storage; confirm production storage settings |
| S-03 | Interviewers can read every interview, application and scorecard in their org (not just their own) | May be intended for panel collaboration; product decision |
| S-04 | Earlier report: 10 Copilot evaluation tests fail on AI provider rate limits | Need a live AI service; flaky by nature |
