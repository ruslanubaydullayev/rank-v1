import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  css: ["assets/css/tailwind.css"],
  devtools: { enabled: true },

  modules: [
    "@pinia/nuxt",
    "@nuxt/eslint",
    "@vueuse/nuxt",
    "nuxt-auth-utils",
    "@nuxtjs/seo",
  ],

  // Public site identity used by @nuxtjs/seo (sitemap, robots, canonical, OG).
  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || "https://rankingshorts.com",
    name: "Ranking Shorts",
    description:
      "Turn your favorite TikTok & Instagram clips into a ranked, share-ready short video in seconds.",
    defaultLocale: "en",
  },

  runtimeConfig: {
    // --- Server-only secrets ---
    databaseUrl: process.env.DATABASE_URL,

    // OAuth (nuxt-auth-utils reads oauth.google.* automatically)
    oauth: {
      google: {
        clientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET,
      },
    },

    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      priceId: process.env.STRIPE_PRICE_ID, // $9/mo recurring price
    },

    storage: {
      driver: process.env.STORAGE_DRIVER || "local", // "local" | "s3"
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT, // for S3-compatible providers
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      localDir: process.env.STORAGE_LOCAL_DIR || ".data/storage",
    },

    // Binaries used by the render pipeline.
    ytDlpPath: process.env.YT_DLP_PATH || "yt-dlp",
    ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
    ffprobePath: process.env.FFPROBE_PATH || "ffprobe",

    // Instagram (and sometimes TikTok) now require a logged-in session to fetch
    // even public posts. Provide cookies via one of these:
    //  - YT_DLP_COOKIES_FROM_BROWSER: a browser name yt-dlp reads cookies from
    //    (e.g. "chrome", "safari", "firefox", "edge"). Best for local dev.
    //  - YT_DLP_COOKIES_FILE: path to a Netscape-format cookies.txt file.
    //    Best for servers/production where no browser is available.
    ytDlpCookiesFromBrowser: process.env.YT_DLP_COOKIES_FROM_BROWSER || "",
    ytDlpCookiesFile: process.env.YT_DLP_COOKIES_FILE || "",

    limits: {
      freeRendersPer24h: Number(process.env.FREE_RENDERS_PER_24H || 10),
    },

    // --- Public (client + server) ---
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || "https://rankingshorts.com",
      // Base URL for API calls. Empty = same-origin (the browser hits the
      // Vercel frontend, which proxies /api/* to the backend), which keeps
      // auth cookies first-party. Override only if you call the backend host
      // directly.
      apiBase: process.env.NUXT_PUBLIC_API_BASE || "",
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      // Client-side guardrails (also enforced server-side).
      maxRankingItems: Number(process.env.MAX_RANKING_ITEMS || 10),
      maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 100),
      maxClipDurationSeconds: Number(
        process.env.MAX_CLIP_DURATION_SECONDS || 60,
      ),
      planPriceUsd: Number(process.env.PLAN_PRICE_USD || 9),
    },
  },

  // --- SEO module configuration (@nuxtjs/seo) ---
  robots: {
    // Public pages crawlable; app/private/API paths blocked.
    disallow: ["/create", "/account", "/login", "/render", "/api"],
  },

  sitemap: {
    // Exclude noindex/app routes from the sitemap.
    exclude: ["/create", "/account", "/login", "/render/**"],
    // Dynamic blog URLs are supplied by this source endpoint.
    sources: ["/api/__sitemap__/urls"],
  },

  // Using static branded OG images (public/og/*.png), so the dynamic OG image
  // generator is disabled to avoid a runtime renderer dependency. To enable
  // per-post dynamic OG images later (spec §8.4), set enabled: true and add
  // @takumi-rs/core (or a satori renderer component).
  ogImage: { enabled: false },

  // Route-level indexing + rendering strategy.
  routeRules: {
    // Content pages: prerender for crawlability + fast TTFB.
    "/": { prerender: true },
    "/pricing": { prerender: true },
    "/blog": { prerender: true },
    "/blog/**": { prerender: true },
    "/terms": { prerender: true },
    "/privacy": { prerender: true },
    // App / private pages: client-rendered only. On the Vercel deployment the
    // API lives on another host (proxied), so these must never SSR-fetch it.
    "/create": { robots: false, ssr: false },
    "/account": { robots: false, ssr: false },
    "/login": { robots: false, ssr: false },
    "/render/**": { robots: false, ssr: false },
    // Never expose the API to crawlers.
    "/api/**": { robots: false },
  },

  nitro: {
    experimental: { tasks: true },
    // Hourly storage retention cleanup (spec §8). Runs on node-server/preview.
    scheduledTasks: {
      "0 * * * *": ["storage:cleanup"],
    },
    // Ensure every page has a static entry for the Vercel static build.
    // Client-only app pages are emitted as SPA shells; marketing pages are
    // fully prerendered for SEO.
    prerender: {
      crawlLinks: true,
      routes: [
        "/",
        "/pricing",
        "/blog",
        "/terms",
        "/privacy",
        "/login",
        "/create",
        "/account",
      ],
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: "en" },
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  compatibilityDate: "2025-12-22",
});
