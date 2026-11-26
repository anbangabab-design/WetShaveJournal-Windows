import React from "react";
import { Paintbrush } from "lucide-react";
import { getGearItemSpecTags } from "../../lib/gearMutations";
import {
  brandDisplay,
  categorySupportsSample,
  gearStatusDisplay,
  handleTag,
  t,
} from "../../lib/l10n";
import type { GearItem, GearStatus } from "../../types/journal";
import { BrandAvatar } from "../ui/BrandAvatar";
import { TagPill, type TagTone } from "../ui/TagPill";

interface GearCardProps {
  item: GearItem;
  isEnglish: boolean;
  onClick: (item: GearItem) => void;
  onContextMenu: (e: React.MouseEvent, item: GearItem) => void;
}

function statusTone(status: GearStatus): TagTone {
  if (status === "在用" || status === "有") return "forest";
  if (status === "借用") return "slate";
  return "neutral";
}

function isDefaultNormalStatus(status: GearStatus): boolean {
  return status === "在用" || status === "有";
}

function cardSurfaceClasses(status: GearStatus, isPending: boolean): string {
  const bg =
    status === "借用"
      ? "bg-[#F1F7FE] dark:bg-[#222A37]"
      : status === "已出" || status === "无"
        ? "bg-[#F1F1F4] dark:bg-[#1E2023]"
        : "bg-[var(--wsj-card)]";

  const border = isPending
    ? "border-[#D1851F]/60 dark:border-[#D1851F]/65"
    : status === "借用"
      ? "border-[#5280B8]/35 dark:border-[#5280B8]/45"
      : "border-[var(--wsj-border)] hover:border-[var(--wsj-text-tertiary)]/45";

  const opacity = status === "已出" || status === "无" ? "opacity-75" : "";
  return `${bg} ${border} ${opacity}`;
}

export const GearCard: React.FC<GearCardProps> = ({
  item,
  isEnglish,
  onClick,
  onContextMenu,
}) => {
  const tags = getGearItemSpecTags(item, isEnglish);

  const hybridHandle =
    item.category === "剃须刷" &&
    item.handleBrand?.trim() &&
    item.handleBrand.trim().toLowerCase() !== item.brand.toLowerCase()
      ? item.handleBrand.trim()
      : null;

  const brushKnotSize =
    item.category === "剃须刷" && item.knotSize?.trim()
      ? item.knotSize.trim()
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(item);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, item)}
      className={`flex h-full cursor-pointer flex-col gap-3 rounded-[15px] border p-[18px] text-left transition ${cardSurfaceClasses(item.status, item.isPending)}`}
    >
      {/* 第一行：品牌徽章 + 品牌（混搭刷展示毛结 × 手柄）+ 状态 + 待确认 + 次数 */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <BrandAvatar brand={item.brand} size={28} />
          <span
            className={`truncate text-[13.5px] font-semibold ${
              hybridHandle
                ? "text-[var(--wsj-text)]"
                : "text-[var(--wsj-text-secondary)]"
            }`}
          >
            {brandDisplay(item.brand, isEnglish)}
          </span>

          {hybridHandle && (
            <>
              <span className="text-[12px] text-[var(--wsj-text-tertiary)]">
                ×
              </span>
              <span className="inline-flex max-w-[140px] items-center gap-1 rounded-full bg-[var(--wsj-pill)] px-2 py-[2px] text-[12px] font-semibold text-[var(--wsj-text)]/85">
                <Paintbrush className="h-3 w-3 shrink-0 text-[var(--wsj-text-secondary)]" />
                <span className="truncate">
                  {handleTag(hybridHandle, isEnglish)}
                </span>
              </span>
            </>
          )}

          {!isDefaultNormalStatus(item.status) && (
            <TagPill
              text={gearStatusDisplay(item.status, isEnglish)}
              tone={statusTone(item.status)}
            />
          )}

          {item.isPending && (
            <TagPill
              text={t("待确认", "Pending", isEnglish)}
              tone="amber"
              filled
            />
          )}
        </div>

        <span className="shrink-0 font-mono text-[13px] font-semibold text-[var(--wsj-text-secondary)]">
          {t(`${item.count} 次`, `${item.count}`, isEnglish)}
        </span>
      </div>

      {/* 第二行：型号主标题 + 剃须刷醒目等宽结径徽章 + 皂/须后小样标签 */}
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="line-clamp-2 text-[16.5px] font-bold leading-snug text-[var(--wsj-text)]">
          {item.model}
        </h3>

        {brushKnotSize && (
          <span className="shrink-0 rounded-full border border-[var(--wsj-accent)]/35 bg-[var(--wsj-accent-soft)] px-2 py-[2px] font-mono text-[13px] font-bold text-[var(--wsj-accent)]">
            {brushKnotSize}
          </span>
        )}

        {categorySupportsSample(item.category) && item.isSample && (
          <TagPill text={t("小样", "Sample", isEnglish)} tone="slate" />
        )}
      </div>

      {/* 第三行：中性极简属性小胶囊（无标签时完全隐藏不占位） */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, idx) => (
            <TagPill key={`${tag}-${idx}`} text={tag} tone="neutral" />
          ))}
        </div>
      )}

      {/* 第四行：最近使用日期 */}
      <div className="mt-auto pt-1 text-[12px] text-[var(--wsj-text-tertiary)]">
        {item.lastUsedDate
          ? t(`最近 ${item.lastUsedDate}`, `Last ${item.lastUsedDate}`, isEnglish)
          : t("尚未使用", "Unused", isEnglish)}
      </div>
    </div>
  );
};
