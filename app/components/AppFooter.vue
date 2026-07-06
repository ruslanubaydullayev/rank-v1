<script setup lang="ts">
const year = new Date().getFullYear();
</script>

<template>
  <footer class="mt-24 border-t border-border">
    <div
      class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between"
    >
      <div class="flex items-center gap-2">
        <span
          class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-black text-white"
          >RS</span
        >
        <span class="font-semibold">Ranking Shorts</span>
        <span class="text-sm text-muted"
          >© {{ year }}. All rights reserved.</span
        >
      </div>
      <nav class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
        <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
        <NuxtLink to="/pricing" class="hover:text-white">Pricing</NuxtLink>
        <NuxtLink to="/blog" class="hover:text-white">Blog</NuxtLink>
        <NuxtLink to="/create" class="hover:text-white">Create</NuxtLink>
        <a href="/terms" class="hover:text-white">Terms</a>
        <a href="/privacy" class="hover:text-white">Privacy</a>
      </nav>
    </div>
  </footer>
</template>
