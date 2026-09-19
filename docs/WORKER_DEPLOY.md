# Worker Deployment Guide — Railway.app

## Architecture

```
[Main App (Railway)]  ──HTTP──>  [Worker Service (Railway)]
                                      |
                               solc (Solidity compiler)
                               slither-analyzer (Python)
```

Worker ek alag Railway service hai jo `POST /v1/analysis/stages` expose karta hai.
Main app `CHAINSHIELD_WORKER_URL` + `CHAINSHIELD_WORKER_TOKEN` se connect karta hai.

---

## Step 1 — Secret Token Generate Karo

```bash
# PowerShell (Windows)
[System.Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Ya openssl (WSL/Linux/Mac)
openssl rand -base64 32
```

Is token ko save karo — dono services mein same token lagega.

---

## Step 2 — Railway pe Worker Deploy Karo

### Option A: Railway CLI se (Recommended)

```bash
# Railway CLI install
npm install -g @railway/cli

# Login
railway login

# Project create ya existing mein join
railway link

# Worker service create karo
railway service create chainshield-worker

# Worker directory set karo
railway up --service chainshield-worker

# Environment variables set karo
railway variables set WORKER_SECRET_TOKEN="<tumhara-token>" --service chainshield-worker
railway variables set PORT=4000 --service chainshield-worker
railway variables set NODE_ENV=production --service chainshield-worker
```

### Option B: Railway Dashboard se

1. [railway.app](https://railway.app) pe jao
2. New Project → Deploy from GitHub repo
3. **Root Directory**: `/` (root)
4. **Dockerfile Path**: `worker/Dockerfile`
5. Environment Variables add karo:
   - `WORKER_SECRET_TOKEN` = tumhara secret token
   - `PORT` = `4000`
   - `NODE_ENV` = `production`
6. Deploy karo → Railway ek public URL dega (e.g. `https://chainshield-worker.up.railway.app`)

---

## Step 3 — Main App ke Environment Variables Set Karo

Main app service mein yeh variables add karo:

```
CHAINSHIELD_WORKER_URL=https://chainshield-worker.up.railway.app
CHAINSHIELD_WORKER_TOKEN=<same-token-jo-worker-mein-lagaya>
```

### Railway CLI se:
```bash
railway variables set CHAINSHIELD_WORKER_URL="https://chainshield-worker.up.railway.app" --service chainshield-app
railway variables set CHAINSHIELD_WORKER_TOKEN="<tumhara-token>" --service chainshield-app
```

---

## Step 4 — Verify karo

```bash
# Health check
curl https://chainshield-worker.up.railway.app/health
# Expected: {"status":"ok","service":"chainshield-worker","version":"1.0.0"}

# Auth test (bina token ke 401 aana chahiye)
curl -X POST https://chainshield-worker.up.railway.app/v1/analysis/stages
# Expected: {"error":"UNAUTHORIZED",...}
```

---

## Local Development

```bash
# .env file mein add karo:
WORKER_SECRET_TOKEN=dev-secret-token-local-only

# Terminal 1: Worker start karo
pnpm dev:worker

# Terminal 2: Main app start karo
pnpm dev
```

### Docker Compose se (full stack):

```bash
# .env file banao
cp .env.example .env
# WORKER_SECRET_TOKEN=... set karo

# Full stack start karo
docker compose up --build
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `WORKER_NOT_CONFIGURED` findings | `CHAINSHIELD_WORKER_URL` env var check karo |
| `WORKER_HTTP_401` | Token match nahi — dono services mein same token lagao |
| `SLITHER_EXECUTION_FAILED` | Worker container mein `slither --version` run karo |
| `SOLC_EXECUTION_FAILED` | Worker container mein `solc --version` run karo |
| Slow first scan | Slither pehli baar import cache build karta hai — 2nd scan fast hogi |

---

## Security Notes

- Worker token rotate karo agar expose ho jaye
- Production mein worker ke liye `network_mode: none` enable karo (docker-compose)
- Worker public URL pe rate limiting lagao (Railway settings mein)
