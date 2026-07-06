<script setup lang="ts">
import { posts } from "~/data/blog";

const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl;

useSeoMeta({
  title: "Blog — Ranking Shorts",
  description:
    "Guides and tips on making ranking videos from TikTok and Instagram clips.",
  ogTitle: "Ranking Shorts Blog",
  ogDescription: "How-tos and tips for making ranking videos.",
  ogType: "website",
  ogUrl: `${siteUrl}/blog`,
  twitterCard: "summary_large_image",
});

useHead({ link: [{ rel: "canonical", href: `${siteUrl}/blog` }] });

const sorted = [...posts].sort(
  (a, b) => +new Date(b.datePublished) - +new Date(a.datePublished),
);
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-14 sm:px-6">
    <h1 class="text-4xl font-black">Blog</h1>
    <p class="mt-3 text-muted">Guides and tips for making ranking videos.</p>

    <div class="mt-10 space-y-4">
      <NuxtLink
        v-for="post in sorted"
        :key="post.slug"
        :to="`/blog/${post.slug}`"
        class="block rounded-2xl border border-border bg-surface p-6 transition hover:border-accent/50"
      >
        <p class="text-xs text-muted">
          {{ new Date(post.datePublished).toLocaleDateString() }} ·
          {{ post.readingMinutes }} min read
        </p>
        <h2 class="mt-2 text-xl font-bold">{{ post.title }}</h2>
        <p class="mt-2 text-muted">{{ post.description }}</p>
      </NuxtLink>
    </div>
  </div>
</template>
