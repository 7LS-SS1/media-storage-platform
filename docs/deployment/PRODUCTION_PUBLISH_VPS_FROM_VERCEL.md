# Production Publish Guide: Vercel to VPS (Hostinger + Coolify + Neon)

Last updated: 2026-02-17

## 1. Target Stack (Recommended)

### 1.1 VPS and OS
- VPS provider: Hostinger VPS
- Recommended plan for production transcode workload: KVM 8 (8 vCPU, 32 GB RAM, NVMe)
- OS: Ubuntu Server 24.04 LTS (recommended baseline)

Why this OS:
- Long support lifecycle
- Excellent Docker compatibility
- Large community support for ffmpeg, Node.js, and DevOps tooling

### 1.2 Web Management Panel
- Recommended: Coolify (self-hosted PaaS control plane)
- Why:
  - Popular open-source deployment platform
  - Strong support for Git-based deploys
  - Easy split services (web app + worker) for this project
  - Works well on a single VPS and can scale later

### 1.3 Database
- Neon PostgreSQL
- Runtime DB URL: pooled connection string
- Migration DB URL: direct connection string

Important for this project:
- MP4 conversion is queue/worker-based in production
- Do not run inline transcode on serverless or request-response path

## 2. Architecture for This Project

- Service A: Next.js web app (API + UI)
- Service B: Transcode worker (`npm run transcode:worker`)
- Data: Neon PostgreSQL
- Object storage: Cloudflare R2
- Manager: Coolify on same VPS (or dedicated control VPS if you scale later)

Flow:
1. Upload TS/video metadata to DB
2. API marks video as `PROCESSING`
3. Worker polls DB and transcodes to MP4
4. Worker uploads MP4 to R2 and sets status `READY`

## 3. Migration Plan from Vercel to VPS

## 3.1 Pre-Migration Checklist
- Freeze major schema changes for migration window
- Confirm production branch and commit hash
- Set DNS TTL to 60-300 seconds at least 24 hours before cutover
- Prepare rollback owner and decision threshold

## 3.2 Export Existing Production Environment

Use Vercel CLI from your local machine:

```bash
vercel login
vercel link
vercel env pull .env.vercel.production --environment=production
```

Then create final production env for VPS:

```bash
cp .env.vercel.production .env.vps.production
```

Add or verify keys required by this project:
- `DATABASE_URL` (Neon pooled)
- `JWT_SECRET`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_JAV_BUCKET_NAME`
- `R2_PUBLIC_DOMAIN`
- `R2_JAV_PUBLIC_DOMAIN`
- `NEXT_PUBLIC_APP_URL`
- `TRANSCODE_MODE=worker`

Recommended optional keys:
- `DIRECT_URL` (Neon direct, for migration command override)
- `R2_KEY_PREFIX`
- `R2_JAV_KEY_PREFIX`
- `FFMPEG_PATH=/usr/bin/ffmpeg`
- `FFPROBE_PATH=/usr/bin/ffprobe`
- `TRANSCODE_TMP_DIR=/mnt/transcode-tmp`
- `TRANSCODE_POLL_INTERVAL_MS=15000`
- `TRANSCODE_IDLE_DELAY_MS=15000`

## 4. VPS Provisioning and OS Installation

## 4.1 Provision VPS
- Create Hostinger VPS with Ubuntu Server 24.04 LTS
- Add SSH key in Hostinger panel during provisioning

## 4.2 Base Hardening (run on VPS)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git jq unzip ca-certificates gnupg lsb-release fail2ban ufw

# optional timezone
sudo timedatectl set-timezone Asia/Bangkok

# firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# fail2ban
sudo systemctl enable --now fail2ban
```

Optional but strongly recommended:
- Create non-root sudo user and disable password SSH auth
- Keep root SSH disabled after verified access

## 4.3 Install Docker Engine and Compose

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
```

## 4.4 Install ffmpeg for Worker Host

```bash
sudo apt install -y ffmpeg
ffmpeg -version
ffprobe -version
```

## 5. Install and Configure Coolify

## 5.1 Install Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

After install:
- Open Coolify URL shown in terminal
- Complete admin setup
- Add your Git provider connection (GitHub)

## 5.2 Server and Project Setup in Coolify
- Add VPS as deployment target (local server)
- Create project: `media-storage-platform`
- Create 2 applications from same repository/branch

App 1: `media-storage-web`
- Build pack: Nixpacks (or Dockerfile if you add one)
- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Port: `3000`
- Domain: `api.yourdomain.com` or `app.yourdomain.com`

App 2: `media-storage-worker`
- Build pack: Nixpacks
- Build command: `npm ci`
- Start command: `npm run transcode:worker`
- No public port
- Add same env except public URL-specific keys not needed by worker

## 5.3 Environment Variables in Coolify
Set shared env in both services where applicable:
- DB: `DATABASE_URL`
- Auth: `JWT_SECRET`
- Storage: all `R2_*`
- Transcode: `TRANSCODE_MODE=worker`

Web-only:
- `NEXT_PUBLIC_APP_URL=https://app.yourdomain.com`

Worker-only recommended:
- `FFMPEG_PATH=/usr/bin/ffmpeg`
- `FFPROBE_PATH=/usr/bin/ffprobe`
- `TRANSCODE_TMP_DIR=/mnt/transcode-tmp`

## 6. Database Migration with Neon

Because Prisma schema currently uses `DATABASE_URL`, run migration with direct URL override:

```bash
# from a one-off deploy shell or CI job
export DATABASE_URL="$DIRECT_URL"
npx prisma migrate deploy
```

Then switch runtime back to pooled URL:
- Web runtime `DATABASE_URL` should be pooled Neon URL
- Worker runtime can also use pooled URL unless heavy DB admin ops are needed

## 7. Cutover Procedure (Vercel to VPS)

## 7.1 Dry Run Before DNS Switch
- Deploy both services to VPS
- Run smoke tests:
  - Login
  - Video list
  - Upload
  - Retranscode queue action
  - Worker converts at least one long clip to MP4

## 7.2 Production Cutover Steps
1. Pause non-essential content updates
2. Verify worker heartbeat in logs
3. Point DNS from Vercel target to VPS target
4. Purge CDN cache if applicable
5. Validate API and playback endpoints
6. Monitor errors and transcode queue for 60-120 minutes

## 7.3 Rollback Plan
If severe error exceeds threshold:
1. Repoint DNS back to Vercel endpoint
2. Disable new writes on VPS if needed
3. Investigate and fix
4. Retry cutover in next approved window

## 8. Operations and Monitoring

Minimum dashboards:
- Web response time / 5xx rate
- Worker queue depth (videos in `PROCESSING`)
- Transcode failure rate (`FAILED`)
- VPS CPU, RAM, disk, and I/O

Recommended alerts:
- `PROCESSING` stuck over 30 min with `transcodeProgress=0`
- Worker process down
- Disk usage > 80%
- DB connection errors

## 9. Security Baseline

- Enforce HTTPS only
- Rotate R2 keys and JWT secret regularly
- Limit DB roles (runtime vs migration)
- Restrict SSH and Coolify admin access by IP where possible
- Keep OS patched monthly

## 10. Validation Checklist

- [ ] Web service healthy after restart
- [ ] Worker service auto restarts after reboot
- [ ] `TRANSCODE_MODE=worker` applied
- [ ] Long video transcode completes
- [ ] MP4 playback works on target domain
- [ ] Plugin sync still works with required mode/type flow
- [ ] Backup and restore test documented

## 11. References

- Hostinger VPS plans: https://www.hostinger.com/vps-hosting
- Hostinger VPS limits/spec examples: https://support.hostinger.com/en/articles/1583571-what-are-the-available-operating-systems-for-vps
- Coolify docs: https://coolify.io/docs
- Coolify install docs: https://coolify.io/docs/get-started/installation
- Coolify GitHub: https://github.com/coollabsio/coolify
- Neon connect docs: https://neon.com/docs/connect/connect-from-any-app
- Neon regions: https://neon.com/docs/introduction/regions
- Vercel CLI env pull: https://vercel.com/docs/cli/env
- Next.js self-hosting guide: https://nextjs.org/docs/app/guides/self-hosting
