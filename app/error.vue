<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();

const is404 = computed(() => props.error?.statusCode === 404);
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center"
  >
    <p class="text-7xl font-black text-accent">
      {{ error.statusCode || 500 }}
    </p>
    <h1 class="text-2xl font-bold">
      {{ is404 ? "Page not found" : "Something went wrong" }}
    </h1>
    <p class="max-w-md text-muted">
      {{
        is404
          ? "The page you’re looking for doesn’t exist or has moved."
          : error.message ?? "An unexpected error occurred."
      }}
    </p>
    <button class="btn-primary" @click="clearError({ redirect: '/' })">
      Back to home
    </button>
  </div>
</template>
