# Ranking Shorts

Turn TikTok & Instagram clips into ranked, share-ready 9:16 short videos.
Built with Nuxt 4 (Vue 3), a Nitro API backend, Postgres (Drizzle), Stripe,
S3-compatible storage, and an FFmpeg + yt-dlp render pipeline.

## Stack

| Concern      | Choice                                                        |
| ------------ | ------------------------------------------------------------- |
| Framework    | Nuxt 4 / Nitro server routes                                  |
| Styling      | Tailwind CSS v4 (dark, YouTube-style theme)                   |
| Auth         | `nuxt-auth-utils` (Google OAuth, sealed session cookie)       |
| Database     | Postgres via Drizzle ORM (`postgres` driver)                  |
| Payments     | Stripe (Checkout, Customer Portal, webhooks)                  |
| Storage      | S3-compatible bucket, with a local-disk driver for dev        |
| Media        | `yt-dlp` (download) + `ffmpeg`/`ffprobe` (normalize + render) |
| SEO          | `@nuxtjs/seo` (sitemap, robots, canonical, schema.org)        |
| State        | Pinia                                                         |

## Prerequisites

- Node 20+ and `pnpm`
- Postgres 14+
- `ffmpeg` + `ffprobe` on PATH (`brew install ffmpeg`)
- `yt-dlp` on PATH (`brew install yt-dlp` or `pipx install yt-dlp`)

## Setup

```bash
pnpm install
cp .env.example .env          # then fill in the values
pnpm db:migrate               # apply schema to Postgres
pnpm dev                      # http://localhost:3000
```

Generate a session password with `openssl rand -base64 32` and set
`NUXT_SESSION_PASSWORD`. Configure a Google OAuth client with redirect URI
`<SITE_URL>/api/auth/google`.

### Database migrations

```bash
pnpm db:generate   # create a new migration from schema changes
pnpm db:migrate    # apply pending migrations
pnpm db:push       # push schema directly (dev only)
pnpm db:studio     # Drizzle Studio
```

### Stripe webhooks (local)

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
# copy the whsec_... into STRIPE_WEBHOOK_SECRET
```

## Architecture

```
app/                     # Nuxt front-end
  pages/                 # /, /pricing, /create, /account, /login, /blog, ...
  components/            # header/footer, toasts, create-flow steps
  stores/builder.store   # multi-step /create builder state
server/
  api/                   # REST endpoints (auth, usage, clips, render, billing)
  routes/api/auth/       # Google OAuth callback (nuxt-auth-utils)
  database/schema.ts     # Drizzle schema + migrations
  utils/                 # db, storage, usage, stripe, billing, media, render
  tasks/                 # scheduled storage cleanup + db migrate
```

### Core flow (`/create`)

1. **Build the list** — paste an Instagram/TikTok link (`/api/clips/import`,
   fetched via yt-dlp) or upload a file (`/api/clips/upload`). Clips are staged,
   labelled, and drag-reorderable.
2. **Title** — the overall title burned in at the top of the video.
3. **Review** — summary + a client-side preview showing each clip's label/badge
   only while that clip plays.
4. **Generate** — `POST /api/render` queues a job; the page polls
   `/api/render/:jobId/status` and offers the finished `.mp4` for download.

### Render pipeline

`server/utils/render.ts` builds a single FFmpeg `filter_complex` graph that
normalizes each clip to 9:16, burns in the overall title (full duration), a
per-clip label (only during its segment), and a colored outlined ranking badge,
then concatenates everything into the final MP4. Jobs run through a small
in-process queue (`render-queue.ts`) — swap for BullMQ/Redis at scale without
changing the API.

## Rate limiting

- **Anonymous first video:** a visitor can create one free video without
  signing in. On first write action a lightweight *guest* user is created and
  tracked via an httpOnly `guest_id` cookie. When they sign in, their guest
  video + usage are migrated to their account (`mergeGuestIntoUser`).
- Free tier (guest or signed-in): **1 successful render per rolling 24h**
  (`FREE_RENDERS_PER_24H`).
- Only `render_completed` usage events count — failed renders don't consume the
  daily slot, so users can retry immediately.
- Enforced **server-side** in `POST /api/render` (never trust the client), and
  surfaced in the UI via `GET /api/usage/status`. The actor (session user or
  guest) is resolved in `server/utils/actor.ts`.
- Paid subscribers are unlimited.

## Storage retention

An hourly scheduled task (`server/tasks/storage/cleanup.ts`) enforces:

- Source clips: deleted ~24h after their render job completes.
- Orphaned staged clips: deleted ~24h after upload/import.
- Rendered outputs: deleted ~30 days after completion.

For production S3, you can additionally configure bucket lifecycle rules.

## SEO

- Indexable: `/`, `/pricing`, `/blog`, `/blog/*` (prerendered).
- `noindex`: `/create`, `/account`, `/login`, `/render/*`, `/api/*`.
- Per-page `useSeoMeta` + canonical URLs; JSON-LD via schema.org
  (`Organization`/`WebSite` on home, `SoftwareApplication` on pricing,
  `FAQPage` on home, `Article` per blog post).
- `robots.txt` and `sitemap.xml` auto-generated; static branded OG images in
  `public/og/`. To enable per-post dynamic OG images, set `ogImage.enabled` and
  add a renderer (see `nuxt.config.ts`).

## Product decisions

**Resolved (from spec):**

- Download tool: yt-dlp + ffmpeg.
- Retention: 24h source / 30d output defaults.
- Rate limit: only successful renders count.

**Defaults chosen for the open questions** (all env-tunable):

- Max ranking items: `MAX_RANKING_ITEMS=10`
- Max upload: `MAX_UPLOAD_MB=100`, `MAX_CLIP_DURATION_SECONDS=60`
- Client preview: render-then-review, plus a lightweight label/badge preview.

**Flagged for product/legal (not code):** importing content from
Instagram/TikTok can violate their ToS and raise copyright questions. The
`/create` flow includes a rights-confirmation notice and the Terms page shifts
responsibility to the uploader — review before launch.

## Scripts

```bash
pnpm dev            # dev server
pnpm build          # production build (node-server)
pnpm preview        # preview the build
pnpm lint           # eslint
pnpm db:*           # drizzle-kit (see above)
```
