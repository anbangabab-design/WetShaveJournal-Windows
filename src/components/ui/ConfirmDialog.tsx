import React, { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-[380px] rounded-2xl border border-[var(--wsj-border)] bg-[var(--wsj-card)] p-5 shadow-2xl">
        <h3 className="text-[16px] font-semibold text-[var(--wsj-text)]">
          {title}
        </h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--wsj-text-secondary)]">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] transition hover:opacity-85"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90 ${
              destructive
                ? "bg-[#CC3D3D]"
                : "bg-[var(--wsj-accent)]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
