import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { auditGearItems, isAIConfigReady } from "../../lib/aiService";
import { brandDisplay, categoryPluralName, t } from "../../lib/l10n";
import { useJournal } from "../../store/JournalContext";
import type {
  GearAuditBatchFailure,
  GearAuditMergeProposal,
  GearAuditUpdateProposal,
  GearCategory,
  GearItem,
} from "../../types/journal";
import { TagPill } from "../ui/TagPill";

interface AIHealthCheckModalProps {
  open: boolean;
  initialCategory: GearCategory;
  onClose: () => void;
}

type AuditScope = "currentCategory" | "allPending";
const MAX_RETRY_ROUNDS = 3;

export const AIHealthCheckModal: React.FC<AIHealthCheckModalProps> = ({
  open,
  initialCategory,
  onClose,
}) => {
  const {
    catalogSnapshot,
    allPendingGearItems,
    aiConfig,
    isEnglish,
    isReadOnlyProtected,
    applyAuditProposals,
  } = useJournal();

  const [scope, setScope] = useState<AuditScope>("currentCategory");
  const [isAuditing, setIsAuditing] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  const [updates, setUpdates] = useState<GearAuditUpdateProposal[]>([]);
  const [merges, setMerges] = useState<GearAuditMergeProposal[]>([]);
  const [undeterminedItems, setUndeterminedItems] = useState<GearItem[]>([]);
  const [failedItems, setFailedItems] = useState<GearItem[]>([]);
  const [batchFailures, setBatchFailures] = useState<GearAuditBatchFailure[]>(
    []
  );

  const [plannedCount, setPlannedCount] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [unknownIdCount, setUnknownIdCount] = useState(0);
  const [liveUndeterminedCount, setLiveUndeterminedCount] = useState(0);
  const [liveFailedCount, setLiveFailedCount] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [retryRound, setRetryRound] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!open) {
      cancelledRef.current = true;
      return;
    }
    cancelledRef.current = false;
    setErrorMessage(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isAuditing) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isAuditing, onClose]);

  const currentCategoryItems = useMemo(
    () => catalogSnapshot.itemsByCategory[initialCategory] ?? [],
    [catalogSnapshot, initialCategory]
  );

  const targetItems =
    scope === "currentCategory" ? currentCategoryItems : allPendingGearItems;

  const selectedCount = useMemo(
    () =>
      updates.filter((u) => u.selected).length +
      merges.filter((m) => m.selected).length,
    [updates, merges]
  );

  if (!open) return null;

  const ready = isAIConfigReady(aiConfig);

  const runAudit = async () => {
    const itemsToAudit = targetItems;
    if (itemsToAudit.length === 0) return;

    cancelledRef.current = false;
    setIsAuditing(true);
    setHasCompleted(false);
    setErrorMessage(null);
    setUpdates([]);
    setMerges([]);
    setUndeterminedItems([]);
    setFailedItems([]);
    setBatchFailures([]);
    setPlannedCount(itemsToAudit.length);
    setVerifiedCount(0);
    setSkippedCount(0);
    setUnknownIdCount(0);
    setLiveUndeterminedCount(0);
    setLiveFailedCount(0);
    setCurrentBatch(0);
    setTotalBatches(0);
    setRetryRound(0);

    try {
      const report = await auditGearItems(itemsToAudit, aiConfig, isEnglish, {
        isCancelled: () => cancelledRef.current,
        onProgress: (p) => {
          setCurrentBatch(p.currentBatch);
          setTotalBatches(p.totalBatches);
          setVerifiedCount(p.verifiedCount);
          setLiveUndeterminedCount(p.undeterminedCount);
          setLiveFailedCount(p.failedCount);
          setSkippedCount(p.skippedCount);
        },
      });
      setUpdates(report.updates);
      setMerges(report.merges);
      setModelUsed(report.modelUsed);
      setPlannedCount(report.plannedCount);
      setVerifiedCount(report.verifiedCount);
      setUndeterminedItems(report.undeterminedItems);
      setFailedItems(report.failedItems);
      setSkippedCount(report.skippedCount);
      setUnknownIdCount(report.unknownOrDuplicateIdCount);
      setLiveUndeterminedCount(report.undeterminedItems.length);
      setLiveFailedCount(report.failedItems.length);
      setBatchFailures(report.failures);
      setHasCompleted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsAuditing(false);
    }
  };

  const runRetryFailedOnly = async () => {
    if (failedItems.length === 0 || retryRound >= MAX_RETRY_ROUNDS) return;

    cancelledRef.current = false;
    const nextRound = retryRound + 1;
    setRetryRound(nextRound);
    const itemsToRetry = [...failedItems];
    const baseVerified = verifiedCount;
    const baseSkipped = skippedCount;
    const baseBadIds = unknownIdCount;
    const baseUndetermined = [...undeterminedItems];

    setIsAuditing(true);
    setErrorMessage(null);
    setCurrentBatch(0);
    setTotalBatches(0);
    setLiveFailedCount(itemsToRetry.length);

    try {
      const report = await auditGearItems(itemsToRetry, aiConfig, isEnglish, {
        isCancelled: () => cancelledRef.current,
        onProgress: (p) => {
          setCurrentBatch(p.currentBatch);
          setTotalBatches(p.totalBatches);
          setVerifiedCount(baseVerified + p.verifiedCount);
          setSkippedCount(baseSkipped + p.skippedCount);
          setLiveUndeterminedCount(
            baseUndetermined.length + p.undeterminedCount
          );
          setLiveFailedCount(p.failedCount);
        },
      });

      setModelUsed(report.modelUsed);
      setVerifiedCount(baseVerified + report.verifiedCount);
      setSkippedCount(baseSkipped + report.skippedCount);
      setUnknownIdCount(baseBadIds + report.unknownOrDuplicateIdCount);

      const mergedUndetermined = [...baseUndetermined];
      for (const u of report.undeterminedItems) {
        if (!mergedUndetermined.some((x) => x.id === u.id)) {
          mergedUndetermined.push(u);
        }
      }
      setUndeterminedItems(mergedUndetermined);
      setFailedItems(report.failedItems);
      setLiveUndeterminedCount(mergedUndetermined.length);
      setLiveFailedCount(report.failedItems.length);
      setBatchFailures(report.failures);

      setUpdates((prev) => {
        const next = [...prev];
        for (const u of report.updates) {
          if (!next.some((ex) => ex.id === u.id)) next.push(u);
        }
        return next;
      });
      setMerges((prev) => {
        const next = [...prev];
        for (const m of report.merges) {
          if (!next.some((ex) => ex.id === m.id)) next.push(m);
        }
        return next;
      });
      setHasCompleted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleApply = async () => {
    if (isApplying || isReadOnlyProtected) return;
    setIsApplying(true);
    setErrorMessage(null);
    const res = await applyAuditProposals(updates, merges, undeterminedItems);
    setIsApplying(false);
    if (res.ok) {
      onClose();
    } else if (res.error) {
      setErrorMessage(res.error);
    }
  };

  const displayedFailed = isAuditing ? liveFailedCount : failedItems.length;
  const displayedUndetermined = isAuditing
    ? liveUndeterminedCount
    : undeterminedItems.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isAuditing) onClose();
      }}
    >
      <div className="flex h-[84vh] max-h-[700px] w-full max-w-[780px] flex-col overflow-hidden rounded-2xl border border-[var(--wsj-border)] bg-[var(--wsj-canvas)] shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--wsj-border)] bg-[var(--wsj-card)] px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--wsj-accent)]" />
              <h2 className="text-[18.5px] font-bold text-[var(--wsj-text)]">
                {t("AI 器材库体检", "AI Gear Audit", isEnglish)}
              </h2>
              {modelUsed && <TagPill text={modelUsed} tone="accent" />}
            </div>
            <p className="mt-1 text-[12.5px] text-[var(--wsj-text-secondary)]">
              {t(
                "每批 6–8 件、180 秒超时深度核验官网参数与疑似重复项；不确定项标为待确认绝不编造，确认勾选后再写入并支持一键撤销。",
                "Audits 6–8 items per batch (180s timeout). Uncertain items stay pending without fabrication. Review diffs before applying; one-click undo supported.",
                isEnglish
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              cancelledRef.current = true;
              onClose();
            }}
            className="rounded-lg p-1.5 text-[var(--wsj-text-secondary)] hover:bg-[var(--wsj-subtle)] hover:text-[var(--wsj-text)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 主体 */}
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-hidden p-5">
          {!ready ? (
            <div className="flex items-start gap-3 rounded-xl border border-[var(--wsj-accent)]/30 bg-[var(--wsj-accent-soft)] p-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--wsj-accent)]" />
              <div>
                <div className="text-[14px] font-semibold text-[var(--wsj-text)]">
                  {t(
                    "尚未启用 AI 识别接口",
                    "AI Recognition API is Not Enabled",
                    isEnglish
                  )}
                </div>
                <p className="mt-1 text-[12.5px] text-[var(--wsj-text-secondary)]">
                  {t(
                    "请先前往「外观与设置 → AI 识别接口」选择 DeepSeek 或自定义 OpenAI 兼容服务、保存 API Key 并开启总开关。",
                    "Go to Settings → AI Recognition API, save your API key, and enable the switch first.",
                    isEnglish
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-[10px] bg-[var(--wsj-subtle)] p-1">
                <button
                  type="button"
                  disabled={isAuditing}
                  onClick={() => setScope("currentCategory")}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition ${
                    scope === "currentCategory"
                      ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                      : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                  }`}
                >
                  {t(
                    `当前分类：${categoryPluralName(initialCategory, false)} (${currentCategoryItems.length})`,
                    `Current: ${categoryPluralName(initialCategory, true)} (${currentCategoryItems.length})`,
                    isEnglish
                  )}
                </button>
                <button
                  type="button"
                  disabled={isAuditing}
                  onClick={() => setScope("allPending")}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition ${
                    scope === "allPending"
                      ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                      : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                  }`}
                >
                  {t(
                    `全部待确认 (${allPendingGearItems.length})`,
                    `All Pending (${allPendingGearItems.length})`,
                    isEnglish
                  )}
                </button>
              </div>

              {isAuditing ? (
                <button
                  type="button"
                  onClick={() => {
                    cancelledRef.current = true;
                  }}
                  className="rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-4 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] hover:bg-[var(--wsj-subtle)]"
                >
                  {t("取消体检", "Cancel Audit", isEnglish)}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={targetItems.length === 0}
                  onClick={() => void runAudit()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wsj-accent)] px-4 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("开始 AI 体检", "Start Audit", isEnglish)}
                </button>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-[#CC3D3D]/10 px-3 py-2 text-[12.5px] text-[#CC3D3D]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="break-words">{errorMessage}</span>
            </div>
          )}

          {/* 实时状态胶囊与「仅重试失败项」 */}
          {(hasCompleted || isAuditing) && (
            <div className="flex flex-wrap items-center gap-2">
              <TagPill
                text={t(`计划 ${plannedCount}`, `Planned ${plannedCount}`, isEnglish)}
                tone="neutral"
              />
              <TagPill
                text={t(`成功核查 ${verifiedCount}`, `Verified ${verifiedCount}`, isEnglish)}
                tone="forest"
              />
              {displayedUndetermined > 0 && (
                <TagPill
                  text={t(
                    `待确认 ${displayedUndetermined}`,
                    `Uncertain ${displayedUndetermined}`,
                    isEnglish
                  )}
                  tone="amber"
                />
              )}
              <TagPill
                text={t(`失败 ${displayedFailed}`, `Failed ${displayedFailed}`, isEnglish)}
                tone={displayedFailed === 0 ? "slate" : "crimson"}
              />
              {skippedCount > 0 && (
                <TagPill
                  text={t(`无变更 ${skippedCount}`, `Unchanged ${skippedCount}`, isEnglish)}
                  tone="neutral"
                />
              )}
              {unknownIdCount > 0 && (
                <TagPill
                  text={t(`异常 ID ${unknownIdCount}`, `Bad IDs ${unknownIdCount}`, isEnglish)}
                  tone="crimson"
                />
              )}

              {!isAuditing && failedItems.length > 0 && (
                <button
                  type="button"
                  disabled={retryRound >= MAX_RETRY_ROUNDS}
                  onClick={() => void runRetryFailedOnly()}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#D1851F] px-3 py-1 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {retryRound >= MAX_RETRY_ROUNDS
                    ? t(
                        `已达重试上限 (${MAX_RETRY_ROUNDS})`,
                        `Retry Limit (${MAX_RETRY_ROUNDS})`,
                        isEnglish
                      )
                    : t(
                        `仅重试失败项 (${failedItems.length})`,
                        `Retry Failed Only (${failedItems.length})`,
                        isEnglish
                      )}
                </button>
              )}
            </div>
          )}

          {/* 批次失败原因摘要 */}
          {!isAuditing && batchFailures.length > 0 && (
            <div className="rounded-xl border border-[#CC3D3D]/35 bg-[#CC3D3D]/8 p-3 text-[12px]">
              <div className="flex items-center gap-1.5 font-semibold text-[#CC3D3D]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {t(
                  `有 ${batchFailures.length} 个批次（共 ${failedItems.length} 件器材）请求失败或被遗漏：`,
                  `${batchFailures.length} batch(es) (${failedItems.length} items) failed or omitted:`,
                  isEnglish
                )}
              </div>
              <div className="mt-1.5 space-y-1 text-[var(--wsj-text-secondary)]">
                {batchFailures.map((f, idx) => (
                  <div key={`${f.batchIndex}-${idx}`} className="truncate">
                    {t(
                      `• 第 ${f.batchIndex} 批（${f.items.length} 件）：${f.reason}`,
                      `• Batch #${f.batchIndex} (${f.items.length} items): ${f.reason}`,
                      isEnglish
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 进度 / 空结果 / Diff 列表 */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isAuditing ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="h-7 w-7 animate-spin text-[var(--wsj-accent)]" />
                <div className="text-[14px] font-medium text-[var(--wsj-text)]">
                  {totalBatches > 0
                    ? t(
                        `正在核验第 ${currentBatch} / ${totalBatches} 批（每批 6–8 件，单批超时 180 秒）...`,
                        `Auditing batch ${currentBatch} / ${totalBatches} (6–8 items/batch, 180s timeout)...`,
                        isEnglish
                      )
                    : t("正在调用 AI 核验器材参数...", "Auditing gear specs via AI...", isEnglish)}
                </div>
                {totalBatches > 0 && (
                  <div className="h-2 w-64 overflow-hidden rounded-full bg-[var(--wsj-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--wsj-accent)] transition-all"
                      style={{
                        width: `${Math.min(100, Math.round((currentBatch / totalBatches) * 100))}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            ) : hasCompleted &&
              updates.length === 0 &&
              merges.length === 0 &&
              failedItems.length === 0 &&
              undeterminedItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <CheckCircle2 className="h-9 w-9 text-[#2E8F5C]" />
                <p className="text-[14px] font-medium text-[var(--wsj-text-secondary)]">
                  {t(
                    "全部器材命名与参数均很规范，暂未发现需要修正或合并的条目",
                    "All checked items look clean — no fixes or merges needed.",
                    isEnglish
                  )}
                </p>
              </div>
            ) : updates.length > 0 || merges.length > 0 ? (
              <div className="space-y-5 pr-1">
                {updates.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[14.5px] font-semibold text-[var(--wsj-text)]">
                        {t(
                          `规范纠错与属性补全建议（${updates.length}）`,
                          `Naming & Spec Improvements (${updates.length})`,
                          isEnglish
                        )}
                      </h3>
                      <div className="flex items-center gap-3 text-[12px]">
                        <button
                          type="button"
                          onClick={() =>
                            setUpdates((prev) =>
                              prev.map((u) => ({ ...u, selected: true }))
                            )
                          }
                          className="font-medium text-[var(--wsj-accent)] hover:underline"
                        >
                          {t("全选", "Select All", isEnglish)}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setUpdates((prev) =>
                              prev.map((u) => ({ ...u, selected: false }))
                            )
                          }
                          className="font-medium text-[var(--wsj-text-secondary)] hover:underline"
                        >
                          {t("全不选", "Deselect All", isEnglish)}
                        </button>
                      </div>
                    </div>

                    {updates.map((prop) => (
                      <label
                        key={prop.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--wsj-border)] bg-[var(--wsj-card)] p-3.5 transition hover:border-[var(--wsj-accent)]/40"
                      >
                        <input
                          type="checkbox"
                          checked={prop.selected}
                          onChange={(e) =>
                            setUpdates((prev) =>
                              prev.map((u) =>
                                u.id === prop.id
                                  ? { ...u, selected: e.target.checked }
                                  : u
                              )
                            )
                          }
                          className="mt-1 h-4 w-4 accent-[var(--wsj-accent)]"
                        />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13.5px] font-semibold text-[var(--wsj-text)]">
                              {brandDisplay(prop.item.brand, isEnglish)} ·{" "}
                              {prop.item.model}
                            </span>
                            <TagPill
                              text={`${Math.round(prop.confidence * 100)}%`}
                              tone={prop.confidence >= 0.72 ? "forest" : "amber"}
                            />
                            {prop.item.isManuallyConfirmed && (
                              <TagPill
                                text={t("已人工确认", "Manual", isEnglish)}
                                tone="slate"
                              />
                            )}
                          </div>
                          <div className="space-y-0.5 font-mono text-[12px] text-[var(--wsj-text)]">
                            {prop.changesSummary.map((line, i) => (
                              <div key={i}>• {line}</div>
                            ))}
                          </div>
                          <div className="text-[12px] text-[var(--wsj-text-secondary)]">
                            {prop.reason}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {merges.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-[14.5px] font-semibold text-[var(--wsj-text)]">
                      {t(
                        `疑似重复合并建议（${merges.length}）`,
                        `Suspected Duplicate Merges (${merges.length})`,
                        isEnglish
                      )}
                    </h3>

                    {merges.map((m) => (
                      <label
                        key={m.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--wsj-border)] bg-[var(--wsj-card)] p-3.5 transition hover:border-[var(--wsj-accent)]/40"
                      >
                        <input
                          type="checkbox"
                          checked={m.selected}
                          onChange={(e) =>
                            setMerges((prev) =>
                              prev.map((x) =>
                                x.id === m.id
                                  ? { ...x, selected: e.target.checked }
                                  : x
                              )
                            )
                          }
                          className="mt-1 h-4 w-4 accent-[var(--wsj-accent)]"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold">
                            <span className="text-[var(--wsj-text)]">
                              {m.source.name}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 text-[var(--wsj-accent)]" />
                            <span className="text-[var(--wsj-accent)]">
                              {m.target.name}
                            </span>
                          </div>
                          <div className="text-[12px] text-[var(--wsj-text-secondary)]">
                            {m.reason}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-[13.5px] text-[var(--wsj-text-secondary)]">
                {hasCompleted
                  ? t(
                      "部分条目无法核验或失败，请查看上方状态或点击「仅重试失败项」",
                      "Some items failed or remained uncertain. Review status above or retry failed items.",
                      isEnglish
                    )
                  : t(
                      "选择范围后点击「开始 AI 体检」查看逐项修改建议（Diff）",
                      "Choose a scope and click Start Audit to review proposed diffs",
                      isEnglish
                    )}
              </div>
            )}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--wsj-border)] bg-[var(--wsj-card)] px-6 py-3.5">
          <div className="text-[12.5px] text-[var(--wsj-text-secondary)]">
            {hasCompleted && (updates.length > 0 || merges.length > 0)
              ? t(
                  `已勾选 ${selectedCount} 项改动（写入前自动备份，可随时撤销）`,
                  `${selectedCount} change(s) selected (auto-backed up; undoable)`,
                  isEnglish
                )
              : ""}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                cancelledRef.current = true;
                onClose();
              }}
              className="rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-4 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] hover:opacity-85"
            >
              {t("关闭", "Close", isEnglish)}
            </button>

            {(updates.length > 0 ||
              merges.length > 0 ||
              undeterminedItems.length > 0) && (
              <button
                type="button"
                disabled={
                  (selectedCount === 0 && undeterminedItems.length === 0) ||
                  isReadOnlyProtected ||
                  isAuditing ||
                  isApplying
                }
                onClick={() => void handleApply()}
                className="rounded-lg bg-[var(--wsj-accent)] px-4 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
              >
                {t("应用选中修改", "Apply Selected", isEnglish)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
