import {
  ALL_GEAR_CATEGORIES,
  ALL_IRRITATION_LEVELS,
  ALL_SHAVE_RESULTS,
  type BladeLongevityStat,
  type DistributionSlice,
  type HeatmapDayInfo,
  type IrritationLevel,
  type JournalDatabase,
  type JournalEntry,
  type MonthlyShavePoint,
  type ParsedProcess,
  type RazorBladeComboStat,
  type ShaveResult,
  type StatisticsSnapshot,
} from "../types/journal";
import {
  parseBladeUsage,
  resolveGear,
  type GearCatalogSnapshot,
} from "./gearKnowledge";
import { irritationDisplay } from "./l10n";
import {
  getAfterShower,
  getHotTowel,
  getPrimaryRazor,
  getProcessText,
  getPureLatheringMethod,
  getSoap,
  parseDateISO,
  parseProcessText,
} from "./processParser";

function extractSlottedValues(
  entry: JournalEntry,
  prefix: string
): { slot: string; value: string }[] {
  const result: { slot: string; value: string }[] = [];
  for (const field of entry.fields ?? []) {
    const val = (field.value ?? "").trim();
    if (!val || val === "无" || val === "-") continue;
    if (field.label === prefix) {
      result.push({ slot: "", value: val });
    } else if (field.label.startsWith(prefix)) {
      const suffix = field.label.slice(prefix.length);
      if (/^\d+$/.test(suffix)) {
        result.push({ slot: suffix, value: val });
      }
    }
  }
  return result;
}

function pairRazorsAndBlades(
  razors: { slot: string; value: string }[],
  blades: { slot: string; value: string }[]
): { razor: string; blade: string }[] {
  if (razors.length === 0 || blades.length === 0) return [];

  const bladeBySlot = new Map<string, string>();
  for (const b of blades) {
    if (!bladeBySlot.has(b.slot)) {
      bladeBySlot.set(b.slot, b.value);
    }
  }
  const hasNumberedSlots =
    razors.some((r) => r.slot !== "") && blades.some((b) => b.slot !== "");
  if (hasNumberedSlots) {
    const matched: { razor: string; blade: string }[] = [];
    for (const r of razors) {
      const b = bladeBySlot.get(r.slot);
      if (b) matched.push({ razor: r.value, blade: b });
    }
    if (matched.length > 0) return matched;
  }

  const pairCount = Math.min(razors.length, blades.length);
  const pairs: { razor: string; blade: string }[] = [];
  for (let i = 0; i < pairCount; i++) {
    pairs.push({ razor: razors[i].value, blade: blades[i].value });
  }
  return pairs;
}

function computeSeverity(
  proc: ParsedProcess,
  rawProcess: string
): 0 | 1 | 2 {
  const lower = rawProcess.toLowerCase();
  if (
    proc.irritation === "刺痛" ||
    rawProcess.includes("刮伤") ||
    rawProcess.includes("出血") ||
    rawProcess.includes("血点") ||
    lower.includes("weeper") ||
    lower.includes("nick")
  ) {
    return 2;
  }
  if (proc.irritation === "微痛") {
    return 1;
  }
  return 0;
}

export function buildStatisticsSnapshot(
  db: JournalDatabase,
  catalog: GearCatalogSnapshot,
  parsedProcessByEntryID: Record<string, ParsedProcess>,
  isEn: boolean
): StatisticsSnapshot {
  const entries = db.entries ?? [];

  let activeGearCount = 0;
  for (const cat of ALL_GEAR_CATEGORIES) {
    for (const item of catalog.itemsByCategory[cat] ?? []) {
      if (cat === "刀片") {
        if (item.status === "有") activeGearCount += 1;
      } else if (item.status === "在用") {
        activeGearCount += 1;
      }
    }
  }

  const emptyIrritation: Record<IrritationLevel, number> = {
    无痛: 0,
    微痛: 0,
    刺痛: 0,
  };

  if (entries.length === 0) {
    return {
      totalEntries: 0,
      validResultCount: 0,
      validIrritationCount: 0,
      bbsCount: 0,
      painlessCount: 0,
      bbsRate: 0,
      painlessRate: 0,
      activeGearCount,
      avgIntervalDays: 0,
      resultDistribution: [],
      irritationDistribution: [],
      irritationCountsByLevel: emptyIrritation,
      monthlyTrend: [],
      heatmapByDate: {},
      comboStats: [],
      bladeLongevityStats: [],
    };
  }

  const resolveRazorCache = new Map<string, { brand: string; name: string }>();
  const resolveBladeCache = new Map<string, { brand: string; name: string }>();
  const resolveSoapCache = new Map<string, { brand: string; name: string }>();

  const getRazorInfo = (raw: string) => {
    const hit = resolveRazorCache.get(raw);
    if (hit) return hit;
    const ov = resolveGear("剃须刀", raw, db).override;
    const res = { brand: ov.brand, name: ov.name };
    resolveRazorCache.set(raw, res);
    return res;
  };

  const getBladeInfo = (raw: string) => {
    const hit = resolveBladeCache.get(raw);
    if (hit) return hit;
    const ov = resolveGear("刀片", raw, db).override;
    const res = { brand: ov.brand, name: ov.name };
    resolveBladeCache.set(raw, res);
    return res;
  };

  const getSoapInfo = (raw: string) => {
    const hit = resolveSoapCache.get(raw);
    if (hit) return hit;
    const ov = resolveGear("剃须皂", raw, db).override;
    const res = { brand: ov.brand, name: ov.name };
    resolveSoapCache.set(raw, res);
    return res;
  };

  let validResultCount = 0;
  let validIrritationCount = 0;
  let bbsCount = 0;
  let painlessCount = 0;
  let minTime: number | null = null;
  let maxTime: number | null = null;
  let parsedDateCount = 0;

  const resultCounts: Record<ShaveResult, number> = {
    BBS: 0,
    DFS: 0,
    CCS: 0,
    SAS: 0,
  };
  const irritationCounts: Record<IrritationLevel, number> = {
    无痛: 0,
    微痛: 0,
    刺痛: 0,
  };
  const monthCounts = new Map<string, number>();
  const heatmapByDate: Record<string, HeatmapDayInfo> = {};
  const comboMap = new Map<string, RazorBladeComboStat>();
  const bladeMap = new Map<
    string,
    { brand: string; name: string; uses: number[]; total: number }
  >();

  for (const entry of entries) {
    const procText = getProcessText(entry);
    const proc =
      parsedProcessByEntryID[entry.id] ?? parseProcessText(procText);

    if (proc.result) {
      validResultCount += 1;
      resultCounts[proc.result] += 1;
      if (proc.result === "BBS") bbsCount += 1;
    }
    if (proc.irritation) {
      validIrritationCount += 1;
      irritationCounts[proc.irritation] += 1;
      if (proc.irritation === "无痛") painlessCount += 1;
    }

    const parsedDate = parseDateISO(entry.date);
    if (parsedDate) {
      const ts = parsedDate.getTime();
      parsedDateCount += 1;
      if (minTime === null || ts < minTime) minTime = ts;
      if (maxTime === null || ts > maxTime) maxTime = ts;
    }

    if (entry.date.length >= 7) {
      const ym = entry.date.slice(0, 7);
      monthCounts.set(ym, (monthCounts.get(ym) ?? 0) + 1);
    }

    const sev = computeSeverity(proc, procText);
    const primaryRazorRaw = getPrimaryRazor(entry);
    const primaryRazor = primaryRazorRaw ? getRazorInfo(primaryRazorRaw).name : "";
    const primarySoapRaw = getSoap(entry);
    const primarySoap = primarySoapRaw ? getSoapInfo(primarySoapRaw).name : "";

    const existingDay = heatmapByDate[entry.date];
    if (existingDay) {
      existingDay.count += 1;
      if (sev > existingDay.severity) existingDay.severity = sev;
      if (!existingDay.primaryRazor && primaryRazor) {
        existingDay.primaryRazor = primaryRazor;
      }
      if (!existingDay.primarySoap && primarySoap) {
        existingDay.primarySoap = primarySoap;
      }
    } else {
      heatmapByDate[entry.date] = {
        date: entry.date,
        count: 1,
        primaryRazor,
        primarySoap,
        severity: sev,
      };
    }

    const slottedRazors = extractSlottedValues(entry, "剃须刀");
    const slottedBlades = extractSlottedValues(entry, "刀片");
    const pairs = pairRazorsAndBlades(slottedRazors, slottedBlades);

    for (const { razor, blade } of pairs) {
      const rInfo = getRazorInfo(razor);
      const bInfo = getBladeInfo(blade);
      const key = `${rInfo.name}||${bInfo.name}`;
      let stat = comboMap.get(key);
      if (!stat) {
        stat = {
          id: key,
          razorBrand: rInfo.brand,
          razorName: rInfo.name,
          bladeBrand: bInfo.brand,
          bladeName: bInfo.name,
          uses: 0,
          bbsCount: 0,
          painlessCount: 0,
          mildCount: 0,
          stingingCount: 0,
          bbsRate: 0,
          painlessRate: 0,
          stingingRate: 0,
          comfortScore: 0,
        };
        comboMap.set(key, stat);
      }
      stat.uses += 1;
      if (proc.result === "BBS") stat.bbsCount += 1;
      if (proc.irritation === "无痛") stat.painlessCount += 1;
      if (proc.irritation === "微痛") stat.mildCount += 1;
      if (proc.irritation === "刺痛") stat.stingingCount += 1;
    }

    for (const { value: rawBlade } of slottedBlades) {
      const parsed = parseBladeUsage(rawBlade);
      const bInfo = getBladeInfo(rawBlade);
      let rec = bladeMap.get(bInfo.name);
      if (!rec) {
        rec = { brand: bInfo.brand, name: bInfo.name, uses: [], total: 0 };
        bladeMap.set(bInfo.name, rec);
      }
      rec.total += 1;
      if (parsed.useCount !== null) {
        rec.uses.push(parsed.useCount);
      }
    }
  }

  const resultDistribution: DistributionSlice[] = ALL_SHAVE_RESULTS.map((r) => ({
    id: r,
    label: r,
    count: resultCounts[r],
  })).filter((s) => s.count > 0);

  const irritationDistribution: DistributionSlice[] = ALL_IRRITATION_LEVELS.map(
    (lvl) => ({
      id: lvl,
      label: irritationDisplay(lvl, isEn),
      count: irritationCounts[lvl],
    })
  );

  const monthlyTrend: MonthlyShavePoint[] = Array.from(monthCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, count]) => {
      const parts = month.split("-");
      const label =
        parts.length === 2 ? `${parts[0].slice(-2)}/${parts[1]}` : month;
      return { month, label, count };
    });

  const comboStats: RazorBladeComboStat[] = Array.from(comboMap.values()).map(
    (stat) => {
      const uses = stat.uses;
      const bbsRate = uses > 0 ? stat.bbsCount / uses : 0;
      const painlessRate = uses > 0 ? stat.painlessCount / uses : 0;
      const stingingRate = uses > 0 ? stat.stingingCount / uses : 0;
      const rawScore =
        uses > 0
          ? (stat.painlessCount * 1.0 +
              stat.mildCount * 0.45 -
              stat.stingingCount * 0.9 +
              stat.bbsCount * 0.4) /
            uses
          : 0;
      const comfortScore = Math.max(0, Math.min(1.4, rawScore));
      return {
        ...stat,
        bbsRate,
        painlessRate,
        stingingRate,
        comfortScore,
      };
    }
  );

  comboStats.sort((a, b) => {
    if (a.uses !== b.uses) return b.uses - a.uses;
    return b.comfortScore - a.comfortScore;
  });

  const bladeLongevityStats: BladeLongevityStat[] = [];
  for (const rec of bladeMap.values()) {
    if (rec.total < 2) continue;
    const maxUseCount =
      rec.uses.length > 0 ? Math.max(...rec.uses) : 1;
    const ones = Math.max(1, rec.uses.filter((u) => u === 1).length);
    const rawAvg = rec.uses.length === 0 ? 1.0 : rec.uses.length / ones;
    bladeLongevityStats.push({
      id: rec.name,
      brand: rec.brand,
      bladeName: rec.name,
      totalShaves: rec.total,
      maxUseCount,
      avgCycleUses: Math.min(maxUseCount, Math.max(1.0, rawAvg)),
    });
  }
  bladeLongevityStats.sort((a, b) => b.totalShaves - a.totalShaves);

  const avgIntervalDays =
    parsedDateCount >= 2 && minTime !== null && maxTime !== null
      ? (maxTime - minTime) / 86_400_000 / (parsedDateCount - 1)
      : 0;

  return {
    totalEntries: entries.length,
    validResultCount,
    validIrritationCount,
    bbsCount,
    painlessCount,
    bbsRate: validResultCount > 0 ? bbsCount / validResultCount : 0,
    painlessRate:
      validIrritationCount > 0 ? painlessCount / validIrritationCount : 0,
    activeGearCount,
    avgIntervalDays,
    resultDistribution,
    irritationDistribution,
    irritationCountsByLevel: irritationCounts,
    monthlyTrend,
    heatmapByDate,
    comboStats,
    bladeLongevityStats,
  };
}

/** 对齐 Mac StatisticsEngine.buildDiagnosisStatsSummary，为 AI 复盘提供真实聚合统计摘要 */
export function buildDiagnosisStatsSummary(
  db: JournalDatabase,
  catalog: GearCatalogSnapshot,
  snapshot: StatisticsSnapshot,
  parsedProcessByEntryID: Record<string, ParsedProcess>
): string {
  const entries = db.entries ?? [];
  const bbsPct = Math.round(snapshot.bbsRate * 100);
  const irrTotal = snapshot.validIrritationCount;
  const painlessPct =
    irrTotal > 0
      ? Math.round((snapshot.irritationCountsByLevel["无痛"] / irrTotal) * 100)
      : 0;
  const mildPct =
    irrTotal > 0
      ? Math.round((snapshot.irritationCountsByLevel["微痛"] / irrTotal) * 100)
      : 0;
  const stingPct =
    irrTotal > 0
      ? Math.round((snapshot.irritationCountsByLevel["刺痛"] / irrTotal) * 100)
      : 0;

  const comfortRate = (subset: JournalEntry[]): string => {
    const valid = subset
      .map((e) => parsedProcessByEntryID[e.id] ?? parseProcessText(getProcessText(e)))
      .filter((p) => p.irritation !== null);
    if (valid.length === 0) return "n/a";
    const ok = valid.filter((p) => p.irritation === "无痛").length;
    return `${Math.round((ok / valid.length) * 100)}% painless (n=${valid.length})`;
  };

  const hotYes = entries.filter((e) => getHotTowel(e));
  const hotNo = entries.filter((e) => !getHotTowel(e));
  const showerYes = entries.filter((e) => getAfterShower(e).startsWith("是"));
  const showerNo = entries.filter((e) => !getAfterShower(e).startsWith("是"));
  const bowlLather = entries.filter((e) => getPureLatheringMethod(e) === "碗起");
  const faceLather = entries.filter((e) => getPureLatheringMethod(e) === "脸起");

  const topRazors = (catalog.itemsByCategory["剃须刀"] ?? [])
    .slice(0, 6)
    .map((i) => `${i.name}(${i.count})`)
    .join(", ");
  const topBlades = (catalog.itemsByCategory["刀片"] ?? [])
    .slice(0, 6)
    .map((i) => `${i.name}(${i.count})`)
    .join(", ");
  const topBrushes = (catalog.itemsByCategory["剃须刷"] ?? [])
    .slice(0, 5)
    .map((i) => `${i.name}(${i.count})`)
    .join(", ");
  const topSoaps = (catalog.itemsByCategory["剃须皂"] ?? [])
    .slice(0, 5)
    .map((i) => `${i.name}(${i.count})`)
    .join(", ");

  const golden = [...snapshot.comboStats]
    .filter((c) => c.uses >= 2)
    .sort((a, b) => b.comfortScore - a.comfortScore)
    .slice(0, 6)
    .map(
      (c) =>
        `${c.razorName} + ${c.bladeName} (${Math.round(c.painlessRate * 100)}% painless, ${Math.round(c.bbsRate * 100)}% BBS, n=${c.uses})`
    )
    .join("; ");

  const stinging = [...snapshot.comboStats]
    .filter((c) => c.stingingCount > 0 || (c.mildCount > 0 && c.painlessCount === 0))
    .sort((a, b) => b.stingingCount - a.stingingCount)
    .slice(0, 6)
    .map(
      (c) =>
        `${c.razorName} + ${c.bladeName} (stinging:${c.stingingCount}, mild:${c.mildCount}, n=${c.uses})`
    )
    .join("; ");

  return [
    `Total SOTD entries: ${entries.length}`,
    `BBS rate: ${bbsPct}%`,
    `Comfort breakdown: Painless ${painlessPct}%, Mild ${mildPct}%, Stinging ${stingPct}%`,
    `Hot towel: YES = ${comfortRate(hotYes)} | NO = ${comfortRate(hotNo)}`,
    `Post-shower: YES = ${comfortRate(showerYes)} | NO = ${comfortRate(showerNo)}`,
    `Lather method: Bowl = ${comfortRate(bowlLather)} | Face = ${comfortRate(faceLather)}`,
    `Top Razors: ${topRazors || "none"}`,
    `Top Blades: ${topBlades || "none"}`,
    `Top Brushes: ${topBrushes || "none"}`,
    `Top Soaps: ${topSoaps || "none"}`,
    `Golden Combos: ${golden || "none"}`,
    `High-Irritation Combos: ${stinging || "none"}`,
  ].join("\n");
}
