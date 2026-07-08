<script setup lang="ts">
import type { RankingItem } from "~/stores/builder.store";

const props = defineProps<{
  title: string;
  items: RankingItem[];
}>();

// Countdown preview mirroring the burned-in render: the numbered list is always
// visible; clips play highest-rank-first, and each row's label is revealed once
// its clip has played (and stays). `current` indexes into the countdown order.
const current = ref(0);
const videoEl = ref<HTMLVideoElement | null>(null);
const playing = ref(false);
const PLACEHOLDER_MS = 3000;
let placeholderTimer: ReturnType<typeof setTimeout> | null = null;

// Playback order: last item (highest rank / bottom of the list) plays first.
const order = computed(() => props.items.map((_, i) => i).reverse());
const activeIndex = computed(() => order.value[current.value] ?? 0);
const active = computed(() => props.items[activeIndex.value] ?? null);
// 1-based rank currently on screen (counts down from N to 1).
const currentRank = computed(() => activeIndex.value + 1);

// A row (1-based rank) is revealed once its clip has played in the countdown.
function isRevealed(rank: number): boolean {
  return playing.value && rank >= currentRank.value;
}

// Vibrant per-rank palette (mirrors the server render in render.ts).
const PALETTE = [
  "#ffe14d",
  "#ff3b5c",
  "#37d5ff",
  "#6cff59",
  "#ff8a1f",
  "#b98dff",
  "#ffffff",
  "#ff4fd8",
  "#59b0ff",
  "#ffd23f",
];
const colorForRank = (rank: number) => PALETTE[(rank - 1) % PALETTE.length];

const titleWords = computed(() => props.title.split(/\s+/).filter(Boolean));

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
        class="h-full w-full object-cover"
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

      <!-- Black title band: bold, multi-colored words -->
      <div
        v-if="title"
        class="absolute inset-x-0 top-0 flex flex-wrap items-center justify-center gap-x-1 bg-black px-2 py-1.5"
      >
        <span
          v-for="(word, i) in titleWords"
          :key="i"
          class="text-[12px] font-black leading-tight [text-shadow:1px_1px_2px_rgb(0_0_0)]"
          :style="{ color: PALETTE[i % PALETTE.length] }"
          >{{ word }}</span
        >
      </div>

      <!-- Ranks burned onto the video: a centered block, big colored numbers
           with smaller white labels -->
      <div
        class="pointer-events-none absolute inset-x-0 bottom-3 top-12 flex flex-col justify-center gap-4 px-2.5"
      >
        <div
          v-for="(item, idx) in items"
          :key="item.uid"
          class="flex items-baseline gap-2 truncate"
        >
          <span
            class="text-4xl font-black leading-none [-webkit-text-stroke:1px_black] [text-shadow:1px_1px_2px_rgb(0_0_0)]"
            :style="{ color: colorForRank(idx + 1) }"
            >{{ idx + 1 }}.</span
          >
          <span
            v-if="isRevealed(idx + 1) && item.label"
            class="truncate text-4xl font-black text-white [text-shadow:1px_1px_2px_rgb(0_0_0)]"
            >{{ item.label }}</span
          >
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <button v-if="!playing" class="btn-primary" @click="play">
        ▶ Preview
      </button>
      <button v-else class="btn-outline" @click="stop">■ Stop</button>
      <span v-if="playing" class="text-sm text-muted"
        >Revealing #{{ currentRank }} ({{ current + 1 }} /
        {{ items.length }})</span
      >
    </div>
  </div>
</template>
