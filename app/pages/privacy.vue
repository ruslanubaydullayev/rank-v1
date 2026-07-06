<script setup lang="ts">
const siteUrl = useRuntimeConfig().public.siteUrl;
useSeoMeta({
  title: "Privacy Policy — Ranking Shorts",
  description: "How Ranking Shorts handles your data.",
});
useHead({ link: [{ rel: "canonical", href: `${siteUrl}/privacy` }] });
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-14 sm:px-6">
    <h1 class="text-3xl font-black">Privacy Policy</h1>
    <p class="mt-4 text-muted">
      Placeholder privacy content for the MVP — replace with reviewed copy
      before launch.
    </p>
    <h2 class="mt-8 text-xl font-bold">What we store</h2>
    <p class="mt-2 text-muted">
      We store your account details (from Google sign-in), your subscription
      status, and the videos you create. Source clips are deleted shortly after
      your video is rendered; finished videos are retained for a limited time so
      you can re-download them.
    </p>
    <h2 class="mt-8 text-xl font-bold">Third parties</h2>
    <p class="mt-2 text-muted">
      We use Google for sign-in and Stripe for payments. We don’t sell your
      data.
    </p>
  </div>
</template>
