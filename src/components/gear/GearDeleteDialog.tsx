import React, { useEffect, useState } from "react";
import { t } from "../../lib/l10n";
import { useJournal } from "../../store/JournalContext";
import type { GearItem } from "../../types/journal";

interface GearDeleteDialogProps {
  item: GearItem | null;
  onClose: () => void;
  onDeleted?: () => void;
  onError?: (error: string) => void;
}

export const GearDeleteDialog: React.FC<GearDeleteDialogProps> = ({
  item,
  onClose,
  onDeleted,
  onError,
}) => {
  const { isEnglish, getGearReferencedEntryCount, deleteGearItem } =
    useJournal();
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [item, isDeleting, onClose]);

  if (!item) return null;

  const refCount = getGearReferencedEntryCount(item);

  const handleDelete = async (removeFromEntries: boolean) => {
    if (isDeleting) return;
    setIsDeleting(true);
    const res = await deleteGearItem(item, removeFromEntries);
    setIsDeleting(false);
    if (res.ok) {
      onClose();
      onDeleted?.();
    } else if (res.error) {
      onError?.(res.error);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
    >
      <div className="w-full max-w-[440px] rounded-2xl border border-[var(--wsj-border)] bg-[var(--wsj-card)] p-5 shadow-2xl">
        <h3 className="text-[16.5px] font-semibold text-[var(--wsj-text)]">
          {t("确认删除器材？", "Delete Gear?", isEnglish)}
        </h3>

        {refCount === 0 ? (
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-[var(--wsj-text-secondary)]">
            {t(
              `「${item.name}」当前关联了 0 篇日记，确认后将从器材库彻底移除。`,
              `"${item.name}" is linked to 0 journal entries and will be permanently removed from your gear library.`,
              isEnglish
            )}
          </p>
        ) : (
          <div className="mt-2.5 space-y-2 text-[13px] leading-relaxed text-[var(--wsj-text-secondary)]">
            <p>
              {t(
                `「${item.name}」当前关联了 ${refCount} 篇日记：`,
                `"${item.name}" is linked to ${refCount} journal entries:`,
                isEnglish
              )}
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[12.5px]">
              <li>
                {t(
                  "仅移除档案规则：清除自定义分类、参数与合并规则，保留日记原文。",
                  "Remove Profile Rules Only: clears custom specs & merge rules while keeping journal entries intact.",
                  isEnglish
                )}
              </li>
              <li>
                {t(
                  `彻底删除：同步从这 ${refCount} 篇日记中移除该器材字段（保留其余字段，并先自动备份 journal.json）。`,
                  `Delete Completely: also removes this gear field from those ${refCount} entries (other fields stay intact; journal.json is backed up first).`,
                  isEnglish
                )}
              </li>
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] transition hover:opacity-85 disabled:opacity-45"
          >
            {t("取消", "Cancel", isEnglish)}
          </button>

          {refCount === 0 ? (
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => void handleDelete(false)}
              className="rounded-lg bg-[#CC3D3D] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
            >
              {t("删除器材", "Delete Gear", isEnglish)}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDelete(false)}
                className="rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
              >
                {t("仅移除档案规则", "Rules Only", isEnglish)}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDelete(true)}
                className="rounded-lg bg-[#CC3D3D] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
              >
                {t("彻底删除（含日记）", "Delete Completely", isEnglish)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
