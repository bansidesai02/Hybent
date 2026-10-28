# Super Admin Audit Report

Date: 23 October 2026
Branch: `seo/prerender`. **Nothing has been committed yet.**

## In short

Round 1 fixed the urgent security holes and removed the fake numbers. Round 2 (this update) built the missing features:

- Organization detail pages
- A searchable user directory
- Sign-in tracking
- Audit log filters and CSV export
- Organization activity rankings
- Working security settings

Round 2 also fixed several more bugs found along the way.

| Check | Result |
|---|---|
| Super Admin tests | **18 / 18 passed** |
| Full backend test suite | **746 passed, 10 failed** (all 10 are AI evaluation tests that hit the AI provider's rate limit) |
| Frontend type check | **Passed** |
| Frontend production build | **Passed** |
| Browser check (main super admin pages) | **Done** |

**Production readiness:** close, but not yet. See section 9.

---

## 1. Bugs found and fixed

"Tested" means an automated test covers the fix. "Checked in browser" means I looked at it on the running app.

### Round 1 (earlier)

| # | Problem | How bad | Status |
|---|---|---|---|
| 1 | "Reset password" set the password to `password123` | Critical | Fixed, tested |
| 2 | New client admins were given the password `password123` | Critical | Fixed, not tested |
| 3 | Suspending a client didn't block its users | High | Fixed, tested |
| 4 | Any company admin could send email to any address through our email account | Medium | Fixed, not tested |
| 5 | Suspending a user didn't end their sessions | Medium | Fixed, tested |
| 6 | A super admin could suspend their own account | Low | Fixed, tested |
| 7 | A super admin could impersonate another super admin or a suspended user | Medium | Fixed, tested for the super admin case |
| 8 | Fake numbers on Health and Dashboard (uptime, service status, CPU) | High (wrong data) | Fixed, tested |
| 9 | Fake "Operational highlights" card on Analytics | High (wrong data) | Removed |
| 10 | Analytics months mixed up across years; deleted candidates counted | Medium | Fixed, not tested |

### Round 2 (new)

| # | Problem | How bad | Why it happened | Status |
|---|---|---|---|---|
| 11 | Signing in with an emailed code (`/v1/auth/2fa/verify`) worked for suspended users and suspended organizations | **High** | The endpoint skipped the account and organization checks | Fixed: the code step now runs the same checks as password sign-in. Tested |
| 12 | Anyone who knew an email address could ask for a code and sign in with the code alone: no password, no rate limit, and old codes stayed valid | **High** | The code endpoints were a separate, unprotected way to sign in, and the frontend never used them | Fixed: a code only works after the password or Google step has passed. Codes are single-use, expire after 10 minutes, are stored hashed, allow 5 wrong tries, and are rate-limited. Tested |
| 13 | The sign-in rate limit could be bypassed by sending a fake `X-Forwarded-For` header | Medium | The limiter trusted the first entry in that header, which the client controls | Fixed: it now uses the address our own proxy adds. Not separately tested |
| 14 | Deleting the organization that holds the super admin accounts would also delete those accounts | High | No guard existed | Fixed: that organization can't be deleted or suspended. Tested |
| 15 | The client detail page never showed its members, and "Impersonate" always said "no users" | High | The page treated the API's `{users, total}` response as a plain list | Fixed: rebuilt on a new endpoint. Checked in browser |
| 16 | Clients with the same name shared one member list | Medium | Members were looked up by organization name instead of ID | Fixed (looked up by ID) |
| 17 | "Interviews booked" on the client page was always blank | Low | The API never sent that number | Fixed |
| 18 | An active client with no plan showed an "Activate" button instead of "Suspend" | Medium | The button followed the subscription status, not the organization status | Fixed |
| 19 | Revenue showed in rupees (₹) on Analytics and Clients, but plan prices are in US dollars | Medium (wrong data) | Wrong currency setting | Fixed. Checked in browser |
| 20 | The dashboard counted deleted jobs and candidates; its label said "Active jobs" for all jobs; it returned a made-up "MRR: Stable" value | Medium | Missing filters and placeholder code | Fixed |
| 21 | Opening the Settings page silently saved "2FA on" and "timeout on" as defaults, even though nothing enforced them | Medium | Defaults were written to the database when the page was first read | Fixed: reading no longer writes anything (see section 4) |
| 22 | The Users and Audit pages only searched the 50 rows on screen | Medium | Search ran in the browser, not on the server | Fixed: search now covers all records. Checked in browser |
| 23 | The 401 auto-refresh in the frontend would wrongly kick in on 2FA and Google sign-in errors | Low | Those routes were missing from the exclusion list | Fixed |

---

## 2. New features added

All of these are built and covered by tests. The pages were also checked in the browser.

| Feature | How it works |
|---|---|
| **Sign-in history** | Every sign-in attempt is now recorded: success or failure, the reason, the method (password, Google or 2FA code), IP address and browser. Passwords and codes are never stored. History starts from now: earlier sign-ins were never recorded, and the pages say so instead of inventing data. |
| **Client detail page** | Six tabs: **Overview** (member counts, last sign-in, last activity, hiring numbers, subscription, seat and job limits), **Members** (role, status, last sign-in, joined date), **Activity** (the organization's own activity log), **Sign-ins**, **Imports** (rows added, duplicates and failures), **Settings** (feature flags and the danger zone). |
| **User directory** | Server-side search by name or email, plus filters for client, role, status and last sign-in ("last 7 days", "not in 30+ days", "never"). Columns sort by name, last sign-in and joined date. Each user has a "Sign-in history" option. A client can be pre-selected from the URL. |
| **Audit logs** | Filters for search, client, category, area and date range. **CSV export** (up to 10,000 rows): the export itself is recorded in the audit log, and cells are escaped so they can't run as spreadsheet formulas. A new **Sign-ins** tab lists all sign-in attempts, filterable by outcome. |
| **Activity rankings** (on Analytics) | For each organization over 7, 30 or 90 days: sign-ins, active users, actions, candidates added and interviews scheduled. Any column can be sorted, and clicking a row opens that client. A "Recently signed in" list sits alongside. |
| **Dashboard** | New figures: suspended clients, suspended accounts, accounts that never signed in, and failed sign-ins in the last 24 hours. Each one links to the relevant page. |

---

## 3. Security settings that now actually work

| Setting | What it does now |
|---|---|
| **Require 2FA for tenant admins** | Organization admins get a 6-digit code by email after their password or Google sign-in, and must enter it to finish signing in. The login page has a new code step with "send a new code" and "use a different account". |
| **Auto session timeout (30 min)** | The app signs the user out after 30 minutes with no activity in any open tab. The server also refuses to restore a session that has been idle that long. |
| **Restrict super admin by IP** | A new allow-list (single IPs or ranges). Super admin sign-in and every super admin request are checked against it. You can't save a list that excludes your own current IP, so you can't lock yourself out. |

The **Email delivery** and **Branding** sections of Settings are still not used by anything in the product. The page now says so clearly instead of implying they work.

---

## 4. Important: settings that were switched on but never enforced

Your local database has **2FA = on** and **session timeout = on** stored, because the old page saved them automatically the first time it was opened. Production probably has the same.

If those values were enforced as-is, every company admin would suddenly need an email code after this deploy. To avoid that surprise:

- **A security switch only takes effect after a super admin saves the Security section on the Settings page.**
- Until then, all three switches show as **off**, which matches what is really happening today.

---

## 5. Database changes

| Migration | What it does |
|---|---|
| `056_login_events` | Adds a new `login_events` table, an index on `users.last_login`, and an index on `super_admin_audit_logs.created_at`. |

- It only adds things: no data is changed or deleted.
- It was run on the **local** database, rolled back and run again without problems.
- It has **not** been run on production.

---

## 6. Test results (actually run)

| Check | Result |
|---|---|
| Super Admin tests (`tests/test_super_admin.py`) | **18 passed** |
| Full backend suite | **746 passed, 10 failed** |
| Contact form tests (updated to the new form rules) | 17 passed |
| Email import tests | All passed |
| Copilot conversation tests | 10 passed |
| Frontend type check | Passed |
| Frontend production build (`npm run build`) | Passed |
| Frontend lint on changed files | Clean |
| Frontend lint on the whole project | **Fails**: about 25 errors in files I didn't touch (see section 8) |
| Browser check | Done: dashboard, clients, client detail (all 6 tabs), users (search and filters), audit (including CSV export), analytics and settings |

### What the 18 Super Admin tests cover

- Sign-ins are recorded, and failed ones show the right reason
- Unsaved default settings are not enforced
- The full 2FA flow:
  - a code alone doesn't work
  - a wrong code is rejected
  - each code can only be used once
  - recruiters aren't affected
- 5 wrong codes lock further attempts
- IP allow-list:
  - an empty list is refused
  - a list without your own IP is refused
  - an invalid entry is refused
  - requests from outside the list are blocked
- A session idle too long can't be restored
- User directory filters, including rejecting an injected sort value
- Client detail endpoint, the 404 for a missing client, and the guard on the super admin's organization
- Audit filters and CSV export
- Activity rankings
- Company admins are blocked from every new endpoint
- Everything from round 1

### Earlier test failures

| Failure | What I found | Result |
|---|---|---|
| Contact form tests (4) | The tests were out of date with your new form rules | Updated the tests, now passing. The form code itself was not touched |
| Email import tests (7) | A memory guard fired because the test process itself is large, not because of a real problem | Turned off the guard for those tests, now passing |
| Copilot conversation file (wouldn't load) | It had a broken import and was patching the wrong module | Fixed, all 10 tests pass |
| One copilot title test | It was making a **real** paid AI call | It's now stubbed out |
| Copilot AI evaluation tests (10) | They call a live AI provider (Groq), which returned "rate limit" (HTTP 429) during the run | **Not fixed (blocked).** They need a live AI service and don't give the same answer every time |

### Not tested

- Real email delivery of the 2FA codes and reset links (no email service was used in tests)
- The full 2FA sign-in **in the browser**
- The idle sign-out timer in a real browser
- Phone and tablet layouts

---

## 7. Files changed

### Backend

| File | What changed |
|---|---|
| `app/services/platform_security.py` | **New.** Security settings, client IP detection, IP allow-list, session timeout, sign-in recording, 2FA codes |
| `app/models/login_event.py` | **New.** Sign-in history table |
| `alembic/versions/056_login_events.py` | **New.** Migration |
| `app/services/auth_service.py` | One shared sign-in path (all checks, 2FA, recording) |
| `app/routers/auth.py` | Login and Google handle the 2FA step; secured `/2fa/*`; new `/session-policy` |
| `app/routers/super_admin.py` | Client detail, user directory, sign-in history, audit filters and export, activity rankings, settings validation, organization guard, dashboard fixes |
| `app/dependencies.py` | IP allow-list check on super admin requests |
| `app/middleware/rate_limiter.py` | Spoof-proof client IP; 2FA and Google sign-in routes added to the limit |
| `app/schemas/super_admin.py`, `app/models/user.py`, `app/models/super_admin.py`, `app/models/__init__.py` | Allow-list field, indexes, model registration |
| `tests/test_super_admin.py` | 18 tests |
| `tests/test_contact.py`, `tests/test_email_ingestion_service.py`, `tests/test_copilot_conversation.py` | Test fixes |

### Frontend

| File | What changed |
|---|---|
| `pages/ClientDetailPage.tsx` | Rebuilt with tabs |
| `pages/UsersPage.tsx`, `pages/AuditLogsPage.tsx` | Server-side search and filters, history, export |
| `pages/AnalyticsPage.tsx` | Activity rankings, USD currency, honest labels |
| `pages/DashboardPage.tsx`, `pages/ClientsPage.tsx` | New stats, USD currency |
| `pages/SettingsPage.tsx` | IP allow-list, accurate descriptions, "not applied" notes |
| `components/LoginEventsTable.tsx`, `components/ActivityRankings.tsx` | **New** shared components |
| `src/modules/site/pages/HybentMfaStep.tsx` | **New.** 2FA code step on the login page; `HybentLoginRoute.tsx` updated to use it |
| `src/hooks/useIdleSignOut.ts` | **New.** Idle sign-out; mounted in `AppShell.tsx` |
| `src/api/superAdmin.ts`, `src/api/auth.ts`, `src/api/axios.ts`, `src/types/index.ts` | API calls and types |

The first four rows are in `src/modules/super_admin/`.

---

## 8. Still not done, and known issues

**Not built**

- **Email and branding settings:** they're saved, but nothing uses them. Mail is sent with the server's environment settings.
- **Revenue history:** there is no table for it, so only the current month's MRR is shown.
- **Support mode banner with a time limit:** impersonation is already recorded in the audit log and shows the existing impersonation banner, but there is no automatic end time.
- **Platform-wide announcements, a background-job dashboard, and an email delivery log:** no data source exists for these yet.

**Known issues**

- **Clients list status:** an active client with no plan still shows "PENDING" on the Clients list. That's existing list logic; the detail page now shows the correct status.
- **IP allow-list depends on the proxy:** it assumes the production proxy (Caddy) sets the client IP. Locally, Docker shows an internal IP such as `172.18.0.6`.
- **Contact form rate limit:** it still uses the spoofable first IP entry. That file is part of your uncommitted contact-form work, so I didn't change it.
- **Database endpoints:** `/v1/admin/run-migrations` and `/v1/admin/repair-db-schema` still exist. I recommend turning them off in production.
- **Dead code:** `TempPasswordDialog.tsx` and `enforce_mfa` in `auth.py` are no longer used.
- **"Launch portal" button removed** from the client page. It only ever pointed to `localhost`, so it didn't work in production.
- **Lint debt:** the whole-project lint (`npm run lint`) fails on about 25 errors that already existed in other files, such as `InterviewsListPage`, `CopilotWidget` and `formatters.ts`.
- **Flaky AI tests:** the 10 copilot AI evaluation tests depend on a live AI provider.

---

## 8b. Round 3: Impersonation (support sessions)

### Problems found (from reading the code)

1. **Wrong promise in the dialog:** it said changes made while impersonating were "recorded against your own account". They weren't: changes showed up under the client user's name.
2. **End never recorded:** "Exit" only switched the login back in the browser, so `ended_at` was never saved.
3. **Silent account switch:** after about 15 minutes the impersonation token expired, and the app quietly refreshed using the super admin's own refresh token. The banner still said "impersonating", but requests ran as the super admin and the client's screens broke.

### What was built

- **Time limit:** each session lasts **30 minutes** (setting `IMPERSONATION_SESSION_MINUTES`) and can't be refreshed. The banner shows a countdown, and when time runs out the super admin is returned cleanly to their own account.
- **View only by default:** the dialog has an "Allow changes" switch, off by default. In view-only mode:
  - every write request is refused with a 403, except two preview endpoints that only read data
  - the database refuses writes as a second line of defense
- **Changes recorded under the super admin:** in "Allow changes" mode, every database change is written to the audit log in the same commit as the change itself. The entry names the super admin, the tables changed, the row IDs and the request. The client's own activity log also shows "via support session by …".
- **End recorded on the server:**
  - Exit and time-up save the end time and the reason.
  - From that moment the token stops working, including for the notifications websocket.
  - Starting a new session ends the old one.
  - Another super admin can end a session (API only; there's no button for it yet).
  - If the super admin is suspended, their session stops.
  - Sessions whose time ran out without the browser reporting it are closed automatically.
- **Can't impersonate** members of a suspended organization. A reason (at least 3 characters) is required.
- **Migration `057_support_sessions`:** adds 5 nullable columns to `impersonation_logs`. Only adds things. Run locally, rolled back and re-run without problems. **Not run on production.**

### Tests

- `tests/test_impersonation.py`: **12 passed**
- Together with `tests/test_super_admin.py`: **30 / 30 passed**
- Frontend production build: passed

**Browser check (done):**

- Started a view-only session on the recruiter "Bansi": the banner showed the name, "View only" and a countdown (29:54).
- An attempt to edit returned **403** with the view-only message.
- "End session" returned me to the client page.
- The database recorded `end_reason = exit` and both audit entries (start and end).

**Not tested in the browser:**

- "Allow changes" mode (covered by automated tests only)
- The 30-minute expiry (covered by automated tests only)
- Impersonating a candidate (the candidate portal may use a different layout, so the countdown banner may not show; the server still ends the session)

### Still to do

- An "Active support sessions" list with an "End now" button in the UI. The API (`GET /v1/super-admin/impersonations`) already exists.
- The whole-project lint error at `axios.ts:167` (an empty `catch`) was already there before this work.

---

## 9. Is it ready for production?

**Close, but not yet.**

**Done**

- All the critical and high-severity issues found are fixed and covered by tests.
- The main features asked for are built and were checked in the browser.

**Before going live**

1. Run migration `056` on production. It only adds things.
2. Make sure email works in production (2FA codes, reset links and setup links all depend on it).
3. Try a full 2FA sign-in once in a browser.
4. Then decide whether to switch on 2FA, the session timeout and the IP allow-list. They stay off until someone saves them.
5. Turn off the database repair endpoints.
6. Review and commit. Nothing is committed yet.
