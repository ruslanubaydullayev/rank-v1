<script setup lang="ts">
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl;
const price = config.public.planPriceUsd;

useSeoMeta({
  title: "Ranking Shorts — Turn TikTok & Instagram Clips into Ranked Videos",
  description:
    "Rank your favorite TikTok & Instagram clips into a share-ready 9:16 short with numbered badges and captions — no editing skills needed.",
  ogTitle: "Ranking Shorts — Turn Clips into Ranked Videos",
  ogDescription:
    "Drop in clips, rank them, and generate a polished vertical ranking video in seconds.",
  ogType: "website",
  ogUrl: siteUrl,
  ogImage: `${siteUrl}/og/home.png`,
  twitterCard: "summary_large_image",
});

useHead({
  link: [{ rel: "canonical", href: siteUrl }],
});

// Structured data: Organization + WebSite (spec §8.3).
useSchemaOrg([
  defineOrganization({
    name: "Ranking Shorts",
    url: siteUrl,
    logo: `${siteUrl}/og/home.png`,
  }),
  defineWebSite({ name: "Ranking Shorts", url: siteUrl }),
]);

const faqs = [
  {
    q: "Is this content monetizable?",
    a: "Yes. On YouTube you can monetize this type of ranking/countdown content, as long as it meets the YouTube Partner Program requirements and you have the rights to the clips you use. Adding your own title, ranking, and commentary helps keep it original.",
  },
  {
    q: "How do I make money with ranking videos?",
    a: "Post your ranking shorts to YouTube (Shorts or long-form), TikTok, and Instagram. On YouTube you can earn through ad revenue and Shorts monetization once you qualify for the Partner Program, plus channel memberships, sponsorships, and affiliate links as your audience grows.",
  },
  {
    q: "How do I make a ranking video?",
    a: "Add your clips (paste a TikTok/Instagram link or upload a file), give each one a label, set the order, add an overall title, and hit Generate. We render a vertical 9:16 MP4 with numbered badges and captions.",
  },
  {
    q: "Do I need video editing skills?",
    a: "No. Ranking Shorts handles trimming, formatting, badges, and captions automatically. You just choose the clips and the order.",
  },
  {
    q: "What does it cost?",
    a: `You can make one video per day for free. Pro is $${price}/month for unlimited renders.`,
  },
  {
    q: "Where do the clips come from?",
    a: "You can upload your own videos or import from a link. You’re responsible for making sure you have the rights to any content you use.",
  },
];

useSchemaOrg([
  defineWebPage({ "@type": "FAQPage" }),
  ...faqs.map((f) => defineQuestion({ name: f.q, acceptedAnswer: f.a })),
]);

const steps = [
  {
    n: "1",
    title: "Add your clips",
    body: "Paste an Instagram or TikTok link, or upload straight from your device.",
  },
  {
    n: "2",
    title: "Rank & label",
    body: "Drag to reorder and give each clip a name. Rank order is the whole point.",
  },
  {
    n: "3",
    title: "Generate",
    body: "We render a vertical MP4 with numbered badges and captions in ~30s.",
  },
];

// Hero carousel — screenshots live in /public (filenames contain spaces).
// Duplicated once so the marquee can loop seamlessly.
const slides = [
  "/screen 1.png",
  "/screen 2.png",
  "/screen 3.png",
  "/screen 4.png",
].map((s) => encodeURI(s));
const marquee = [...slides, ...slides];
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden">
      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/10 via-transparent to-transparent"
      />
      <div
        class="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28"
      >
        <div>
          <span
            class="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted"
          >
            <span class="h-2 w-2 rounded-full bg-accent" />
            Ranked shorts in seconds
          </span>
          <h1 class="mt-5 text-4xl font-black leading-tight sm:text-6xl">
            Turn your clips into
            <span class="text-accent">ranked videos</span>
          </h1>
          <p class="mt-5 max-w-lg text-lg text-muted">
            Drop in TikTok & Instagram clips, rank them, and export a polished
            9:16 short with numbered badges and captions — no editing skills
            required.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <NuxtLink to="/create" class="btn-primary px-7 py-3 text-base">
              Start creating — free
            </NuxtLink>
            <NuxtLink to="/pricing" class="btn-outline px-7 py-3 text-base">
              See pricing
            </NuxtLink>
          </div>
          <p class="mt-4 text-sm text-muted">
            1 free video per day · Pro ${{ price }}/mo for unlimited
          </p>
        </div>

        <!-- Screenshot carousel (continuous smooth marquee).
             8 cards (4 duplicated); track is 800% wide on mobile (1 visible)
             and 400% on sm+ (2 visible). Each card is 1/8 of the track. -->
        <div class="carousel-mask relative overflow-hidden">
          <div class="marquee-track flex w-[800%] sm:w-[400%]">
            <div
              v-for="(src, i) in marquee"
              :key="i"
              class="w-[12.5%] shrink-0 px-2"
            >
              <div
                class="aspect-[9/16] overflow-hidden rounded-[1.5rem] border-4 border-border bg-black shadow-2xl shadow-black/60"
              >
                <img
                  :src="src"
                  alt="Ranking Shorts app screenshot"
                  loading="lazy"
                  class="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 class="text-center text-3xl font-bold">How it works</h2>
      <div class="mt-10 grid gap-6 md:grid-cols-3">
        <div v-for="s in steps" :key="s.n" class="card">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-lg font-black"
          >
            {{ s.n }}
          </div>
          <h3 class="mt-4 text-lg font-semibold">{{ s.title }}</h3>
          <p class="mt-2 text-muted">{{ s.body }}</p>
        </div>
      </div>
    </section>

    <!-- CTA band -->
    <section class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div
        class="flex flex-col items-center gap-4 rounded-2xl border border-border bg-gradient-to-r from-surface to-surface-2 px-6 py-12 text-center"
      >
        <h2 class="text-3xl font-bold">Make your first ranking short</h2>
        <p class="max-w-md text-muted">
          Free to start. No watermark headaches. Just clips, ranked and ready to
          post.
        </p>
        <NuxtLink to="/create" class="btn-primary px-7 py-3 text-base"
          >Start creating</NuxtLink
        >
      </div>
    </section>

    <!-- FAQ -->
    <section class="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h2 class="text-center text-3xl font-bold">Frequently asked questions</h2>
      <div class="mt-8 space-y-3">
        <details
          v-for="f in faqs"
          :key="f.q"
          class="group rounded-xl border border-border bg-surface p-5"
        >
          <summary
            class="cursor-pointer list-none font-semibold marker:hidden [&::-webkit-details-marker]:hidden"
          >
            {{ f.q }}
          </summary>
          <p class="mt-3 text-muted">{{ f.a }}</p>
        </details>
      </div>
    </section>
  </div>
</template>

<style scoped>
.marquee-track {
  animation: marquee 22s linear infinite;
  will-change: transform;
}
/* Pause the loop while the user is pointing at the carousel. */
.carousel-mask:hover .marquee-track {
  animation-play-state: paused;
}
/* Soft fade at both edges so screenshots slide in/out gracefully. */
.carousel-mask {
  -webkit-mask-image: linear-gradient(
    to right,
    transparent,
    #000 6%,
    #000 94%,
    transparent
  );
  mask-image: linear-gradient(
    to right,
    transparent,
    #000 6%,
    #000 94%,
    transparent
  );
}
@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    /* Track is duplicated once; shift by half its width for a seamless loop. */
    transform: translateX(-50%);
  }
}
</style>
