<script setup lang="ts">
import {
  useSortable,
  moveArrayElement,
} from "@vueuse/integrations/useSortable";

import { useBuilderStore } from "~/stores/builder.store";

const store = useBuilderStore();
const toast = useToast();
const config = useRuntimeConfig();
const maxItems = config.public.maxRankingItems;
const maxMb = config.public.maxUploadMb;
const maxDuration = config.public.maxClipDurationSeconds;

const mode = ref<"link" | "upload">("link");
const linkUrl = ref("");
const newLabel = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
const busy = ref(false);

const listEl = ref<HTMLElement | null>(null);
// Drag-and-drop reordering — rank order is meaningful.
useSortable(listEl, store.items, {
  handle: ".drag-handle",
  animation: 150,
  onUpdate: (e: { oldIndex: number; newIndex: number }) => {
    moveArrayElement(store.items, e.oldIndex, e.newIndex);
  },
});

const atLimit = computed(() => store.items.length >= maxItems);

function detectPlatform(raw: string): "instagram" | "tiktok" | null {
  try {
    const u = new URL(raw);
    if (/(^|\.)instagram\.com$/i.test(u.hostname)) return "instagram";
    if (/(^|\.)(tiktok\.com|vm\.tiktok\.com)$/i.test(u.hostname))
      return "tiktok";
    return null;
  } catch {
    return null;
  }
}

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(el.src);
      resolve(Number.isFinite(el.duration) ? el.duration : null);
    };
    el.onerror = () => resolve(null);
    el.src = URL.createObjectURL(file);
  });
}

async function addLink() {
  if (atLimit.value) return toast.error(`Max ${maxItems} clips.`);
  const url = linkUrl.value.trim();
  const platform = detectPlatform(url);
  if (!platform) {
    return toast.error("Enter a valid Instagram or TikTok link.");
  }

  const item = store.addItem({
    sourceType: "link",
    label: newLabel.value.trim(),
    sourceUrl: url,
    platform,
    status: "uploading",
  });
  linkUrl.value = "";
  newLabel.value = "";
  busy.value = true;

  try {
    const res = await $fetch<{
      clipId: string;
      platform: string;
      durationSeconds: number | null;
    }>("/api/clips/import", {
      method: "POST",
      body: { url, platform },
    });
    store.updateItem(item.uid, {
      clipId: res.clipId,
      durationSeconds: res.durationSeconds,
      status: "ready",
    });
  } catch (err) {
    const message =
      (err as { statusMessage?: string })?.statusMessage ??
      "Couldn’t fetch this link.";
    store.updateItem(item.uid, { status: "error", error: message });
    toast.error(message);
  } finally {
    busy.value = false;
  }
}

async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (atLimit.value) return toast.error(`Max ${maxItems} clips.`);

  if (!file.type.startsWith("video/")) {
    return toast.error("Please choose a video file.");
  }
  if (file.size > maxMb * 1024 * 1024) {
    return toast.error(`File too large (max ${maxMb}MB).`);
  }
  const duration = await readDuration(file);
  if (duration && duration > maxDuration) {
    return toast.error(`Clip too long (max ${maxDuration}s).`);
  }

  const item = store.addItem({
    sourceType: "upload",
    label: newLabel.value.trim() || file.name.replace(/\.[^.]+$/, ""),
    filename: file.name,
    durationSeconds: duration,
    previewUrl: URL.createObjectURL(file),
    status: "uploading",
  });
  newLabel.value = "";
  busy.value = true;

  try {
    const form = new FormData();
    form.append("file", file);
    const res = await $fetch<{ clipId: string }>("/api/clips/upload", {
      method: "POST",
      body: form,
    });
    store.updateItem(item.uid, { clipId: res.clipId, status: "ready" });
  } catch (err) {
    const message =
      (err as { statusMessage?: string })?.statusMessage ?? "Upload failed.";
    store.updateItem(item.uid, { status: "error", error: message });
    toast.error(message);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <!-- Add clip -->
    <div class="card">
      <div class="mb-4 inline-flex rounded-full bg-surface-2 p-1">
        <button
          class="rounded-full px-4 py-1.5 text-sm font-medium transition"
          :class="mode === 'link' ? 'bg-accent text-white' : 'text-muted'"
          @click="mode = 'link'"
        >
          Paste link
        </button>
        <button
          class="rounded-full px-4 py-1.5 text-sm font-medium transition"
          :class="mode === 'upload' ? 'bg-accent text-white' : 'text-muted'"
          @click="mode = 'upload'"
        >
          Upload file
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label class="label">Clip label</label>
          <input
            v-model="newLabel"
            class="input"
            placeholder="e.g. The substitute teacher"
            maxlength="30"
          />
        </div>

        <template v-if="mode === 'link'">
          <div>
            <label class="label">Instagram or TikTok link</label>
            <div class="flex gap-2">
              <input
                v-model="linkUrl"
                class="input"
                placeholder="https://www.tiktok.com/@user/video/…"
                @keyup.enter="addLink"
              />
              <button
                class="btn-primary shrink-0"
                :disabled="busy || atLimit"
                @click="addLink"
              >
                Add
              </button>
            </div>
          </div>
        </template>

        <template v-else>
          <div>
            <label class="label"
              >Video file (max {{ maxMb }}MB, {{ maxDuration }}s)</label
            >
            <input
              ref="fileInput"
              type="file"
              accept="video/*"
              class="hidden"
              @change="onFilePicked"
            />
            <button
              class="btn-outline w-full"
              :disabled="busy || atLimit"
              @click="fileInput?.click()"
            >
              Choose a video…
            </button>
          </div>
        </template>

        <p v-if="atLimit" class="text-sm text-amber-400">
          You’ve reached the max of {{ maxItems }} clips.
        </p>
      </div>
    </div>

    <!-- List -->
    <div class="mt-6">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">Your ranking ({{ store.items.length }})</h3>
        <span class="text-sm text-muted">Drag to reorder</span>
      </div>

      <p
        v-if="!store.items.length"
        class="rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted"
      >
        No clips yet. Add at least 2 to build a ranking.
      </p>

      <ul ref="listEl" class="space-y-2">
        <li
          v-for="(item, index) in store.items"
          :key="item.uid"
          class="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
        >
          <button
            class="drag-handle cursor-grab px-1 text-muted active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            ⠿
          </button>
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-accent text-sm font-black"
            >{{ index + 1 }}</span
          >

          <!-- Thumbnail / source icon -->
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 text-lg"
          >
            <video
              v-if="item.previewUrl"
              :src="item.previewUrl"
              class="h-full w-full object-cover"
              muted
            />
            <span v-else-if="item.platform === 'tiktok'" title="TikTok"
              >🎵</span
            >
            <span v-else-if="item.platform === 'instagram'" title="Instagram"
              >📸</span
            >
            <span v-else title="Upload">🎬</span>
          </div>

          <div class="min-w-0 flex-1">
            <input
              :value="item.label"
              class="w-full rounded-md bg-transparent text-sm font-medium outline-none focus:bg-surface-2 focus:px-2 focus:py-1"
              placeholder="Add a label…"
              maxlength="30"
              @input="
                store.updateItem(item.uid, {
                  label: ($event.target as HTMLInputElement).value,
                })
              "
            />
            <p class="truncate text-xs text-muted">
              <span v-if="item.status === 'uploading'">Processing…</span>
              <span v-else-if="item.status === 'error'" class="text-red-400">{{
                item.error
              }}</span>
              <span v-else>{{ item.filename || item.sourceUrl }}</span>
            </p>
          </div>

          <span
            v-if="item.status === 'uploading'"
            class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-muted border-t-transparent"
          />
          <span
            v-else-if="item.status === 'ready'"
            class="shrink-0 text-emerald-400"
            >✓</span
          >

          <button
            class="shrink-0 px-2 text-muted transition hover:text-red-400"
            aria-label="Remove"
            @click="store.removeItem(item.uid)"
          >
            ✕
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
