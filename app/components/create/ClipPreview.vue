<script setup lang="ts">
import type { RankingItem } from "~/stores/builder.store";

const props = defineProps<{
  title: string;
  items: RankingItem[];
}>();

// Sequentially preview clips. The per-clip label + rank badge are only shown
// while that clip is the active one — mirroring the final burned-in render.
const current = ref(0);
const videoEl = ref<HTMLVideoElement | null>(null);
const playing = ref(false);
const PLACEHOLDER_MS = 3000;
let placeholderTimer: ReturnType<typeof setTimeout> | null = null;

const active = computed(() => props.items[current.value] ?? null);

function clearTimer() {
  if (placeholderTimer) {
    clearTimeout(placeholderTimer);
    placeholderTimer = null;
  }
}

function next() {
  clearTimer();
  if (current.value < props.items.length - 1) {
    current.value += 1;
    startCurrent();
  } else {
    playing.value = false;
    current.value = 0;
  }
}

async function startCurrent() {
  await nextTick();
  const item = active.value;
  if (!item) return;
  if (item.previewUrl && videoEl.value) {
    try {
      videoEl.value.currentTime = 0;
      await videoEl.value.play();
    } catch {
      // Autoplay can be blocked; fall back to a timed placeholder step.
      placeholderTimer = setTimeout(next, PLACEHOLDER_MS);
    }
  } else {
    // No local file (e.g. imported link) → show a timed placeholder.
    placeholderTimer = setTimeout(next, PLACEHOLDER_MS);
  }
}

function play() {
  playing.value = true;
  current.value = 0;
  startCurrent();
}

function stop() {
  clearTimer();
  playing.value = false;
  videoEl.value?.pause();
  current.value = 0;
}

onBeforeUnmount(clearTimer);
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div
      class="relative aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-2xl border border-border bg-black"
    >
      <!-- Video (uploads) -->
      <video
        v-if="active?.previewUrl"
        ref="videoEl"
        :src="active.previewUrl"
        class="h-full w-full object-contain"
        muted
        playsinline
        @ended="next"
      />
      <!-- Placeholder (link imports / not started) -->
      <div
        v-else
        class="flex h-full w-full items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-900 text-center text-sm text-muted"
      >
        {{ active ? "Preview on server render" : "Press play to preview" }}
      </div>

      <!-- Overall title (always visible) -->
      <div
        v-if="title"
        class="absolute inset-x-2 top-2 truncate rounded-md bg-accent/90 px-2 py-1 text-center text-xs font-bold"
      >
        {{ title }}
      </div>

      <!-- Rank badge — only for the active clip -->
      <span
        v-if="active && playing"
        class="absolute left-3 top-12 flex h-11 w-11 items-center justify-center rounded-lg border-2 border-accent bg-black/40 text-2xl font-black"
        >{{ current + 1 }}</span
      >

      <!-- Per-clip label — only while its clip is active -->
      <div
        v-if="active && playing && active.label"
        class="absolute bottom-6 left-1/2 max-w-[90%] -translate-x-1/2 truncate rounded bg-black/60 px-3 py-1 text-center text-sm font-semibold"
      >
        {{ active.label }}
      </div>
    </div>

    <div class="flex items-center gap-3">
      <button v-if="!playing" class="btn-primary" @click="play">
        ▶ Preview
      </button>
      <button v-else class="btn-outline" @click="stop">■ Stop</button>
      <span v-if="playing" class="text-sm text-muted"
        >Clip {{ current + 1 }} / {{ items.length }}</span
      >
    </div>
  </div>
</template>
