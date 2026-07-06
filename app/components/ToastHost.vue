<script setup lang="ts">
const { toasts, dismiss } = useToast();

const styles: Record<string, string> = {
  info: "border-border bg-surface-2",
  success: "border-emerald-600/50 bg-emerald-950/40",
  error: "border-red-600/50 bg-red-950/40",
};
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
  >
    <TransitionGroup name="fade-slide">
      <div
        v-for="t in toasts"
        :key="t.id"
        :class="styles[t.kind]"
        class="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg shadow-black/40 backdrop-blur"
        role="status"
      >
        <span class="mt-0.5 shrink-0">
          <span v-if="t.kind === 'success'" aria-hidden>✓</span>
          <span v-else-if="t.kind === 'error'" aria-hidden>⚠</span>
          <span v-else aria-hidden>ℹ</span>
        </span>
        <p class="flex-1 leading-snug text-white">{{ t.message }}</p>
        <button
          class="shrink-0 text-muted transition hover:text-white"
          aria-label="Dismiss"
          @click="dismiss(t.id)"
        >
          ✕
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
