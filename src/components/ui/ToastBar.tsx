import React from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import type { ToastState } from "../../types/journal";

interface ToastBarProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

export const ToastBar: React.FC<ToastBarProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-[var(--wsj-border)] bg-[var(--wsj-card)]/95 px-4 py-2.5 shadow-lg backdrop-blur-md">
        {toast.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--wsj-accent)]" />
        ) : toast.isError ? (
          <AlertTriangle className="h-4 w-4 text-[#CC3D3D]" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-[#2E8F5C]" />
        )}
        <span className="max-w-[440px] truncate text-[13px] font-medium text-[var(--wsj-text)]">
          {toast.message}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-0.5 rounded-full p-1 text-[var(--wsj-text-secondary)] transition hover:bg-[var(--wsj-subtle)] hover:text-[var(--wsj-text)]"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
