# HYBENT Bug Fix Report

Date: 23 October 2026
Branch: `seo/prerender`. **Nothing has been committed.** These changes sit alongside the earlier uncommitted Super Admin work.
Initial findings: [HYBENT_BUG_AUDIT_REPORT.md](HYBENT_BUG_AUDIT_REPORT.md)

## In short

- **16 confirmed bugs** found: 2 Critical, 4 High, 5 Medium, 5 Low.
- **14 fixed and tested.** 2 left open: one needs a product decision, the other is your local `.env` file.
- The worst problem: **anyone could sign up as a "candidate" for any company and read that company's whole candidate database, interviews, offers and internal activity, and use its AI Copilot.** That is now blocked by a single deny-by-default rule, and a test checks every endpoint.
- No regressions: all 540 non-AI backend tests behave as before. The only failure is caused by your local `.env`.

| Check | Result |
|---|---|
| New regression tests (`tests/test_audit_regressions.py`) | **17 / 17 passed** |
| Backend suite, excluding live-AI evaluation tests | **540 passed, 1 failed** (BUG-016, local `.env`) |
| Full backend suite including live-AI evaluations | 575 passed, 197 failed, 1 skipped. The 196 extra failures are AI evaluations hitting Groq/Gemini rate limits (HTTP 429): **BLOCKED** |
| Baseline full suite before any fix | 686 passed, 70 failed (69 AI rate-limit + BUG-016) |
| Frontend type check + production build | **Passed** (before and after) |
| Frontend lint | 27 → **10 problems** (still fails `--max-warnings 0`) |
| Live check on the running dev server | `/v1/ai/test-gemini` → 404; resume probe → 404 |

## Bugs fixed

### Critical

| Bug | What was wrong | Fix | Files |
|---|---|---|---|
| BUG-001 | A self-registered candidate account could call ~30 staff endpoints: the candidate list, talent pool, interviews, offers, applications, pipeline, scorecards, search, activity log, inbox, chat, and the Copilot | Candidate accounts are denied by default. They can only reach `/v1/portal/*`, `/v1/auth/*`, `/v1/users/me*` and `/v1/notifications*`, and anything else returns 403. New endpoints are covered automatically. `list_interviews` also no longer treats unknown roles as admins. | `app/dependencies.py`, `app/routers/interviews.py` |
| BUG-002 | An unauthenticated URL returned candidates' personal details from any company (or an invented resume) | A missing file now returns 404; the candidate lookup and generated PDF are gone | `app/main.py` |

### High

| Bug | What was wrong | Fix | Files |
|---|---|---|---|
| BUG-003 | `/v1/ai/test-gemini` was public and spent AI quota on every request | Endpoint removed (nothing used it) | `app/routers/ai.py` |
| BUG-004 | Anyone in an org could accept or decline any candidate's offer | Recruiter/admin only; candidates keep their own ownership-checked portal endpoint | `app/routers/offers.py` |
| BUG-005 | Interviews accepted panelists and applications from other organisations, leaking emails and showing interviews across tenants | Panelists must be active hiring-team members of the same org (else 400); application must belong to the org and candidate (else 404); the interviewer list is filtered by org. AI Calls scheduling uses the same check. | `app/services/interview_scheduling.py`, `app/routers/interviews.py` |
| BUG-006 | The candidate dashboard showed the company's internal HR activity feed | Widget removed from the portal dashboard | `src/modules/portal/pages/PortalDashboard.tsx` |

### Medium

| Bug | Fix | Files |
|---|---|---|
| BUG-007: "Avg hire time" hardcoded to `2.1d` | Calculated from real hires (applied → hired); `null` when there are none | `app/routers/talent_pool.py`, `src/api/talentPool.ts` |
| BUG-008: `/api/*` compatibility routes always failed and skipped auth | Dependencies declared correctly: 401 without a token, 200 for recruiters | `app/routers/api_compat.py` |
| BUG-009: Kanban pipeline ran one DB query per applicant | One query for all candidates | `app/routers/pipeline.py` |
| BUG-015: candidates could confirm any interview | Covered by BUG-001 | (as BUG-001) |

### Low

| Bug | Fix | Files |
|---|---|---|
| BUG-011: public apply accepted invalid emails and over-long names (500 error) | Validated; returns 400 with a clear message | `app/routers/public.py` |
| BUG-012: empty `SECRET_KEY` allowed outside production (forgeable logins) | Required in every environment | `app/core/config.py` |
| BUG-013: local test suite hung on Redis timeouts | Tests default to the docker-compose Redis port (6380) | `tests/conftest.py` |
| BUG-014: frontend lint failed with 27 problems | Mechanical `eslint --fix` only (stale disable comments, `let` → `const`). 10 remain (below). | 20 frontend files, no behaviour change |

## Bugs remaining

| Bug | Why it isn't fixed | What's needed |
|---|---|---|
| **BUG-010**: the public apply form overwrites an existing candidate's resume and details when someone applies with their email | Changes product behaviour: a genuine returning applicant *should* be able to update their details | Your decision: (a) keep the existing profile and store the new resume as an extra document, or (b) keep current behaviour |
| **BUG-016**: local `.env` has `APP_NAME=HireOn` and `SMTP_FROM_NAME=HireOn` | It's your private config file | Change both to `Hybent Hiring`. Also check production uses `Hybent Hiring` (the deploy guide says so). |
| BUG-014 (rest): 10 lint problems | Three empty `catch` blocks and one intentional `while (true)` stream loop need a decision on intent; five fast-refresh warnings need files split, which is refactoring | Small follow-up if you want lint to pass in CI |

## Regression tests added

`hybent-hiring-backend/tests/test_audit_regressions.py`, 17 tests, all passing:

- **Every** user-authenticated route is called with a candidate token and must return 403. This guards against future endpoints repeating BUG-001.
- Candidate portal endpoints still return 200.
- Resume URL with wildcard patterns returns 404 and no personal data.
- test-gemini is gone; offer respond is recruiter-only.
- Cross-org panelist rejected, same-org panelist saved, cross-org application rejected.
- Avg hire time `null` with no hires, `4.0d` for a 4-day hire.
- `/api/designations` 401 without token, 200 with one.
- Pipeline still lists all applicants.
- Public apply rejects a bad email, a 300-character name and a blank name.
- Empty `SECRET_KEY` is refused.

Before the fixes, the Phase 1 probe made these same requests and they succeeded: 18 staff GET endpoints answered 200 to a candidate token, and test-gemini answered without auth.

## Deployment notes

- **No database migrations.**
- **No new environment variables.** The app now refuses to start if `SECRET_KEY` is empty in *any* environment. render.yaml, the deploy guide, CI, docker-compose (via `.env`) and the tests already set it.
- **Behaviour changes users may notice:**
  - Candidate-portal users get 403 on staff APIs. The portal UI never called them, except the activity widget, which was removed.
  - Scheduling an interview with a panelist outside your team now returns a 400 error.
  - A missing local resume file now returns 404 instead of a generated PDF. Production stores resumes in cloud storage, so this only affects old local-disk files.
  - `POST /v1/offers/{id}/respond` is now recruiter/admin only. Candidates use the portal endpoint, which is unchanged.

## Not verified (BLOCKED or out of scope)

| Area | Status | Reason |
|---|---|---|
| Copilot intent/answer quality (196 eval tests) | **BLOCKED** | Groq and Gemini returned rate-limit/quota errors (429) during the runs |
| Gmail/Outlook, Google Calendar/Meet, Stripe, Cloudinary/Supabase, voice engine | **BLOCKED** | Need live credentials; covered only by existing mocked tests |
| Browser walk-through of candidate portal and recruiter pages | Not done | Only build and API-level checks were run |
| Super Admin module | Not re-audited | Covered by `SUPER_ADMIN_AUDIT_REPORT.md` |
| Migrations, indexes, frontend responsive layouts | Not audited in depth | Time |

## Security risks still open

- BUG-010 (above).
- Suspected items S-01 to S-03 in the audit report (localhost CORS origins, unauthenticated local `/static/uploads` for UUID-named files, interviewers seeing all org interviews). Each needs a product or deployment decision rather than a code fix.

## Is it ready to deploy?

**The fixes are ready to deploy, and should be, because BUG-001 and BUG-002 are live data leaks.** Before deploying:

1. Commit these changes (nothing is committed yet).
2. Run the full test suite once the AI providers' rate limits reset, so the Copilot evaluations can be judged.
3. Decide on BUG-010.
4. Click through the candidate portal and the interview scheduling form once in a browser.

This audit does **not** show that HYBENT is bug-free. It covered security, tenant isolation and the core hiring workflows; the areas listed above were not verified.
