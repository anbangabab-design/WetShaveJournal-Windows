import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, PlusCircle, X } from "lucide-react";
import { isShortGapSpec } from "../../lib/gearKnowledge";
import {
  brandDisplay,
  gearStatusDisplay,
  handleTag,
  t,
} from "../../lib/l10n";
import { useJournal } from "../../store/JournalContext";
import type { GearCategory, GearItem } from "../../types/journal";
import { BrandAvatar } from "../ui/BrandAvatar";
import { TagPill, type TagTone } from "../ui/TagPill";

interface GearAutocompleteFieldProps {
  title: string;
  category: GearCategory;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSelectItem?: (item: GearItem) => void;
}

function statusTone(status: GearItem["status"]): TagTone {
  if (status === "在用" || status === "有") return "forest";
  if (status === "借用") return "slate";
  return "neutral";
}

export const GearAutocompleteField: React.FC<GearAutocompleteFieldProps> = ({
  title,
  category,
  value,
  placeholder,
  onChange,
  onSelectItem,
}) => {
  const {
    getSearchCandidates,
    createQuickGear,
    isEnglish,
    isReadOnlyProtected,
  } = useJournal();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showAllMode, setShowAllMode] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemBrand, setNewItemBrand] = useState("");
  const [quickError, setQuickError] = useState<string | null>(null);
  const [isSavingQuick, setIsSavingQuick] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const candidates = useMemo(() => {
    const query = showAllMode ? "" : value;
    const limit = showAllMode ? 40 : 8;
    return getSearchCandidates(category, query).slice(0, limit);
  }, [category, getSearchCandidates, showAllMode, value]);

  useEffect(() => {
    if (!isDropdownOpen && !showQuickAdd) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
        setShowAllMode(false);
        setShowQuickAdd(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isDropdownOpen, showQuickAdd]);

  const handleSelect = (item: GearItem) => {
    onChange(item.name);
    setIsDropdownOpen(false);
    setShowAllMode(false);
    onSelectItem?.(item);
  };

  const handleQuickCreate = async () => {
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    setQuickError(null);
    setIsSavingQuick(true);
    const res = await createQuickGear(category, trimmed, newItemBrand);
    setIsSavingQuick(false);
    if (res.ok && res.override) {
      onChange(res.override.name);
      setShowQuickAdd(false);
      setNewItemName("");
      setNewItemBrand("");
    } else {
      setQuickError(res.error ?? t("添加失败", "Failed to add", isEnglish));
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <label className="mb-1.5 block text-[12.5px] font-semibold text-[var(--wsj-text-secondary)]">
        {title}
      </label>

      <div className="flex items-center gap-1.5">
        <div className="relative flex flex-1 items-center rounded-[9px] border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-2.5 py-[7px] transition focus-within:border-[var(--wsj-accent)] focus-within:ring-1 focus-within:ring-[var(--wsj-accent)]/30">
          <input
            type="text"
            value={value}
            placeholder={placeholder}
            onFocus={() => {
              setShowAllMode(false);
              setIsDropdownOpen(true);
            }}
            onChange={(e) => {
              onChange(e.target.value);
              setShowAllMode(false);
              setIsDropdownOpen(true);
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--wsj-text)] placeholder:text-[var(--wsj-text-tertiary)] outline-none"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="ml-1 rounded-full p-0.5 text-[var(--wsj-text-tertiary)] hover:text-[var(--wsj-text)]"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          title={t("从器材库下拉选择", "Select from Gear Library", isEnglish)}
          onClick={() => {
            setShowQuickAdd(false);
            if (isDropdownOpen && showAllMode) {
              setIsDropdownOpen(false);
              setShowAllMode(false);
            } else {
              setShowAllMode(true);
              setIsDropdownOpen(true);
            }
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] text-[var(--wsj-text-secondary)] transition hover:text-[var(--wsj-text)]"
        >
          <ChevronDown className="h-4 w-4" />
        </button>

        <button
          type="button"
          disabled={isReadOnlyProtected}
          title={t(`新建${title}`, `Add New ${title}`, isEnglish)}
          onClick={() => {
            setIsDropdownOpen(false);
            setNewItemName(value);
            setNewItemBrand("");
            setQuickError(null);
            setShowQuickAdd((prev) => !prev);
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] text-[var(--wsj-accent)] transition hover:bg-[var(--wsj-accent-soft)] disabled:opacity-45"
        >
          <PlusCircle className="h-4 w-4" />
        </button>
      </div>

      {/* 联想搜索 / 全量下拉列表 */}
      {isDropdownOpen && candidates.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-60 overflow-y-auto rounded-[10px] border border-[var(--wsj-border)] bg-[var(--wsj-card)] shadow-xl">
          {candidates.map((item, idx) => {
            const gap = isShortGapSpec(item.gapOrSpec);
            const isNormalStatus =
              item.status === "在用" || item.status === "有";
            return (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-[var(--wsj-subtle)] ${
                  idx > 0 ? "border-t border-[var(--wsj-border)]/70" : ""
                }`}
              >
                <BrandAvatar brand={item.brand} size={19} />
                <span className="shrink-0 text-[12px] font-semibold text-[var(--wsj-text-secondary)]">
                  {brandDisplay(item.brand, isEnglish)}
                </span>
                <span className="truncate text-[13px] font-medium text-[var(--wsj-text)]">
                  {item.model}
                </span>

                <div className="flex shrink-0 items-center gap-1">
                  {gap && <TagPill text={gap} tone="neutral" />}
                  {item.knotSize && (
                    <TagPill text={item.knotSize} tone="accent" />
                  )}
                  {item.handleBrand && (
                    <TagPill
                      text={handleTag(item.handleBrand, isEnglish)}
                      tone="neutral"
                    />
                  )}
                  {item.isSample && (
                    <TagPill
                      text={t("小样", "Sample", isEnglish)}
                      tone="slate"
                    />
                  )}
                  {!isNormalStatus && (
                    <TagPill
                      text={gearStatusDisplay(item.status, isEnglish)}
                      tone={statusTone(item.status)}
                    />
                  )}
                </div>

                <span className="ml-auto shrink-0 font-mono text-[11.5px] text-[var(--wsj-text-secondary)]">
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 快捷新建器材浮层 */}
      {showQuickAdd && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-[300px] rounded-xl border border-[var(--wsj-border)] bg-[var(--wsj-card)] p-3.5 shadow-2xl">
          <div className="text-[13.5px] font-semibold text-[var(--wsj-text)]">
            {t(`新建${title}`, `Add ${title}`, isEnglish)}
          </div>
          <div className="mt-2.5 space-y-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={t("名称", "Name", isEnglish)}
              className="w-full rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-2.5 py-1.5 text-[13px] text-[var(--wsj-text)] outline-none focus:border-[var(--wsj-accent)]"
            />
            <input
              type="text"
              value={newItemBrand}
              onChange={(e) => setNewItemBrand(e.target.value)}
              placeholder={t("品牌（选填）", "Brand (Optional)", isEnglish)}
              className="w-full rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-2.5 py-1.5 text-[13px] text-[var(--wsj-text)] outline-none focus:border-[var(--wsj-accent)]"
            />
            {quickError && (
              <p className="text-[12px] text-[#CC3D3D]">{quickError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="rounded-lg border border-[var(--wsj-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--wsj-text)] hover:bg-[var(--wsj-subtle)]"
              >
                {t("取消", "Cancel", isEnglish)}
              </button>
              <button
                type="button"
                disabled={!newItemName.trim() || isSavingQuick}
                onClick={() => void handleQuickCreate()}
                className="rounded-lg bg-[var(--wsj-accent)] px-3 py-1 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-45"
              >
                {t("添加", "Add", isEnglish)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
