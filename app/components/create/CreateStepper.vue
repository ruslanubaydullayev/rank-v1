<script setup lang="ts">
const props = defineProps<{ step: number; total: number }>();

const labels = ["Clips", "Title", "Review", "Result"];
const pct = computed(() => ((props.step - 1) / (props.total - 1)) * 100);
</script>

<template>
  <div class="mb-8">
    <div class="mb-2 flex items-center justify-between text-sm">
      <span class="font-semibold">Step {{ step }} of {{ total }}</span>
      <span class="text-muted">{{ labels[step - 1] }}</span>
    </div>
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        class="h-full rounded-full bg-accent transition-all duration-500"
        :style="{ width: `${pct}%` }"
      />
    </div>
    <div class="mt-3 flex justify-between">
      <div
        v-for="(l, i) in labels"
        :key="l"
        class="flex flex-col items-center gap-1"
      >
        <span
          class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition"
          :class="
            step >= i + 1 ? 'bg-accent text-white' : 'bg-surface-2 text-muted'
          "
          >{{ i + 1 }}</span
        >
        <span
          class="hidden text-xs sm:block"
          :class="step >= i + 1 ? 'text-white' : 'text-muted'"
          >{{ l }}</span
        >
      </div>
    </div>
  </div>
</template>
