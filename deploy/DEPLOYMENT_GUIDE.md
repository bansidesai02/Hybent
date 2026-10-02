# Hybent backend: Render → AWS EC2 with CI/CD

Follow the parts in order. Every part ends with a **Check** — don't move on until it passes.

Steps happen in one of three places:

| Where | How to recognise it |
|---|---|
| **EC2 terminal** | The SSH session — prompt looks like `[ec2-user@ip-172-31-14-32 ~]$` |
| **Mac terminal** | A normal terminal on your laptop — prompt looks like `admin@Macbooks-MacBook-Air Hybent %` |
| **Browser** | AWS console, GitHub, Render dashboard, DNS provider |

Parts 1, 5, 6 run in the **EC2 terminal**; Parts 2, 3, 4 in the **browser** (AWS console); Part 7 in the **browser** (GitHub) and **Mac terminal** (git push).

## What you're building

```
 git push to `main`
        │
        ▼
 GitHub Actions ── build Docker image ── smoke test ── push to Amazon ECR
        │
        ▼  (AWS SSM Run Command — no SSH from GitHub, port 22 stays locked to your IP)
 EC2 t3.small (eu-north-1)
   ~/hybent/deploy/deploy.sh <commit-sha>
        │  pulls the new image, restarts, checks /health, auto-rollback if unhealthy
        ▼
 ┌──────────── docker compose (deploy/docker-compose.prod.yml) ────────────┐
 │  caddy   :80/:443  → HTTPS for api.hybent.com (auto Let's Encrypt)      │
 │  backend :8000     → FastAPI, 2 Uvicorn workers, runs Alembic on start  │
 │  worker            → Celery worker + beat                               │
 │  redis             → Celery broker, rate limiter, websockets            │
 └─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
 Supabase Postgres + Cloudinary/Supabase storage (unchanged — no data migration)
```

Files in the repo that make this work:

| File | Purpose |
|---|---|
| `.github/workflows/backend-deploy.yml` | The pipeline (replaces the old Render deploy hook) |
| `deploy/docker-compose.prod.yml` | Production containers |
| `deploy/deploy.sh` | Runs on the server: pull → restart → health check → rollback |
| `deploy/Caddyfile` | HTTPS reverse proxy |

Files that exist **only on the server** (never committed — they hold secrets):

| File | Contents |
|---|---|
| `~/hybent/deploy/.env` | `BACKEND_IMAGE_REPO`, `API_DOMAIN`, `BACKEND_IMAGE_TAG` (written by deploy.sh) |
| `~/hybent/deploy/.env.prod` | All the app's environment variables (what's in Render today) |

Your values used throughout this guide:

| Name | Value |
|---|---|
| AWS account ID | `640031441258` |
| Region | `eu-north-1` (Stockholm) |
| Instance ID | `i-0c4392d0f81623c96` |
| ECR registry | `640031441258.dkr.ecr.eu-north-1.amazonaws.com` |
| ECR repository | `hybent-backend` |
| GitHub repo | `bansidesai02/Hybent` |
| Deploy branch | `main` |
| API domain | `api.hybent.com` (change everywhere if you pick another) |

Already done: Elastic IP attached, security group (22 from your IP, 80, 443), SSH working.

---

## Part 1 — Prepare the server

All commands in this part run **on the EC2 instance** over SSH.

### 1.1 Confirm the OS and user

```bash
cat /etc/os-release | head -3
whoami
```

This guide is written for **Amazon Linux 2023** and the user **`ec2-user`** (what this instance runs). Home directory: `/home/ec2-user`.

### 1.2 Update and add swap

```bash
sudo dnf upgrade -y
sudo timedatectl set-timezone Asia/Kolkata

sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

If the upgrade installed a new kernel (`dnf needs-restarting -r` says a reboot is needed): `sudo reboot`, wait a minute, SSH back in.

**Check:** `free -h` shows `Swap: 2.0Gi`.

### 1.3 Install Docker and the Compose plugin

Amazon Linux ships Docker in its own repo; the Compose plugin isn't packaged, so it's installed from GitHub.

```bash
sudo dnf install -y docker git jq
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -fSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

sudo tee /etc/docker/daemon.json > /dev/null <<'EOF'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
EOF
sudo systemctl restart docker
```

Now **log out (`exit`) and SSH back in** so the `docker` group applies.

**Check:** `docker run --rm hello-world` prints "Hello from Docker!" and `docker compose version` prints v2.x.

### 1.4 Let Docker pull from ECR automatically

```bash
sudo dnf install -y amazon-ecr-credential-helper
```

If dnf says "No match for argument", install the binary directly instead:

```bash
sudo curl -fSL https://amazon-ecr-credential-helper-releases.s3.us-east-2.amazonaws.com/0.9.0/linux-amd64/docker-credential-ecr-login \
  -o /usr/bin/docker-credential-ecr-login
sudo chmod +x /usr/bin/docker-credential-ecr-login
```

Then point Docker at it for your ECR registry only (Docker Hub images like Redis and Caddy stay anonymous):

```bash
mkdir -p ~/.docker
cat > ~/.docker/config.json <<'EOF'
{
  "credHelpers": {
    "640031441258.dkr.ecr.eu-north-1.amazonaws.com": "ecr-login"
  }
}
EOF
```

This uses the instance's IAM role (Part 3) — no AWS keys are stored on the server.

**Check:** `docker-credential-ecr-login version` prints a version.

---

## Part 2 — Create the ECR repository (AWS console)

Make sure the region selector (top right) says **Europe (Stockholm)**.

1. Search **ECR** → **Elastic Container Registry** → **Private registry → Repositories** → **Create repository**.
2. Repository name: `hybent-backend`. Leave everything else default → **Create**.
3. Open the repository → left menu **Lifecycle Policy** → **Create rule** (or **Edit JSON**) and use:

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep the last 10 images",
      "selection": { "tagStatus": "any", "countType": "imageCountMoreThan", "countNumber": 10 },
      "action": { "type": "expire" }
    }
  ]
}
```

This keeps storage cost under about $1/month while leaving 10 versions to roll back to.

**Check:** the repository URI shown is `640031441258.dkr.ecr.eu-north-1.amazonaws.com/hybent-backend`.

---

## Part 3 — Give the EC2 instance an IAM role (AWS console)

The instance needs permission to (a) pull images from ECR and (b) receive deploy commands from GitHub via SSM.

1. Search **IAM** → **Roles** → **Create role**.
2. Trusted entity type: **AWS service**. Use case: **EC2** → **Next**.
3. Search and tick both:
   - `AmazonEC2ContainerRegistryReadOnly`
   - `AmazonSSMManagedInstanceCore`
4. **Next** → Role name: `hybent-ec2-role` → **Create role**.
5. Go to **EC2 → Instances** → select **Hybent** → **Actions → Security → Modify IAM role** → choose `hybent-ec2-role` → **Update IAM role**.
6. On the server, restart the SSM agent so it picks up the role:

```bash
sudo systemctl restart amazon-ssm-agent
```

(The SSM agent comes preinstalled on Amazon Linux 2023.)

**Check (wait 2–5 minutes):** AWS console → search **Systems Manager** → **Fleet Manager** → your instance appears with status **Online**. If it doesn't after 10 minutes, see Troubleshooting.

---

## Part 4 — Let GitHub Actions into AWS without keys (AWS console)

GitHub authenticates with short-lived OIDC tokens, so there are no AWS access keys to leak or rotate.

### 4.1 Add GitHub as an identity provider (once per AWS account)

1. **IAM → Identity providers → Add provider**.
2. Provider type: **OpenID Connect**.
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. **Add provider**.

### 4.2 Create the deploy role

1. **IAM → Roles → Create role**.
2. Trusted entity type: **Web identity**.
3. Identity provider: `token.actions.githubusercontent.com`. Audience: `sts.amazonaws.com`.
4. GitHub organization: `bansidesai02`. GitHub repository: `Hybent`. GitHub branch: `main`. → **Next**.
5. Don't tick any policies → **Next**.
6. Role name: `hybent-github-deploy` → **Create role**.
7. Open the new role → **Permissions** tab → **Add permissions → Create inline policy** → **JSON** tab → paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrLogin",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "EcrPush",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "arn:aws:ecr:eu-north-1:640031441258:repository/hybent-backend"
    },
    {
      "Sid": "RunDeployOnInstance",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ec2:eu-north-1:640031441258:instance/i-0c4392d0f81623c96",
        "arn:aws:ssm:eu-north-1::document/AWS-RunShellScript"
      ]
    },
    {
      "Sid": "ReadDeployResult",
      "Effect": "Allow",
      "Action": "ssm:GetCommandInvocation",
      "Resource": "*"
    }
  ]
}
```

8. **Next** → Policy name: `hybent-deploy` → **Create policy**.
9. Copy the role's **ARN** from the top of the page — it looks like `arn:aws:iam::640031441258:role/hybent-github-deploy`. You need it in Part 7.

**Check:** role → **Trust relationships** tab contains:

```json
"token.actions.githubusercontent.com:sub": "repo:bansidesai02/Hybent:ref:refs/heads/main"
```

The owner and repo name are case-sensitive and must match GitHub exactly.

---

## Part 5 — Put the repo on the server

The server needs its own key to download the code from GitHub. Your Mac's key is never copied to the server.

### 5.1 Create the server's key — **EC2 terminal** (prompt `[ec2-user@ip-172-31-14-32 ~]$`)

```bash
ssh-keygen -t ed25519 -C "hybent-ec2" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Copy the whole line it prints, from `ssh-ed25519` to `hybent-ec2`. This is the **public** key — safe to paste into GitHub. Never copy `~/.ssh/id_ed25519` (without `.pub`) anywhere.

### 5.2 Register it on GitHub — **browser**

1. Open `https://github.com/bansidesai02/Hybent/settings/keys` (repo → **Settings** → left menu **Deploy keys**). You need admin access to the repo; if you don't see **Settings**, ask the repo owner to do this step.
2. **Add deploy key**.
3. Title: `hybent-ec2`. Key: paste the line from 5.1.
4. Leave **Allow write access unticked** → **Add key**.

### 5.3 Test the key and clone — **EC2 terminal**

```bash
ssh -T git@github.com
```

The first time it asks `Are you sure you want to continue connecting (yes/no)?` — type `yes` and press Enter. Expected reply:

```
Hi bansidesai02/Hybent! You've successfully authenticated, but GitHub does not provide shell access.
```

(It exits with code 1 — that's normal.) Then:

```bash
git clone git@github.com:bansidesai02/Hybent.git ~/hybent
mkdir -p ~/hybent/deploy
ls ~/hybent
```

**Check:** `ls` shows `hybent-hiring-backend`, `hybent-hiring-frontend`, `docker-compose.yml`, etc. The `deploy/` folder is empty for now; the pipeline files arrive when they're merged into `main` in Part 7.

---

## Part 6 — Server environment files

### 6.1 `deploy/.env` — stack settings

```bash
cat > ~/hybent/deploy/.env <<'EOF'
BACKEND_IMAGE_REPO=640031441258.dkr.ecr.eu-north-1.amazonaws.com/hybent-backend
API_DOMAIN=api.hybent.com
EOF
```

`deploy.sh` adds `BACKEND_IMAGE_TAG=` to this file on every deploy.

### 6.2 `deploy/.env.prod` — the app's environment

Open Render → **hybent-hiring-backend → Environment** and copy each value.

```bash
nano ~/hybent/deploy/.env.prod
```

```bash
APP_ENV=production
FRONTEND_URL=https://hybent.com
EMAIL_FROM_ADDRESS=info@hybent.com
SMTP_FROM_NAME=Hybent Hiring

# ── Copy these EXACT values from Render. Never generate new ones. ──
# New SECRET_KEY = every user is logged out.
# EMAIL_ACCOUNTS_ENCRYPTION_KEY: copy it if Render has it; if Render doesn't,
# leave it out entirely — existing mailboxes are encrypted with the code default.
SECRET_KEY=
DATABASE_URL=
# Never true in production: seed.py truncates every table if its demo admin is missing.
RUN_SEED=false

# ── AI ──
GROQ_API_KEY=
GEMINI_API_KEY=
MISTRAL_API_KEY=
HUGGINGFACE_API_KEY=

# ── Email ──
RESEND_API_KEY=
SMTP_USER=
SMTP_PASSWORD=

# ── Stripe (webhook secret gets replaced in Part 10) ──
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# ── OAuth — same paths as on Render, new domain ──
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://api.hybent.com/v1/calendar/callback
GMAIL_REDIRECT_URI=https://api.hybent.com/v1/email-accounts/gmail/callback
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=

# ── Storage ──
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# ── Firebase: the whole JSON on ONE line, wrapped in single quotes ──
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ... }'
```

For `LINKEDIN_REDIRECT_URI`: take the value from Render and swap `hybent-hiring-backend.onrender.com` for `api.hybent.com`.

Save (`Ctrl+O`, `Enter`, `Ctrl+X`) and lock it down:

```bash
chmod 600 ~/hybent/deploy/.env.prod ~/hybent/deploy/.env
```

**Check:** `grep -c '=' ~/hybent/deploy/.env.prod` returns roughly 30, and `grep -E '^(SECRET_KEY|DATABASE_URL|EMAIL_ACCOUNTS_ENCRYPTION_KEY)=$' ~/hybent/deploy/.env.prod` prints **nothing** (no empty critical values).

---

## Part 7 — Turn on the pipeline (GitHub)

### 7.1 Repository secrets

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::640031441258:role/hybent-github-deploy` |
| `EC2_INSTANCE_ID` | `i-0c4392d0f81623c96` |

You can delete `RENDER_DEPLOY_HOOK` after the cutover (Part 11).

### 7.2 Merge the pipeline files into `main`

On your **Mac**, commit these files and get them onto `main` (directly or via a pull request):

```
.github/workflows/backend-deploy.yml
deploy/docker-compose.prod.yml
deploy/deploy.sh
deploy/Caddyfile
deploy/DEPLOYMENT_GUIDE.md
.gitignore                      (adds .env.prod)
```

The push to `main` starts the first run automatically. Watch it under the repo's **Actions** tab → **Backend CD**.

- **Build, test & push image** — first run takes about 8–12 minutes (later runs reuse the cache: 2–4 minutes).
- **Deploy to EC2** — prints the server's output, ending with `==> <sha> is healthy` and a `docker compose ps` table.

The first deploy has no previous version, so if it fails there's nothing to roll back to — read the printed logs and fix.

**Check — on the server:**

```bash
cd ~/hybent/deploy
docker compose -f docker-compose.prod.yml ps        # backend (healthy), worker, redis, caddy — all "Up"
curl http://127.0.0.1:8000/health
docker compose -f docker-compose.prod.yml logs --tail=30 worker   # "celery@... ready" and "beat: Starting"
free -h                                             # used memory comfortably under 2 GB
```

Caddy will log certificate errors until Part 8 — that's expected.

---

## Part 8 — Domain and HTTPS

1. In the DNS provider for `hybent.com`, add:
   - Type `A`, Name `api`, Value = **your Elastic IP**, TTL 300 (or Auto).
   - If the DNS is on Cloudflare, set the proxy to **DNS only (grey cloud)**.
2. Wait until it resolves — on your Mac:

```bash
dig +short api.hybent.com          # must print your Elastic IP
```

3. On the server, make Caddy retry immediately:

```bash
cd ~/hybent/deploy
docker compose -f docker-compose.prod.yml restart caddy
docker compose -f docker-compose.prod.yml logs -f caddy    # wait for "certificate obtained successfully", then Ctrl+C
```

**Check — from your Mac:** `curl https://api.hybent.com/health` returns the health response and `https://api.hybent.com/docs` (if enabled) opens with a valid padlock.

---

## Part 9 — Test the new backend before switching users over

Render is still serving production at this point. Test the EC2 backend directly:

- [ ] `https://api.hybent.com/health` responds
- [ ] Login works (use the API docs page or point a local frontend at it: `VITE_API_BASE_URL=https://api.hybent.com npm run dev`)
- [ ] Upload a resume → it parses (exercises Celery + Tesseract)
- [ ] An AI feature responds (Groq/Gemini/Mistral keys)
- [ ] An email arrives (invite or password reset)
- [ ] `docker compose -f docker-compose.prod.yml logs --tail=100 backend worker` shows no repeated errors

---

## Part 10 — Point external services at the new URL

Keep the old Render values in place alongside the new ones until Part 11 is finished.

| Service | Change |
|---|---|
| **Google Cloud Console** → APIs & Services → Credentials → your OAuth client | Add redirect URIs `https://api.hybent.com/v1/calendar/callback` and `https://api.hybent.com/v1/email-accounts/gmail/callback` |
| **LinkedIn Developers** → your app → Auth | Add the new `LINKEDIN_REDIRECT_URI` |
| **Stripe** → Developers → Webhooks | **Add endpoint** `https://api.hybent.com/v1/stripe/webhook` with the same events as the Render one. Copy its **Signing secret** into `STRIPE_WEBHOOK_SECRET` in `.env.prod` |
| **Supabase** → Database → Network restrictions | Only if restrictions are on: allow your Elastic IP |

After editing `.env.prod`, apply it (a plain `restart` does **not** re-read env files):

```bash
cd ~/hybent/deploy
docker compose -f docker-compose.prod.yml up -d
```

---

## Part 11 — Cutover

1. **Frontend:** in `hybent-hiring-frontend/src/config/api.ts`, change
   `PROD_BACKEND_URL = 'https://hybent-hiring-backend.onrender.com'` → `'https://api.hybent.com'`.
   Merge to `main` → the existing Frontend workflow deploys it to Hostinger.
2. Test the live site end to end (login, upload, Google connect, a Stripe test payment).
3. **Render:** suspend (don't delete) the `hybent-hiring-backend` service and `hybent-hiring-redis`. Disable the old Stripe webhook endpoint.
4. After about a week with no problems:
   - Delete the Render services.
   - Remove the old `onrender.com` redirect URIs from Google and LinkedIn, and delete the old Stripe webhook endpoint.
   - Delete `render.yaml` from the repo and the `RENDER_DEPLOY_HOOK` GitHub secret.
   - Remove `https://hybent-hiring-backend.onrender.com` from the CORS list in `hybent-hiring-backend/app/main.py`.

---

## Day-to-day operations

All server commands assume:

```bash
cd ~/hybent/deploy
alias dc='docker compose -f docker-compose.prod.yml'     # add to ~/.bashrc to keep it
```

### Deploy

Push (or merge) to `main`. Only changes under `hybent-hiring-backend/`, `deploy/` or the workflow file trigger a deploy.

There are roughly 20–40 seconds of downtime while the backend restarts and runs migrations.

### Roll back

- **Automatic:** if a new version never passes `/health` within 2 minutes, `deploy.sh` switches back to the previous version and the workflow goes red.
- **Manual, from GitHub:** **Actions → Backend CD → Run workflow** → branch `main` → `image_tag` = the full commit SHA of a version that worked (find SHAs in past runs or ECR → `hybent-backend` → Images).
- **Manual, on the server:** `bash ~/hybent/deploy/deploy.sh <commit-sha>`

Rolling back the image does **not** undo database migrations. If a bad deploy included a migration, check whether the old code works with the new schema before rolling back.

### Common commands

| Task | Command |
|---|---|
| Status | `dc ps` |
| Follow logs | `dc logs -f backend worker` |
| Memory/CPU per container | `docker stats` |
| Restart one service | `dc restart worker` |
| Apply `.env.prod` changes | `dc up -d` |
| Shell inside backend | `dc exec backend bash` |
| Run migrations by hand | `dc exec backend alembic upgrade head` |
| Create a super admin | `dc exec backend python create_super_admin.py` |
| Currently deployed version | `grep BACKEND_IMAGE_TAG .env` |
| Disk usage | `df -h /` and `docker system df` |

### Reboots

All containers use `restart: always` and Docker starts at boot, so after `sudo reboot` everything comes back on its own. Check with `dc ps`.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Workflow fails at **configure-aws-credentials** with "Not authorized to perform sts:AssumeRoleWithWebIdentity" | Trust policy doesn't match: check owner/repo casing and that you pushed to `main` (Part 4.2 Check). Confirm `AWS_DEPLOY_ROLE_ARN` secret is the role ARN. |
| Workflow fails at **Push image** with "denied" | ECR repo name/region differs from `hybent-backend` / `eu-north-1`, or the inline policy is missing. |
| Smoke test fails with an ImportError | Real code error — the same error would have crashed production. Fix and push again. |
| Smoke test fails with "N migration heads" | Two branches each added a migration. Run `alembic merge heads -m "merge"` locally, commit, push. |
| **Deploy** step: `InvalidInstanceId` | Instance isn't Online in SSM Fleet Manager — recheck Part 3 (role attached, `sudo systemctl restart amazon-ssm-agent`, then `sudo systemctl status amazon-ssm-agent`). |
| Deploy output: `deploy/.env.prod is missing` | Part 6 wasn't done, or files are in the wrong folder (`~/hybent/deploy/`). |
| Deploy output: `no basic auth credentials` / ECR pull denied | `~/.docker/config.json` missing (Part 1.4) or the EC2 role lacks `AmazonEC2ContainerRegistryReadOnly`. |
| Deploy output: `Permission denied (publickey)` on git fetch | Deploy key missing on GitHub or was generated as another user. |
| Backend keeps restarting, logs show "Postgres not ready" | `DATABASE_URL` wrong — must be the Supabase **Session pooler** URL (`aws-…pooler.supabase.com:5432`). |
| `https://api.hybent.com` doesn't load | `dig` doesn't return the Elastic IP yet, Cloudflare proxy is orange, or port 80/443 missing from the security group. See `dc logs caddy`. |
| Container killed, `dmesg` shows "Out of memory" | Lower `--workers` to 1 or `--concurrency` to 1 in `docker-compose.prod.yml`, or move to t3.medium. |
| Can't SSH anymore | Your IP changed — edit the security group SSH rule → **My IP**. (Deploys keep working; they don't use SSH.) |

## Monthly cost (approx.)

| Item | Cost |
|---|---|
| t3.small on-demand (eu-north-1) | ~$16 |
| 20–30 GB gp3 disk | ~$2–3 |
| Public IPv4 (Elastic IP) | ~$3.60 |
| ECR storage (10 images) | < $1 |
| SSM, IAM, GitHub Actions | $0 |
| **Total** | **~$22–24** |
