<script setup lang="ts">
// Site-wide SEO defaults; per-page meta overrides these.
useHead({
  titleTemplate: (t) => (t ? `${t} · Ranking Shorts` : "Ranking Shorts"),
  htmlAttrs: { lang: "en" },
});
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage :transition="{ name: 'page', mode: 'out-in' }" />
    </NuxtLayout>
  </div>
</template>
