import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Dices,
  Loader2,
  Lock,
  PenLine,
  Sparkles,
  Unlock,
} from "lucide-react";
import { isAIConfigReady, recommendSetup } from "../../lib/aiService";
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

type DrawMode = "random" | "aiAdvisor";

const CORE_FOUR_CATEGORIES: GearCategory[] = [
  "剃须刀",
  "刀片",
  "剃须刷",
  "剃须皂",
];

const QUICK_ADVISOR_PROMPTS: { zh: string; en: string }[] = [
  { zh: "两天硬茬，要温和无痛 BBS", en: "2-day stubble, gentle painless BBS" },
  { zh: "消灭长期吃灰的冷门器材", en: "Dust off neglected gear I rarely use" },
  { zh: "清爽提神的搭配体验", en: "Fresh, crisp and uplifting shave" },
  { zh: "经典高舒适度黄金组合", en: "Proven ultra-comfortable golden combo" },
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
  showControls?: boolean;
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
  showControls = true,
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

        {showControls && (
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
        )}
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
  const {
    aiConfig,
    statisticsSnapshot,
    isEnglish,
    isReadOnlyProtected,
    getEligibleDrawPool,
  } = useJournal();

  const [mode, setMode] = useState<DrawMode>("random");

  // 随机抽签状态
  const [enabledCategories, setEnabledCategories] = useState<Set<GearCategory>>(
    () => new Set<GearCategory>(ALL_GEAR_CATEGORIES)
  );
  const [lockedCategories, setLockedCategories] = useState<Set<GearCategory>>(
    () => new Set<GearCategory>()
  );
  const [drawnItems, setDrawnItems] = useState<
    Partial<Record<GearCategory, GearItem>>
  >({});

  // AI 功能 ③：AI 智能配装建议状态
  const [advisorPrompt, setAdvisorPrompt] = useState("");
  const [isRecommending, setIsRecommending] = useState(false);
  const [advisorError, setAdvisorError] = useState<string | null>(null);
  const [advisorReason, setAdvisorReason] = useState("");
  const [aiRecommendedItems, setAiRecommendedItems] = useState<
    Partial<Record<GearCategory, GearItem>>
  >({});

  const activeRazor: GearItem | null = enabledCategories.has("剃须刀")
    ? (drawnItems["剃须刀"] ?? null)
    : null;

  const hasAnyDrawnItem = useMemo(() => {
    if (mode === "random") {
      return ALL_GEAR_CATEGORIES.some(
        (cat) => enabledCategories.has(cat) && Boolean(drawnItems[cat])
      );
    }
    return Object.keys(aiRecommendedItems).length > 0;
  }, [mode, enabledCategories, drawnItems, aiRecommendedItems]);

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

  const runAIAdvisor = async (promptOverride?: string) => {
    const req = (promptOverride ?? advisorPrompt).trim();
    if (!req || isRecommending) return;

    setIsRecommending(true);
    setAdvisorError(null);
    try {
      const eligible = {} as Record<GearCategory, GearItem[]>;
      for (const cat of ALL_GEAR_CATEGORIES) {
        eligible[cat] = getEligibleDrawPool(cat);
      }

      const rec = await recommendSetup(
        req,
        eligible,
        statisticsSnapshot.comboStats,
        aiConfig,
        isEnglish
      );

      const findItem = (
        cat: GearCategory,
        name: string | null
      ): GearItem | undefined => {
        const target = name?.trim().toLowerCase();
        if (!target) return undefined;
        const pool = eligible[cat] ?? [];
        const exact = pool.find((i) => i.name.toLowerCase() === target);
        if (exact) return exact;
        return pool.find(
          (i) =>
            i.name.toLowerCase().includes(target) ||
            target.includes(i.name.toLowerCase())
        );
      };

      const mapped: Partial<Record<GearCategory, GearItem>> = {};
      const r = findItem("剃须刀", rec.razorName);
      if (r) mapped["剃须刀"] = r;

      const b = findItem("刀片", rec.bladeName);
      if (r?.razorType) {
        if (razorRequiresBlade(r.razorType)) {
          const reqType = matchingBladeTypeForRazor(r.razorType);
          if (b && (!reqType || b.bladeType === reqType)) {
            mapped["刀片"] = b;
          } else {
            const fallback = getEligibleDrawPool("刀片", r)[0];
            if (fallback) mapped["刀片"] = fallback;
          }
        }
      } else if (b) {
        mapped["刀片"] = b;
      }

      const br = findItem("剃须刷", rec.brushName);
      if (br) mapped["剃须刷"] = br;
      const sp = findItem("剃须皂", rec.soapName);
      if (sp) mapped["剃须皂"] = sp;
      const bw = findItem("剃须碗", rec.bowlName);
      if (bw) mapped["剃须碗"] = bw;
      const pre = findItem("须前", rec.preShaveName);
      if (pre) mapped["须前"] = pre;
      const aft = findItem("须后", rec.afterShaveName);
      if (aft) mapped["须后"] = aft;

      setAiRecommendedItems(mapped);
      setAdvisorReason(rec.reason);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAdvisorError(msg);
    } finally {
      setIsRecommending(false);
    }
  };

  const handleLogThisSetup = () => {
    if (mode === "aiAdvisor") {
      onRecordSOTD({
        razor: aiRecommendedItems["剃须刀"]?.name ?? "",
        blade: aiRecommendedItems["刀片"]?.name ?? "",
        brush: aiRecommendedItems["剃须刷"]?.name ?? "",
        soap: aiRecommendedItems["剃须皂"]?.name ?? "",
        preShave: aiRecommendedItems["须前"]?.name ?? "",
        afterShave: aiRecommendedItems["须后"]?.name ?? "",
        bowl: aiRecommendedItems["剃须碗"]?.name ?? "",
      });
      return;
    }

    onRecordSOTD({
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
    });
  };

  const aiReady = isAIConfigReady(aiConfig);

  return (
    <div className="h-full w-full overflow-y-auto px-7 py-6">
      <div className="mx-auto max-w-[1120px] space-y-6">
        {/* 顶部标题 + 随机抽签 / AI 推荐双模式切换 + 操作栏 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3.5">
            <h1 className="text-[26px] font-bold tracking-tight text-[var(--wsj-text)]">
              {t("随机抽签", "Randomizer", isEnglish)}
            </h1>

            <div className="inline-flex rounded-[10px] bg-[var(--wsj-subtle)] p-1">
              <button
                type="button"
                onClick={() => setMode("random")}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
                  mode === "random"
                    ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                    : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                }`}
              >
                {t("随机抽签", "Random", isEnglish)}
              </button>
              <button
                type="button"
                onClick={() => setMode("aiAdvisor")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
                  mode === "aiAdvisor"
                    ? "bg-[var(--wsj-card)] text-[var(--wsj-accent)] shadow-sm"
                    : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t("AI 推荐", "AI Advisor", isEnglish)}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {mode === "random" && (
              <>
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
              </>
            )}

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

        {mode === "random" ? (
          <>
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
                        const core = new Set<GearCategory>(
                          CORE_FOUR_CATEGORIES
                        );
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
                {ALL_GEAR_CATEGORIES.filter((cat) =>
                  enabledCategories.has(cat)
                ).map((cat) => {
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
                })}
              </div>
            )}
          </>
        ) : (
          /* AI 功能 ③：AI 智能配装建议模式 */
          <>
            <SectionCard>
              {!aiReady ? (
                <div className="flex items-center gap-2.5 text-[13.5px] text-[var(--wsj-text-secondary)]">
                  <Sparkles className="h-4 w-4 shrink-0 text-[var(--wsj-accent)]" />
                  <span>
                    {t(
                      "请先在「外观与设置 → AI 识别接口」启用并保存 API Key，即可使用 AI 智能配装顾问。",
                      "Enable and configure your AI API key in Settings to use the AI Setup Advisor.",
                      isEnglish
                    )}
                  </span>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      type="text"
                      value={advisorPrompt}
                      onChange={(e) => setAdvisorPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void runAIAdvisor();
                        }
                      }}
                      placeholder={t(
                        "描述今天的需求，例如：两天硬茬要温和无痛 BBS / 消灭吃灰器材...",
                        "Describe today's shave goal, e.g., 2-day stubble gentle BBS...",
                        isEnglish
                      )}
                      className="min-w-[260px] flex-1 rounded-[10px] border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-3.5 py-2 text-[13.5px] text-[var(--wsj-text)] placeholder:text-[var(--wsj-text-tertiary)] outline-none focus:border-[var(--wsj-accent)]"
                    />
                    <button
                      type="button"
                      disabled={isRecommending || !advisorPrompt.trim()}
                      onClick={() => void runAIAdvisor()}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-[var(--wsj-accent)] px-4 py-2 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
                    >
                      {isRecommending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {isRecommending
                        ? t("推荐中...", "Thinking...", isEnglish)
                        : t("生成 AI 推荐", "Recommend", isEnglish)}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {QUICK_ADVISOR_PROMPTS.map((chip) => {
                      const label = t(chip.zh, chip.en, isEnglish);
                      return (
                        <button
                          key={chip.zh}
                          type="button"
                          disabled={isRecommending}
                          onClick={() => {
                            setAdvisorPrompt(label);
                            void runAIAdvisor(label);
                          }}
                          className="rounded-full bg-[var(--wsj-subtle)] px-3 py-1 text-[12.5px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-accent-soft)] hover:text-[var(--wsj-accent)] disabled:opacity-45"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {advisorError && (
                    <div className="text-[12.5px] text-[#CC3D3D]">
                      {advisorError}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            {advisorReason && (
              <SectionCard>
                <div className="flex items-start gap-2.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wsj-accent)]" />
                  <div className="space-y-1">
                    <div className="text-[14px] font-semibold text-[var(--wsj-text)]">
                      {t("AI 搭配理由", "Why This Setup", isEnglish)}
                    </div>
                    <p className="text-[13.5px] leading-relaxed text-[var(--wsj-text)] select-text">
                      {advisorReason}
                    </p>
                  </div>
                </div>
              </SectionCard>
            )}

            {Object.keys(aiRecommendedItems).length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-4">
                {ALL_GEAR_CATEGORIES.filter((cat) =>
                  Boolean(aiRecommendedItems[cat])
                ).map((cat) => {
                  const recRazor = aiRecommendedItems["剃须刀"] ?? null;
                  const eligibleCount = getEligibleDrawPool(
                    cat,
                    cat === "刀片" ? recRazor : null
                  ).length;
                  return (
                    <DrawSlotCard
                      key={cat}
                      category={cat}
                      item={aiRecommendedItems[cat]}
                      isLocked={false}
                      matchingRazor={cat === "刀片" ? recRazor : null}
                      eligibleCount={eligibleCount}
                      isEnglish={isEnglish}
                      showControls={false}
                      onToggleLock={() => {}}
                      onRollSingle={() => {}}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
