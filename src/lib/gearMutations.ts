import {
  ALL_GEAR_CATEGORIES,
  type BladeType,
  type BrandGroup,
  type GearCategory,
  type GearEntryFieldSnapshot,
  type GearHistorySnapshot,
  type GearItem,
  type GearOverride,
  type JournalDatabase,
  type JournalEntry,
  type JournalField,
  type RazorType,
} from "../types/journal";
import {
  getSpecTags,
  inferDefaultOverride,
  inferMaterial,
  isShortGapSpec,
  normalizeGearStatus,
  normalizeKey,
  normalizePlateType,
  normalizeRazorType,
  parseBladeUsage,
  type GearCatalogSnapshot,
} from "./gearKnowledge";
import {
  brushMaterialDisplay,
  categorySupportsSample,
  t,
} from "./l10n";
import {
  extractBowlName,
  getBowl,
  getFieldValues,
} from "./processParser";

const MAX_HISTORY_DEPTH = 30;
const LEADING_GAP_REGEX = /^\s*(\d+(?:\.\d+)?)\s*(mm)?(\+{1,3})?/i;

// MARK: - Brand Logo Key

/** 与 Mac 版 BrandLogoCache.normalizedBrandKey 及 Rust 后端 100% 一致 */
export function normalizedBrandKey(brand: string): string {
  return Array.from(brand.trim().toLowerCase())
    .map((ch) => (/[\p{L}\p{N}]/u.test(ch) ? ch : "_"))
    .join("");
}

// MARK: - Razor / Blade Compatibility & Random Draw Eligibility

export function razorRequiresBlade(razorType?: RazorType): boolean {
  return razorType !== "直剃";
}

export function matchingBladeTypeForRazor(
  razorType?: RazorType
): BladeType | null {
  switch (razorType) {
    case "Double Edge (DE)":
    case "Single Edge (半DE)":
    case "Twin Blade":
      return "DE";
    case "Single Edge (AC)":
    case "替刃":
      return "AC";
    case "Single Edge (GEM)":
      return "GEM";
    case "Single Edge (Injector)":
      return "Injector";
    case "盒刀":
      return "盒刀头";
    case "直剃":
    case "其他":
    default:
      return null;
  }
}

export function getEligibleDrawItems(
  all: GearItem[],
  category: GearCategory,
  matchingRazor?: GearItem | null
): GearItem[] {
  if (category === "刀片") {
    const inStock = all.filter((item) => item.status === "有");
    if (!matchingRazor || !matchingRazor.razorType) {
      return inStock;
    }
    if (!razorRequiresBlade(matchingRazor.razorType)) {
      return [];
    }
    const requiredType = matchingBladeTypeForRazor(matchingRazor.razorType);
    if (requiredType) {
      return inStock.filter((item) => item.bladeType === requiredType);
    }
    return inStock;
  }
  return all.filter((item) => item.status === "在用");
}

// MARK: - Brand Grouping & Spec Formatting

export function buildBrandGroups(items: GearItem[]): BrandGroup[] {
  const byBrand = new Map<string, GearItem[]>();
  for (const item of items) {
    const list = byBrand.get(item.brand);
    if (list) {
      list.push(item);
    } else {
      byBrand.set(item.brand, [item]);
    }
  }

  const groups: BrandGroup[] = [];
  for (const [brand, list] of byBrand.entries()) {
    const sorted = [...list].sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
    let totalUses = 0;
    let latestDate = "";
    for (const item of sorted) {
      totalUses += item.count;
      if (item.lastUsedDate > latestDate) {
        latestDate = item.lastUsedDate;
      }
    }
    groups.push({
      brand,
      items: sorted,
      totalUses,
      latestDate,
    });
  }

  groups.sort((a, b) => {
    if (a.totalUses !== b.totalUses) return b.totalUses - a.totalUses;
    return a.brand.localeCompare(b.brand);
  });
  return groups;
}

export function getGearItemSpecTags(item: GearItem, isEn: boolean): string[] {
  return getSpecTags(item.category, overrideFromGearItem(item), isEn, false);
}

// MARK: - GearOverride Construction & Sanitization (对齐 Mac GearSanitizer)

export function overrideFromGearItem(item: GearItem): GearOverride {
  const ov: GearOverride = {
    brand: item.brand,
    name: item.name,
    status: item.status,
  };
  if (item.model.trim()) ov.model = item.model.trim();
  if (item.razorType) ov.razorType = item.razorType;
  if (item.isAdjustable) ov.isAdjustable = true;
  if (item.isSlant) ov.isSlant = true;
  if (item.material) ov.material = item.material;
  if (item.plateType) ov.plateType = item.plateType;
  if (item.gapOrSpec) ov.gapOrSpec = item.gapOrSpec;
  if (item.bladeType) ov.bladeType = item.bladeType;
  if (item.handleBrand) ov.handleBrand = item.handleBrand;
  if (item.brushMaterial) ov.brushMaterial = item.brushMaterial;
  if (item.badgerTreatment) ov.badgerTreatment = item.badgerTreatment;
  if (item.badgerBand) ov.badgerBand = item.badgerBand;
  if (item.knotSize) ov.knotSize = item.knotSize;
  if (item.knotShape) ov.knotShape = item.knotShape;
  if (item.isSample) ov.isSample = true;
  if (item.notes) ov.notes = item.notes;
  if (item.recognizedSource) ov.recognizedSource = item.recognizedSource;
  if (item.isManuallyConfirmed) ov.isManuallyConfirmed = true;
  return ov;
}

export function sanitizeBrand(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  switch (trimmed.toLowerCase()) {
    case "karve shaving co.":
    case "karve shaving co":
    case "karve shaving":
      return "Karve";
    case "lambda razors":
      return "Lambda";
    case "blutt rasur":
      return "Blutt";
    case "blackland razors":
      return "Blackland";
    case "wolfman razors":
      return "Wolfman";
    case "tatara razors":
      return "Tatara";
    case "aylsworth razors":
      return "Aylsworth";
    default:
      return trimmed;
  }
}

export function sanitizeMaterialStrict(
  raw: string | undefined
): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return inferMaterial(trimmed) ?? trimmed;
}

export function sanitizeModel(
  rawModel: string | undefined
): string | undefined {
  let text = rawModel?.trim();
  if (!text) return undefined;
  const suffixPatterns = [
    /\s+(?:316l|304|stainless\s+steel|stainless|titanium|brass|copper|bronze|aluminum|aluminium|zamak)$/i,
    /\s+(?:ss|ti|cu|al)$/i,
  ];
  for (const pat of suffixPatterns) {
    const next = text.replace(pat, "").trim();
    if (next) text = next;
  }
  return text || undefined;
}

function sanitizeGapAndNotes(
  rawGap: string | undefined,
  existingNotes: string | undefined
): { gapOrSpec?: string; notes?: string } {
  const noteParts: string[] = [];
  const ex = existingNotes?.trim();
  if (ex) noteParts.push(ex);

  let finalGap: string | undefined;
  const trimmedGap = rawGap?.trim();
  if (trimmedGap) {
    const shortGap = isShortGapSpec(trimmedGap);
    if (shortGap) {
      finalGap = shortGap;
    } else {
      if (
        !noteParts.some((p) =>
          p.toLowerCase().includes(trimmedGap.toLowerCase())
        )
      ) {
        noteParts.push(trimmedGap);
      }
      const match = trimmedGap.match(LEADING_GAP_REGEX);
      if (match?.[1]) {
        const num = match[1];
        const plus = match[3] ?? "";
        const mm = !plus && match[2] ? "mm" : "";
        const candidate = `${num}${mm}${plus}`;
        if (candidate.length <= 10 && isShortGapSpec(candidate)) {
          finalGap = candidate;
        }
      }
    }
  }

  return {
    gapOrSpec: finalGap,
    notes: noteParts.length > 0 ? noteParts.join("；") : undefined,
  };
}

export function sanitizeOverride(
  raw: GearOverride,
  category: GearCategory
): GearOverride {
  const cleanBrand = sanitizeBrand(raw.brand) ?? (raw.brand.trim() || "品牌未注明");
  const cleanName = raw.name.trim();
  const clean: GearOverride = {
    brand: cleanBrand,
    name: cleanName,
    status: normalizeGearStatus(raw.status as string | undefined, category),
  };

  if (category === "剃须刀") {
    const cleanModel = sanitizeModel(raw.model);
    if (cleanModel) clean.model = cleanModel;
    const rt = normalizeRazorType(raw.razorType as string | undefined);
    if (rt) clean.razorType = rt;
    if (raw.isAdjustable) clean.isAdjustable = true;
    const { plateType, impliedSlant } = normalizePlateType(
      raw.plateType as string | undefined
    );
    if (raw.isSlant || impliedSlant) clean.isSlant = true;
    if (plateType) clean.plateType = plateType;
    const mat = sanitizeMaterialStrict(raw.material);
    if (mat) clean.material = mat;
    const { gapOrSpec, notes } = sanitizeGapAndNotes(raw.gapOrSpec, raw.notes);
    if (gapOrSpec) clean.gapOrSpec = gapOrSpec;
    if (notes) clean.notes = notes;
  } else {
    const m = raw.model?.trim();
    if (m) clean.model = m;
    const n = raw.notes?.trim();
    if (n) clean.notes = n;
  }

  if (category === "刀片") {
    if (raw.bladeType) clean.bladeType = raw.bladeType;
  }

  if (category === "剃须刷") {
    const hb = raw.handleBrand?.trim();
    if (hb && hb.toLowerCase() !== cleanBrand.toLowerCase()) {
      clean.handleBrand = hb;
    }
    if (raw.brushMaterial) clean.brushMaterial = raw.brushMaterial;
    if (raw.brushMaterial === "獾毛") {
      if (raw.badgerTreatment) clean.badgerTreatment = raw.badgerTreatment;
      if (raw.badgerBand) clean.badgerBand = raw.badgerBand;
    }
    const ks = raw.knotSize?.trim();
    if (ks) clean.knotSize = ks;
    if (raw.knotShape) clean.knotShape = raw.knotShape;
  }

  if (categorySupportsSample(category) && raw.isSample) {
    clean.isSample = true;
  }

  if (raw.recognizedSource?.trim()) {
    clean.recognizedSource = raw.recognizedSource.trim();
  }
  if (raw.isManuallyConfirmed) {
    clean.isManuallyConfirmed = true;
  }

  return clean;
}

// MARK: - Merge Conflict Guard (对齐 Mac GearMergeGuard)

function normSpec(raw: string | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  return s.toLowerCase().replace(/\s+/g, "");
}

export function checkGearMergeConflict(
  source: GearItem,
  target: GearItem,
  isEn: boolean
): string | null {
  if (source.id === target.id) {
    return t("源器材与目标器材相同", "Source and target are the same item", isEn);
  }
  if (source.category !== target.category) {
    return t("分类不同，禁止合并", "Category mismatch", isEn);
  }

  if (source.category === "剃须刀") {
    const m1 = normSpec(source.material);
    const m2 = normSpec(target.material);
    if (m1 && m2 && m1 !== m2) {
      return t(
        `材质不同（${source.material} vs ${target.material}）`,
        `Different materials (${source.material} vs ${target.material})`,
        isEn
      );
    }
    if (source.plateType && target.plateType && source.plateType !== target.plateType) {
      return t(
        `底板形制不同（${source.plateType} vs ${target.plateType}）`,
        `Different baseplates (${source.plateType} vs ${target.plateType})`,
        isEn
      );
    }
    const g1 = normSpec(source.gapOrSpec);
    const g2 = normSpec(target.gapOrSpec);
    if (g1 && g2 && g1 !== g2) {
      return t(
        `刀隙/规格不同（${source.gapOrSpec} vs ${target.gapOrSpec}）`,
        `Different gap/spec (${source.gapOrSpec} vs ${target.gapOrSpec})`,
        isEn
      );
    }
    if (source.isSlant !== target.isSlant) {
      return t("Slant 斜头属性不同", "Different Slant geometry", isEn);
    }
  } else if (source.category === "剃须刷") {
    const k1 = normSpec(source.knotSize);
    const k2 = normSpec(target.knotSize);
    if (k1 && k2 && k1 !== k2) {
      return t(
        `结径不同（${source.knotSize} vs ${target.knotSize}）`,
        `Different knot sizes (${source.knotSize} vs ${target.knotSize})`,
        isEn
      );
    }
    if (source.knotShape && target.knotShape && source.knotShape !== target.knotShape) {
      return t(
        `毛型不同（${source.knotShape} vs ${target.knotShape}）`,
        `Different knot shapes (${source.knotShape} vs ${target.knotShape})`,
        isEn
      );
    }
    if (
      source.brushMaterial &&
      target.brushMaterial &&
      source.brushMaterial !== target.brushMaterial
    ) {
      return t(
        `刷毛材质不同（${brushMaterialDisplay(source.brushMaterial, false)} vs ${brushMaterialDisplay(target.brushMaterial, false)}）`,
        "Different hair materials",
        isEn
      );
    }
    const h1 = normSpec(source.handleBrand);
    const h2 = normSpec(target.handleBrand);
    if (h1 && h2 && h1 !== h2) {
      return t(
        `手柄品牌不同（${source.handleBrand} vs ${target.handleBrand}）`,
        "Different handle brands",
        isEn
      );
    }
  } else if (source.category === "剃须皂" || source.category === "须后") {
    if (source.isSample !== target.isSample) {
      return t("正装与小样属性不同", "Full-size vs Sample mismatch", isEn);
    }
  }

  return null;
}

// MARK: - Raw Key Samples & Entry Reference Counting

export function getRawEntrySamples(
  rawKey: string,
  category: GearCategory,
  db: JournalDatabase
): { display: string; count: number } {
  const counts = new Map<string, number>();

  for (const entry of db.entries ?? []) {
    let values: string[] = [];
    if (category === "剃须刀") {
      values = getFieldValues(entry, ["剃须刀"]);
    } else if (category === "刀片") {
      values = getFieldValues(entry, ["刀片"]).map(
        (v) => parseBladeUsage(v).baseName
      );
    } else if (category === "剃须刷") {
      values = getFieldValues(entry, ["剃须刷"]);
    } else if (category === "剃须皂") {
      values = getFieldValues(entry, ["剃须皂"]);
    } else if (category === "须前") {
      values = getFieldValues(entry, ["须前"]);
    } else if (category === "须后") {
      values = getFieldValues(entry, ["须后"]);
    } else if (category === "剃须碗") {
      const b = getBowl(entry);
      values = b ? [b] : [];
    }

    for (const v of values) {
      const k = `${category}|${normalizeKey(v)}`;
      if (k === rawKey) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }
  }

  let total = 0;
  let bestDisplay = "";
  let bestCount = -1;
  for (const [text, c] of counts.entries()) {
    total += c;
    if (c > bestCount) {
      bestCount = c;
      bestDisplay = text;
    }
  }

  if (bestDisplay) {
    return { display: bestDisplay, count: total };
  }
  const sepIdx = rawKey.indexOf("|");
  const suffix = sepIdx >= 0 ? rawKey.slice(sepIdx + 1) : rawKey;
  return { display: suffix, count: 0 };
}

export function getRemovalKeysForItem(item: GearItem): Set<string> {
  const keys = new Set<string>(item.rawKeys);
  keys.add(item.canonicalKey);
  keys.add(`${item.category}|${normalizeKey(item.name)}`);
  return keys;
}

function labelMatchesCategory(label: string, category: GearCategory): boolean {
  return (
    label === category ||
    (label.startsWith(category) && /^\d+$/.test(label.slice(category.length)))
  );
}

function normalizedKeyForFieldValue(
  rawValue: string,
  category: GearCategory
): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed || trimmed === "无" || trimmed === "-") return null;
  let effective: string;
  if (category === "刀片") {
    effective = parseBladeUsage(trimmed).baseName;
  } else if (category === "剃须碗") {
    effective = extractBowlName(trimmed) ?? trimmed;
  } else {
    effective = trimmed;
  }
  if (!effective) return null;
  return `${category}|${normalizeKey(effective)}`;
}

export function getReferencedEntryCount(
  item: GearItem,
  db: JournalDatabase
): number {
  const keys = getRemovalKeysForItem(item);
  let count = 0;

  for (const entry of db.entries ?? []) {
    let matched = false;
    for (const field of entry.fields ?? []) {
      if (labelMatchesCategory(field.label, item.category)) {
        const key = normalizedKeyForFieldValue(field.value, item.category);
        if (key && keys.has(key)) {
          matched = true;
          break;
        }
      } else if (item.category === "剃须碗" && field.label === "起泡") {
        const trimmed = (field.value ?? "").trim();
        const bowlName = extractBowlName(trimmed);
        if (bowlName) {
          const key = `剃须碗|${normalizeKey(bowlName)}`;
          if (keys.has(key)) {
            matched = true;
            break;
          }
        }
      }
    }
    if (matched) count += 1;
  }

  return count;
}

function computeEntryFingerprint(entry: JournalEntry): string {
  const parts = [
    entry.date,
    ...entry.fields.map((f) => `${f.label}=${f.value}`),
  ].join("\u001F");
  let hash = 2166136261;
  for (let i = 0; i < parts.length; i++) {
    hash ^= parts.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// MARK: - Pure Mutation Planners (对齐 Mac GearMutationService)

export interface GearMutationPlan {
  database: JournalDatabase;
  shouldBackup: boolean;
  toastMessage: string;
  didMutate: boolean;
  error?: string;
}

function pushHistorySnapshot(
  db: JournalDatabase,
  overrides?: Record<string, GearOverride>,
  pending?: string[],
  entrySnapshots?: GearEntryFieldSnapshot[]
): JournalDatabase["history"] {
  const snap: GearHistorySnapshot = {
    overrides: { ...(overrides ?? db.overrides) },
    pending: [...(pending ?? db.pending)],
  };
  if (entrySnapshots && entrySnapshots.length > 0) {
    snap.entrySnapshots = entrySnapshots;
  }
  const next = [...(db.history ?? []), snap];
  return next.length > MAX_HISTORY_DEPTH
    ? next.slice(next.length - MAX_HISTORY_DEPTH)
    : next;
}

export function planUpdateGearItem(
  rawKeys: string[],
  category: GearCategory,
  newOverride: GearOverride,
  clearPending: boolean,
  db: JournalDatabase,
  isEn: boolean
): GearMutationPlan {
  const cleanOverride = sanitizeOverride(newOverride, category);
  const newNormKey = `${category}|${normalizeKey(cleanOverride.name)}`;
  const targetKeys = rawKeys.length === 0 ? [newNormKey] : rawKeys;

  const nextOverrides: Record<string, GearOverride> = { ...db.overrides };
  let nextPending = [...db.pending];

  for (const key of targetKeys) {
    nextOverrides[key] = cleanOverride;
    if (clearPending) {
      nextPending = nextPending.filter((k) => k !== key);
    } else if (!nextPending.includes(key)) {
      nextPending.push(key);
    }
  }

  nextOverrides[newNormKey] = cleanOverride;
  if (clearPending) {
    nextPending = nextPending.filter((k) => k !== newNormKey);
  } else if (rawKeys.length === 0 && !nextPending.includes(newNormKey)) {
    nextPending.push(newNormKey);
  }

  const nextHistory = pushHistorySnapshot(db);

  return {
    database: {
      ...db,
      overrides: nextOverrides,
      pending: nextPending,
      history: nextHistory,
    },
    shouldBackup: false,
    toastMessage: t("已保存器材修改", "Saved gear changes", isEn),
    didMutate: true,
  };
}

export function planMergeGearItem(
  source: GearItem,
  target: GearItem,
  db: JournalDatabase,
  isEn: boolean
): GearMutationPlan {
  if (source.id === target.id || source.category !== target.category) {
    return {
      database: db,
      shouldBackup: false,
      toastMessage: "",
      didMutate: false,
    };
  }

  const conflict = checkGearMergeConflict(source, target, isEn);
  if (conflict) {
    return {
      database: db,
      shouldBackup: false,
      toastMessage: "",
      didMutate: false,
      error: t(`已阻止合并：${conflict}`, `Merge blocked: ${conflict}`, isEn),
    };
  }

  const targetOverride = sanitizeOverride(
    overrideFromGearItem(target),
    target.category
  );
  const nextOverrides: Record<string, GearOverride> = { ...db.overrides };
  const keysToRemoveFromPending = new Set<string>(source.rawKeys);
  const sourceNormKey = `${source.category}|${normalizeKey(source.name)}`;
  keysToRemoveFromPending.add(sourceNormKey);

  for (const key of source.rawKeys) {
    nextOverrides[key] = targetOverride;
  }
  nextOverrides[sourceNormKey] = targetOverride;

  const nextPending = db.pending.filter((k) => !keysToRemoveFromPending.has(k));
  const nextHistory = pushHistorySnapshot(db);

  return {
    database: {
      ...db,
      overrides: nextOverrides,
      pending: nextPending,
      history: nextHistory,
    },
    shouldBackup: true,
    toastMessage: t(
      `已合并「${source.name}」至「${target.name}」`,
      `Merged "${source.name}" into "${target.name}"`,
      isEn
    ),
    didMutate: true,
  };
}

export function planSplitRawKey(
  rawKey: string,
  item: GearItem,
  db: JournalDatabase,
  isEn: boolean
): GearMutationPlan {
  const sample = getRawEntrySamples(rawKey, item.category, db);
  const splitName = sample.display || rawKey;
  const inferred = inferDefaultOverride(splitName, item.category);
  if (inferred.brand === "品牌未注明" && item.brand !== "品牌未注明") {
    inferred.brand = item.brand;
  }
  inferred.name =
    splitName.toLowerCase() === item.name.toLowerCase()
      ? `${splitName} (Split)`
      : splitName;

  const nextOverrides: Record<string, GearOverride> = {
    ...db.overrides,
    [rawKey]: inferred,
  };
  const nextPending = db.pending.includes(rawKey)
    ? [...db.pending]
    : [...db.pending, rawKey];
  const nextHistory = pushHistorySnapshot(db);

  return {
    database: {
      ...db,
      overrides: nextOverrides,
      pending: nextPending,
      history: nextHistory,
    },
    shouldBackup: true,
    toastMessage: t(
      `已将「${splitName}」拆分为独立器材`,
      `Split "${splitName}" into a new item`,
      isEn
    ),
    didMutate: true,
  };
}

export function planDeleteGearItem(
  item: GearItem,
  removeFromEntries: boolean,
  db: JournalDatabase,
  isEn: boolean
): GearMutationPlan {
  const priorOverrides = { ...db.overrides };
  const priorPending = [...db.pending];
  const keys = getRemovalKeysForItem(item);
  const referencedCount = getReferencedEntryCount(item, db);

  const nextOverrides: Record<string, GearOverride> = { ...db.overrides };
  for (const key of keys) {
    delete nextOverrides[key];
  }
  const nextPending = db.pending.filter((k) => !keys.has(k));

  let affectedEntryCount = 0;
  const capturedSnapshots: GearEntryFieldSnapshot[] = [];
  const nextEntries = db.entries.map((originalEntry) => {
    if (!removeFromEntries) return originalEntry;

    let modified = false;
    const newFields: JournalField[] = [];
    for (const field of originalEntry.fields) {
      if (labelMatchesCategory(field.label, item.category)) {
        const key = normalizedKeyForFieldValue(field.value, item.category);
        if (key && keys.has(key)) {
          modified = true;
          continue;
        }
      } else if (item.category === "剃须碗" && field.label === "起泡") {
        const trimmed = (field.value ?? "").trim();
        const bowlName = extractBowlName(trimmed);
        if (bowlName) {
          const key = `剃须碗|${normalizeKey(bowlName)}`;
          if (keys.has(key)) {
            modified = true;
            if (trimmed.endsWith("碗起")) {
              newFields.push({ ...field, value: "碗起" });
            }
            continue;
          }
        }
      }
      newFields.push(field);
    }

    if (!modified) return originalEntry;

    const updatedEntry: JournalEntry = {
      ...originalEntry,
      fields: newFields,
      locallyModified: true,
    };
    capturedSnapshots.push({
      entryID: originalEntry.id,
      previousFields: originalEntry.fields.map((f) => ({ ...f })),
      previousLocallyModified: originalEntry.locallyModified,
      postMutationFingerprint: computeEntryFingerprint(updatedEntry),
    });
    affectedEntryCount += 1;
    return updatedEntry;
  });

  const nextHistory = pushHistorySnapshot(
    db,
    priorOverrides,
    priorPending,
    capturedSnapshots
  );

  let toastMessage: string;
  if (removeFromEntries && affectedEntryCount > 0) {
    toastMessage = t(
      `已彻底删除「${item.name}」，并从 ${affectedEntryCount} 篇日记移除`,
      `Deleted "${item.name}" and removed it from ${affectedEntryCount} entries`,
      isEn
    );
  } else if (referencedCount === 0) {
    toastMessage = t(`已删除「${item.name}」`, `Deleted "${item.name}"`, isEn);
  } else {
    toastMessage = t(
      `已移除「${item.name}」的器材档案规则`,
      `Removed profile rules for "${item.name}"`,
      isEn
    );
  }

  return {
    database: {
      ...db,
      entries: nextEntries,
      overrides: nextOverrides,
      pending: nextPending,
      history: nextHistory,
    },
    shouldBackup: removeFromEntries,
    toastMessage,
    didMutate: true,
  };
}

function isGearHistorySnapshot(
  raw: GearHistorySnapshot | Record<string, GearOverride>
): raw is GearHistorySnapshot {
  if (!raw || typeof raw !== "object") return false;
  if (!("overrides" in raw)) return false;
  const ov = (raw as { overrides?: unknown }).overrides;
  return Boolean(ov && typeof ov === "object" && !("brand" in ov));
}

export function planUndoLastGearChange(
  db: JournalDatabase,
  isEn: boolean
): GearMutationPlan {
  if (!db.history || db.history.length === 0) {
    return {
      database: db,
      shouldBackup: false,
      toastMessage: t(
        "当前没有可撤销的器材修改记录",
        "No gear changes to undo",
        isEn
      ),
      didMutate: false,
    };
  }

  const nextHistory = db.history.slice(0, -1);
  const popped = db.history[db.history.length - 1];

  const restoredOverrides: Record<string, GearOverride> = isGearHistorySnapshot(
    popped
  )
    ? { ...popped.overrides }
    : { ...(popped as Record<string, GearOverride>) };

  const restoredPending: string[] =
    isGearHistorySnapshot(popped) && Array.isArray(popped.pending)
      ? [...popped.pending]
      : [...db.pending];

  let restoredEntriesCount = 0;
  let skippedEditedCount = 0;
  let nextEntries = db.entries;

  if (
    isGearHistorySnapshot(popped) &&
    Array.isArray(popped.entrySnapshots) &&
    popped.entrySnapshots.length > 0
  ) {
    const snapById = new Map<string, GearEntryFieldSnapshot>();
    for (const s of popped.entrySnapshots) {
      snapById.set(s.entryID, s);
    }

    const foundIds = new Set<string>();
    nextEntries = db.entries.map((entry) => {
      const snap = snapById.get(entry.id);
      if (!snap) return entry;
      foundIds.add(entry.id);
      if (computeEntryFingerprint(entry) === snap.postMutationFingerprint) {
        restoredEntriesCount += 1;
        return {
          ...entry,
          fields: snap.previousFields.map((f) => ({ ...f })),
          locallyModified: snap.previousLocallyModified,
        };
      }
      skippedEditedCount += 1;
      return entry;
    });

    for (const s of popped.entrySnapshots) {
      if (!foundIds.has(s.entryID)) {
        skippedEditedCount += 1;
      }
    }
  }

  let toastMessage: string;
  if (restoredEntriesCount > 0 && skippedEditedCount > 0) {
    toastMessage = t(
      `已撤销器材修改：恢复 ${restoredEntriesCount} 篇日记引用，跳过 ${skippedEditedCount} 篇后续已编辑日记`,
      `Undid gear change: restored ${restoredEntriesCount} entries, skipped ${skippedEditedCount} edited entries`,
      isEn
    );
  } else if (restoredEntriesCount > 0) {
    toastMessage = t(
      `已撤销器材修改，并完整恢复 ${restoredEntriesCount} 篇日记引用`,
      `Undid gear change and restored ${restoredEntriesCount} entry references`,
      isEn
    );
  } else if (skippedEditedCount > 0) {
    toastMessage = t(
      `已恢复器材档案，但 ${skippedEditedCount} 篇关联日记已变动未能直接回滚`,
      `Restored gear profile; ${skippedEditedCount} linked entries changed since deletion`,
      isEn
    );
  } else {
    toastMessage = t("已撤销上次器材修改", "Undid last gear change", isEn);
  }

  return {
    database: {
      ...db,
      entries: nextEntries,
      overrides: restoredOverrides,
      pending: restoredPending,
      history: nextHistory,
    },
    shouldBackup: restoredEntriesCount > 0,
    toastMessage,
    didMutate: true,
  };
}

// MARK: - CSV Export (与 Mac GearCatalogService.exportGearLibraryCSV 100% 一致)

function csvEscape(field: string): string {
  if (
    field.includes(",") ||
    field.includes('"') ||
    field.includes("\n") ||
    field.includes("\r")
  ) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function exportGearLibraryCSV(snapshot: GearCatalogSnapshot): string {
  const headers = [
    "分类",
    "品牌",
    "手柄品牌",
    "型号",
    "完整名称",
    "使用次数",
    "最近使用",
    "状态",
    "小样",
    "待确认",
    "刀型",
    "可调刀",
    "Slant斜头",
    "剃须刀材质",
    "底板形制",
    "刀隙/版本",
    "刀片类型",
    "刷毛材质",
    "獾毛处理",
    "獾毛段数",
    "结径",
    "毛型",
    "备注",
  ];
  const lines: string[] = [headers.map(csvEscape).join(",")];

  for (const cat of ALL_GEAR_CATEGORIES) {
    for (const item of snapshot.itemsByCategory[cat] ?? []) {
      const row = [
        cat,
        item.brand,
        item.handleBrand ?? "",
        item.model,
        item.name,
        String(item.count),
        item.lastUsedDate,
        item.status,
        item.isSample ? "是" : "",
        item.isPending ? "待确认" : "",
        item.razorType ?? "",
        item.isAdjustable ? "是" : "",
        item.isSlant ? "是" : "",
        item.material ?? "",
        item.plateType ?? "",
        item.gapOrSpec ?? "",
        item.bladeType ?? "",
        item.brushMaterial ?? "",
        item.badgerTreatment ?? "",
        item.badgerBand ?? "",
        item.knotSize ?? "",
        item.knotShape ?? "",
        item.notes ?? "",
      ];
      lines.push(row.map(csvEscape).join(","));
    }
  }

  return "\uFEFF" + lines.join("\r\n");
}
