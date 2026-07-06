<script setup lang="ts">
const siteUrl = useRuntimeConfig().public.siteUrl;
useSeoMeta({
  title: "Terms of Service — Ranking Shorts",
  description: "The terms governing your use of Ranking Shorts.",
});
useHead({ link: [{ rel: "canonical", href: `${siteUrl}/terms` }] });
</script>

<template>
  <div class="prose-invert mx-auto max-w-2xl px-4 py-14 sm:px-6">
    <h1 class="text-3xl font-black">Terms of Service</h1>
    <p class="mt-4 text-muted">
      By using Ranking Shorts you agree to these terms. This is placeholder
      content for the MVP — replace with reviewed legal copy before launch.
    </p>
    <h2 class="mt-8 text-xl font-bold">Content ownership &amp; rights</h2>
    <p class="mt-2 text-muted">
      You are solely responsible for the clips you import or upload. You confirm
      that you own or have the rights to use any content you submit, and that
      your use complies with the terms of the platforms the content came from.
      Do not upload content you don’t have permission to use.
    </p>
    <h2 class="mt-8 text-xl font-bold">Acceptable use</h2>
    <p class="mt-2 text-muted">
      Don’t use the service for unlawful, infringing, or abusive content. We may
      remove content or suspend accounts that violate these terms.
    </p>
    <h2 class="mt-8 text-xl font-bold">Billing</h2>
    <p class="mt-2 text-muted">
      Paid plans renew monthly until cancelled. You can manage or cancel your
      subscription anytime from your account.
    </p>
  </div>
</template>
