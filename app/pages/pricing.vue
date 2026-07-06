<script setup lang="ts">
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl;
const price = config.public.planPriceUsd;
const { loggedIn } = useUserSession();
const toast = useToast();
const router = useRouter();
const loading = ref(false);

useSeoMeta({
  title: "Pricing — Ranking Shorts",
  description: `Start free with 1 ranking video per day. Go Pro for $${price}/month and get unlimited renders of your TikTok & Instagram ranking videos.`,
  ogTitle: "Ranking Shorts Pricing",
  ogDescription: `Free daily video, or unlimited for $${price}/month.`,
  ogType: "website",
  ogUrl: `${siteUrl}/pricing`,
  ogImage: `${siteUrl}/og/pricing.png`,
  twitterCard: "summary_large_image",
});

useHead({ link: [{ rel: "canonical", href: `${siteUrl}/pricing` }] });

// Product / SoftwareApplication schema (spec §8.3).
useSchemaOrg([
  defineSoftwareApp({
    name: "Ranking Shorts Pro",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    description:
      "Create unlimited ranked short videos from TikTok and Instagram clips.",
    offers: {
      "@type": "Offer",
      price: String(price),
      priceCurrency: "USD",
    },
  }),
]);

async function subscribe() {
  if (!loggedIn.value) {
    await router.push("/login?redirect=/pricing");
    return;
  }
  loading.value = true;
  try {
    const { url } = await $fetch<{ url: string }>(
      "/api/billing/create-checkout-session",
      { method: "POST" },
    );
    if (url) window.location.href = url;
  } catch {
    toast.error("Couldn’t start checkout. Please try again.");
  } finally {
    loading.value = false;
  }
}

const freeFeatures = [
  "1 ranking video per day",
  "Up to 10 ranked clips",
  "Link import + file upload",
  "9:16 vertical export",
];
const proFeatures = [
  "Unlimited ranking videos",
  "Priority rendering",
  "Longer output retention",
  "Everything in Free",
];
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-16 sm:px-6">
    <div class="text-center">
      <h1 class="text-4xl font-black sm:text-5xl">Simple pricing</h1>
      <p class="mx-auto mt-4 max-w-xl text-muted">
        Start free. Upgrade when you want to post more than one ranking video a
        day.
      </p>
    </div>

    <div class="mt-12 grid gap-6 md:grid-cols-2">
      <!-- Free -->
      <div class="card flex flex-col">
        <h2 class="text-xl font-semibold">Free</h2>
        <p class="mt-2 text-4xl font-black">
          $0<span class="text-base font-normal text-muted">/forever</span>
        </p>
        <ul class="mt-6 flex-1 space-y-3 text-sm">
          <li
            v-for="f in freeFeatures"
            :key="f"
            class="flex items-center gap-2"
          >
            <span class="text-accent">✓</span> {{ f }}
          </li>
        </ul>
        <NuxtLink to="/create" class="btn-outline mt-6">Get started</NuxtLink>
      </div>

      <!-- Pro -->
      <div
        class="card relative flex flex-col border-accent/60 ring-1 ring-accent/40"
      >
        <span
          class="absolute -top-3 right-6 rounded-full bg-accent px-3 py-1 text-xs font-bold"
          >Most popular</span
        >
        <h2 class="text-xl font-semibold">Pro</h2>
        <p class="mt-2 text-4xl font-black">
          ${{ price
          }}<span class="text-base font-normal text-muted">/month</span>
        </p>
        <ul class="mt-6 flex-1 space-y-3 text-sm">
          <li v-for="f in proFeatures" :key="f" class="flex items-center gap-2">
            <span class="text-accent">✓</span> {{ f }}
          </li>
        </ul>
        <button class="btn-primary mt-6" :disabled="loading" @click="subscribe">
          {{ loading ? "Starting checkout…" : "Upgrade to Pro" }}
        </button>
      </div>
    </div>

    <p class="mt-8 text-center text-sm text-muted">
      Cancel anytime from your account. Secure payments by Stripe.
    </p>
  </div>
</template>
