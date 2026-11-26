import type {
  AppLanguage,
  AppearanceMode,
  AppTab,
  BadgerBand,
  BadgerTreatment,
  BladeType,
  BrushMaterial,
  GearCategory,
  GearStatus,
  IrritationLevel,
  LatheringMethod,
  PlateType,
  RazorType,
  ShavePassType,
  ShaveResult,
  SoapLoadingMethod,
} from "../types/journal";

export function resolveIsEnglish(language: AppLanguage): boolean {
  if (language === "en") return true;
  if (language === "zh-Hans") return false;
  const navLang = (
    typeof navigator !== "undefined" ? navigator.language : "zh-CN"
  ).toLowerCase();
  return !navLang.startsWith("zh");
}

export function t(zh: string, en: string, isEn: boolean): string {
  return isEn ? en : zh;
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 === 11 || mod100 === 12 || mod100 === 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function brandDisplay(raw: string, isEn: boolean): string {
  if (!isEn) return raw;
  switch (raw) {
    case "仿刀":
      return "Clone";
    case "品牌未注明":
    case "无品牌":
      return "Unknown Brand";
    default:
      return raw;
  }
}

export function materialDisplay(raw: string, isEn: boolean): string {
  if (!isEn) return raw;
  switch (raw) {
    case "不锈钢":
      return "Stainless Steel";
    case "钛合金":
      return "Titanium";
    case "黄铜":
      return "Brass";
    case "红铜":
      return "Copper";
    case "青铜":
      return "Bronze";
    case "磷青铜":
      return "Phosphor Bronze";
    case "铝合金":
      return "Aluminum";
    case "锌合金":
      return "Zamak";
    default:
      return raw;
  }
}

export function handleTag(handleBrand: string, isEn: boolean): string {
  return isEn ? `${handleBrand} Handle` : `${handleBrand} 柄`;
}

export function latheringDisplay(raw: string, isEn: boolean): string {
  switch (raw) {
    case "碗起":
      return t("碗起", "Bowl Lather", isEn);
    case "脸起":
      return t("脸起", "Face Lather", isEn);
    case "手起":
      return t("手起", "Hand Lather", isEn);
    default:
      return raw;
  }
}

export function latheringShortDisplay(method: LatheringMethod, isEn: boolean): string {
  switch (method) {
    case "碗起":
      return t("碗起", "Bowl", isEn);
    case "脸起":
      return t("脸起", "Face", isEn);
    case "手起":
      return t("手起", "Hand", isEn);
  }
}

export function loadingDisplay(raw: string, isEn: boolean): string {
  switch (raw) {
    case "挖取":
      return t("挖取", "Scoop", isEn);
    case "刷取":
      return t("刷取", "Brush Load", isEn);
    case "涂抹":
    case "涂取":
      return t("涂抹", "Apply", isEn);
    default:
      return raw;
  }
}

export function loadingMethodDisplay(method: SoapLoadingMethod, isEn: boolean): string {
  return loadingDisplay(method, isEn);
}

export function categorySingularName(category: GearCategory, isEn: boolean): string {
  switch (category) {
    case "剃须刀":
      return t("剃须刀", "Razor", isEn);
    case "刀片":
      return t("刀片", "Blade", isEn);
    case "剃须刷":
      return t("剃须刷", "Brush", isEn);
    case "剃须皂":
      return t("剃须皂", "Soap", isEn);
    case "须前":
      return t("须前", "Pre-Shave", isEn);
    case "须后":
      return t("须后", "Aftershave", isEn);
    case "剃须碗":
      return t("剃须碗", "Bowl", isEn);
  }
}

export function categoryPluralName(category: GearCategory, isEn: boolean): string {
  switch (category) {
    case "剃须刀":
      return t("剃须刀", "Razors", isEn);
    case "刀片":
      return t("刀片", "Blades", isEn);
    case "剃须刷":
      return t("剃须刷", "Brushes", isEn);
    case "剃须皂":
      return t("剃须皂", "Soaps", isEn);
    case "须前":
      return t("须前", "Pre-Shave", isEn);
    case "须后":
      return t("须后", "Aftershave", isEn);
    case "剃须碗":
      return t("剃须碗", "Bowls", isEn);
  }
}

export function shaveResultFullDescription(res: ShaveResult, isEn: boolean): string {
  switch (res) {
    case "BBS":
      return t("BBS 婴儿肌", "BBS", isEn);
    case "DFS":
      return t("DFS 极净", "DFS", isEn);
    case "CCS":
      return t("CCS 贴面净", "CCS", isEn);
    case "SAS":
      return t("SAS 日常净", "SAS", isEn);
  }
}

export function irritationDisplay(level: IrritationLevel, isEn: boolean): string {
  switch (level) {
    case "无痛":
      return t("无痛", "Painless", isEn);
    case "微痛":
      return t("微痛", "Mild", isEn);
    case "刺痛":
      return t("刺痛", "Stinging", isEn);
  }
}

export function passDisplay(pass: ShavePassType, isEn: boolean): string {
  switch (pass) {
    case "顺刮":
      return t("顺刮", "WTG", isEn);
    case "横刮":
      return t("横刮", "XTG", isEn);
    case "逆刮":
      return t("逆刮", "ATG", isEn);
    case "补刀":
      return t("补刀", "Pickup", isEn);
  }
}

export function passShortChar(pass: ShavePassType): string {
  switch (pass) {
    case "顺刮":
      return "顺";
    case "横刮":
      return "横";
    case "逆刮":
      return "逆";
    case "补刀":
      return "补";
  }
}

export function gearStatusDisplay(status: GearStatus, isEn: boolean): string {
  switch (status) {
    case "在用":
      return t("在用", "Active", isEn);
    case "借用":
      return t("借用", "Borrowed", isEn);
    case "已出":
      return t("已出", "Sold", isEn);
    case "有":
      return t("有", "In Stock", isEn);
    case "无":
      return t("无", "Out of Stock", isEn);
  }
}

export function gearStatusOptions(category: GearCategory): GearStatus[] {
  return category === "刀片" ? ["有", "无"] : ["在用", "借用", "已出"];
}

export function categorySupportsSample(category: GearCategory): boolean {
  return category === "剃须皂" || category === "须后";
}

export function razorTypeFullDisplay(rt: RazorType, isEn: boolean): string {
  switch (rt) {
    case "Double Edge (DE)":
      return "Double Edge (DE)";
    case "Single Edge (AC)":
      return "Single Edge (AC)";
    case "Single Edge (GEM)":
      return "Single Edge (GEM)";
    case "Single Edge (Injector)":
      return "Single Edge (Injector)";
    case "Single Edge (半DE)":
      return t("Single Edge (半DE)", "Single Edge (Half DE)", isEn);
    case "盒刀":
      return t("盒刀", "Cartridge", isEn);
    case "Twin Blade":
      return "Twin Blade";
    case "直剃":
      return t("直剃", "Straight Razor", isEn);
    case "替刃":
      return t("替刃", "Shavette", isEn);
    case "其他":
      return t("其他", "Other", isEn);
  }
}

export function plateTypeDisplay(pt: PlateType, isEn: boolean): string {
  switch (pt) {
    case "SB":
      return t("SB 闭齿", "SB (Safety Bar)", isEn);
    case "OC":
      return t("OC 开齿", "OC (Open Comb)", isEn);
    case "DC":
      return t("DC 双面", "DC (Dual Comb)", isEn);
  }
}

export function razorTypeShortLabel(rt: RazorType, isEn: boolean): string {
  switch (rt) {
    case "Double Edge (DE)":
      return "DE";
    case "Single Edge (AC)":
      return "SE · AC";
    case "Single Edge (GEM)":
      return "SE · GEM";
    case "Single Edge (Injector)":
      return "SE · Injector";
    case "Single Edge (半DE)":
      return t("SE · 半DE", "SE · Half DE", isEn);
    case "盒刀":
      return t("盒刀", "Cartridge", isEn);
    case "Twin Blade":
      return "Twin Blade";
    case "直剃":
      return t("直剃", "Straight", isEn);
    case "替刃":
      return t("替刃", "Shavette", isEn);
    case "其他":
      return t("其他", "Other", isEn);
  }
}

export function bladeTypeDisplay(bt: BladeType, isEn: boolean): string {
  switch (bt) {
    case "盒刀头":
      return t("盒刀头", "Cartridge", isEn);
    case "其他":
      return t("其他", "Other", isEn);
    default:
      return bt;
  }
}

export function brushMaterialDisplay(bm: BrushMaterial, isEn: boolean): string {
  switch (bm) {
    case "獾毛":
      return t("獾毛", "Badger", isEn);
    case "人造丝":
      return t("人造丝", "Synthetic", isEn);
    case "猪鬃":
      return t("猪鬃", "Boar", isEn);
    case "马毛":
      return t("马毛", "Horse", isEn);
    case "羊毛":
      return t("羊毛", "Wool", isEn);
    case "混毛":
      return t("混毛", "Mixed", isEn);
    case "其他":
      return t("其他", "Other", isEn);
  }
}

export function badgerTreatmentDisplay(bt: BadgerTreatment, isEn: boolean): string {
  return bt === "无漂" ? t("无漂", "Unbleached", isEn) : t("漂尖", "Gel Tip", isEn);
}

export function badgerBandDisplay(bb: BadgerBand, isEn: boolean): string {
  return bb === "二段" ? t("二段", "2-Band", isEn) : t("三段", "3-Band", isEn);
}

export function appearanceModeDisplay(mode: AppearanceMode, isEn: boolean): string {
  switch (mode) {
    case "system":
      return t("跟随系统", "System", isEn);
    case "light":
      return t("浅色", "Light", isEn);
    case "dark":
      return t("深色", "Dark", isEn);
  }
}

export function languageDisplay(lang: AppLanguage, isEn: boolean): string {
  switch (lang) {
    case "system":
      return t("跟随系统", "System", isEn);
    case "zh-Hans":
      return "简体中文";
    case "en":
      return "English";
  }
}

export function tabDisplayName(tab: AppTab, isEn: boolean): string {
  switch (tab) {
    case "journal":
      return t("湿剃日记", "Journal", isEn);
    case "gear":
      return t("器材库", "Gear", isEn);
    case "randomDraw":
      return t("随机抽签", "Randomizer", isEn);
    case "stats":
      return t("数据统计", "Stats", isEn);
    case "settings":
      return t("外观与设置", "Settings", isEn);
  }
}
