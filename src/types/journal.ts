// 100% 兼容 Mac 版 WetShaveJournal journal.json 数据模型

export type GearCategory =
  | "剃须刀"
  | "刀片"
  | "剃须刷"
  | "剃须皂"
  | "须前"
  | "须后"
  | "剃须碗";

export const ALL_GEAR_CATEGORIES: GearCategory[] = [
  "剃须刀",
  "刀片",
  "剃须刷",
  "剃须皂",
  "须前",
  "须后",
  "剃须碗",
];

export type BladeType = "DE" | "AC" | "GEM" | "Injector" | "盒刀头" | "其他";
export const ALL_BLADE_TYPES: BladeType[] = [
  "DE",
  "AC",
  "GEM",
  "Injector",
  "盒刀头",
  "其他",
];

export type RazorType =
  | "Double Edge (DE)"
  | "Single Edge (AC)"
  | "Single Edge (GEM)"
  | "Single Edge (Injector)"
  | "Single Edge (半DE)"
  | "盒刀"
  | "Twin Blade"
  | "直剃"
  | "替刃"
  | "其他";
export const ALL_RAZOR_TYPES: RazorType[] = [
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

export type PlateType = "SB" | "OC" | "DC";
export const ALL_PLATE_TYPES: PlateType[] = ["SB", "OC", "DC"];

export const STANDARD_RAZOR_MATERIALS: string[] = [
  "不锈钢",
  "钛合金",
  "黄铜",
  "红铜",
  "青铜",
  "磷青铜",
  "铝合金",
  "锌合金",
];

export type BrushMaterial =
  | "獾毛"
  | "人造丝"
  | "猪鬃"
  | "马毛"
  | "羊毛"
  | "混毛"
  | "其他";
export const ALL_BRUSH_MATERIALS: BrushMaterial[] = [
  "獾毛",
  "人造丝",
  "猪鬃",
  "马毛",
  "羊毛",
  "混毛",
  "其他",
];

export type BadgerTreatment = "无漂" | "漂尖";
export const ALL_BADGER_TREATMENTS: BadgerTreatment[] = ["无漂", "漂尖"];

export type BadgerBand = "二段" | "三段";
export const ALL_BADGER_BANDS: BadgerBand[] = ["二段", "三段"];

export type BrushKnotShape = "Fan" | "Bulb" | "Hybrid";
export const ALL_BRUSH_KNOT_SHAPES: BrushKnotShape[] = [
  "Fan",
  "Bulb",
  "Hybrid",
];

export type GearStatus = "在用" | "借用" | "已出" | "有" | "无";

export type SoapLoadingMethod = "挖取" | "刷取" | "涂抹";
export const ALL_LOADING_METHODS: SoapLoadingMethod[] = ["挖取", "刷取", "涂抹"];

export type LatheringMethod = "碗起" | "脸起" | "手起";
export const ALL_LATHERING_METHODS: LatheringMethod[] = ["碗起", "脸起", "手起"];

export type ShaveResult = "BBS" | "DFS" | "CCS" | "SAS";
export const ALL_SHAVE_RESULTS: ShaveResult[] = ["BBS", "DFS", "CCS", "SAS"];

export type IrritationLevel = "无痛" | "微痛" | "刺痛";
export const ALL_IRRITATION_LEVELS: IrritationLevel[] = ["无痛", "微痛", "刺痛"];

export type ShavePassType = "顺刮" | "横刮" | "逆刮" | "补刀";
export const ALL_SHAVE_PASS_TYPES: ShavePassType[] = ["顺刮", "横刮", "逆刮", "补刀"];

export interface PassStep {
  pass: ShavePassType;
  setting: string;
}

export interface ParsedProcess {
  passes: PassStep[];
  result: ShaveResult | null;
  irritation: IrritationLevel | null;
  note: string;
}

export interface JournalField {
  label: string;
  value: string;
  [key: string]: unknown;
}

export interface JournalEntry {
  id: string;
  date: string;
  fields: JournalField[];
  sourceFingerprint?: string;
  locallyModified?: boolean;
  hasSyncConflict?: boolean;
  suspectedDuplicate?: boolean;
  [key: string]: unknown;
}

export interface GearOverride {
  brand: string;
  name: string;
  model?: string;
  razorType?: RazorType | string;
  isAdjustable?: boolean;
  isSlant?: boolean;
  material?: string;
  plateType?: PlateType | string;
  gapOrSpec?: string;
  bladeType?: BladeType | string;
  handleBrand?: string;
  knotBrand?: string;
  brushMaterial?: BrushMaterial | string;
  badgerTreatment?: BadgerTreatment | string;
  badgerBand?: BadgerBand | string;
  knotSize?: string;
  knotShape?: BrushKnotShape | string;
  isSample?: boolean;
  status?: GearStatus | string;
  notes?: string;
  recognizedSource?: string;
  isManuallyConfirmed?: boolean;
  [key: string]: unknown;
}

export interface GearEntryFieldSnapshot {
  entryID: string;
  previousFields: JournalField[];
  previousLocallyModified?: boolean;
  postMutationFingerprint: string;
  [key: string]: unknown;
}

export interface GearHistorySnapshot {
  overrides: Record<string, GearOverride>;
  pending?: string[];
  entrySnapshots?: GearEntryFieldSnapshot[];
  [key: string]: unknown;
}

export interface JournalDatabase {
  schemaVersion?: number;
  entries: JournalEntry[];
  duplicates: number;
  skipped: number;
  lastSync: number;
  overrides: Record<string, GearOverride>;
  pending: string[];
  history: (GearHistorySnapshot | Record<string, GearOverride>)[];
  deletedSourceIDs?: string[];
  [key: string]: unknown;
}

export interface GearItem {
  id: string;
  category: GearCategory;
  canonicalKey: string;
  brand: string;
  name: string;
  model: string;
  count: number;
  lastUsedDate: string;
  rawKeys: string[];
  isPending: boolean;

  razorType?: RazorType;
  isAdjustable: boolean;
  isSlant: boolean;
  material?: string;
  plateType?: PlateType;
  gapOrSpec?: string;
  bladeType?: BladeType;
  handleBrand?: string;
  brushMaterial?: BrushMaterial;
  badgerTreatment?: BadgerTreatment;
  badgerBand?: BadgerBand;
  knotSize?: string;
  knotShape?: BrushKnotShape;
  isSample: boolean;
  status: GearStatus;
  notes?: string;
  recognizedSource?: string;
  isManuallyConfirmed: boolean;
}

export type AppearanceMode = "system" | "light" | "dark";
export type AppLanguage = "system" | "zh-Hans" | "en";
export type AppTab = "journal" | "gear" | "randomDraw" | "stats" | "settings";

export interface AppConfigInfo {
  defaultDataDir: string;
  customDataDir: string | null;
  activeDataDir: string;
  journalFilePath: string;
  backupsDirPath: string;
  appearanceMode: string;
  language: string;
}

export interface LoadJournalResponse {
  data: JournalDatabase;
  exists: boolean;
  filePath: string;
  dataDir: string;
  backupsDir: string;
  backupCount: number;
}

export interface SaveJournalResponse {
  savedAt: string;
  backupCount: number;
  lastBackupPath: string | null;
}

export interface BackupResponse {
  backupPath: string;
  backupCount: number;
}

export interface BrandGroup {
  brand: string;
  items: GearItem[];
  totalUses: number;
  latestDate: string;
}

export interface SOTDDraft {
  razor: string;
  blade: string;
  brush: string;
  soap: string;
  preShave: string;
  afterShave: string;
  bowl: string;
}

export interface CustomLogoResponse {
  key: string;
  dataUrl: string;
}

export interface ToastState {
  id: string;
  message: string;
  isLoading: boolean;
  isError?: boolean;
}
