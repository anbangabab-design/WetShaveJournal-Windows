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
  aiEnabled: boolean;
  aiPreset: string;
  aiBaseUrl: string;
  aiModel: string;
  aiEnableWebSearch: boolean;
  aiEnableGoogleSearch: boolean;
  hasAiApiKey: boolean;
  autoCheckUpdates: boolean;
  ignoredUpdateVersion: string;
}

// MARK: - AI 配置与 4 大 AI 功能模型

export type AIPreset = "deepseek" | "custom";

export interface AIConfigState {
  enabled: boolean;
  preset: AIPreset;
  baseUrl: string;
  model: string;
  enableWebSearch: boolean;
  enableGoogleSearch: boolean;
  hasApiKey: boolean;
}

export interface AiChatRequestPayload {
  system: string;
  user: string;
  baseUrl?: string;
  model?: string;
  preset?: string;
  enableWebSearch?: boolean;
  enableGoogleSearch?: boolean;
  apiKeyOverride?: string;
  useWebSearch?: boolean;
  timeoutSecs?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface AiChatResponsePayload {
  content: string;
  actualModel: string;
  webSearchEvidence:
    | "notRequested"
    | "downgradedToPlain"
    | "toolAcceptedUnverified"
    | "verifiedWithSources"
    | string;
}

export interface AiConnectionTestResponse {
  ok: boolean;
  message: string;
  actualModel: string | null;
  latencyMs: number;
}

export interface AINaturalSOTDResult {
  razor: string | null;
  blade: string | null;
  bladeUseCount: number | null;
  brush: string | null;
  soap: string | null;
  bowl: string | null;
  preShave: string | null;
  afterShave: string | null;
  loadingMethod: SoapLoadingMethod | null;
  latheringMethod: LatheringMethod | null;
  hotTowel: boolean | null;
  afterShower: boolean | null;
  useAlum: boolean | null;
  passes: PassStep[];
  result: ShaveResult | null;
  irritation: IrritationLevel | null;
  note: string | null;
}

export interface AISetupRecommendation {
  razorName: string | null;
  bladeName: string | null;
  brushName: string | null;
  soapName: string | null;
  bowlName: string | null;
  preShaveName: string | null;
  afterShaveName: string | null;
  reason: string;
}

export interface GearAuditUpdateProposal {
  id: string;
  item: GearItem;
  proposed: GearOverride;
  changesSummary: string[];
  reason: string;
  confidence: number;
  selected: boolean;
}

export interface GearAuditMergeProposal {
  id: string;
  source: GearItem;
  target: GearItem;
  reason: string;
  selected: boolean;
}

export interface GearAuditBatchFailure {
  batchIndex: number;
  items: GearItem[];
  reason: string;
}

export interface GearAuditProgress {
  currentBatch: number;
  totalBatches: number;
  plannedCount: number;
  verifiedCount: number;
  undeterminedCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface GearAuditReport {
  updates: GearAuditUpdateProposal[];
  merges: GearAuditMergeProposal[];
  modelUsed: string;
  plannedCount: number;
  verifiedCount: number;
  undeterminedItems: GearItem[];
  failedItems: GearItem[];
  skippedCount: number;
  unknownOrDuplicateIdCount: number;
  failures: GearAuditBatchFailure[];
}

// MARK: - 统计分析模型

export interface RazorBladeComboStat {
  id: string;
  razorBrand: string;
  razorName: string;
  bladeBrand: string;
  bladeName: string;
  uses: number;
  bbsCount: number;
  painlessCount: number;
  mildCount: number;
  stingingCount: number;
  bbsRate: number;
  painlessRate: number;
  stingingRate: number;
  comfortScore: number;
}

export interface BladeLongevityStat {
  id: string;
  brand: string;
  bladeName: string;
  totalShaves: number;
  maxUseCount: number;
  avgCycleUses: number;
}

export interface MonthlyShavePoint {
  month: string;
  label: string;
  count: number;
}

export interface DistributionSlice {
  id: string;
  label: string;
  count: number;
}

export interface HeatmapDayInfo {
  date: string;
  count: number;
  primaryRazor: string;
  primarySoap: string;
  severity: 0 | 1 | 2;
}

export interface StatisticsSnapshot {
  totalEntries: number;
  validResultCount: number;
  validIrritationCount: number;
  bbsCount: number;
  painlessCount: number;
  bbsRate: number;
  painlessRate: number;
  activeGearCount: number;
  avgIntervalDays: number;
  resultDistribution: DistributionSlice[];
  irritationDistribution: DistributionSlice[];
  irritationCountsByLevel: Record<IrritationLevel, number>;
  monthlyTrend: MonthlyShavePoint[];
  heatmapByDate: Record<string, HeatmapDayInfo>;
  comboStats: RazorBladeComboStat[];
  bladeLongevityStats: BladeLongevityStat[];
}

// MARK: - GitHub 联网更新模型

export interface ReleaseAssetInfo {
  name: string;
  browserDownloadUrl: string;
  size: number;
  digest: string | null;
}

export interface ReleaseInfo {
  tagName: string;
  version: string;
  title: string;
  body: string;
  htmlUrl: string;
  matchedAsset: ReleaseAssetInfo | null;
  isFromWebFallback: boolean;
}

export interface UpdateCheckResult {
  currentVersion: string;
  hasUpdate: boolean;
  release: ReleaseInfo | null;
}

export interface DownloadProgressEvent {
  downloadedBytes: number;
  totalBytes: number;
  progress: number;
}

export type UpdateDownloadState =
  | { status: "idle" }
  | {
      status: "downloading";
      progress: number;
      downloadedBytes: number;
      totalBytes: number;
    }
  | { status: "completed"; filePath: string }
  | { status: "failed"; message: string };

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

export interface BrandLogoFetchResponse {
  logos: Record<string, string>;
  fetchedCount: number;
  failedCount: number;
  skippedCount: number;
  failedKeys: string[];
}

export interface ToastState {
  id: string;
  message: string;
  isLoading: boolean;
  isError?: boolean;
}
