# Move Supabase from Seoul to Stockholm

**Why:** the app server is in Stockholm (eu-north-1) and the database in Seoul (ap-northeast-2). Every query crosses the world twice — a login takes ~5–6 s. With both in Stockholm it should drop well under 1 s.

Supabase can't move a project between regions, so this creates a **new project in Stockholm** and copies everything into it:

| What | How it's copied |
|---|---|
| All tables, data, indexes, sequences, `alembic_version` | `deploy/scripts/migrate_supabase_db.sh` (pg_dump → pg_restore, then row counts compared table by table) |
| Resume files (Storage bucket `resume`) | `deploy/scripts/copy_supabase_storage.py` (same paths, so the database needs no changes) |
| Extensions (`pg_trgm` for search indexes) | Recreated automatically by the DB script before the restore |

Not involved: Supabase Auth (the app has its own login), Cloudinary, Elasticsearch, Redis.

Why not just run Alembic on the new database? Alembic only recreates **empty** tables. Copying the whole schema with its data keeps everything — including `alembic_version` — identical, so the next deploy's `alembic upgrade head` simply finds nothing to do.

**Downtime:** about 10–15 minutes in Part B (the app is stopped so no writes are lost). Part A has no downtime.

**Rollback:** the old project is only ever read. If anything goes wrong, put the old three values back in `.env.prod` and restart (Part D).

Where each step runs: **Browser** (Supabase / Render dashboards) or **EC2 terminal** (`[ec2-user@ip-172-31-14-32 ~]$`).

---

## Part A — Preparation (no downtime)

### A1. Create the new project — Browser

1. Supabase dashboard → **New project** (same organization).
2. Name: `hybent-prod-eu`.
3. **Database password:** click **Generate a password**, or use **only letters and digits** (symbols like `@ # / :` break connection URLs). Save it in your password manager.
4. **Region: North EU (Stockholm)** — `eu-north-1`.
5. Create and wait until the project shows as healthy (1–2 minutes).

The free plan allows two active projects, so the old one can stay up during the move.

### A2. Collect the new project's three values — Browser

Write these down somewhere private (not in chat):

| Value | Where |
|---|---|
| **NEW_DB** — session pooler URL | Project → **Connect** (top bar) → **Session pooler** → copy the URI, replace `[YOUR-PASSWORD]`. It looks like `postgresql://postgres.<newref>:<password>@aws-0-eu-north-1.pooler.supabase.com:5432/postgres` |
| **NEW_SUPABASE_URL** | **Project Settings → Data API** → Project URL, `https://<newref>.supabase.co` |
| **NEW_SUPABASE_KEY** | **Project Settings → API Keys** → the **service_role** key (under "Legacy API keys" if shown; otherwise the **secret** key `sb_secret_...`) |

Use the **Session pooler** (port 5432) — not "Direct connection" and not "Transaction pooler" (6543).

The old project's values are the current `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `~/hybent/deploy/.env.prod`.

### A3. Check the old project's Storage — Browser

Old project → **Storage**. The app only uses the bucket **`resume`**. If you see any other bucket with files in it, tell me before continuing.

### A4. Suspend Render — Browser

Render's backend is still running against the old database, including its Celery beat — scheduled jobs (emails, reminders) currently run **twice**, once on Render and once on EC2. The live site no longer uses it, so:

Render dashboard → **hybent-hiring-backend** → **Settings** → **Suspend Web Service**. Do the same for **hybent-hiring-redis**.

### A5. Get the scripts onto the server — EC2 terminal

The scripts arrive with the commit that adds this guide. Once it's on `main`:

```bash
cd ~/hybent && git pull
ls deploy/scripts
```

**Check:** shows `copy_supabase_storage.py` and `migrate_supabase_db.sh`.

### A6. Load the values into your SSH session — EC2 terminal

`read -s` keeps them out of the screen and shell history. Paste each value when prompted, then Enter:

```bash
read -rsp "OLD_DB: " OLD_DB; echo
read -rsp "NEW_DB: " NEW_DB; echo
read -rsp "OLD_SUPABASE_URL: " OLD_SUPABASE_URL; echo
read -rsp "OLD_SUPABASE_KEY: " OLD_SUPABASE_KEY; echo
read -rsp "NEW_SUPABASE_URL: " NEW_SUPABASE_URL; echo
read -rsp "NEW_SUPABASE_KEY: " NEW_SUPABASE_KEY; echo
export OLD_DB NEW_DB OLD_SUPABASE_URL OLD_SUPABASE_KEY NEW_SUPABASE_URL NEW_SUPABASE_KEY
```

These live only in this SSH session. If you disconnect, run this block again (and re-define `storage_copy` from A7).

Test both connections:

```bash
docker run --rm postgres:17-alpine psql "$OLD_DB" -Atc "select 'old ok: ' || count(*) || ' tables' from information_schema.tables where table_schema='public'"
docker run --rm postgres:17-alpine psql "$NEW_DB" -Atc "select 'new ok: ' || count(*) || ' tables' from information_schema.tables where table_schema='public'"
```

**Check:** old shows a few dozen tables, new shows `0 tables`.

### A7. Pre-copy the resume files — EC2 terminal

Done now so the copy during downtime only has to catch up on new uploads.

```bash
storage_copy() {
  docker compose -f "$HOME/hybent/deploy/docker-compose.prod.yml" run --rm --no-deps --entrypoint python \
    -v "$HOME/hybent/deploy/scripts:/scripts:ro" \
    -e OLD_SUPABASE_URL -e OLD_SUPABASE_KEY -e NEW_SUPABASE_URL -e NEW_SUPABASE_KEY -e DRY_RUN \
    backend /scripts/copy_supabase_storage.py
}

DRY_RUN=1 storage_copy      # only counts — copies nothing
storage_copy                # real copy
```

It runs inside the backend image (which already has the Supabase library) without touching the running app.

**Check:** the last line reads `bucket 'resume': N copied, 0 already present, 0 failed`. Running `storage_copy` again should report `0 copied, N already present`.

---

## Part B — The switch (≈10–15 min downtime)

Do Part B in one sitting, in the same SSH session as A6.

### B1. Stop the app — EC2 terminal

```bash
cd ~/hybent/deploy
docker compose -f docker-compose.prod.yml stop backend worker
```

Visitors now get an error page; nothing can write to the old database.

### B2. Copy the database — EC2 terminal

```bash
bash ~/hybent/deploy/scripts/migrate_supabase_db.sh
```

It refuses to run if the new database isn't empty, recreates extensions, dumps, restores in a single transaction (all or nothing), then compares row counts.

**Check:** it ends with

```
   all NN tables match
==> Alembic version (old, new)
049_clear_fcm_tokens
049_clear_fcm_tokens
==> Database migration complete
```

If it stops with an error or `MISMATCH`, **don't continue** — run Part D (restart on the old database) and send me the output.

### B3. Catch up the resume files — EC2 terminal

```bash
storage_copy
```

**Check:** `0 failed`.

### B4. Point the app at the new project — EC2 terminal

```bash
nano ~/hybent/deploy/.env.prod
```

Replace exactly these three lines with the new values from A2, save (`Ctrl+O`, `Enter`, `Ctrl+X`):

```
DATABASE_URL=<NEW_DB>
SUPABASE_URL=<NEW_SUPABASE_URL>
SUPABASE_SERVICE_ROLE_KEY=<NEW_SUPABASE_KEY>
```

### B5. Start the app — EC2 terminal

```bash
cd ~/hybent/deploy
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f backend
```

Wait for `Migrations complete` and `Uvicorn running`, then `Ctrl+C`.

```bash
curl -s http://127.0.0.1:8000/health; echo
docker compose -f docker-compose.prod.yml ps
```

**Check:** health says `healthy`; backend is `healthy`, worker is `Up`.

### B6. Test — Browser / Mac terminal

On `https://hybent.com`:

- [ ] Log in with a real account; your existing jobs and candidates are there
- [ ] Open a candidate and view their **resume** (proves Storage was copied)
- [ ] Upload a new resume
- [ ] Pages feel noticeably faster

Speed check from your Mac (was ~5.7 s before):

```bash
curl -s -o /dev/null -w "%{time_total}s\n" -X POST https://api.hybent.com/v1/auth/login \
  -H "Content-Type: application/json" -d '{"email":"nobody@example.com","password":"x"}'
```

---

## Part C — Clean up (after a few days without issues)

1. Delete the dump on the server — it contains all your data:
   ```bash
   rm -rf ~/db-migration
   ```
2. Update your Mac's copy `deploy/.env.prod` with the three new values, so it matches the server.
3. Old Supabase project → **Project Settings → General → Pause project** (keeps it restorable). Delete it after another week or two.
4. Delete the Render services.

Because the new project has a new database password and new keys, this also rotates the Supabase credentials that were exposed earlier.

---

## Part D — Rollback (only if Part B fails)

The old project hasn't been modified. In the EC2 terminal:

```bash
nano ~/hybent/deploy/.env.prod     # put the OLD DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY back
cd ~/hybent/deploy
docker compose -f docker-compose.prod.yml up -d
```

To retry later, the new database must be emptied first: Supabase → new project → **SQL Editor** → run `drop schema public cascade; create schema public;` — then start again from B1. Anything written to the new database after B5 is lost on rollback.
