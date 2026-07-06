<script setup lang="ts">
import { getPost } from "~/data/blog";

const route = useRoute();
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl;
const slug = computed(() => route.params.slug as string);

const post = computed(() => getPost(slug.value));

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: "Post not found" });
}

const url = computed(() => `${siteUrl}/blog/${slug.value}`);

useSeoMeta({
  title: () => post.value!.title,
  description: () => post.value!.description,
  ogTitle: () => post.value!.title,
  ogDescription: () => post.value!.description,
  ogType: "article",
  ogUrl: () => url.value,
  ogImage: `${siteUrl}/og/home.png`,
  twitterCard: "summary_large_image",
  articlePublishedTime: () => post.value!.datePublished,
});

useHead({ link: [{ rel: "canonical", href: url.value }] });

// Article schema (spec §8.3).
useSchemaOrg([
  defineArticle({
    headline: post.value.title,
    description: post.value.description,
    datePublished: post.value.datePublished,
    author: { "@type": "Organization", name: post.value.author },
    image: `${siteUrl}/og/home.png`,
  }),
]);
</script>

<template>
  <article v-if="post" class="mx-auto max-w-2xl px-4 py-14 sm:px-6">
    <NuxtLink to="/blog" class="text-sm text-muted hover:text-white"
      >← All posts</NuxtLink
    >
    <h1 class="mt-4 text-4xl font-black leading-tight">{{ post.title }}</h1>
    <p class="mt-3 text-sm text-muted">
      {{ new Date(post.datePublished).toLocaleDateString() }} ·
      {{ post.author }} · {{ post.readingMinutes }} min read
    </p>
    <!-- Seed content is trusted, first-party HTML. -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="blog-body mt-8" v-html="post.body" />

    <div
      class="mt-12 rounded-2xl border border-border bg-surface p-6 text-center"
    >
      <p class="font-semibold">Ready to make your own ranking video?</p>
      <NuxtLink to="/create" class="btn-primary mt-4">Start creating</NuxtLink>
    </div>
  </article>
</template>

<style scoped>
.blog-body :deep(h2) {
  font-size: 1.35rem;
  font-weight: 700;
  margin-top: 1.75rem;
  margin-bottom: 0.5rem;
}
.blog-body :deep(p) {
  color: var(--color-muted);
  line-height: 1.7;
  margin-bottom: 1rem;
}
.blog-body :deep(a) {
  color: var(--color-accent);
  text-decoration: underline;
}
</style>
