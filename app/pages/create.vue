<script setup lang="ts">
import { useBuilderStore } from "~/stores/builder.store";

definePageMeta({ layout: "default" });
useSeoMeta({
  title: "Create a ranking video",
  robots: "noindex, nofollow",
});

const store = useBuilderStore();
const toast = useToast();
const router = useRouter();
const { loggedIn } = useUserSession();

// --- Auth & limit gating (spec §5). Re-checked server-side on submit. ---
const { data: usage, refresh: refreshUsage } =
  await useFetch("/api/usage/status");

const gate = computed(() => usage.value?.reason ?? "ok");
const guestLimitReached = computed(
  () => gate.value === "limit_reached" && !usage.value?.isAuthenticated,
);
const paidUpsell = computed(
  () =>
    gate.value === "limit_reached" &&
    usage.value?.isAuthenticated &&
    !usage.value?.isSubscribed,
);
const subscribing = ref(false);

async function upgrade() {
  if (!loggedIn.value) return router.push("/login?redirect=/create");
  subscribing.value = true;
  try {
    const { url } = await $fetch<{ url: string }>(
      "/api/billing/create-checkout-session",
      { method: "POST" },
    );
    if (url) window.location.href = url;
  } catch {
    toast.error("Couldn’t start checkout.");
  } finally {
    subscribing.value = false;
  }
}

// --- Render + polling ---
const phase = ref<"idle" | "processing" | "done" | "failed">("idle");
const renderError = ref<string | null>(null);
let poll: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
  if (poll) {
    clearInterval(poll);
    poll = null;
  }
}

async function generate() {
  if (!store.canGenerate) return;

  const payload = {
    title: store.title.trim(),
    items: store.readyItems.map((i, idx) => ({
      clipId: i.clipId as string,
      label: i.label.trim(),
      order: idx,
    })),
  };

  store.setStep(4);
  phase.value = "processing";
  renderError.value = null;

  try {
    const { jobId } = await $fetch<{ jobId: string }>("/api/render", {
      method: "POST",
      body: payload,
    });
    store.jobId = jobId;
    startPolling(jobId);
  } catch (err) {
    const e = err as { statusCode?: number; statusMessage?: string };
    phase.value = "failed";
    renderError.value = e.statusMessage ?? "Couldn’t start the render.";
    if (e.statusCode === 403) {
      await refreshUsage();
      store.setStep(3);
      phase.value = "idle";
      toast.error(renderError.value);
    }
  }
}

function startPolling(jobId: string) {
  stopPolling();
  poll = setInterval(async () => {
    try {
      const s = await $fetch<{ status: string; error: string | null }>(
        `/api/render/${jobId}/status`,
      );
      if (s.status === "done") {
        stopPolling();
        const { url } = await $fetch<{ url: string }>(
          `/api/render/${jobId}/download`,
        );
        store.resultUrl = url;
        phase.value = "done";
        refreshUsage();
      } else if (s.status === "failed") {
        stopPolling();
        phase.value = "failed";
        renderError.value = s.error ?? "Render failed. You can try again.";
        refreshUsage();
      }
    } catch {
      // transient — keep polling
    }
  }, 2500);
}

function createAnother() {
  stopPolling();
  store.reset();
  phase.value = "idle";
  refreshUsage();
}

onBeforeUnmount(stopPolling);
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-10 sm:px-6">
    <h1 class="mb-6 text-2xl font-bold">Create a ranking video</h1>

    <!-- Free anonymous video hint -->
    <div
      v-if="gate === 'ok' && !usage?.isAuthenticated"
      class="mb-6 rounded-2xl border border-border bg-surface p-4 text-sm text-muted"
    >
      🎁 Your first video is on us — no sign-up needed. Sign in later to save it
      and make more.
    </div>

    <!-- Guest used their free video → prompt sign in -->
    <div
      v-else-if="guestLimitReached"
      class="mb-6 rounded-2xl border border-accent/50 bg-surface p-5"
    >
      <p class="font-semibold">You’ve used your free video</p>
      <p class="mt-1 text-sm text-muted">
        Sign in to save it to your account and create more ranking videos.
      </p>
      <NuxtLink to="/login?redirect=/create" class="btn-primary mt-4"
        >Sign in with Google</NuxtLink
      >
    </div>

    <!-- Signed-in free user hit the daily limit → upsell Pro -->
    <div
      v-else-if="paidUpsell"
      class="mb-6 rounded-2xl border border-accent/50 bg-surface p-5"
    >
      <p class="font-semibold">You’ve used your free video today</p>
      <p class="mt-1 text-sm text-muted">
        Upgrade to Pro for unlimited renders, or come back
        <template v-if="usage?.resetAt">
          {{ new Date(usage.resetAt).toLocaleString() }} </template
        ><template v-else>tomorrow</template>.
      </p>
      <button class="btn-primary mt-4" :disabled="subscribing" @click="upgrade">
        {{ subscribing ? "Starting…" : "Upgrade to Pro — $9/mo" }}
      </button>
    </div>

    <CreateStepper :step="store.step" :total="store.totalSteps" />

    <Transition name="fade-slide" mode="out-in">
      <!-- Step 1: clips -->
      <div v-if="store.step === 1" key="1">
        <ClipListBuilder />
        <div class="mt-6 flex justify-end">
          <button
            class="btn-primary"
            :disabled="!store.canProceedFromList"
            @click="store.setStep(2)"
          >
            Next: title
          </button>
        </div>
        <p
          v-if="!store.canProceedFromList"
          class="mt-2 text-right text-xs text-muted"
        >
          Add at least 2 clips with labels to continue.
        </p>
      </div>

      <!-- Step 2: title -->
      <div v-else-if="store.step === 2" key="2">
        <div class="card">
          <label class="label">Overall video title</label>
          <input
            v-model="store.title"
            class="input"
            maxlength="120"
            placeholder="Ranking The Funniest School Moments"
          />
          <p class="mt-2 text-sm text-muted">
            Shown at the top of your video for the whole duration.
          </p>
        </div>
        <div class="mt-6 flex justify-between">
          <button class="btn-outline" @click="store.setStep(1)">Back</button>
          <button
            class="btn-primary"
            :disabled="!store.title.trim()"
            @click="store.setStep(3)"
          >
            Next: review
          </button>
        </div>
      </div>

      <!-- Step 3: review -->
      <div v-else-if="store.step === 3" key="3">
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="card">
            <h3 class="font-semibold">{{ store.title }}</h3>
            <ol class="mt-4 space-y-2">
              <li
                v-for="(item, i) in store.readyItems"
                :key="item.uid"
                class="flex items-center gap-3 text-sm"
              >
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-accent font-black"
                  >{{ i + 1 }}</span
                >
                <span class="truncate">{{ item.label }}</span>
              </li>
            </ol>
          </div>
          <ClipPreview :title="store.title" :items="store.readyItems" />
        </div>

        <p class="mt-4 text-center text-xs text-muted">
          By generating, you confirm you own or have the rights to use these
          clips. See our
          <NuxtLink to="/terms" class="underline">Terms</NuxtLink>.
        </p>
        <div class="mt-4 flex justify-between">
          <button class="btn-outline" @click="store.setStep(2)">Back</button>
          <button
            class="btn-primary"
            :disabled="!store.canGenerate || gate !== 'ok'"
            @click="generate"
          >
            Generate video
          </button>
        </div>
      </div>

      <!-- Step 4: result -->
      <div v-else key="4">
        <div v-if="phase === 'processing'" class="card text-center">
          <div
            class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-surface-2 border-t-accent"
          />
          <p class="mt-4 font-semibold">Rendering your video…</p>
          <p class="mt-1 text-sm text-muted">
            This usually takes ~30 seconds. Hang tight.
          </p>
          <div class="mt-6 space-y-2">
            <div class="h-3 w-full animate-pulse rounded bg-surface-2" />
            <div class="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
          </div>
        </div>

        <div v-else-if="phase === 'done'" class="card text-center">
          <p class="text-lg font-semibold">Your ranking short is ready 🎉</p>
          <video
            v-if="store.resultUrl"
            :src="store.resultUrl"
            controls
            playsinline
            class="mx-auto mt-4 aspect-[9/16] max-h-[70vh] rounded-xl bg-black"
          />
          <div class="mt-6 flex flex-wrap justify-center gap-3">
            <a
              v-if="store.resultUrl"
              :href="store.resultUrl"
              download="ranking-short.mp4"
              class="btn-primary"
              >Download .mp4</a
            >
            <button class="btn-outline" @click="createAnother">
              Create another
            </button>
          </div>

          <div
            v-if="!loggedIn"
            class="mt-6 rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted"
          >
            Want to keep this video and make more?
            <NuxtLink to="/login?redirect=/create" class="text-accent underline"
              >Sign in</NuxtLink
            >
            — your video comes with you.
          </div>
        </div>

        <div v-else class="card text-center">
          <p class="text-lg font-semibold text-red-400">Render failed</p>
          <p class="mt-2 text-sm text-muted">
            {{ renderError }}
          </p>
          <p class="mt-1 text-xs text-muted">
            Failed renders don’t count against your daily limit.
          </p>
          <div class="mt-6 flex justify-center gap-3">
            <button class="btn-primary" @click="store.setStep(3)">
              Try again
            </button>
            <button class="btn-outline" @click="createAnother">
              Start over
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
