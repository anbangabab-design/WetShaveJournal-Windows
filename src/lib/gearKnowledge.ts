import {
  ALL_GEAR_CATEGORIES,
  type BadgerBand,
  type BadgerTreatment,
  type BladeType,
  type BrushKnotShape,
  type BrushMaterial,
  type GearCategory,
  type GearItem,
  type GearOverride,
  type GearStatus,
  type JournalDatabase,
  type JournalEntry,
  type PlateType,
  type RazorType,
} from "../types/journal";
import {
  badgerBandDisplay,
  badgerTreatmentDisplay,
  bladeTypeDisplay,
  brandDisplay,
  brushMaterialDisplay,
  categorySingularName,
  handleTag,
  irritationDisplay,
  latheringDisplay,
  loadingDisplay,
  materialDisplay,
  ordinal,
  passDisplay,
  razorTypeShortLabel,
  t,
} from "./l10n";
import {
  extractBowlName,
  getAfterShave,
  getAfterShower,
  getAlum,
  getBowl,
  getBrush,
  getFieldValues,
  getHotTowel,
  getLoadingMethod,
  getPreShave,
  getProcessText,
  getPureLatheringMethod,
  getSoap,
  parseProcessText,
} from "./processParser";

// MARK: - 归一化与基础解析

export function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/ /g, "")
    .replace(/\u00A0/g, "")
    .trim();
}

const BLADE_USAGE_REGEX = /\s*(\d+)\s*(?:st|nd|rd|th)\s*$/i;
const KNOT_SIZE_REGEX = /(\d{2}(?:\.\d)?)\s*mm/;
const COPPER_TOKEN_REGEX = /(?:^|[\s\d])cu(?:$|[\s])/;
const TITANIUM_TOKEN_REGEX = /(?:^|[\s\d])ti(?:$|[\s])/;
const ALUMINUM_TOKEN_REGEX = /(?:^|\s)al(?:$|\s)/;
const STAINLESS_TOKEN_REGEX = /(?:^|[\s\d])ss(?:$|[\s])/;

export function parseBladeUsage(raw: string): {
  baseName: string;
  useCount: number | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { baseName: "", useCount: null };
  const match = trimmed.match(BLADE_USAGE_REGEX);
  if (match && match.index !== undefined) {
    const count = Number.parseInt(match[1], 10);
    const base = trimmed.slice(0, match.index).trim();
    return {
      baseName: base || trimmed,
      useCount: Number.isNaN(count) ? null : count,
    };
  }
  return { baseName: trimmed, useCount: null };
}

export function quickSpellCorrect(raw: string): {
  corrected: string;
  wasCorrected: boolean;
} {
  let text = raw.trim();
  const original = text;
  const replacements: [string, string][] = [
    ["Blackbrid", "Blackbird"],
    ["blackbrid", "Blackbird"],
    ["Twofaca", "Twoface"],
    ["twofaca", "Twoface"],
    ["Alysworth", "Aylsworth"],
    ["alysworth", "Aylsworth"],
    ["Darkkant", "Drakkant"],
    ["Seamgue", "Semogue"],
    ["seamgue", "Semogue"],
    ["Tayers", "Thayers"],
    ["Thyers", "Thayers"],
    ["Blve Astra", "Astra Blue"],
    ["DOROC", "Dorco"],
    ["AMONTURA", "Amonatura"],
    ["Razorock", "RazoRock"],
    ["RAZOROCK", "RazoRock"],
  ];
  for (const [wrong, right] of replacements) {
    if (text.includes(wrong)) {
      text = text.split(wrong).join(right);
    }
  }
  return { corrected: text, wasCorrected: text !== original };
}

export const KNOWN_BRANDS: [string, string][] = [
  ["above the tie", "Above The Tie"],
  ["atelier durdan", "Atelier Durdan"],
  ["ad ", "Atelier Durdan"],
  ["alpha ", "Alpha"],
  ["ascender", "Ascender"],
  ["aylsworth", "Aylsworth"],
  ["alysworth", "Aylsworth"],
  ["blackland", "Blackland"],
  ["blutt", "Blutt"],
  ["colonial", "Colonial"],
  ["gillette", "Gillette"],
  ["hls", "HLS"],
  ["homelike", "HLS"],
  ["karve", "Karve"],
  ["lambda", "Lambda"],
  ["maxwell june", "Maxwell June"],
  ["muhle", "Mühle"],
  ["mühle", "Mühle"],
  ["razorock", "RazoRock"],
  ["rr ", "RazoRock"],
  ["rex ", "Rex Supply Co."],
  ["rocnel", "Rocnel"],
  ["tatara", "Tatara"],
  ["trowell", "Trowell"],
  ["twoface", "Twoface"],
  ["twofaca", "Twoface"],
  ["wolfman", "Wolfman"],
  ["yaqi", "Yaqi"],
  ["frank shaving", "Frank Shaving"],
  ["fs ", "Frank Shaving"],
  ["fs", "Frank Shaving"],
  ["feather", "Feather"],
  ["kai", "Kai"],
  ["schick", "Schick"],
  ["personna", "Personna"],
  ["astra", "Astra"],
  ["dorco", "Dorco"],
  ["doroc", "Dorco"],
  ["super iridium", "Wizamet"],
  ["iridium super", "Wizamet"],
  ["wizamet", "Wizamet"],
  ["wald", "Wald"],
  ["oumo", "Oumo"],
  ["arno", "Arno"],
  ["boti", "Boti"],
  ["bobby", "Bobby"],
  ["paladin", "Paladin"],
  ["simpson", "Simpson"],
  ["semogue", "Semogue"],
  ["seamgue", "Semogue"],
  ["shavemac", "Shavemac"],
  ["longshaving", "Longshaving"],
  ["maggard", "Maggard"],
  ["rooney", "Rooney"],
  ["brad sears", "Brad Sears"],
  ["omega", "Omega"],
  ["dg ", "Declaration Grooming"],
  ["dg", "Declaration Grooming"],
  ["declaration", "Declaration Grooming"],
  ["tns ", "Turn-N-Shave"],
  ["turn-n-shave", "Turn-N-Shave"],
  ["c&h", "Chisel & Hound"],
  ["chisel & hound", "Chisel & Hound"],
  ["rv×", "RV"],
  ["rvx", "RV"],
  ["rv ", "RV"],
  ["mdc", "Martin de Candre"],
  ["martin de candre", "Martin de Candre"],
  ["sv1945", "Saponificio Varesino"],
  ["sv ", "Saponificio Varesino"],
  ["sv80", "Saponificio Varesino"],
  ["sv阿甘", "Saponificio Varesino"],
  ["sv沙漠", "Saponificio Varesino"],
  ["saponificio", "Saponificio Varesino"],
  ["ethos", "Ethos Grooming"],
  ["phoenix", "Phoenix Artisan Accoutrements"],
  ["paa ", "Phoenix Artisan Accoutrements"],
  ["macduff", "MacDuffs Soap Company"],
  ["stirling", "Stirling Soap Co."],
  ["moon", "Moon Soaps"],
  ["mammoth", "House of Mammoth"],
  ["house of mammoth", "House of Mammoth"],
  ["pantarei", "PantaRei"],
  ["elysian", "Elysian Soap Shop"],
  ["hags", "HAGS"],
  ["westman", "WestMan Shaving"],
  ["zingari", "Zingari Man"],
  ["cella", "Cella"],
  ["proraso", "Proraso"],
  ["thayers", "Thayers"],
  ["tayers", "Thayers"],
  ["thyers", "Thayers"],
  ["old spice", "Old Spice"],
  ["clubman", "Clubman Pinaud"],
  ["cerave", "CeraVe"],
  ["amonatura", "Amonatura"],
  ["amontura", "Amonatura"],
  ["lpl", "Le Père Lucien"],
  ["ae ", "Ariana & Evans"],
  ["ariana", "Ariana & Evans"],
  ["laxo", "Laxo"],
  ["华研", "华研"],
  ["哼哈", "哼哈"],
  ["双面", "Twoface"],
  ["rokyhows", "Rokyhows"],
  ["fizz", "Fizz"],
  ["cayuen", "Cayuen"],
  ["aka", "AKA"],
  ["trc", "The Razor Company"],
  ["arko", "Arko"],
  ["fine", "Fine Accoutrements"],
  ["nomad theory", "Nomad Theory"],
  ["s.ghost", "S.ghost"],
  ["帝诗", "帝诗"],
  ["树皮", "树皮"],
  ["阳森", "阳森"],
  ["图腾", "图腾"],
];

export const KNOWN_ADJUSTABLE_KEYWORDS: string[] = [
  "可调",
  "muramasa",
  "taiga",
  "elbrus",
  "ambassador",
  "konsul",
  "fatboy",
  "slim",
  "black beauty",
  "super adjustable",
  "progress",
  "futur",
  "variant",
  "horizon",
  "trowell t8",
  "t8",
  "osprey",
  "rockwell t2",
  "model t",
  "flexi",
  "gibbs",
  "rex",
  "adjustable",
];

function isCloneRazor(raw: string): boolean {
  const lower = raw.toLowerCase();
  return (
    lower.includes("仿") ||
    lower.includes("舜平") ||
    lower.includes("clone") ||
    lower.includes("复刻") ||
    lower.includes("橙子or1") ||
    lower.includes("橙子 or1") ||
    lower.includes("队可调斜")
  );
}

export function inferMaterial(text: string): string | undefined {
  const lower = ` ${text.toLowerCase()} `;
  if (lower.includes("磷青铜") || lower.includes("phosphor bronze")) return "磷青铜";
  if (lower.includes("青铜") || lower.includes("bronze")) return "青铜";
  if (
    lower.includes("红铜") ||
    lower.includes("紫铜") ||
    lower.includes("copper") ||
    COPPER_TOKEN_REGEX.test(lower)
  ) {
    return "红铜";
  }
  if (lower.includes("黄铜") || lower.includes("brass")) return "黄铜";
  if (
    lower.includes("钛") ||
    lower.includes("titanium") ||
    lower.includes("grade 5") ||
    lower.includes("grade 2") ||
    TITANIUM_TOKEN_REGEX.test(lower)
  ) {
    return "钛合金";
  }
  if (
    lower.includes("铝") ||
    lower.includes("aluminum") ||
    lower.includes("aluminium") ||
    lower.includes("6061") ||
    lower.includes("7075") ||
    ALUMINUM_TOKEN_REGEX.test(lower)
  ) {
    return "铝合金";
  }
  if (
    lower.includes("316l") ||
    lower.includes("316") ||
    lower.includes("304") ||
    lower.includes("303") ||
    lower.includes("17-4") ||
    lower.includes("不锈钢") ||
    lower.includes("stainless") ||
    lower.includes("steel") ||
    STAINLESS_TOKEN_REGEX.test(lower)
  ) {
    return "不锈钢";
  }
  if (
    lower.includes("锌合金") ||
    lower.includes("zamak") ||
    lower.includes("zamac") ||
    lower.includes("zinc") ||
    lower.includes("chrome")
  ) {
    return "锌合金";
  }
  return undefined;
}

export function inferIsSlant(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("slant") ||
    lower.includes("斜") ||
    lower.includes("wunderbar") ||
    lower.includes("konsul") ||
    lower.includes("l2") ||
    lower.includes("l3")
  );
}

export function inferPlateType(text: string): PlateType | undefined {
  const lower = text.toLowerCase();
  if (
    lower.includes(" oc") ||
    lower.endsWith("oc") ||
    lower.includes("open comb") ||
    lower.includes("开齿") ||
    lower.includes("r41")
  ) {
    return "OC";
  }
  if (
    lower.includes(" dc") ||
    lower.endsWith("dc") ||
    lower.includes("dual comb") ||
    lower.includes("双面齿")
  ) {
    return "DC";
  }
  if (
    lower.includes(" sb") ||
    lower.endsWith("sb") ||
    lower.includes(" cc") ||
    lower.endsWith("cc") ||
    lower.includes("safety bar") ||
    lower.includes("closed comb") ||
    lower.includes("闭齿")
  ) {
    return "SB";
  }
  return undefined;
}

export function inferRazorType(text: string): RazorType | undefined {
  const lower = text.toLowerCase();
  if (
    lower.includes("极光") ||
    lower.includes("gillette lab") ||
    lower.includes("gillette blue") ||
    lower.includes("mach3") ||
    lower.includes("fusion") ||
    lower.includes("盒刀") ||
    lower.includes("cartridge")
  ) {
    return "盒刀";
  }
  if (
    lower.includes("twin blade") ||
    lower.includes("maxwell june") ||
    lower.includes(" tb") ||
    lower.endsWith("tb")
  ) {
    return "Twin Blade";
  }
  if (
    lower.includes("shavette") ||
    lower.includes("替刃") ||
    lower.includes("剃刃") ||
    lower.includes("artist club ss") ||
    lower.includes("feather dx")
  ) {
    return "替刃";
  }
  if (lower.includes("straight") || lower.includes("直剃")) return "直剃";
  if (
    lower.includes("树皮") ||
    lower.includes("半de") ||
    lower.includes("half de") ||
    lower.includes("twig") ||
    lower.includes("thorn") ||
    lower.includes("proof razor")
  ) {
    return "Single Edge (半DE)";
  }
  if (
    lower.includes("injector") ||
    lower.includes("schick type") ||
    lower.includes("supply se")
  ) {
    return "Single Edge (Injector)";
  }
  if (
    lower.includes("vestige") ||
    lower.includes("batch 004") ||
    lower.includes("gem") ||
    lower.includes("sabre") ||
    lower.includes("micromatic")
  ) {
    return "Single Edge (GEM)";
  }
  if (
    lower.includes("vector") ||
    lower.includes("hawk") ||
    lower.includes("general") ||
    lower.includes("amakuni") ||
    lower.includes("天国") ||
    lower.includes("horizon") ||
    lower.includes("se1") ||
    lower.includes("se2") ||
    lower.includes("tf-1") ||
    lower.includes("artist club") ||
    lower.includes(" ac ")
  ) {
    return "Single Edge (AC)";
  }
  return undefined;
}

export function inferBladeType(text: string): BladeType | undefined {
  const lower = text.toLowerCase();
  if (
    lower.includes("极光") ||
    lower.includes("gillette lab") ||
    lower.includes("gillette blue") ||
    lower.includes("mach3") ||
    lower.includes("fusion") ||
    lower.includes("盒刀") ||
    lower.includes("cartridge")
  ) {
    return "盒刀头";
  }
  if (lower.includes("62-0178") || lower.includes("ptfe")) return "GEM";
  if (lower.includes("injector") || lower.includes("b-20")) return "Injector";
  if (
    lower.includes("ctm") ||
    lower.includes("captain") ||
    lower.includes("ps-20") ||
    lower.includes("pro super") ||
    lower.includes("p-30") ||
    lower.includes("p30") ||
    lower.includes("proline") ||
    lower.includes("protouch") ||
    lower.includes("premiumguard") ||
    lower.includes("artist club") ||
    lower.includes(" ac")
  ) {
    return "AC";
  }
  if (
    lower.includes("de") ||
    lower.includes("74-0002") ||
    lower.includes("60-0257") ||
    lower.includes("nacet") ||
    lower.includes("astra") ||
    lower.includes("wizamet") ||
    lower.includes("iridium") ||
    lower.includes("dorco") ||
    lower.includes("俄纸") ||
    lower.includes("德产红") ||
    lower.includes("365") ||
    lower.includes("碳素钢")
  ) {
    return "DE";
  }
  return undefined;
}

function inferBrushAttributes(text: string): {
  material?: BrushMaterial;
  treatment?: BadgerTreatment;
  band?: BadgerBand;
  knotSize?: string;
  knotShape?: BrushKnotShape;
} {
  const lower = text.toLowerCase();
  const knotMatch = lower.match(KNOT_SIZE_REGEX);
  const knotSize = knotMatch?.[1] ? `${knotMatch[1]}mm` : undefined;

  let knotShape: BrushKnotShape | undefined;
  if (lower.includes("hybrid")) knotShape = "Hybrid";
  else if (lower.includes("fan")) knotShape = "Fan";
  else if (lower.includes("bulb")) knotShape = "Bulb";

  let material: BrushMaterial | undefined;
  let treatment: BadgerTreatment | undefined;
  let band: BadgerBand | undefined;

  if (lower.includes("羊毛") || lower.includes("wool")) {
    material = "羊毛";
  } else if (
    lower.includes("猪鬃") ||
    lower.includes("boar") ||
    lower.includes("10048") ||
    lower.includes("soc taj") ||
    lower.includes("pigsy")
  ) {
    material = "猪鬃";
  } else if (lower.includes("马毛") || lower.includes("horse")) {
    material = "马毛";
  } else if (
    lower.includes("人造") ||
    lower.includes("synthetic") ||
    lower.includes("wald") ||
    lower.includes("pur-tech") ||
    lower.includes("g5") ||
    lower.includes("st3") ||
    lower.includes("st-3") ||
    lower.includes("st-2") ||
    lower.includes("cloudline") ||
    lower.includes("云线") ||
    lower.includes("云尾") ||
    lower.includes("slg") ||
    lower.includes("star100") ||
    lower.includes("star 86") ||
    lower.includes("流云") ||
    lower.includes("twoface gs")
  ) {
    material = "人造丝";
  } else if (
    lower.includes("獾") ||
    lower.includes("badger") ||
    lower.includes("2band") ||
    lower.includes("3band") ||
    lower.includes("2-band") ||
    lower.includes("3-band") ||
    lower.includes("二段") ||
    lower.includes("二路") ||
    lower.includes("三段") ||
    lower.includes("三路") ||
    lower.includes("满洲") ||
    lower.includes("manchurian") ||
    lower.includes("d01") ||
    lower.includes("shd") ||
    lower.includes("silvertip") ||
    lower.includes("finest") ||
    lower.includes("脊背毛") ||
    lower.includes("漂尖") ||
    lower.includes("老毛") ||
    lower.includes("特路") ||
    lower.includes("paladin") ||
    lower.includes("shavemac") ||
    lower.includes("rooney") ||
    lower.includes("brad sears") ||
    lower.includes("dg b") ||
    lower.includes("tns ") ||
    lower.includes("reserve") ||
    lower.includes("epoch") ||
    lower.includes("kirin") ||
    lower.includes("麒麟")
  ) {
    material = "獾毛";
  }

  if (material === "獾毛") {
    if (
      lower.includes("漂尖") ||
      lower.includes("gel") ||
      lower.includes("bleached") ||
      lower.includes("shd")
    ) {
      treatment = "漂尖";
    } else if (
      lower.includes("无漂") ||
      lower.includes("unbleached") ||
      lower.includes("脊背") ||
      lower.includes("满洲") ||
      lower.includes("d01") ||
      lower.includes("finest")
    ) {
      treatment = "无漂";
    }

    if (
      lower.includes("3band") ||
      lower.includes("三段") ||
      lower.includes("三路") ||
      lower.includes("3-band")
    ) {
      band = "三段";
    } else if (
      lower.includes("2band") ||
      lower.includes("二段") ||
      lower.includes("二路") ||
      lower.includes("2-band") ||
      lower.includes("满洲") ||
      lower.includes("finest") ||
      lower.includes("shd") ||
      lower.includes("脊背")
    ) {
      band = "二段";
    }
  }

  return { material, treatment, band, knotSize, knotShape };
}

export function normalizeGearStatus(
  status: string | undefined,
  category: GearCategory
): GearStatus {
  let mapped: GearStatus;
  switch (status) {
    case "在用":
    case "闲置":
      mapped = "在用";
      break;
    case "借用":
      mapped = "借用";
      break;
    case "已出":
    case "空瓶":
      mapped = "已出";
      break;
    case "有":
      mapped = "有";
      break;
    case "无":
      mapped = "无";
      break;
    default:
      return category === "刀片" ? "有" : "在用";
  }

  if (category === "刀片") {
    return mapped === "有" || mapped === "在用" || mapped === "借用" ? "有" : "无";
  }
  if (mapped === "有") return "在用";
  if (mapped === "无") return "已出";
  return mapped;
}

export function normalizeRazorType(raw: string | undefined): RazorType | undefined {
  if (!raw) return undefined;
  if (raw === "剃刃") return "替刃";
  if (raw === "Single Edge (其他)") return "其他";
  const allowed: RazorType[] = [
    "Double Edge (DE)",
    "Single Edge (AC)",
    "Single Edge (GEM)",
    "Single Edge (Injector)",
    "Single Edge (半DE)",
    "盒刀",
    "Twin Blade",
    "直剃",
    "替刃",
    "其他",
  ];
  return (allowed as string[]).includes(raw) ? (raw as RazorType) : "其他";
}

export function normalizePlateType(raw: string | undefined): {
  plateType?: PlateType;
  impliedSlant?: boolean;
} {
  if (!raw) return {};
  if (raw === "SB") return { plateType: "SB" };
  if (raw === "OC") return { plateType: "OC" };
  if (raw === "DC") return { plateType: "DC" };
  if (raw === "Slant") return { plateType: "SB", impliedSlant: true };
  if (raw === "Slant OC") return { plateType: "OC", impliedSlant: true };
  return {};
}

export function inferDefaultOverride(
  rawName: string,
  category: GearCategory
): GearOverride {
  const { corrected } = quickSpellCorrect(rawName);
  const lower = corrected.toLowerCase();

  let brand = "品牌未注明";
  let handleBrand: string | undefined;

  if (category === "剃须刀" && isCloneRazor(corrected)) {
    brand = "仿刀";
  } else {
    for (const [prefix, canonical] of KNOWN_BRANDS) {
      if (lower.startsWith(prefix)) {
        brand = canonical;
        break;
      }
    }
  }

  if (category === "剃须刷" && (corrected.includes("×") || lower.includes(" x "))) {
    const sep = corrected.includes("×") ? "×" : " x ";
    const parts = corrected.split(sep);
    if (parts.length >= 2) {
      const firstRaw = parts[0].trim().toLowerCase();
      const secondRaw = parts[1].trim().toLowerCase();
      let detectedHandle: string | undefined;
      let detectedKnot: string | undefined;

      for (const [prefix, canonical] of KNOWN_BRANDS) {
        const p = prefix.trim();
        if (!detectedHandle && firstRaw.startsWith(p)) detectedHandle = canonical;
        if (!detectedKnot && secondRaw.startsWith(p)) detectedKnot = canonical;
      }
      if (!detectedKnot) {
        if (secondRaw.startsWith("long")) detectedKnot = "Longshaving";
        else if (secondRaw.startsWith("maggard")) detectedKnot = "Maggard";
      }
      if (detectedKnot) {
        brand = detectedKnot;
        if (
          detectedHandle &&
          detectedHandle.toLowerCase() !== detectedKnot.toLowerCase()
        ) {
          handleBrand = detectedHandle;
        }
      }
    }
  }

  const ov: GearOverride = {
    brand,
    name: corrected,
    status: category === "刀片" ? "有" : "在用",
  };

  if (category === "剃须刀") {
    ov.razorType = inferRazorType(corrected) ?? "Double Edge (DE)";
    ov.isAdjustable = KNOWN_ADJUSTABLE_KEYWORDS.some((kw) => lower.includes(kw));
    ov.isSlant = inferIsSlant(corrected);
    ov.material = inferMaterial(corrected);
    ov.plateType = inferPlateType(corrected);
  } else if (category === "刀片") {
    ov.bladeType = inferBladeType(corrected);
  } else if (category === "剃须刷") {
    const info = inferBrushAttributes(corrected);
    ov.handleBrand = handleBrand;
    ov.brushMaterial = info.material;
    ov.badgerTreatment = info.treatment;
    ov.badgerBand = info.band;
    ov.knotSize = info.knotSize;
    ov.knotShape = info.knotShape;
  }

  return ov;
}

export function getDisplayModel(ov: GearOverride): string {
  const m = ov.model?.trim();
  if (m) return m;
  const b = (ov.brand || "").trim();
  const n = (ov.name || "").trim();
  if (
    b &&
    b !== "品牌未注明" &&
    b !== "仿刀" &&
    n.toLowerCase().startsWith(b.toLowerCase())
  ) {
    const stripped = n.slice(b.length).trim();
    if (stripped) return stripped;
  }
  return n;
}

export function isShortGapSpec(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.length > 12) return null;
  const lower = trimmed.toLowerCase();
  const forbidden = [
    "blade",
    "exposure",
    "gap",
    "positive",
    "negative",
    "neutral",
    "weight",
    "gram",
    "grams",
    "克重",
    "露刃",
    "刀隙",
    ",",
    "，",
    ";",
    "；",
    "/",
    "(",
    "（",
  ];
  for (const token of forbidden) {
    if (lower.includes(token)) return null;
  }
  return trimmed;
}

export function getSpecTags(
  category: GearCategory,
  ov: GearOverride,
  isEn: boolean,
  includeSampleTag = false
): string[] {
  const tags: string[] = [];
  if (category === "剃须刀") {
    const rt = normalizeRazorType(ov.razorType as string | undefined);
    if (rt) tags.push(razorTypeShortLabel(rt, isEn));
    if (ov.isAdjustable) tags.push(t("可调", "Adjustable", isEn));
    const { plateType, impliedSlant } = normalizePlateType(
      ov.plateType as string | undefined
    );
    if (ov.isSlant || impliedSlant) tags.push("Slant");
    if (plateType) tags.push(plateType);
    const gap = isShortGapSpec(ov.gapOrSpec);
    if (gap) tags.push(gap);
    if (ov.material?.trim()) tags.push(materialDisplay(ov.material.trim(), isEn));
  } else if (category === "刀片") {
    if (ov.bladeType) tags.push(bladeTypeDisplay(ov.bladeType as BladeType, isEn));
  } else if (category === "剃须刷") {
    if (ov.brushMaterial) {
      tags.push(brushMaterialDisplay(ov.brushMaterial as BrushMaterial, isEn));
    }
    if (ov.brushMaterial === "獾毛") {
      if (ov.badgerTreatment) {
        tags.push(
          badgerTreatmentDisplay(ov.badgerTreatment as BadgerTreatment, isEn)
        );
      }
      if (ov.badgerBand) {
        tags.push(badgerBandDisplay(ov.badgerBand as BadgerBand, isEn));
      }
    }
    if (ov.knotShape) tags.push(String(ov.knotShape));
  } else if (category === "剃须皂" || category === "须后") {
    if (includeSampleTag && ov.isSample) {
      tags.push(t("小样", "Sample", isEn));
    }
  }
  return tags;
}

function hydrateOverride(rawOv: GearOverride, category: GearCategory): GearOverride {
  const ov: GearOverride = { ...rawOv };
  ov.status = normalizeGearStatus(ov.status as string | undefined, category);
  if (category === "剃须刀") {
    if (ov.razorType) {
      ov.razorType = normalizeRazorType(String(ov.razorType));
    }
    const { plateType, impliedSlant } = normalizePlateType(
      ov.plateType as string | undefined
    );
    if (plateType) ov.plateType = plateType;
    if (impliedSlant && ov.isSlant === undefined) ov.isSlant = true;
  }
  if (category === "刀片" && !ov.bladeType) {
    ov.bladeType = inferBladeType(ov.name);
  }
  if (category === "剃须刷" && !ov.handleBrand && ov.knotBrand?.trim()) {
    const legacyKnot = ov.knotBrand.trim();
    if (ov.brand.toLowerCase() !== legacyKnot.toLowerCase()) {
      ov.handleBrand = ov.brand;
    }
    ov.brand = legacyKnot;
  }
  return ov;
}

export function resolveGear(
  category: GearCategory,
  rawValue: string,
  db: JournalDatabase
): { key: string; override: GearOverride } {
  let effectiveRaw: string;
  if (category === "刀片") {
    effectiveRaw = parseBladeUsage(rawValue).baseName;
  } else if (category === "剃须碗") {
    effectiveRaw = extractBowlName(rawValue) ?? rawValue.trim();
  } else {
    effectiveRaw = rawValue.trim();
  }

  const norm = normalizeKey(effectiveRaw);
  const fullKey = `${category}|${norm}`;
  const existing = db.overrides[fullKey];
  if (existing) {
    return { key: fullKey, override: hydrateOverride(existing, category) };
  }
  return { key: fullKey, override: inferDefaultOverride(effectiveRaw, category) };
}

function categoryForFieldLabel(label: string): GearCategory | null {
  for (const cat of ALL_GEAR_CATEGORIES) {
    if (
      label === cat ||
      (label.startsWith(cat) && /^\d+$/.test(label.slice(cat.length)))
    ) {
      return cat;
    }
  }
  return null;
}

function variantSignature(category: GearCategory, ov: GearOverride): string {
  if (category === "剃须刀") {
    const { plateType, impliedSlant } = normalizePlateType(
      ov.plateType as string | undefined
    );
    return [
      (ov.material ?? "").toLowerCase(),
      plateType ?? "",
      ov.isSlant || impliedSlant ? "slant" : "",
      (ov.gapOrSpec ?? "").toLowerCase(),
    ].join("#");
  }
  if (category === "剃须刷") {
    return [
      (ov.handleBrand ?? "").toLowerCase(),
      (ov.knotSize ?? "").toLowerCase(),
      ov.knotShape ?? "",
      ov.badgerBand ?? "",
      ov.badgerTreatment ?? "",
    ].join("#");
  }
  return "";
}

function mergeMissingFields(dst: GearOverride, src: GearOverride): void {
  if (!dst.material && src.material) dst.material = src.material;
  if (!dst.plateType && src.plateType) dst.plateType = src.plateType;
  if (!dst.gapOrSpec && src.gapOrSpec) dst.gapOrSpec = src.gapOrSpec;
  if (!dst.razorType && src.razorType) dst.razorType = src.razorType;
  if (!dst.isAdjustable && src.isAdjustable) dst.isAdjustable = true;
  if (!dst.isSlant && src.isSlant) dst.isSlant = true;
  if (!dst.bladeType && src.bladeType) dst.bladeType = src.bladeType;
  if (!dst.handleBrand && src.handleBrand) dst.handleBrand = src.handleBrand;
  if (!dst.brushMaterial && src.brushMaterial) dst.brushMaterial = src.brushMaterial;
  if (!dst.badgerTreatment && src.badgerTreatment) dst.badgerTreatment = src.badgerTreatment;
  if (!dst.badgerBand && src.badgerBand) dst.badgerBand = src.badgerBand;
  if (!dst.knotSize && src.knotSize) dst.knotSize = src.knotSize;
  if (!dst.knotShape && src.knotShape) dst.knotShape = src.knotShape;
  if (!dst.isSample && src.isSample) dst.isSample = true;
  if (!dst.status && src.status) dst.status = src.status;
  if (!dst.isManuallyConfirmed && src.isManuallyConfirmed) dst.isManuallyConfirmed = true;
}

export interface GearCatalogSnapshot {
  itemsByCategory: Record<GearCategory, GearItem[]>;
}

export function buildGearCatalogSnapshot(db: JournalDatabase): GearCatalogSnapshot {
  type Agg = {
    brand: string;
    name: string;
    count: number;
    lastDate: string;
    rawKeys: Set<string>;
    override: GearOverride;
    isPending: boolean;
  };

  const buckets: Record<GearCategory, Map<string, Agg>> = {
    剃须刀: new Map(),
    刀片: new Map(),
    剃须刷: new Map(),
    剃须皂: new Map(),
    须前: new Map(),
    须后: new Map(),
    剃须碗: new Map(),
  };

  const pendingSet = new Set(db.pending ?? []);
  const resolveCache = new Map<string, { key: string; override: GearOverride }>();

  const cachedResolve = (category: GearCategory, rawValue: string) => {
    const cacheKey = `${category}\u001F${rawValue}`;
    const hit = resolveCache.get(cacheKey);
    if (hit) return hit;
    const res = resolveGear(category, rawValue, db);
    resolveCache.set(cacheKey, res);
    return res;
  };

  const merge = (
    category: GearCategory,
    rawKey: string,
    rawOv: GearOverride,
    date: string | null,
    countDelta: number
  ) => {
    const ov = hydrateOverride(rawOv, category);
    const sig = variantSignature(category, ov);
    const identity = `${category}|${(ov.brand || "").toLowerCase()}|${(ov.name || "").toLowerCase()}|${sig}`;
    const pending = pendingSet.has(rawKey);
    const bucket = buckets[category];
    const existing = bucket.get(identity);
    if (existing) {
      existing.count += countDelta;
      if (date && date > existing.lastDate) existing.lastDate = date;
      existing.rawKeys.add(rawKey);
      existing.isPending = existing.isPending || pending;
      mergeMissingFields(existing.override, ov);
    } else {
      bucket.set(identity, {
        brand: ov.brand || "品牌未注明",
        name: ov.name,
        count: countDelta,
        lastDate: date ?? "",
        rawKeys: new Set([rawKey]),
        override: ov,
        isPending: pending,
      });
    }
  };

  for (const entry of db.entries ?? []) {
    let hasExplicitBowl = false;
    let latheringRaw: string | null = null;

    for (const field of entry.fields ?? []) {
      const trimmed = (field.value ?? "").trim();
      if (field.label === "起泡") {
        latheringRaw = trimmed;
        continue;
      }
      if (!trimmed || trimmed === "无" || trimmed === "-") continue;
      const cat = categoryForFieldLabel(field.label);
      if (!cat) continue;
      if (cat === "剃须碗") hasExplicitBowl = true;
      const { key, override } = cachedResolve(cat, trimmed);
      merge(cat, key, override, entry.date, 1);
    }

    if (!hasExplicitBowl && latheringRaw) {
      const inferredBowl = extractBowlName(latheringRaw);
      if (inferredBowl) {
        const { key, override } = cachedResolve("剃须碗", inferredBowl);
        merge("剃须碗", key, override, entry.date, 1);
      }
    }
  }

  for (const [k, ov] of Object.entries(db.overrides ?? {})) {
    const sepIdx = k.indexOf("|");
    if (sepIdx <= 0) continue;
    const catStr = k.slice(0, sepIdx) as GearCategory;
    if (!ALL_GEAR_CATEGORIES.includes(catStr)) continue;
    merge(catStr, k, ov, null, 0);
  }

  const itemsByCategory = {} as Record<GearCategory, GearItem[]>;
  for (const cat of ALL_GEAR_CATEGORIES) {
    const list: GearItem[] = [];
    for (const agg of buckets[cat].values()) {
      const rawKeys = Array.from(agg.rawKeys).sort();
      const primaryKey = rawKeys[0] ?? `${cat}|${normalizeKey(agg.name)}`;
      const ov = agg.override;
      const normalizedStatus = normalizeGearStatus(ov.status as string | undefined, cat);
      const { plateType, impliedSlant } = normalizePlateType(
        ov.plateType as string | undefined
      );
      list.push({
        id: primaryKey,
        category: cat,
        canonicalKey: primaryKey,
        brand: agg.brand,
        name: agg.name,
        model: getDisplayModel(ov),
        count: agg.count,
        lastUsedDate: agg.lastDate,
        rawKeys,
        isPending: agg.isPending,
        razorType: normalizeRazorType(ov.razorType as string | undefined),
        isAdjustable: Boolean(ov.isAdjustable),
        isSlant: Boolean(ov.isSlant || impliedSlant),
        material: ov.material,
        plateType,
        gapOrSpec: ov.gapOrSpec,
        bladeType: ov.bladeType as BladeType | undefined,
        handleBrand: ov.handleBrand,
        brushMaterial: ov.brushMaterial as BrushMaterial | undefined,
        badgerTreatment: ov.badgerTreatment as BadgerTreatment | undefined,
        badgerBand: ov.badgerBand as BadgerBand | undefined,
        knotSize: ov.knotSize,
        knotShape: ov.knotShape as BrushKnotShape | undefined,
        isSample: Boolean(ov.isSample),
        status: normalizedStatus,
        notes: ov.notes,
        recognizedSource: ov.recognizedSource,
        isManuallyConfirmed: Boolean(ov.isManuallyConfirmed),
      });
    }
    list.sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return b.lastUsedDate.localeCompare(a.lastUsedDate);
    });
    itemsByCategory[cat] = list;
  }

  return { itemsByCategory };
}

function statusSearchPriority(status: GearStatus): number {
  if (status === "在用" || status === "有") return 0;
  if (status === "借用") return 1;
  return 2;
}

export function searchGearCandidates(
  all: GearItem[],
  query: string
): GearItem[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? all.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.brand.toLowerCase().includes(q) ||
          item.model.toLowerCase().includes(q) ||
          (item.handleBrand?.toLowerCase().includes(q) ?? false) ||
          (item.gapOrSpec?.toLowerCase().includes(q) ?? false) ||
          (item.material?.toLowerCase().includes(q) ?? false)
      )
    : all;

  return [...filtered].sort((a, b) => {
    const pa = statusSearchPriority(a.status);
    const pb = statusSearchPriority(b.status);
    if (pa !== pb) return pa - pb;
    if (a.count !== b.count) return b.count - a.count;
    return b.lastUsedDate.localeCompare(a.lastUsedDate);
  });
}

export function isRazorAdjustable(razorText: string, db: JournalDatabase): boolean {
  const trimmed = razorText.trim();
  if (!trimmed) return false;
  const { override } = resolveGear("剃须刀", trimmed, db);
  if (override.isAdjustable !== undefined) return Boolean(override.isAdjustable);
  const lower = trimmed.toLowerCase();
  return KNOWN_ADJUSTABLE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function suggestedNextBladeUseCount(
  baseBladeName: string,
  db: JournalDatabase
): number {
  const targetNorm = normalizeKey(parseBladeUsage(baseBladeName).baseName);
  if (!targetNorm) return 1;
  for (const entry of db.entries ?? []) {
    for (const raw of getFieldValues(entry, ["刀片"])) {
      const parsed = parseBladeUsage(raw);
      const { override } = resolveGear("刀片", raw, db);
      if (
        normalizeKey(parsed.baseName) === targetNorm ||
        normalizeKey(override.name) === targetNorm
      ) {
        return (parsed.useCount ?? 1) + 1;
      }
    }
  }
  return 1;
}

/** 与 Mac 版 ShaveTheme.brandColor(for:) 100% 一致的低饱和品牌色哈希 */
export function getBrandColor(brand: string): string {
  if (brand === "仿刀") return "#7A7A85";
  if (!brand || brand === "品牌未注明" || brand === "无品牌") return "#8A8D94";
  const palette = [
    "#3D73B3",
    "#3D8575",
    "#706BA3",
    "#996B47",
    "#8A617A",
    "#57808F",
    "#8A7A42",
    "#945C5C",
  ];
  let hash = 5381;
  const lower = brand.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    hash = ((hash << 5) + hash + lower.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

/** 与 Mac 版 JournalStore.formatSOTDForSharing(_:) 100% 一致的分享文案生成 */
export function formatSOTDForSharing(
  entry: JournalEntry,
  db: JournalDatabase,
  isEn: boolean
): string {
  const lines: string[] = [];
  lines.push(isEn ? `**SOTD · ${entry.date}**` : `SOTD · ${entry.date}`);
  lines.push("");

  const formatGearLine = (category: GearCategory, raw: string): string => {
    const { override: ov } = resolveGear(category, raw, db);
    const brand = brandDisplay(ov.brand, isEn);
    const model = getDisplayModel(ov);
    const baseName =
      brand === "Unknown Brand" ||
      brand === "品牌未注明" ||
      brand === "Clone" ||
      brand === "仿刀"
        ? model
        : model.toLowerCase().startsWith(brand.toLowerCase())
          ? model
          : `${brand} ${model}`;

    const extras: string[] = [];
    if (category === "剃须刀") {
      extras.push(...getSpecTags("剃须刀", ov, isEn));
    } else if (category === "刀片") {
      const parsed = parseBladeUsage(raw);
      if (parsed.useCount !== null) {
        extras.push(isEn ? ordinal(parsed.useCount) : `第 ${parsed.useCount} 次`);
      }
    } else if (category === "剃须刷") {
      if (ov.handleBrand) extras.push(handleTag(ov.handleBrand, isEn));
      extras.push(...getSpecTags("剃须刷", ov, isEn));
      if (ov.knotSize) extras.push(ov.knotSize);
    } else if (category === "剃须皂" || category === "须后") {
      if (ov.isSample) extras.push(t("小样", "Sample", isEn));
    }

    const detail =
      extras.length === 0
        ? ""
        : isEn
          ? ` (${extras.join(" · ")})`
          : `（${extras.join(" · ")}）`;
    const catName = categorySingularName(category, isEn);
    return isEn
      ? `* **${catName}:** ${baseName}${detail}`
      : `• ${catName}：${baseName}${detail}`;
  };

  for (const r of getFieldValues(entry, ["剃须刀"])) {
    lines.push(formatGearLine("剃须刀", r));
  }
  for (const b of getFieldValues(entry, ["刀片"])) {
    lines.push(formatGearLine("刀片", b));
  }
  const brush = getBrush(entry);
  if (brush) lines.push(formatGearLine("剃须刷", brush));
  const soap = getSoap(entry);
  if (soap) lines.push(formatGearLine("剃须皂", soap));
  const bowl = getBowl(entry);
  if (bowl) lines.push(formatGearLine("剃须碗", bowl));
  const preShave = getPreShave(entry);
  if (preShave && preShave !== "无") lines.push(formatGearLine("须前", preShave));
  const afterShave = getAfterShave(entry);
  if (afterShave && afterShave !== "无") {
    lines.push(formatGearLine("须后", afterShave));
  }

  const prepParts: string[] = [];
  const loading = getLoadingMethod(entry);
  if (loading) prepParts.push(loadingDisplay(loading, isEn));
  const pureLath = getPureLatheringMethod(entry);
  if (pureLath) prepParts.push(latheringDisplay(pureLath, isEn));
  if (getHotTowel(entry)) prepParts.push(t("热敷", "Hot Towel", isEn));
  if (getAfterShower(entry).startsWith("是")) {
    prepParts.push(t("浴后", "Post-Shower", isEn));
  }
  if (getAlum(entry).startsWith("是")) {
    prepParts.push(t("明矾", "Alum", isEn));
  }
  if (prepParts.length > 0) {
    lines.push(
      isEn
        ? `* **Prep & Lather:** ${prepParts.join(" · ")}`
        : `• 流程：${prepParts.join(" · ")}`
    );
  }

  const proc = parseProcessText(getProcessText(entry));
  const passParts: string[] = [];
  if (proc.passes.length > 0) {
    const passStr = proc.passes
      .map((step) => {
        const name = passDisplay(step.pass, isEn);
        if (!step.setting) return name;
        return isEn ? `${name} (#${step.setting})` : `${name}(${step.setting}档)`;
      })
      .join(isEn ? ", " : " / ");
    passParts.push(passStr);
  }
  if (proc.irritation) passParts.push(irritationDisplay(proc.irritation, isEn));
  if (proc.result) passParts.push(proc.result);
  if (proc.note) passParts.push(proc.note);

  if (passParts.length > 0) {
    lines.push(
      isEn
        ? `* **Result:** ${passParts.join(" · ")}`
        : `• 过程：${passParts.join(" · ")}`
    );
  }

  return lines.join("\n");
}
