import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Dices,
  Lock,
  PenLine,
  Unlock,
} from "lucide-react";
import {
  getGearItemSpecTags,
  matchingBladeTypeForRazor,
  razorRequiresBlade,
} from "../../lib/gearMutations";
import {
  bladeTypeDisplay,
  brandDisplay,
  categoryPluralName,
  categorySingularName,
  categorySupportsSample,
  handleTag,
  t,
} from "../../lib/l10n";
import { useJournal } from "../../store/JournalContext";
import {
  ALL_GEAR_CATEGORIES,
  type GearCategory,
  type GearItem,
  type SOTDDraft,
} from "../../types/journal";
import { BrandAvatar } from "../ui/BrandAvatar";
import { SectionCard } from "../ui/SectionCard";
import { TagPill } from "../ui/TagPill";

interface RandomDrawViewProps {
  onRecordSOTD: (draft: SOTDDraft) => void;
}

const CORE_FOUR_CATEGORIES: GearCategory[] = [
  "剃须刀",
  "刀片",
  "剃须刷",
  "剃须皂",
];

function pickRandomAvoidRepeat(
  pool: GearItem[],
  currentId?: string
): GearItem | undefined {
  if (pool.length === 0) return undefined;
  const candidates =
    pool.length > 1 && currentId
      ? pool.filter((item) => item.id !== currentId)
      : pool;
  const source = candidates.length > 0 ? candidates : pool;
  const idx = Math.floor(Math.random() * source.length);
  return source[idx];
}

interface DrawSlotCardProps {
  category: GearCategory;
  item?: GearItem;
  isLocked: boolean;
  matchingRazor: GearItem | null;
  eligibleCount: number;
  isEnglish: boolean;
  onToggleLock: () => void;
  onRollSingle: () => void;
}

const DrawSlotCard: React.FC<DrawSlotCardProps> = ({
  category,
  item,
  isLocked,
  matchingRazor,
  eligibleCount,
  isEnglish,
  onToggleLock,
  onRollSingle,
}) => {
  const bladeMatchNote = useMemo(() => {
    if (category !== "刀片" || !matchingRazor?.razorType) return null;
    if (!razorRequiresBlade(matchingRazor.razorType)) {
      return t("直剃无需刀片", "No blade needed for Straight", isEnglish);
    }
    const bt = matchingBladeTypeForRazor(matchingRazor.razorType);
    if (bt) {
      const label = bladeTypeDisplay(bt, isEnglish);
      return t(`匹配 ${label} 刀片`, `Matched: ${label}`, isEnglish);
    }
    return null;
  }, [category, matchingRazor, isEnglish]);

  const emptyMessage = useMemo(() => {
    if (
      category === "刀片" &&
      matchingRazor?.razorType &&
      !razorRequiresBlade(matchingRazor.razorType)
    ) {
      return t("直剃无需匹配刀片", "Straight razor requires no blade", isEnglish);
    }
    if (eligibleCount === 0) {
      return category === "刀片"
        ? t("无匹配库存刀片", "No matching in-stock blades", isEnglish)
        : t(
            `无在用${categorySingularName(category, false)}`,
            `No active ${categoryPluralName(category, true).toLowerCase()}`,
            isEnglish
          );
    }
    return t("点击抽取", "Tap to roll", isEnglish);
  }, [category, matchingRazor, eligibleCount, isEnglish]);

  const tags = item ? getGearItemSpecTags(item, isEnglish) : [];

  return (
    <div
      className={`flex min-h-[176px] flex-col gap-3.5 rounded-[15px] border bg-[var(--wsj-card)] p-[18px] transition ${
        isLocked
          ? "border-[var(--wsj-accent)]/60 ring-1 ring-[var(--wsj-accent)]/20"
          : "border-[var(--wsj-border)]"
      }`}
    >
      {/* 头部：品类 + 候选池数量 + 锁定 + 单抽 */}
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-semibold text-[var(--wsj-text-secondary)]">
          {categorySingularName(category, isEnglish)}
        </span>
        <span className="font-mono text-[12px] text-[var(--wsj-text-tertiary)]">
          {eligibleCount}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            disabled={!item}
            onClick={onToggleLock}
            title={
              isLocked
                ? t("解锁该品类", "Unlock", isEnglish)
                : t("锁定该器材", "Lock", isEnglish)
            }
            aria-label={
              isLocked
                ? t("解锁", "Unlock", isEnglish)
                : t("锁定", "Lock", isEnglish)
            }
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition disabled:opacity-35 ${
              isLocked
                ? "bg-[var(--wsj-accent-soft)] text-[var(--wsj-accent)]"
                : "bg-[var(--wsj-subtle)] text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
            }`}
          >
            {isLocked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <Unlock className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            disabled={isLocked || eligibleCount === 0}
            onClick={onRollSingle}
            className="rounded-lg bg-[var(--wsj-subtle)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--wsj-text)] transition hover:opacity-85 disabled:opacity-40"
          >
            {t("单抽", "Roll", isEnglish)}
          </button>
        </div>
      </div>

      {/* 刀片自动匹配提示胶囊 */}
      {bladeMatchNote && (
        <div>
          <TagPill text={bladeMatchNote} tone="accent" />
        </div>
      )}

      {/* 抽中结果 / 空槽位 */}
      {item ? (
        <>
          <div className="flex items-center gap-2.5">
            <BrandAvatar brand={item.brand} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                <span className="truncate font-semibold text-[var(--wsj-text-secondary)]">
                  {brandDisplay(item.brand, isEnglish)}
                </span>
                {category === "剃须刷" &&
                  item.handleBrand &&
                  item.handleBrand.toLowerCase() !== item.brand.toLowerCase() && (
                    <>
                      <span className="text-[var(--wsj-text-tertiary)]">×</span>
                      <span className="truncate font-semibold text-[var(--wsj-text)]/80">
                        {handleTag(item.handleBrand, isEnglish)}
                      </span>
                    </>
                  )}
              </div>

              <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
                <span className="line-clamp-2 text-[16.5px] font-bold leading-snug text-[var(--wsj-text)]">
                  {item.model}
                </span>
                {category === "剃须刷" && item.knotSize && (
                  <span className="shrink-0 rounded-full bg-[var(--wsj-accent-soft)] px-2 py-[2px] font-mono text-[12.5px] font-bold text-[var(--wsj-accent)]">
                    {item.knotSize}
                  </span>
                )}
                {categorySupportsSample(category) && item.isSample && (
                  <TagPill text={t("小样", "Sample", isEnglish)} tone="slate" />
                )}
              </div>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, idx) => (
                <TagPill key={`${tag}-${idx}`} text={tag} tone="neutral" />
              ))}
            </div>
          )}

          <div className="mt-auto flex items-center justify-between pt-1 text-[12px]">
            <span className="text-[var(--wsj-text-secondary)]">
              {t(`${item.count} 次`, `${item.count} uses`, isEnglish)}
            </span>
            {item.lastUsedDate && (
              <span className="font-mono text-[var(--wsj-text-tertiary)]">
                {item.lastUsedDate}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center py-4 text-[13.5px] text-[var(--wsj-text-secondary)]">
          {emptyMessage}
        </div>
      )}
    </div>
  );
};

export const RandomDrawView: React.FC<RandomDrawViewProps> = ({
  onRecordSOTD,
}) => {
  const { isEnglish, isReadOnlyProtected, getEligibleDrawPool } = useJournal();

  const [enabledCategories, setEnabledCategories] = useState<Set<GearCategory>>(
    () => new Set<GearCategory>(ALL_GEAR_CATEGORIES)
  );
  const [lockedCategories, setLockedCategories] = useState<Set<GearCategory>>(
    () => new Set<GearCategory>()
  );
  const [drawnItems, setDrawnItems] = useState<
    Partial<Record<GearCategory, GearItem>>
  >({});

  const activeRazor: GearItem | null = enabledCategories.has("剃须刀")
    ? (drawnItems["剃须刀"] ?? null)
    : null;

  const hasAnyDrawnItem = useMemo(
    () =>
      ALL_GEAR_CATEGORIES.some(
        (cat) => enabledCategories.has(cat) && Boolean(drawnItems[cat])
      ),
    [enabledCategories, drawnItems]
  );

  const toggleCategory = (cat: GearCategory) => {
    setEnabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
    setLockedCategories((prev) => {
      if (!prev.has(cat)) return prev;
      const next = new Set(prev);
      next.delete(cat);
      return next;
    });
  };

  const toggleLock = (cat: GearCategory) => {
    if (!drawnItems[cat]) return;
    setLockedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const drawAll = () => {
    const nextDrawn: Partial<Record<GearCategory, GearItem>> = { ...drawnItems };
    const nextLocked = new Set(lockedCategories);

    // 第一步：优先抽取剃须刀，以便刀片按刀型自动匹配
    if (enabledCategories.has("剃须刀") && !nextLocked.has("剃须刀")) {
      const razorPool = getEligibleDrawPool("剃须刀");
      const picked = pickRandomAvoidRepeat(razorPool, nextDrawn["剃须刀"]?.id);
      if (picked) {
        nextDrawn["剃须刀"] = picked;
      } else {
        delete nextDrawn["剃须刀"];
        nextLocked.delete("剃须刀");
      }
    }

    const effectiveRazor: GearItem | null = enabledCategories.has("剃须刀")
      ? (nextDrawn["剃须刀"] ?? null)
      : null;

    // 第二步：抽取其余已启用且未锁定品类
    for (const cat of ALL_GEAR_CATEGORIES) {
      if (cat === "剃须刀") continue;
      if (!enabledCategories.has(cat)) continue;
      if (nextLocked.has(cat)) continue;

      const pool = getEligibleDrawPool(
        cat,
        cat === "刀片" ? effectiveRazor : null
      );
      const picked = pickRandomAvoidRepeat(pool, nextDrawn[cat]?.id);
      if (picked) {
        nextDrawn[cat] = picked;
      } else {
        delete nextDrawn[cat];
        nextLocked.delete(cat);
      }
    }

    setDrawnItems(nextDrawn);
    setLockedCategories(nextLocked);
  };

  const drawSingle = (cat: GearCategory) => {
    if (lockedCategories.has(cat)) return;
    const nextDrawn: Partial<Record<GearCategory, GearItem>> = { ...drawnItems };
    const nextLocked = new Set(lockedCategories);

    const razorRef = cat === "刀片" ? activeRazor : null;
    const pool = getEligibleDrawPool(cat, razorRef);
    const picked = pickRandomAvoidRepeat(pool, nextDrawn[cat]?.id);
    if (picked) {
      nextDrawn[cat] = picked;
    } else {
      delete nextDrawn[cat];
      nextLocked.delete(cat);
    }

    // 单抽剃须刀后自动同步兼容刀片（若刀片已启用且未锁定）
    if (
      cat === "剃须刀" &&
      enabledCategories.has("刀片") &&
      !nextLocked.has("刀片")
    ) {
      const newRazor = nextDrawn["剃须刀"] ?? null;
      if (newRazor?.razorType && !razorRequiresBlade(newRazor.razorType)) {
        delete nextDrawn["刀片"];
      } else if (newRazor?.razorType) {
        const requiredBladeType = matchingBladeTypeForRazor(newRazor.razorType);
        const currentBlade = nextDrawn["刀片"];
        if (
          requiredBladeType &&
          (!currentBlade || currentBlade.bladeType !== requiredBladeType)
        ) {
          const bladePool = getEligibleDrawPool("刀片", newRazor);
          const matchedBlade = pickRandomAvoidRepeat(
            bladePool,
            currentBlade?.id
          );
          if (matchedBlade) {
            nextDrawn["刀片"] = matchedBlade;
          } else {
            delete nextDrawn["刀片"];
          }
        }
      }
    }

    setDrawnItems(nextDrawn);
    setLockedCategories(nextLocked);
  };

  const handleLogThisSetup = () => {
    const draft: SOTDDraft = {
      razor: enabledCategories.has("剃须刀")
        ? (drawnItems["剃须刀"]?.name ?? "")
        : "",
      blade: enabledCategories.has("刀片")
        ? (drawnItems["刀片"]?.name ?? "")
        : "",
      brush: enabledCategories.has("剃须刷")
        ? (drawnItems["剃须刷"]?.name ?? "")
        : "",
      soap: enabledCategories.has("剃须皂")
        ? (drawnItems["剃须皂"]?.name ?? "")
        : "",
      preShave: enabledCategories.has("须前")
        ? (drawnItems["须前"]?.name ?? "")
        : "",
      afterShave: enabledCategories.has("须后")
        ? (drawnItems["须后"]?.name ?? "")
        : "",
      bowl: enabledCategories.has("剃须碗")
        ? (drawnItems["剃须碗"]?.name ?? "")
        : "",
    };
    onRecordSOTD(draft);
  };

  return (
    <div className="h-full w-full overflow-y-auto px-7 py-6">
      <div className="mx-auto max-w-[1120px] space-y-6">
        {/* 顶部标题与操作栏 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-[var(--wsj-text)]">
              {t("随机抽签", "Randomizer", isEnglish)}
            </h1>
            <p className="mt-1 text-[13px] text-[var(--wsj-text-secondary)]">
              {t(
                "仅从在用器材与库存刀片中抽取，并按刀型自动匹配兼容刀片",
                "Draws only from active gear and in-stock blades with automatic razor/blade compatibility",
                isEnglish
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {lockedCategories.size > 0 && (
              <button
                type="button"
                onClick={() => setLockedCategories(new Set())}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3.5 py-2 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)]"
              >
                <Unlock className="h-3.5 w-3.5 text-[var(--wsj-text-secondary)]" />
                {t("全部解锁", "Unlock All", isEnglish)}
              </button>
            )}

            <button
              type="button"
              disabled={enabledCategories.size === 0}
              onClick={drawAll}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wsj-accent)] px-4 py-2 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
            >
              <Dices className="h-4 w-4" />
              {t("一次抽全套", "Roll All", isEnglish)}
            </button>

            <button
              type="button"
              disabled={!hasAnyDrawnItem || isReadOnlyProtected}
              onClick={handleLogThisSetup}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-4 py-2 text-[13.5px] font-semibold text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
            >
              <PenLine className="h-4 w-4 text-[var(--wsj-accent)]" />
              {t("用这套记一次 SOTD", "Log This Setup", isEnglish)}
            </button>
          </div>
        </div>

        {/* 参与品类配置卡片 */}
        <SectionCard>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14.5px] font-semibold text-[var(--wsj-text)]">
                {t("参与品类", "Categories", isEnglish)}
              </h2>
              <div className="flex items-center gap-3 text-[12.5px]">
                <button
                  type="button"
                  onClick={() =>
                    setEnabledCategories(new Set(ALL_GEAR_CATEGORIES))
                  }
                  className="font-medium text-[var(--wsj-accent)] hover:underline"
                >
                  {t("全选", "All", isEnglish)}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const core = new Set<GearCategory>(CORE_FOUR_CATEGORIES);
                    setEnabledCategories(core);
                    setLockedCategories((prev) => {
                      const next = new Set<GearCategory>();
                      for (const c of prev) {
                        if (core.has(c)) next.add(c);
                      }
                      return next;
                    });
                  }}
                  className="font-medium text-[var(--wsj-accent)] hover:underline"
                >
                  {t("核心四件", "Core Four", isEnglish)}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {ALL_GEAR_CATEGORIES.map((cat) => {
                const isIncluded = enabledCategories.has(cat);
                const poolCount = getEligibleDrawPool(
                  cat,
                  cat === "刀片" ? activeRazor : null
                ).length;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition ${
                      isIncluded
                        ? "border-[var(--wsj-accent)]/40 bg-[var(--wsj-accent-soft)] font-semibold text-[var(--wsj-accent)]"
                        : "border-transparent bg-[var(--wsj-subtle)] font-medium text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                    }`}
                  >
                    {isIncluded ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    )}
                    <span>{categoryPluralName(cat, isEnglish)}</span>
                    <span className="font-mono text-[11.5px] opacity-80">
                      {poolCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </SectionCard>

        {/* 抽签槽位网格 */}
        {enabledCategories.size === 0 ? (
          <SectionCard className="py-12 text-center">
            <p className="text-[14px] text-[var(--wsj-text-secondary)]">
              {t(
                "请先在上方勾选至少一个参与抽签的品类",
                "Select at least one category above to roll",
                isEnglish
              )}
            </p>
          </SectionCard>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-4">
            {ALL_GEAR_CATEGORIES.filter((cat) => enabledCategories.has(cat)).map(
              (cat) => {
                const eligibleCount = getEligibleDrawPool(
                  cat,
                  cat === "刀片" ? activeRazor : null
                ).length;
                return (
                  <DrawSlotCard
                    key={cat}
                    category={cat}
                    item={drawnItems[cat]}
                    isLocked={lockedCategories.has(cat)}
                    matchingRazor={cat === "刀片" ? activeRazor : null}
                    eligibleCount={eligibleCount}
                    isEnglish={isEnglish}
                    onToggleLock={() => toggleLock(cat)}
                    onRollSingle={() => drawSingle(cat)}
                  />
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
};
