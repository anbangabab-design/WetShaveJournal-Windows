import {
  ALL_BADGER_BANDS,
  ALL_BADGER_TREATMENTS,
  ALL_BLADE_TYPES,
  ALL_BRUSH_KNOT_SHAPES,
  ALL_BRUSH_MATERIALS,
  ALL_GEAR_CATEGORIES,
  ALL_IRRITATION_LEVELS,
  ALL_LATHERING_METHODS,
  ALL_LOADING_METHODS,
  ALL_PLATE_TYPES,
  ALL_RAZOR_TYPES,
  ALL_SHAVE_PASS_TYPES,
  ALL_SHAVE_RESULTS,
  type AIConfigState,
  type AINaturalSOTDResult,
  type AISetupRecommendation,
  type BadgerBand,
  type BadgerTreatment,
  type BladeType,
  type BrushKnotShape,
  type BrushMaterial,
  type GearAuditBatchFailure,
  type GearAuditMergeProposal,
  type GearAuditProgress,
  type GearAuditReport,
  type GearAuditUpdateProposal,
  type GearCategory,
  type GearItem,
  type GearOverride,
  type IrritationLevel,
  type LatheringMethod,
  type PassStep,
  type PlateType,
  type RazorBladeComboStat,
  type RazorType,
  type ShavePassType,
  type ShaveResult,
  type SoapLoadingMethod,
} from "../types/journal";
import { getDisplayModel } from "./gearKnowledge";
import {
  checkGearMergeConflict,
  overrideFromGearItem,
  sanitizeMaterialStrict,
  sanitizeOverride,
} from "./gearMutations";
import {
  badgerBandDisplay,
  badgerTreatmentDisplay,
  brushMaterialDisplay,
  materialDisplay,
  razorTypeShortLabel,
  t,
} from "./l10n";
import { aiChatCompletion, isTauriRuntime } from "./tauriApi";

export function isAIConfigReady(cfg: AIConfigState): boolean {
  return (
    cfg.enabled &&
    Boolean(cfg.baseUrl.trim()) &&
    Boolean(cfg.model.trim()) &&
    cfg.hasApiKey
  );
}

export function validateEndpointPreview(
  rawUrl: string,
  isEn: boolean
): { valid: boolean; isLocalHttp: boolean; error: string | null } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, isLocalHttp: false, error: null };
  }
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    const host = parsed.hostname.toLowerCase();
    if (protocol === "https:") {
      return { valid: Boolean(host), isLocalHttp: false, error: null };
    }
    if (protocol === "http:") {
      const isLocal =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host === "[::1]";
      if (isLocal) {
        return { valid: true, isLocalHttp: true, error: null };
      }
      return {
        valid: false,
        isLocalHttp: false,
        error: t(
          "远端 AI 接口必须使用 HTTPS（仅 localhost / 127.0.0.1 / [::1] 允许明文 HTTP）",
          "Remote AI endpoints must use HTTPS (plain HTTP allowed only for localhost / 127.0.0.1 / [::1]).",
          isEn
        ),
      };
    }
    return {
      valid: false,
      isLocalHttp: false,
      error: t(
        "仅支持 https:// 或本机 http:// 协议",
        "Only https:// or local http:// is allowed.",
        isEn
      ),
    };
  } catch {
    return {
      valid: false,
      isLocalHttp: false,
      error: t("Base URL 格式无效", "Invalid Base URL format", isEn),
    };
  }
}

export function extractJsonObjectString(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return cleaned.slice(start, end + 1);
  }
  return cleaned;
}

function cleanStr(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickEnum<T extends string>(val: unknown, allowed: readonly T[]): T | null {
  const s = cleanStr(val);
  if (!s) return null;
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

function ensureTauriDesktop(isEn: boolean): void {
  if (!isTauriRuntime()) {
    throw new Error(
      t(
        "AI 联网请求需在桌面客户端中运行（由 Rust 后端发起）",
        "AI requests require the desktop app (executed via Rust backend).",
        isEn
      )
    );
  }
}

// MARK: - AI 功能 ①：一句话自然语言记 SOTD

export async function parseNaturalLanguageSOTD(
  sentence: string,
  catalogNamesByCategory: Record<GearCategory, string[]>,
  aiConfig: AIConfigState,
  isEn: boolean
): Promise<AINaturalSOTDResult> {
  ensureTauriDesktop(isEn);
  if (!isAIConfigReady(aiConfig)) {
    throw new Error(
      t(
        "请先在「外观与设置 → AI 识别接口」中启用并配置 API Key",
        "Please enable and configure your AI API key in Settings first.",
        isEn
      )
    );
  }

  const catalogDesc = ALL_GEAR_CATEGORIES.map((cat) => {
    const names = (catalogNamesByCategory[cat] ?? []).slice(0, 45).join(" | ");
    return `${cat}: ${names}`;
  }).join("\n");

  const systemPrompt = `You parse a wet-shaving SOTD sentence into structured fields matched against the user's real gear catalog.
Return ONLY a valid JSON object (no markdown fences):
{
  "razor": exact matching name from catalog or user text (or null),
  "blade": exact matching base blade name from catalog without 1st/2nd suffix (or null),
  "bladeUseCount": integer >= 1 or null,
  "brush": exact matching name from catalog or user text (or null),
  "soap": exact matching name from catalog or user text (or null),
  "bowl": exact matching name from catalog or user text (or null),
  "preShave": exact matching name from catalog or user text (or null),
  "afterShave": exact matching name from catalog or user text (or null),
  "loadingMethod": one of ["挖取", "刷取", "涂抹"] or null,
  "latheringMethod": one of ["碗起", "脸起", "手起"] or null,
  "hotTowel": boolean or null,
  "afterShower": boolean or null,
  "useAlum": boolean or null,
  "passes": [{"pass": one of ["顺刮", "横刮", "逆刮", "补刀"], "setting": string like "5" or ""}],
  "result": one of ["BBS", "DFS", "CCS", "SAS"] or null,
  "irritation": one of ["无痛", "微痛", "刺痛"] or null,
  "note": short extra note string or null
}
Match Chinese nicknames to catalog names when obvious (e.g. 黑鸟钛 -> Blackland Blackbird Ti, 俄纸 -> Gillette 俄产纸飞机, 苦艾 -> MDC Absinthe). Never fabricate fields not mentioned in the sentence.`;

  const completion = await aiChatCompletion({
    system: systemPrompt,
    user: `User's gear catalog:\n${catalogDesc}\n\nSOTD sentence:\n${sentence}`,
    useWebSearch: false,
    timeoutSecs: 90,
    temperature: 0.1,
  });

  const jsonStr = extractJsonObjectString(completion.content);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    throw new Error(
      t("AI 返回了无法解析的 JSON 结构", "AI returned an unparseable JSON response", isEn)
    );
  }

  const rawPasses = Array.isArray(parsed.passes) ? parsed.passes : [];
  const passes: PassStep[] = [];
  for (const p of rawPasses) {
    if (!p || typeof p !== "object") continue;
    const obj = p as Record<string, unknown>;
    const passType = pickEnum<ShavePassType>(obj.pass, ALL_SHAVE_PASS_TYPES);
    if (passType) {
      passes.push({
        pass: passType,
        setting: typeof obj.setting === "string" ? obj.setting.trim() : "",
      });
    }
  }

  const bladeCount =
    typeof parsed.bladeUseCount === "number" &&
    Number.isFinite(parsed.bladeUseCount) &&
    parsed.bladeUseCount >= 1
      ? Math.round(parsed.bladeUseCount)
      : null;

  return {
    razor: cleanStr(parsed.razor),
    blade: cleanStr(parsed.blade),
    bladeUseCount: bladeCount,
    brush: cleanStr(parsed.brush),
    soap: cleanStr(parsed.soap),
    bowl: cleanStr(parsed.bowl),
    preShave: cleanStr(parsed.preShave),
    afterShave: cleanStr(parsed.afterShave),
    loadingMethod: pickEnum<SoapLoadingMethod>(
      parsed.loadingMethod,
      ALL_LOADING_METHODS
    ),
    latheringMethod: pickEnum<LatheringMethod>(
      parsed.latheringMethod,
      ALL_LATHERING_METHODS
    ),
    hotTowel: typeof parsed.hotTowel === "boolean" ? parsed.hotTowel : null,
    afterShower:
      typeof parsed.afterShower === "boolean" ? parsed.afterShower : null,
    useAlum: typeof parsed.useAlum === "boolean" ? parsed.useAlum : null,
    passes,
    result: pickEnum<ShaveResult>(parsed.result, ALL_SHAVE_RESULTS),
    irritation: pickEnum<IrritationLevel>(
      parsed.irritation,
      ALL_IRRITATION_LEVELS
    ),
    note: cleanStr(parsed.note),
  };
}

// MARK: - AI 功能 ②：AI 器材库体检（6-8 件分批、180 秒超时、逐项追踪、防编造 Diff）

interface RawAuditUpdate {
  id?: unknown;
  brand?: unknown;
  handleBrand?: unknown;
  model?: unknown;
  name?: unknown;
  razorType?: unknown;
  isAdjustable?: unknown;
  isSlant?: unknown;
  material?: unknown;
  plateType?: unknown;
  gapOrSpec?: unknown;
  notes?: unknown;
  bladeType?: unknown;
  brushMaterial?: unknown;
  badgerTreatment?: unknown;
  badgerBand?: unknown;
  knotSize?: unknown;
  knotShape?: unknown;
  confidence?: unknown;
  reason?: unknown;
}

function buildAuditProposal(
  orig: GearItem,
  u: RawAuditUpdate,
  actualModel: string,
  isEn: boolean
): GearAuditUpdateProposal | null {
  const protectManual = orig.isManuallyConfirmed;
  const brandIsUnknown =
    !orig.brand.trim() ||
    orig.brand === "品牌未注明" ||
    orig.brand === "无品牌";

  const rawOv: GearOverride = {
    ...overrideFromGearItem(orig),
    recognizedSource: `AI 体检 (${actualModel})`,
  };

  const b = cleanStr(u.brand);
  if ((!protectManual || brandIsUnknown) && b) rawOv.brand = b;
  const n = cleanStr(u.name);
  if (!protectManual && n) rawOv.name = n;
  const m = cleanStr(u.model);
  if (!protectManual && m) rawOv.model = m;

  if (orig.category === "剃须刀") {
    const rt = pickEnum<RazorType>(u.razorType, ALL_RAZOR_TYPES);
    if ((!protectManual || !orig.razorType) && rt) rawOv.razorType = rt;
    if (!protectManual && typeof u.isAdjustable === "boolean") {
      rawOv.isAdjustable = u.isAdjustable;
    }
    if (!protectManual && typeof u.isSlant === "boolean") {
      rawOv.isSlant = u.isSlant;
    }
    const mat = sanitizeMaterialStrict(cleanStr(u.material) ?? undefined);
    if ((!protectManual || !orig.material) && mat) rawOv.material = mat;
    const pt = pickEnum<PlateType>(u.plateType, ALL_PLATE_TYPES);
    if ((!protectManual || !orig.plateType) && pt) rawOv.plateType = pt;
    const gap = cleanStr(u.gapOrSpec);
    if ((!protectManual || !orig.gapOrSpec) && gap) rawOv.gapOrSpec = gap;
  } else if (orig.category === "刀片") {
    const bt = pickEnum<BladeType>(u.bladeType, ALL_BLADE_TYPES);
    if ((!protectManual || !orig.bladeType) && bt) rawOv.bladeType = bt;
  } else if (orig.category === "剃须刷") {
    const hb = cleanStr(u.handleBrand);
    if ((!protectManual || !orig.handleBrand) && hb) rawOv.handleBrand = hb;
    const bm = pickEnum<BrushMaterial>(u.brushMaterial, ALL_BRUSH_MATERIALS);
    if ((!protectManual || !orig.brushMaterial) && bm) rawOv.brushMaterial = bm;
    const tr = pickEnum<BadgerTreatment>(
      u.badgerTreatment,
      ALL_BADGER_TREATMENTS
    );
    if ((!protectManual || !orig.badgerTreatment) && tr) {
      rawOv.badgerTreatment = tr;
    }
    const bb = pickEnum<BadgerBand>(u.badgerBand, ALL_BADGER_BANDS);
    if ((!protectManual || !orig.badgerBand) && bb) rawOv.badgerBand = bb;
    const ks = cleanStr(u.knotSize);
    if ((!protectManual || !orig.knotSize) && ks) rawOv.knotSize = ks;
    const sh = pickEnum<BrushKnotShape>(u.knotShape, ALL_BRUSH_KNOT_SHAPES);
    if ((!protectManual || !orig.knotShape) && sh) rawOv.knotShape = sh;
  }

  const extraNotes = cleanStr(u.notes);
  if (extraNotes && (!protectManual || !orig.notes)) {
    const cur = rawOv.notes?.trim() ?? "";
    if (!cur) {
      rawOv.notes = extraNotes;
    } else if (!cur.toLowerCase().includes(extraNotes.toLowerCase())) {
      rawOv.notes = `${cur}；${extraNotes}`;
    }
  }

  const ov = sanitizeOverride(rawOv, orig.category);
  const diffs: string[] = [];
  const nextModel = getDisplayModel(ov);

  if (ov.brand !== orig.brand) {
    diffs.push(`${t("品牌", "Brand", isEn)}: ${orig.brand} → ${ov.brand}`);
  }
  if (nextModel !== orig.model) {
    diffs.push(`${t("型号", "Model", isEn)}: ${orig.model} → ${nextModel}`);
  }
  if (ov.name !== orig.name) {
    diffs.push(`${t("全称", "Name", isEn)}: ${orig.name} → ${ov.name}`);
  }
  if (ov.razorType && ov.razorType !== orig.razorType) {
    diffs.push(
      `${t("刀型", "Type", isEn)}: ${
        orig.razorType ? razorTypeShortLabel(orig.razorType, isEn) : "—"
      } → ${razorTypeShortLabel(ov.razorType as RazorType, isEn)}`
    );
  }
  if (ov.material && ov.material !== orig.material) {
    diffs.push(
      `${t("材质", "Material", isEn)}: ${
        orig.material ? materialDisplay(orig.material, isEn) : "—"
      } → ${materialDisplay(ov.material, isEn)}`
    );
  }
  if (ov.plateType && ov.plateType !== orig.plateType) {
    diffs.push(
      `${t("底板", "Plate", isEn)}: ${orig.plateType ?? "—"} → ${ov.plateType}`
    );
  }
  if (Boolean(ov.isSlant) !== orig.isSlant) {
    diffs.push(
      `Slant: ${orig.isSlant ? "Yes" : "No"} → ${ov.isSlant ? "Yes" : "No"}`
    );
  }
  if (Boolean(ov.isAdjustable) !== orig.isAdjustable) {
    diffs.push(
      `${t("可调", "Adj", isEn)}: ${orig.isAdjustable ? "Yes" : "No"} → ${
        ov.isAdjustable ? "Yes" : "No"
      }`
    );
  }
  if ((ov.gapOrSpec ?? "") !== (orig.gapOrSpec ?? "")) {
    diffs.push(
      `${t("规格", "Spec", isEn)}: ${orig.gapOrSpec ?? "—"} → ${
        ov.gapOrSpec ?? "—"
      }`
    );
  }
  if (ov.notes && ov.notes !== orig.notes) {
    diffs.push(
      `${t("详细参数", "Notes", isEn)}: ${orig.notes ?? "—"} → ${ov.notes}`
    );
  }
  if (ov.bladeType && ov.bladeType !== orig.bladeType) {
    diffs.push(
      `${t("刀片型", "Blade", isEn)}: ${orig.bladeType ?? "—"} → ${ov.bladeType}`
    );
  }
  if ((ov.handleBrand ?? "") !== (orig.handleBrand ?? "")) {
    diffs.push(
      `${t("手柄", "Handle", isEn)}: ${orig.handleBrand ?? "—"} → ${
        ov.handleBrand ?? "—"
      }`
    );
  }
  if (ov.brushMaterial && ov.brushMaterial !== orig.brushMaterial) {
    diffs.push(
      `${t("刷毛", "Hair", isEn)}: ${
        orig.brushMaterial
          ? brushMaterialDisplay(orig.brushMaterial, isEn)
          : "—"
      } → ${brushMaterialDisplay(ov.brushMaterial as BrushMaterial, isEn)}`
    );
  }
  if (ov.badgerTreatment && ov.badgerTreatment !== orig.badgerTreatment) {
    diffs.push(
      `${t("处理", "Tips", isEn)}: ${
        orig.badgerTreatment
          ? badgerTreatmentDisplay(orig.badgerTreatment, isEn)
          : "—"
      } → ${badgerTreatmentDisplay(ov.badgerTreatment as BadgerTreatment, isEn)}`
    );
  }
  if (ov.badgerBand && ov.badgerBand !== orig.badgerBand) {
    diffs.push(
      `${t("段数", "Band", isEn)}: ${
        orig.badgerBand ? badgerBandDisplay(orig.badgerBand, isEn) : "—"
      } → ${badgerBandDisplay(ov.badgerBand as BadgerBand, isEn)}`
    );
  }
  if (ov.knotSize && ov.knotSize !== orig.knotSize) {
    diffs.push(
      `${t("结径", "Size", isEn)}: ${orig.knotSize ?? "—"} → ${ov.knotSize}`
    );
  }
  if (ov.knotShape && ov.knotShape !== orig.knotShape) {
    diffs.push(
      `${t("毛型", "Shape", isEn)}: ${orig.knotShape ?? "—"} → ${ov.knotShape}`
    );
  }

  if (diffs.length === 0) return null;
  const confidence =
    typeof u.confidence === "number" && Number.isFinite(u.confidence)
      ? Math.max(0, Math.min(0.99, u.confidence))
      : 0.78;
  const reason =
    cleanStr(u.reason) ??
    t("官网规范与属性补全", "Standardized naming & specs", isEn);

  return {
    id: orig.id,
    item: orig,
    proposed: ov,
    changesSummary: diffs,
    reason,
    confidence,
    selected: !protectManual && confidence >= 0.72,
  };
}

export async function auditGearItems(
  items: GearItem[],
  aiConfig: AIConfigState,
  isEn: boolean,
  options?: {
    onProgress?: (progress: GearAuditProgress) => void;
    isCancelled?: () => boolean;
  }
): Promise<GearAuditReport> {
  ensureTauriDesktop(isEn);
  if (!isAIConfigReady(aiConfig)) {
    throw new Error(
      t(
        "请先在「外观与设置 → AI 识别接口」启用并配置 API Key",
        "Please enable and configure your AI API key in Settings first.",
        isEn
      )
    );
  }

  if (items.length === 0) {
    return {
      updates: [],
      merges: [],
      modelUsed: aiConfig.model,
      plannedCount: 0,
      verifiedCount: 0,
      undeterminedItems: [],
      failedItems: [],
      skippedCount: 0,
      unknownOrDuplicateIdCount: 0,
      failures: [],
    };
  }

  const itemById = new Map<string, GearItem>();
  for (const it of items) {
    itemById.set(it.id, it);
  }

  const langHint = isEn ? "English" : "Simplified Chinese";
  const systemPrompt = `You are a wet-shaving database auditor (Badger & Blade / Damn Fine Shave / official maker standards).
You MUST account for EVERY SINGLE input item id in the JSON array returned below (no omissions, no invented IDs, no duplicate IDs).
Return ONLY a valid JSON object (no markdown fences) with this exact schema:
{
  "checkedIds": ["<exact input item ids verified accurate and needing NO changes>"],
  "undeterminedIds": ["<exact input item ids that cannot be reliably verified>"],
  "updates": [
    {
      "id": "<exact input item id needing correction or missing-spec fill>",
      "brand": string or null,
      "handleBrand": string or null,
      "model": string or null,
      "name": string or null,
      "razorType": one of ["Double Edge (DE)", "Single Edge (AC)", "Single Edge (GEM)", "Single Edge (Injector)", "Single Edge (半DE)", "盒刀", "Twin Blade", "直剃", "替刃", "其他"] or null,
      "isAdjustable": boolean or null,
      "isSlant": boolean or null,
      "material": one of ["不锈钢", "钛合金", "黄铜", "红铜", "青铜", "磷青铜", "铝合金", "锌合金"] or null,
      "plateType": one of ["SB", "OC", "DC"] or null,
      "gapOrSpec": string (MAX 10 chars, e.g. "0.99", "1.12+", "Standard", "Lite") or null,
      "notes": string (detailed specs like blade exposure, weight, etc.) or null,
      "bladeType": one of ["DE", "AC", "GEM", "Injector", "盒刀头", "其他"] or null,
      "brushMaterial": one of ["獾毛", "人造丝", "猪鬃", "马毛", "羊毛", "混毛", "其他"] or null,
      "badgerTreatment": one of ["无漂", "漂尖"] or null,
      "badgerBand": one of ["二段", "三段"] or null,
      "knotSize": string or null,
      "knotShape": one of ["Fan", "Bulb", "Hybrid"] or null,
      "confidence": number 0.0-1.0,
      "reason": "short explanation in ${langHint}"
    }
  ],
  "merges": [
    {
      "sourceId": "<item id to merge away>",
      "targetId": "<canonical item id to keep>",
      "reason": "short explanation in ${langHint}"
    }
  ]
}
HARD RULES (MUST OBEY):
1. Every input id MUST appear in EXACTLY ONE of "checkedIds", "undeterminedIds", or "updates". NEVER omit an input id and NEVER invent IDs not in the input.
2. NEVER fabricate uncertain specifications. If uncertain, leave field null and place id in "undeterminedIds" or set confidence < 0.70.
3. "model" MUST keep differentiating sub-model/version codes (e.g. "Next Level 112+", "WR1 0.74", "BR-1").
4. "gapOrSpec" MUST ONLY be an ultra-short spec (MAX 10 chars); put long descriptions into "notes".
5. "material" MUST strictly be ONE of ["不锈钢", "钛合金", "黄铜", "红铜", "青铜", "磷青铜", "铝合金", "锌合金"] or null.
6. Every enum field MUST use the exact allowed values above.
7. For brushes, "brand" = knot brand, "handleBrand" = custom handle brand (null if factory).
8. ONLY suggest "merges" for clearly duplicate items; NEVER merge different gaps, materials, baseplates, knot sizes, or Fan vs Bulb.`;

  const isDeepSeek =
    aiConfig.preset === "deepseek" ||
    aiConfig.baseUrl.toLowerCase().includes("deepseek.com");
  const webSearchEnabled =
    (isDeepSeek && aiConfig.enableWebSearch) ||
    (!isDeepSeek && aiConfig.enableGoogleSearch);
  // 严格每批 6-8 件（开启联网搜索每批 6 件，关闭每批 8 件）
  const batchSize = webSearchEnabled ? 6 : 8;
  const totalBatches = Math.max(1, Math.ceil(items.length / batchSize));

  const allUpdates: GearAuditUpdateProposal[] = [];
  const allMerges: GearAuditMergeProposal[] = [];
  const undeterminedItems: GearItem[] = [];
  const failedItems: GearItem[] = [];
  const failures: GearAuditBatchFailure[] = [];
  let verifiedCount = 0;
  let skippedCount = 0;
  let unknownOrDuplicateIdCount = 0;
  let modelUsed = aiConfig.model;

  const emitProgress = (currentBatch: number) => {
    options?.onProgress?.({
      currentBatch,
      totalBatches,
      plannedCount: items.length,
      verifiedCount,
      undeterminedCount: undeterminedItems.length,
      failedCount: failedItems.length,
      skippedCount,
    });
  };

  for (let start = 0, batchIndex = 1; start < items.length; start += batchSize, batchIndex += 1) {
    if (options?.isCancelled?.()) {
      throw new Error(t("AI 体检已取消", "AI audit cancelled", isEn));
    }

    const chunk = items.slice(start, start + batchSize);
    emitProgress(batchIndex);

    const payloadItems = chunk.map((it) => ({
      id: it.id,
      category: it.category,
      brand: it.brand,
      model: it.model,
      name: it.name,
      count: it.count,
      pending: it.isPending,
      manuallyConfirmed: it.isManuallyConfirmed,
      razorType: it.razorType ?? null,
      isAdjustable: it.isAdjustable || null,
      isSlant: it.isSlant || null,
      material: it.material ?? null,
      plateType: it.plateType ?? null,
      gapOrSpec: it.gapOrSpec ?? null,
      notes: it.notes ?? null,
      bladeType: it.bladeType ?? null,
      handleBrand: it.handleBrand ?? null,
      brushMaterial: it.brushMaterial ?? null,
      badgerTreatment: it.badgerTreatment ?? null,
      badgerBand: it.badgerBand ?? null,
      knotSize: it.knotSize ?? null,
      knotShape: it.knotShape ?? null,
    }));

    try {
      const completion = await aiChatCompletion({
        system: systemPrompt,
        user: JSON.stringify(payloadItems),
        useWebSearch: true,
        timeoutSecs: 180,
        temperature: 0.1,
      });

      if (options?.isCancelled?.()) {
        throw new Error(t("AI 体检已取消", "AI audit cancelled", isEn));
      }

      modelUsed = completion.actualModel || modelUsed;
      const jsonStr = extractJsonObjectString(completion.content);
      let decoded: Record<string, unknown>;
      try {
        decoded = JSON.parse(jsonStr) as Record<string, unknown>;
      } catch {
        throw new Error(
          t("返回内容不是有效 JSON", "Response was not valid JSON", isEn)
        );
      }

      const chunkIds = new Set(chunk.map((c) => c.id));
      const seenIds = new Set<string>();

      const checkedIds = Array.isArray(decoded.checkedIds)
        ? decoded.checkedIds.filter((v): v is string => typeof v === "string")
        : [];
      for (const id of checkedIds) {
        if (!chunkIds.has(id) || seenIds.has(id)) {
          unknownOrDuplicateIdCount += 1;
          continue;
        }
        seenIds.add(id);
        verifiedCount += 1;
      }

      const undeterminedIds = Array.isArray(decoded.undeterminedIds)
        ? decoded.undeterminedIds.filter(
            (v): v is string => typeof v === "string"
          )
        : [];
      for (const id of undeterminedIds) {
        if (!chunkIds.has(id) || seenIds.has(id)) {
          unknownOrDuplicateIdCount += 1;
          continue;
        }
        seenIds.add(id);
        const orig = itemById.get(id);
        if (orig) undeterminedItems.push(orig);
      }

      const rawUpdates = Array.isArray(decoded.updates)
        ? (decoded.updates as RawAuditUpdate[])
        : [];
      for (const u of rawUpdates) {
        const id = cleanStr(u.id);
        if (!id || !chunkIds.has(id) || seenIds.has(id)) {
          unknownOrDuplicateIdCount += 1;
          continue;
        }
        seenIds.add(id);
        const orig = itemById.get(id);
        if (!orig) continue;
        const prop = buildAuditProposal(orig, u, modelUsed, isEn);
        if (prop) {
          allUpdates.push(prop);
          verifiedCount += 1;
        } else {
          skippedCount += 1;
        }
      }

      // 被 AI 遗漏/截断的条目绝不计为成功，归入失败项以便「仅重试失败项」
      const omitted = chunk.filter((c) => !seenIds.has(c.id));
      if (omitted.length > 0) {
        failedItems.push(...omitted);
        failures.push({
          batchIndex,
          items: omitted,
          reason: t(
            `响应遗漏了 ${omitted.length} 件器材（可能输出截断）`,
            `Response omitted ${omitted.length} item(s) (possible truncation)`,
            isEn
          ),
        });
      }

      const rawMerges = Array.isArray(decoded.merges) ? decoded.merges : [];
      for (const m of rawMerges) {
        if (!m || typeof m !== "object") continue;
        const obj = m as Record<string, unknown>;
        const srcId = cleanStr(obj.sourceId);
        const dstId = cleanStr(obj.targetId);
        if (!srcId || !dstId || srcId === dstId) continue;
        const src = itemById.get(srcId);
        const dst = itemById.get(dstId);
        if (!src || !dst || src.category !== dst.category) continue;
        if (checkGearMergeConflict(src, dst, isEn) !== null) continue;

        const mergeKey = `${src.id}->${dst.id}`;
        if (!allMerges.some((ex) => ex.id === mergeKey)) {
          allMerges.push({
            id: mergeKey,
            source: src,
            target: dst,
            reason:
              cleanStr(obj.reason) ??
              t("疑似重复条目", "Suspected duplicate", isEn),
            selected: !(src.isManuallyConfirmed || dst.isManuallyConfirmed),
          });
        }
      }
    } catch (err) {
      if (options?.isCancelled?.()) {
        throw new Error(t("AI 体检已取消", "AI audit cancelled", isEn));
      }
      const msg = err instanceof Error ? err.message : String(err);
      failedItems.push(...chunk);
      failures.push({
        batchIndex,
        items: chunk,
        reason: msg,
      });
    }

    emitProgress(batchIndex);
  }

  return {
    updates: allUpdates,
    merges: allMerges,
    modelUsed,
    plannedCount: items.length,
    verifiedCount,
    undeterminedItems,
    failedItems,
    skippedCount,
    unknownOrDuplicateIdCount,
    failures,
  };
}

// MARK: - AI 功能 ③：AI 器材搭配建议

export async function recommendSetup(
  requirement: string,
  eligibleByCategory: Record<GearCategory, GearItem[]>,
  comboStats: RazorBladeComboStat[],
  aiConfig: AIConfigState,
  isEn: boolean
): Promise<AISetupRecommendation> {
  ensureTauriDesktop(isEn);
  if (!isAIConfigReady(aiConfig)) {
    throw new Error(
      t(
        "请先在「外观与设置 → AI 识别接口」中启用并配置 API Key",
        "Please enable and configure your AI API key in Settings first.",
        isEn
      )
    );
  }

  const langHint = isEn ? "English" : "Simplified Chinese";
  const invLines = ALL_GEAR_CATEGORIES.map((cat) => {
    const list = eligibleByCategory[cat] ?? [];
    const summary = list
      .slice(0, 50)
      .map((item) => {
        const meta: string[] = [`uses:${item.count}`];
        if (item.lastUsedDate) meta.push(`last:${item.lastUsedDate}`);
        if (item.razorType) meta.push(razorTypeShortLabel(item.razorType, false));
        if (item.bladeType) meta.push(`blade:${item.bladeType}`);
        if (item.plateType) meta.push(item.plateType);
        if (item.gapOrSpec) meta.push(`gap:${item.gapOrSpec}`);
        if (item.isAdjustable) meta.push("adjustable");
        if (item.isSlant) meta.push("slant");
        if (item.brushMaterial) meta.push(item.brushMaterial);
        if (item.knotSize) meta.push(item.knotSize);
        if (item.isSample) meta.push("sample");
        return `${item.name} [${meta.join(",")}]`;
      })
      .join("; ");
    return `${cat}: ${summary || "none"}`;
  }).join("\n");

  const topGolden = comboStats
    .filter((c) => c.uses >= 2 && c.stingingCount === 0)
    .slice(0, 10)
    .map(
      (c) =>
        `${c.razorName} + ${c.bladeName} (uses:${c.uses}, painless:${Math.round(c.painlessRate * 100)}%, BBS:${Math.round(c.bbsRate * 100)}%)`
    )
    .join("; ");

  const warningCombos = comboStats
    .filter((c) => c.stingingCount > 0)
    .slice(0, 8)
    .map((c) => `${c.razorName} + ${c.bladeName} (stinging:${c.stingingCount}/${c.uses})`)
    .join("; ");

  const systemPrompt = `You are a wet-shaving setup advisor. Recommend ONE cohesive SOTD setup strictly from the user's eligible in-hand gear list.
Return ONLY a valid JSON object (no markdown fences):
{
  "razor": "<exact name from 剃须刀 list>",
  "blade": "<exact name from 刀片 list matching razor type, or null if straight razor>",
  "brush": "<exact name from 剃须刷 list>",
  "soap": "<exact name from 剃须皂 list>",
  "bowl": "<exact name from 剃须碗 list or null>",
  "preShave": "<exact name from 须前 list or null>",
  "afterShave": "<exact name from 须后 list or null>",
  "reason": "2-3 concise sentences in ${langHint} explaining why this pairing fits the request"
}
CRITICAL RULES:
1. You MUST pick exact names present in the provided inventory.
2. Blade type MUST strictly match razor type: DE/SE·半DE/Twin Blade -> blade:DE; SE·AC/替刃 -> blade:AC; SE·GEM -> blade:GEM; SE·Injector -> blade:Injector; 盒刀 -> blade:盒刀头; 直剃 -> null.
3. Avoid combinations in the high-stinging list when the user asks for gentle/painless shaves.`;

  const userPrompt = `User request: ${requirement}

Eligible in-hand gear:
${invLines}

Proven painless combos: ${topGolden || "none"}
High-stinging combos to avoid: ${warningCombos || "none"}`;

  const completion = await aiChatCompletion({
    system: systemPrompt,
    user: userPrompt,
    useWebSearch: false,
    timeoutSecs: 90,
    temperature: 0.35,
  });

  const jsonStr = extractJsonObjectString(completion.content);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    throw new Error(
      t("AI 返回了无法解析的搭配建议", "AI returned an unparseable setup recommendation", isEn)
    );
  }

  return {
    razorName: cleanStr(parsed.razor),
    bladeName: cleanStr(parsed.blade),
    brushName: cleanStr(parsed.brush),
    soapName: cleanStr(parsed.soap),
    bowlName: cleanStr(parsed.bowl),
    preShaveName: cleanStr(parsed.preShave),
    afterShaveName: cleanStr(parsed.afterShave),
    reason: cleanStr(parsed.reason) ?? "",
  };
}

// MARK: - AI 功能 ④：AI 剃须复盘诊断

export async function generateShaveDiagnosis(
  statsSummary: string,
  aiConfig: AIConfigState,
  isEn: boolean
): Promise<{ text: string; model: string }> {
  ensureTauriDesktop(isEn);
  if (!isAIConfigReady(aiConfig)) {
    throw new Error(
      t(
        "请先在「外观与设置 → AI 识别接口」中启用并配置 API Key",
        "Please enable and configure your AI API key in Settings first.",
        isEn
      )
    );
  }

  const langHint = isEn ? "English" : "Simplified Chinese";
  const systemPrompt = `You are an experienced traditional wet-shaving coach.
Analyze the user's real aggregated SOTD statistics and write a concise, practical, data-backed review in ${langHint}.
Structure your response cleanly into 3 short sections with plain headings and bullet points (under 350 words):
1. Core Strengths & Golden Combos
2. Irritation Triggers & Routine Insights (hot towel / post-shower / lather method / blade pairings)
3. 3 Actionable Next-Month Recommendations
Avoid fluff; cite the user's actual gear and percentages. Never invent numbers or gear not present in the summary.`;

  const completion = await aiChatCompletion({
    system: systemPrompt,
    user: statsSummary,
    useWebSearch: false,
    timeoutSecs: 120,
    temperature: 0.35,
  });

  return {
    text: completion.content.trim(),
    model: completion.actualModel,
  };
}
