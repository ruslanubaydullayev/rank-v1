export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

/**
 * Tiny global toast store. Used for inline/transient error + success feedback
 * (invalid links, unsupported files, failed downloads, etc.).
 */
export function useToast() {
  const toasts = useState<Toast[]>("toasts", () => []);

  function push(message: string, kind: ToastKind = "info", timeout = 4500) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    toasts.value.push({ id, kind, message });
    if (timeout > 0) {
      setTimeout(() => dismiss(id), timeout);
    }
    return id;
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts,
    dismiss,
    info: (m: string) => push(m, "info"),
    success: (m: string) => push(m, "success"),
    error: (m: string) => push(m, "error"),
  };
}
