# Deployment: Vercel frontend + Contabo backend

The frontend is a static Nuxt build on Vercel. Every `/api/*` request is proxied
by Vercel to the Contabo backend, so the browser only ever talks to your
`*.vercel.app` domain and login cookies are first-party (no custom domain
needed). The Contabo box runs the full Nitro API, the render pipeline
(`ffmpeg` + `yt-dlp`), and Postgres in Docker, with free HTTPS via `sslip.io`.

```
Browser (your-project.vercel.app)
  |-- pages ------------------> Vercel (static)
  |-- /api/* -----------------> Vercel rewrite --> https://<ip>.sslip.io (Contabo)
                                                     |-- Nitro API + render queue
                                                     |-- Postgres
                                                     |-- disk storage
```

---

## Part A - Contabo backend

1. Create a Contabo VPS (Ubuntu/Debian). Note its public IP, e.g. `203.0.113.5`.
   Your backend host is that IP with dashes: `203-0-113-5.sslip.io`.

2. Install Docker + Compose plugin:

```bash
curl -fsSL https://get.docker.com | sh
```

3. Get the code and enter the app dir:

```bash
git clone <your-repo-url>
cd <repo>/nuxt-starter
```

4. Create the env file and fill it in:

```bash
cp .env.contabo.example .env
nano .env
```

Key values:
- `NUXT_PUBLIC_SITE_URL` = your Vercel URL (fill after Part B; can start as a placeholder)
- `CADDY_SITE_ADDRESS` = `203-0-113-5.sslip.io`
- `POSTGRES_PASSWORD` + matching password in `DATABASE_URL`
- `NUXT_SESSION_PASSWORD` = `openssl rand -base64 32`
- Google OAuth + Stripe keys

5. Open firewall ports 80 and 443 (Contabo panel or `ufw allow 80,443/tcp`).

6. Build and start:

```bash
docker compose up -d --build
```

Migrations run automatically on container start. Check logs:

```bash
docker compose logs -f app
```

7. Verify the backend is up (HTTPS cert may take ~30s on first boot):

```bash
curl https://203-0-113-5.sslip.io/api/usage/status
```

You should get a JSON usage response.

---

## Part B - Vercel frontend

1. In Vercel, "Add New Project" -> import your repo.
2. Set **Root Directory** to `nuxt-starter`. Framework preset: **Other**
   (the included [vercel.json](vercel.json) controls the build).
3. Add Environment Variables (Production):
   - `NUXT_PUBLIC_SITE_URL` = `https://your-project.vercel.app` (update after first deploy if the name differs)
   - `STRIPE_PUBLISHABLE_KEY` = your `pk_...`
   - `NUXT_SESSION_PASSWORD` = any 32+ char string (not used at runtime here, keeps build happy)
4. Edit [vercel.json](vercel.json) and replace `REPLACE_WITH_CONTABO_HOST` with your
   backend host (`203-0-113-5.sslip.io`). Commit and push.
5. Deploy. Note the production URL, e.g. `https://your-project.vercel.app`.

---

## Part C - Wire the two together

1. Back on Contabo, set the real Vercel URL and restart:

```bash
# edit .env: NUXT_PUBLIC_SITE_URL=https://your-project.vercel.app
docker compose up -d
```

2. Google Cloud Console -> Credentials -> your OAuth client -> Authorized
   redirect URIs, add:

```
https://your-project.vercel.app/api/auth/google
```

3. Stripe -> Developers -> Webhooks, add endpoint:

```
https://your-project.vercel.app/api/billing/webhook
```

Copy its signing secret into Contabo `.env` as `STRIPE_WEBHOOK_SECRET`, then
`docker compose up -d`.

4. Open `https://your-project.vercel.app`, create a video as a guest, then sign
   in with Google to confirm the full flow.

---

## Instagram / TikTok link import

Instagram requires a logged-in session even for public Reels, and a datacenter
IP (Contabo) is gated harder than home connections.

1. Export a `cookies.txt` (Netscape format) from a **throwaway** IG account.
2. Copy it to `nuxt-starter/cookies.txt` on the server.
3. Uncomment the cookies volume in [docker-compose.yml](docker-compose.yml) and
   set `YT_DLP_COOKIES_FILE=/app/cookies.txt` in `.env`.
4. `docker compose up -d`.

If Instagram still blocks the datacenter IP, route yt-dlp through a residential
proxy. Device uploads always work regardless.

---

## Updating after code changes

```bash
# Contabo
git pull
docker compose up -d --build

# Vercel: pushing to the connected branch redeploys automatically.
```

---

## Troubleshooting

- **`/api/*` returns Vercel 404**: `vercel.json` still has the placeholder host,
  or the backend cert isn't ready. Check `curl https://<host>.sslip.io/api/usage/status`.
- **Login redirect fails / redirect_uri_mismatch**: `NUXT_PUBLIC_SITE_URL` on
  Contabo must exactly match the Vercel URL, and that URL + `/api/auth/google`
  must be in Google's authorized redirect URIs.
- **Large upload fails**: uploads flow through the Vercel proxy; lower
  `MAX_UPLOAD_MB`, or (follow-up) switch uploads to hit the backend directly.
- **Cert not issued**: ports 80/443 must be open and the `sslip.io` host must
  resolve to your IP (`dig 203-0-113-5.sslip.io`).
