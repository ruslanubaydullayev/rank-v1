<script setup lang="ts">
definePageMeta({ middleware: "auth" });

useSeoMeta({
  title: "Your account — Ranking Shorts",
  robots: "noindex, nofollow",
});

const { user } = useUserSession();
const toast = useToast();
const portalLoading = ref(false);

interface Job {
  id: string;
  title: string;
  status: "queued" | "processing" | "done" | "failed";
  createdAt: string;
  completedAt: string | null;
}

const { data: usage } = await useFetch("/api/usage/status");
const { data: sub } = await useFetch("/api/billing/subscription");
const { data: videos, refresh: refreshVideos } = await useFetch<{
  jobs: Job[];
}>("/api/videos");

async function openPortal() {
  portalLoading.value = true;
  try {
    const { url } = await $fetch<{ url: string }>("/api/billing/portal");
    if (url) window.location.href = url;
  } catch {
    toast.error("Couldn’t open the billing portal.");
  } finally {
    portalLoading.value = false;
  }
}

async function download(jobId: string) {
  try {
    const { url } = await $fetch<{ url: string }>(
      `/api/render/${jobId}/download`,
    );
    window.open(url, "_blank");
  } catch {
    toast.error("Download isn’t ready yet.");
  }
}

const statusColor: Record<string, string> = {
  done: "text-emerald-400",
  processing: "text-amber-400",
  queued: "text-muted",
  failed: "text-red-400",
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString() : "—";
}

onMounted(() => {
  // A render may have finished since the page was rendered.
  refreshVideos();
});
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6">
    <div class="flex items-center gap-4">
      <img
        v-if="user?.avatarUrl"
        :src="user.avatarUrl"
        alt=""
        class="h-14 w-14 rounded-full"
        referrerpolicy="no-referrer"
      />
      <div>
        <h1 class="text-2xl font-bold">{{ user?.name || "Your account" }}</h1>
        <p class="text-muted">{{ user?.email }}</p>
      </div>
    </div>

    <!-- Subscription + usage -->
    <div class="mt-8 grid gap-6 md:grid-cols-2">
      <div class="card">
        <h2 class="text-lg font-semibold">Plan</h2>
        <p class="mt-2 text-2xl font-black">
          {{ sub?.active ? "Pro" : "Free" }}
        </p>
        <p class="mt-1 text-sm text-muted">
          <template v-if="sub?.active">
            Renews {{ fmt(sub.currentPeriodEnd) }}
          </template>
          <template v-else> 1 render per day included </template>
        </p>
        <div class="mt-4">
          <button
            v-if="sub?.active"
            class="btn-outline"
            :disabled="portalLoading"
            @click="openPortal"
          >
            {{ portalLoading ? "Opening…" : "Manage subscription" }}
          </button>
          <NuxtLink v-else to="/pricing" class="btn-primary"
            >Upgrade to Pro</NuxtLink
          >
        </div>
      </div>

      <div class="card">
        <h2 class="text-lg font-semibold">Today’s usage</h2>
        <p class="mt-2 text-2xl font-black">
          <template v-if="usage?.isSubscribed">Unlimited</template>
          <template v-else
            >{{ usage?.used ?? 0 }} / {{ usage?.limit }}</template
          >
        </p>
        <p class="mt-1 text-sm text-muted">
          <template v-if="usage?.canCreate"
            >You can create a video now.</template
          >
          <template v-else-if="usage?.resetAt">
            Resets {{ fmt(usage.resetAt) }}
          </template>
        </p>
        <NuxtLink to="/create" class="btn-ghost mt-4">Create a video</NuxtLink>
      </div>
    </div>

    <!-- History -->
    <div class="mt-10">
      <h2 class="text-lg font-semibold">Your videos</h2>
      <div
        v-if="videos?.jobs?.length"
        class="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border"
      >
        <div
          v-for="job in videos.jobs"
          :key="job.id"
          class="flex items-center justify-between gap-4 bg-surface px-5 py-4"
        >
          <div class="min-w-0">
            <p class="truncate font-medium">{{ job.title }}</p>
            <p class="text-xs text-muted">{{ fmt(job.createdAt) }}</p>
          </div>
          <div class="flex items-center gap-3">
            <span
              class="text-sm font-semibold capitalize"
              :class="statusColor[job.status]"
              >{{ job.status }}</span
            >
            <button
              v-if="job.status === 'done'"
              class="btn-outline"
              @click="download(job.id)"
            >
              Download
            </button>
          </div>
        </div>
      </div>
      <p v-else class="mt-4 text-muted">No videos yet.</p>
    </div>
  </div>
</template>
