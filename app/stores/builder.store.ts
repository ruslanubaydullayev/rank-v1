import { defineStore } from "pinia";

export type SourceType = "link" | "upload";
export type ItemStatus = "pending" | "uploading" | "ready" | "error";

export interface RankingItem {
  uid: string; // client-side id (for drag keys)
  clipId: string | null; // server staged clip id once uploaded/imported
  sourceType: SourceType;
  label: string;
  platform?: "instagram" | "tiktok" | null;
  sourceUrl?: string;
  filename?: string;
  durationSeconds?: number | null;
  previewUrl?: string; // local object URL for client preview
  status: ItemStatus;
  error?: string;
}

let counter = 0;
const uid = () => `item-${Date.now()}-${counter++}`;

export const useBuilderStore = defineStore("builder", {
  state: () => ({
    step: 1 as 1 | 2 | 3 | 4,
    title: "",
    items: [] as RankingItem[],
    jobId: null as string | null,
    resultUrl: null as string | null,
  }),
  getters: {
    totalSteps: () => 4,
    readyItems: (state) => state.items.filter((i) => i.status === "ready"),
    canProceedFromList(): boolean {
      return (
        this.readyItems.length >= 2 &&
        this.readyItems.every((i) => i.label.trim().length > 0)
      );
    },
    canGenerate(): boolean {
      return this.canProceedFromList && this.title.trim().length > 0;
    },
  },
  actions: {
    addItem(partial: Partial<RankingItem> & { sourceType: SourceType }) {
      const item: RankingItem = {
        uid: uid(),
        clipId: null,
        label: "",
        status: "pending",
        ...partial,
      };
      this.items.push(item);
      return item;
    },
    updateItem(uidValue: string, patch: Partial<RankingItem>) {
      const idx = this.items.findIndex((i) => i.uid === uidValue);
      if (idx !== -1) this.items[idx] = { ...this.items[idx]!, ...patch };
    },
    removeItem(uidValue: string) {
      const item = this.items.find((i) => i.uid === uidValue);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      this.items = this.items.filter((i) => i.uid !== uidValue);
    },
    setStep(step: 1 | 2 | 3 | 4) {
      this.step = step;
    },
    reset() {
      this.items.forEach(
        (i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl),
      );
      this.step = 1;
      this.title = "";
      this.items = [];
      this.jobId = null;
      this.resultUrl = null;
    },
  },
});
