import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Copy,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { generateShaveDiagnosis, isAIConfigReady } from "../../lib/aiService";
import { buildBrandGroups } from "../../lib/gearMutations";
import {
  brandDisplay,
  categoryPluralName,
  materialDisplay,
  t,
} from "../../lib/l10n";
import { formatDateISO, parseDateISO } from "../../lib/processParser";
import { useJournal } from "../../store/JournalContext";
import type {
  DistributionSlice,
  GearCategory,
  HeatmapDayInfo,
  MonthlyShavePoint,
  RazorBladeComboStat,
} from "../../types/journal";
import { SectionCard } from "../ui/SectionCard";
import { TagPill } from "../ui/TagPill";

type BrandChartCategory = "剃须刀" | "剃须刷" | "剃须皂" | "刀片";
type ComboRankMode = "best" | "warning" | "mostUsed";

const BRAND_CHART_CATEGORIES: BrandChartCategory[] = [
  "剃须刀",
  "剃须刷",
  "剃须皂",
  "刀片",
];

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

// MARK: - KPI 卡片

const KPICard: React.FC<{ title: string; value: string; subtitle?: string }> = ({
  title,
  value,
  subtitle,
}) => (
  <div className="flex h-full flex-col justify-between rounded-[15px] border border-[var(--wsj-border)] bg-[var(--wsj-card)] p-[18px]">
    <div className="text-[13px] font-medium text-[var(--wsj-text-secondary)]">
      {title}
    </div>
    <div className="mt-2 font-mono text-[27px] font-bold tracking-tight text-[var(--wsj-text)]">
      {value}
    </div>
    {subtitle && (
      <div className="mt-1 truncate text-[11.5px] text-[var(--wsj-text-tertiary)]">
        {subtitle}
      </div>
    )}
  </div>
);

// MARK: - 纯 SVG 月度刮剃趋势图（柱状 + 趋势折线 + 悬浮提示）

const MonthlyTrendChart: React.FC<{
  data: MonthlyShavePoint[];
  isEnglish: boolean;
}> = ({ data, isEnglish }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[13px] text-[var(--wsj-text-secondary)]">
        {t("暂无月度数据", "No monthly data", isEnglish)}
      </div>
    );
  }

  const width = 520;
  const height = 210;
  const padLeft = 32;
  const padRight = 14;
  const padTop = 20;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(1, ...data.map((d) => d.count));
  const yTicks = [0, Math.ceil(maxVal / 2), maxVal];
  const stepX = plotW / data.length;
  const barW = Math.max(10, Math.min(28, stepX * 0.56));

  const points = data.map((d, idx) => {
    const cx = padLeft + stepX * idx + stepX / 2;
    const barH = (d.count / maxVal) * plotH;
    const y = padTop + plotH - barH;
    return { ...d, cx, y, barH };
  });

  const linePath = points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.cx.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(" ");

  const hovered = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="relative h-[220px] w-full select-none">
      {hovered && (
        <div className="pointer-events-none absolute right-2 top-0 z-10 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)]/95 px-2.5 py-1 text-[12px] shadow-md">
          <span className="font-mono font-semibold text-[var(--wsj-text)]">
            {hovered.month}
          </span>
          <span className="mx-1.5 text-[var(--wsj-text-tertiary)]">·</span>
          <span className="font-mono font-bold text-[var(--wsj-accent)]">
            {t(`${hovered.count} 次`, `${hovered.count} shaves`, isEnglish)}
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full overflow-visible"
        role="img"
        aria-label={t("近 12 个月刮剃趋势", "Monthly shaves trend", isEnglish)}
      >
        {/* 水平参考线 */}
        {yTicks.map((tick, idx) => {
          const y = padTop + plotH - (tick / maxVal) * plotH;
          return (
            <g key={`tick-${idx}-${tick}`}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeDasharray={tick === 0 ? undefined : "3 3"}
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10.5"
                fill="var(--wsj-text-tertiary)"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* 柱状 */}
        {points.map((pt, idx) => {
          const isHot = hoveredIdx === idx;
          return (
            <g
              key={pt.month}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={pt.cx - stepX / 2}
                y={padTop}
                width={stepX}
                height={plotH}
                fill="transparent"
              />
              <rect
                x={pt.cx - barW / 2}
                y={pt.y}
                width={barW}
                height={Math.max(2, pt.barH)}
                rx={4}
                fill="var(--wsj-accent)"
                fillOpacity={isHot ? 0.92 : 0.65}
              />
              <text
                x={pt.cx}
                y={height - 10}
                textAnchor="middle"
                fontSize="10.5"
                fill={isHot ? "var(--wsj-text)" : "var(--wsj-text-secondary)"}
                fontWeight={isHot ? 600 : 400}
              >
                {pt.label}
              </text>
            </g>
          );
        })}

        {/* 趋势折线与圆点 */}
        {points.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--wsj-text)"
            strokeOpacity={0.42}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            pointerEvents="none"
          />
        )}
        {points.map((pt, idx) => (
          <circle
            key={`dot-${pt.month}`}
            cx={pt.cx}
            cy={pt.y}
            r={hoveredIdx === idx ? 4.5 : 3}
            fill="var(--wsj-accent)"
            stroke="var(--wsj-card)"
            strokeWidth={1.5}
            pointerEvents="none"
          />
        ))}
      </svg>
    </div>
  );
};

// MARK: - 剃须频率日历热力图（悬浮显示日期与当日主装备）

const ShaveHeatmapCardBody: React.FC<{
  heatmapByDate: Record<string, HeatmapDayInfo>;
  isEnglish: boolean;
}> = ({ heatmapByDate, isEnglish }) => {
  const [hoveredDay, setHoveredDay] = useState<{
    iso: string;
    info?: HeatmapDayInfo;
  } | null>(null);

  const weeks = useMemo(() => {
    const keys = Object.keys(heatmapByDate);
    let anchor = new Date();
    if (keys.length > 0) {
      const latest = keys.reduce((a, b) => (a > b ? a : b));
      const parsed = parseDateISO(latest);
      if (parsed) anchor = parsed;
    }

    const totalWeeks = 22;
    const anchorDay = anchor.getDay(); // 0=Sun..6=Sat
    const endOfWeek = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate() + (6 - anchorDay)
    );
    const startDate = new Date(
      endOfWeek.getFullYear(),
      endOfWeek.getMonth(),
      endOfWeek.getDate() - (totalWeeks * 7 - 1)
    );

    const grid: string[][] = [];
    const cur = new Date(startDate);
    for (let w = 0; w < totalWeeks; w++) {
      const col: string[] = [];
      for (let d = 0; d < 7; d++) {
        col.push(formatDateISO(cur));
        cur.setDate(cur.getDate() + 1);
      }
      grid.push(col);
    }
    return grid;
  }, [heatmapByDate]);

  const cellClass = (count: number): string => {
    if (count <= 0) return "bg-[var(--wsj-subtle)]";
    if (count === 1) return "bg-[#2E8F5C]/75 dark:bg-[#2E8F5C]/80";
    return "bg-[var(--wsj-accent)]";
  };

  return (
    <div className="flex h-[220px] flex-col justify-between">
      {/* 顶部悬浮信息条（避免溢出裁切，始终展示精确日期与当日主装备） */}
      <div className="min-h-[26px] text-[12px]">
        {hoveredDay ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[var(--wsj-text)]">
            <span className="font-mono font-semibold">{hoveredDay.iso}</span>
            <span className="text-[var(--wsj-text-tertiary)]">·</span>
            {hoveredDay.info ? (
              <>
                <span className="font-semibold text-[var(--wsj-accent)]">
                  {t(
                    `${hoveredDay.info.count} 次`,
                    `${hoveredDay.info.count} shave(s)`,
                    isEnglish
                  )}
                </span>
                {hoveredDay.info.primaryRazor && (
                  <span className="truncate text-[var(--wsj-text-secondary)]">
                    · {hoveredDay.info.primaryRazor}
                  </span>
                )}
                {hoveredDay.info.primarySoap && (
                  <span className="truncate text-[var(--wsj-text-tertiary)]">
                    / {hoveredDay.info.primarySoap}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[var(--wsj-text-tertiary)]">
                {t("无剃须记录", "No shave recorded", isEnglish)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[var(--wsj-text-tertiary)]">
            {t(
              "将鼠标悬停在日历格子上查看当日主装备",
              "Hover any cell to inspect date and primary gear",
              isEnglish
            )}
          </span>
        )}
      </div>

      {/* 22 周 × 7 天网格 */}
      <div className="flex items-center justify-center overflow-x-auto py-1">
        <div className="inline-flex gap-[4px]">
          {weeks.map((week, wIdx) => (
            <div key={`w-${wIdx}`} className="flex flex-col gap-[4px]">
              {week.map((iso) => {
                const info = heatmapByDate[iso];
                const cnt = info?.count ?? 0;
                const titleText = info
                  ? `${iso} (${cnt})${info.primaryRazor ? ` · ${info.primaryRazor}` : ""}${info.primarySoap ? ` / ${info.primarySoap}` : ""}`
                  : `${iso}: 0`;
                return (
                  <div
                    key={iso}
                    title={titleText}
                    onMouseEnter={() => setHoveredDay({ iso, info })}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={`h-[14px] w-[14px] rounded-[3px] transition-transform hover:scale-125 ${cellClass(cnt)}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-end gap-1.5 text-[11.5px] text-[var(--wsj-text-secondary)]">
        <span>{t("少", "Less", isEnglish)}</span>
        <span className="h-[11px] w-[11px] rounded-[2.5px] bg-[var(--wsj-subtle)]" />
        <span className="h-[11px] w-[11px] rounded-[2.5px] bg-[#2E8F5C]/75" />
        <span className="h-[11px] w-[11px] rounded-[2.5px] bg-[var(--wsj-accent)]" />
        <span>{t("多", "More", isEnglish)}</span>
      </div>
    </div>
  );
};

// MARK: - 垂直柱状分布图（肤感 / 效果）

const VerticalBarDistribution: React.FC<{
  items: DistributionSlice[];
  colorForId: (id: string) => string;
  isEnglish: boolean;
}> = ({ items, colorForId, isEnglish }) => {
  const total = items.reduce((sum, i) => sum + i.count, 0);
  if (items.length === 0 || total === 0) {
    return (
      <div className="flex h-[188px] items-center justify-center text-[13px] text-[var(--wsj-text-secondary)]">
        {t("暂无数据", "No data", isEnglish)}
      </div>
    );
  }

  const maxCount = Math.max(1, ...items.map((i) => i.count));

  return (
    <div className="flex h-[188px] items-end justify-around gap-4 pt-4">
      {items.map((item) => {
        const pct = Math.round((item.count / total) * 100);
        const barHeightPct =
          item.count > 0 ? Math.max(8, Math.round((item.count / maxCount) * 100)) : 2;
        return (
          <div
            key={item.id}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
          >
            <div className="font-mono text-[12px] font-semibold text-[var(--wsj-text-secondary)]">
              {item.count}
              <span className="ml-1 text-[11px] font-normal text-[var(--wsj-text-tertiary)]">
                ({pct}%)
              </span>
            </div>
            <div className="flex h-[120px] w-full max-w-[64px] items-end rounded-lg bg-[var(--wsj-subtle)] p-1">
              <div
                className="w-full rounded-md transition-all"
                style={{
                  height: `${barHeightPct}%`,
                  backgroundColor: colorForId(item.id),
                }}
              />
            </div>
            <div
              title={item.label}
              className="max-w-full truncate text-[12.5px] font-medium text-[var(--wsj-text)]"
            >
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// MARK: - 严格分离的横向柱状排行（左侧标签列与柱条垂直分离，绝不重叠）

const HorizontalRankingBarList: React.FC<{
  items: DistributionSlice[];
  barColor: string;
  labelWidthClass?: string;
  isEnglish: boolean;
}> = ({ items, barColor, labelWidthClass = "w-[124px]", isEnglish }) => {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[160px] items-center justify-center text-[13px] text-[var(--wsj-text-secondary)]">
        {t("暂无数据", "No data", isEnglish)}
      </div>
    );
  }

  const maxCount = Math.max(1, ...items.map((i) => i.count));

  return (
    <div className="space-y-2.5 pt-1">
      {items.map((item) => {
        const widthPct =
          item.count > 0 ? Math.max(4, (item.count / maxCount) * 100) : 0;
        return (
          <div key={item.id} className="flex items-center gap-3">
            <div
              title={item.label}
              className={`${labelWidthClass} shrink-0 truncate text-right text-[13px] font-medium text-[var(--wsj-text)]`}
            >
              {item.label}
            </div>
            <div className="h-[11px] min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--wsj-subtle)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
            <div className="w-[38px] shrink-0 text-right font-mono text-[12.5px] font-semibold text-[var(--wsj-text-secondary)]">
              {item.count}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// MARK: - 主视图

export const StatsView: React.FC = () => {
  const {
    database,
    catalogSnapshot,
    statisticsSnapshot,
    aiConfig,
    isEnglish,
    getDiagnosisStatsSummary,
    showToast,
  } = useJournal();

  const [selectedBrandCategory, setSelectedBrandCategory] =
    useState<BrandChartCategory>("剃须刀");
  const [comboFilter, setComboFilter] = useState<ComboRankMode>("best");

  // AI 功能 ④：剃须复盘诊断
  const [isGeneratingDiagnosis, setIsGeneratingDiagnosis] = useState(false);
  const [diagnosisText, setDiagnosisText] = useState("");
  const [diagnosisModel, setDiagnosisModel] = useState("");
  const [diagnosisNotice, setDiagnosisNotice] = useState<string | null>(null);

  const topBrands = useMemo<DistributionSlice[]>(() => {
    const items = catalogSnapshot.itemsByCategory[selectedBrandCategory] ?? [];
    return buildBrandGroups(items)
      .filter((g) => g.totalUses > 0)
      .slice(0, 10)
      .map((g) => ({
        id: g.brand,
        label: brandDisplay(g.brand, isEnglish),
        count: g.totalUses,
      }));
  }, [catalogSnapshot, selectedBrandCategory, isEnglish]);

  const razorMaterials = useMemo<DistributionSlice[]>(() => {
    const razors = catalogSnapshot.itemsByCategory["剃须刀"] ?? [];
    const counts = new Map<string, number>();
    for (const r of razors) {
      if (r.count <= 0) continue;
      const mat = r.material
        ? materialDisplay(r.material, isEnglish)
        : t("未标注", "Unknown", isEnglish);
      counts.set(mat, (counts.get(mat) ?? 0) + r.count);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ id: label, label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [catalogSnapshot, isEnglish]);

  const comboRanking = useMemo<RazorBladeComboStat[]>(() => {
    const all = statisticsSnapshot.comboStats;
    if (comboFilter === "best") {
      return [...all]
        .filter((c) => c.uses >= 2)
        .sort((a, b) => {
          if (Math.abs(a.comfortScore - b.comfortScore) > 0.05) {
            return b.comfortScore - a.comfortScore;
          }
          return b.uses - a.uses;
        })
        .slice(0, 8);
    }
    if (comboFilter === "warning") {
      return [...all]
        .filter(
          (c) => c.stingingCount > 0 || (c.mildCount > 0 && c.painlessCount === 0)
        )
        .sort((a, b) => {
          if (a.stingingCount !== b.stingingCount) {
            return b.stingingCount - a.stingingCount;
          }
          return b.stingingRate - a.stingingRate;
        })
        .slice(0, 8);
    }
    return all.slice(0, 8);
  }, [statisticsSnapshot.comboStats, comboFilter]);

  const handleRunDiagnosis = async () => {
    if (!isAIConfigReady(aiConfig)) {
      setDiagnosisNotice(
        t(
          "请先在「外观与设置 → AI 识别接口」中启用并填写 API Key，即可生成个人湿剃复盘诊断。",
          "Enable and configure your AI API key in Settings to generate a personal shave diagnosis.",
          isEnglish
        )
      );
      return;
    }

    setIsGeneratingDiagnosis(true);
    setDiagnosisNotice(null);
    try {
      const summary = getDiagnosisStatsSummary();
      const res = await generateShaveDiagnosis(summary, aiConfig, isEnglish);
      setDiagnosisText(res.text);
      setDiagnosisModel(res.model);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDiagnosisNotice(
        t(`AI 复盘生成失败：${msg}`, `AI review failed: ${msg}`, isEnglish)
      );
    } finally {
      setIsGeneratingDiagnosis(false);
    }
  };

  const handleCopyDiagnosis = async () => {
    if (!diagnosisText) return;
    try {
      await copyText(diagnosisText);
      showToast(
        t("已复制 AI 复盘报告", "Copied AI review to clipboard", isEnglish)
      );
    } catch {
      // ignore
    }
  };

  if (database.entries.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <SectionCard className="max-w-[440px] text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--wsj-accent-soft)] text-[var(--wsj-accent)]">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-[18px] font-bold text-[var(--wsj-text)]">
            {t("暂无统计数据", "No Statistics Yet", isEnglish)}
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--wsj-text-secondary)]">
            {t(
              "记录第一篇 SOTD 或在「外观与设置」中导入 Mac 版 journal.json 后，将自动生成热力图、品牌排行与肤感分析图表。",
              "Log your first SOTD or import your Mac journal.json in Settings to automatically generate heatmaps, rankings, and comfort charts.",
              isEnglish
            )}
          </p>
        </SectionCard>
      </div>
    );
  }

  const snap = statisticsSnapshot;
  const blades = snap.bladeLongevityStats.slice(0, 8);

  return (
    <div className="h-full w-full overflow-y-auto px-7 py-6">
      <div className="mx-auto max-w-[1160px] space-y-6">
        {/* 顶部标题 + AI 复盘诊断按钮 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[26px] font-bold tracking-tight text-[var(--wsj-text)]">
            {t("数据统计", "Statistics", isEnglish)}
          </h1>

          <button
            type="button"
            disabled={isGeneratingDiagnosis}
            onClick={() => void handleRunDiagnosis()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wsj-accent)] px-4 py-2 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isGeneratingDiagnosis ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGeneratingDiagnosis
              ? t("分析中...", "Analyzing...", isEnglish)
              : t("生成 AI 复盘", "AI Review", isEnglish)}
          </button>
        </div>

        {/* AI 提示 / 错误横幅 */}
        {diagnosisNotice && (
          <div className="flex items-center gap-2.5 rounded-xl border border-[#D1851F]/45 bg-[var(--wsj-card)] px-4 py-3 text-[13px] text-[var(--wsj-text-secondary)]">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#D1851F]" />
            <span className="flex-1">{diagnosisNotice}</span>
            <button
              type="button"
              onClick={() => setDiagnosisNotice(null)}
              className="rounded-md p-1 hover:bg-[var(--wsj-subtle)]"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* AI 剃须复盘诊断结果卡片 */}
        {diagnosisText && (
          <SectionCard>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--wsj-accent)]" />
                <h2 className="text-[15.5px] font-semibold text-[var(--wsj-accent)]">
                  {t("AI 个人湿剃复盘诊断", "AI Personal Shave Diagnosis", isEnglish)}
                </h2>
                {diagnosisModel && (
                  <TagPill text={diagnosisModel} tone="neutral" />
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyDiagnosis()}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--wsj-text)] hover:opacity-85"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {t("复制", "Copy", isEnglish)}
                  </button>
                  <button
                    type="button"
                    disabled={isGeneratingDiagnosis}
                    onClick={() => void handleRunDiagnosis()}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--wsj-text)] hover:opacity-85 disabled:opacity-45"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t("重新生成", "Regenerate", isEnglish)}
                  </button>
                </div>
              </div>
              <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--wsj-text)] select-text">
                {diagnosisText}
              </div>
            </div>
          </SectionCard>
        )}

        {/* 第一排：5 张自适应等高 KPI 卡片 */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <KPICard
            title={t("总刮剃次数", "Total Shaves", isEnglish)}
            value={String(snap.totalEntries)}
          />
          <KPICard
            title={t("无痛率", "Painless Rate", isEnglish)}
            value={`${Math.round(snap.painlessRate * 100)}%`}
            subtitle={t(
              `${snap.painlessCount} / ${snap.validIrritationCount} 次记录`,
              `${snap.painlessCount} / ${snap.validIrritationCount} logged`,
              isEnglish
            )}
          />
          <KPICard
            title={t("BBS 率", "BBS Rate", isEnglish)}
            value={`${Math.round(snap.bbsRate * 100)}%`}
            subtitle={t(
              `${snap.bbsCount} / ${snap.validResultCount} 次记录`,
              `${snap.bbsCount} / ${snap.validResultCount} logged`,
              isEnglish
            )}
          />
          <KPICard
            title={t("在用器材数", "Active Gear", isEnglish)}
            value={String(snap.activeGearCount)}
            subtitle={t("在用器材 + 库存刀片", "Active + In-stock blades", isEnglish)}
          />
          <KPICard
            title={t("平均剃须间隔", "Avg Interval", isEnglish)}
            value={
              snap.avgIntervalDays > 0
                ? isEnglish
                  ? `${snap.avgIntervalDays.toFixed(1)} d`
                  : `${snap.avgIntervalDays.toFixed(1)} 天`
                : "—"
            }
          />
        </div>

        {/* 第二排：月度刮剃趋势图 + 剃须频率日历热力图 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard>
            <h2 className="mb-3 text-[15.5px] font-semibold text-[var(--wsj-text)]">
              {t("月度刮剃趋势（近 12 个月）", "Monthly Shaves (12M)", isEnglish)}
            </h2>
            <MonthlyTrendChart
              data={snap.monthlyTrend}
              isEnglish={isEnglish}
            />
          </SectionCard>

          <SectionCard>
            <h2 className="mb-3 text-[15.5px] font-semibold text-[var(--wsj-text)]">
              {t("剃须频率日历热力图", "Activity Heatmap", isEnglish)}
            </h2>
            <ShaveHeatmapCardBody
              heatmapByDate={snap.heatmapByDate}
              isEnglish={isEnglish}
            />
          </SectionCard>
        </div>

        {/* 第三排：肤感分布 + 效果分布 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard>
            <h2 className="mb-3 text-[15.5px] font-semibold text-[var(--wsj-text)]">
              {t("肤感分布", "Comfort Breakdown", isEnglish)}
            </h2>
            <VerticalBarDistribution
              items={snap.irritationDistribution}
              isEnglish={isEnglish}
              colorForId={(id) => {
                if (id === "无痛") return "#2E8F5C";
                if (id === "微痛") return "#D1851F";
                if (id === "刺痛") return "#CC3D3D";
                return "#626875";
              }}
            />
          </SectionCard>

          <SectionCard>
            <h2 className="mb-3 text-[15.5px] font-semibold text-[var(--wsj-text)]">
              {t("剃须效果分布", "Closeness Breakdown", isEnglish)}
            </h2>
            <VerticalBarDistribution
              items={snap.resultDistribution}
              isEnglish={isEnglish}
              colorForId={(id) => {
                if (id === "BBS") return "#2973CC";
                if (id === "DFS") return "#2E8F5C";
                if (id === "CCS") return "#5280B8";
                return "#8D94A1";
              }}
            />
          </SectionCard>
        </div>

        {/* 第四排：品牌 TOP 10 横向柱状图 + 剃须刀材质分布横向柱状图 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard>
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15.5px] font-semibold text-[var(--wsj-text)]">
                {t("品牌 TOP 10", "Top 10 Brands", isEnglish)}
              </h2>
              <div className="inline-flex rounded-[10px] bg-[var(--wsj-subtle)] p-1">
                {BRAND_CHART_CATEGORIES.map((cat) => {
                  const active = selectedBrandCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedBrandCategory(cat)}
                      className={`rounded-lg px-2.5 py-1 text-[12px] font-medium transition ${
                        active
                          ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                          : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                      }`}
                    >
                      {categoryPluralName(cat as GearCategory, isEnglish)}
                    </button>
                  );
                })}
              </div>
            </div>
            <HorizontalRankingBarList
              items={topBrands}
              barColor="var(--wsj-accent)"
              labelWidthClass="w-[124px]"
              isEnglish={isEnglish}
            />
          </SectionCard>

          <SectionCard>
            <h2 className="mb-3.5 text-[15.5px] font-semibold text-[var(--wsj-text)]">
              {t("剃须刀材质分布", "Razor Materials", isEnglish)}
            </h2>
            <HorizontalRankingBarList
              items={razorMaterials}
              barColor="#2E8F5C"
              labelWidthClass="w-[104px]"
              isEnglish={isEnglish}
            />
          </SectionCard>
        </div>

        {/* 第五排：刀 + 刀片组合排行 & 刀片寿命估算 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard>
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15.5px] font-semibold text-[var(--wsj-text)]">
                {t("刀 + 刀片搭配", "Razor + Blade Combos", isEnglish)}
              </h2>
              <div className="inline-flex rounded-[10px] bg-[var(--wsj-subtle)] p-1">
                {(
                  [
                    ["best", t("黄金搭配", "Top", isEnglish)],
                    ["warning", t("易刺激", "Irritation", isEnglish)],
                    ["mostUsed", t("最常用", "Most Used", isEnglish)],
                  ] as [ComboRankMode, string][]
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setComboFilter(mode)}
                    className={`rounded-lg px-2.5 py-1 text-[12px] font-medium transition ${
                      comboFilter === mode
                        ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                        : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {comboRanking.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[var(--wsj-text-secondary)]">
                {t("暂无符合条件的组合记录", "No matching combo data", isEnglish)}
              </div>
            ) : (
              <div className="space-y-2">
                {comboRanking.map((stat, idx) => {
                  const fullTitle = `${stat.razorName} + ${stat.bladeName}`;
                  return (
                    <div
                      key={stat.id}
                      className="flex items-center gap-3 rounded-[10px] bg-[var(--wsj-subtle)] px-3 py-2.5"
                    >
                      <span className="w-6 shrink-0 font-mono text-[12px] font-bold text-[var(--wsj-text-secondary)]">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          title={fullTitle}
                          className="truncate text-[13px] font-semibold text-[var(--wsj-text)]"
                        >
                          {fullTitle}
                        </div>
                        <div className="mt-0.5 truncate text-[11.5px] text-[var(--wsj-text-secondary)]">
                          {t(
                            `${stat.uses} 次 · 无痛 ${stat.painlessCount} · 微痛 ${stat.mildCount} · 刺痛 ${stat.stingingCount}`,
                            `${stat.uses}x · Painless ${stat.painlessCount} · Mild ${stat.mildCount} · Stinging ${stat.stingingCount}`,
                            isEnglish
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <TagPill
                          text={`BBS ${Math.round(stat.bbsRate * 100)}%`}
                          tone="forest"
                        />
                        <TagPill
                          text={t(
                            `无痛 ${Math.round(stat.painlessRate * 100)}%`,
                            `${Math.round(stat.painlessRate * 100)}%`,
                            isEnglish
                          )}
                          tone={stat.stingingCount > 0 ? "crimson" : "accent"}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <div className="mb-3.5 flex items-center gap-2">
              <h2 className="text-[15.5px] font-semibold text-[var(--wsj-text)]">
                {t("刀片寿命", "Blade Longevity", isEnglish)}
              </h2>
              <TagPill text={t("序号估算", "Est.", isEnglish)} tone="neutral" />
            </div>

            {blades.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[var(--wsj-text-secondary)]">
                {t("暂无足够刀片使用记录", "Not enough blade usage data", isEnglish)}
              </div>
            ) : (
              <div className="space-y-2">
                {blades.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-[10px] bg-[var(--wsj-subtle)] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        title={b.bladeName}
                        className="truncate text-[13px] font-semibold text-[var(--wsj-text)]"
                      >
                        {b.bladeName}
                      </div>
                      <div className="mt-0.5 truncate text-[11.5px] text-[var(--wsj-text-secondary)]">
                        {t(
                          `累计 ${b.totalShaves} 次 · 单片最高 ${b.maxUseCount} 次`,
                          `${b.totalShaves} shaves · Max ${b.maxUseCount}/blade`,
                          isEnglish
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[12.5px] font-semibold text-[var(--wsj-accent)]">
                      {isEnglish
                        ? `${b.avgCycleUses.toFixed(1)} / blade`
                        : `均 ${b.avgCycleUses.toFixed(1)} 次`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
