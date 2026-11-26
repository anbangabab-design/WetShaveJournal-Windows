import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildGearCatalogSnapshot,
  formatSOTDForSharing,
  inferDefaultOverride,
  isRazorAdjustable,
  normalizeKey,
  resolveGear,
  searchGearCandidates,
  suggestedNextBladeUseCount,
  type GearCatalogSnapshot,
} from "../lib/gearKnowledge";
import {
  exportGearLibraryCSV,
  getEligibleDrawItems,
  getRawEntrySamples,
  getReferencedEntryCount,
  normalizedBrandKey,
  planDeleteGearItem,
  planMergeGearItem,
  planSplitRawKey,
  planUndoLastGearChange,
  planUpdateGearItem,
} from "../lib/gearMutations";
import { resolveIsEnglish, t } from "../lib/l10n";
import { getProcessText, parseProcessText } from "../lib/processParser";
import {
  backupNow,
  exportCsvFile,
  exportJournal,
  getAppConfig,
  importJournal,
  isTauriRuntime,
  loadBrandLogos,
  loadJournal,
  openDataFolder,
  pickBrandLogoImageDialog,
  pickDirectoryDialog,
  pickExportCsvDialog,
  pickExportJsonDialog,
  pickImportJsonDialog,
  saveJournal,
  savePreferences,
  setCustomBrandLogo,
  setCustomDataDir,
} from "../lib/tauriApi";
import type {
  AppConfigInfo,
  AppearanceMode,
  AppLanguage,
  GearCategory,
  GearItem,
  GearOverride,
  JournalDatabase,
  JournalEntry,
  ParsedProcess,
  ToastState,
} from "../types/journal";

const APPLE_REF_OFFSET = 978307200;
const LOCAL_PREF_APPEARANCE = "WetShaveJournal.AppearanceMode";
const LOCAL_PREF_LANGUAGE = "WetShaveJournal.Language";
const BROWSER_FALLBACK_DB_KEY = "WetShaveJournal.BrowserFallbackDB";

function createEmptyDatabase(): JournalDatabase {
  return {
    schemaVersion: 2,
    entries: [],
    duplicates: 0,
    skipped: 0,
    lastSync: Date.now() / 1000 - APPLE_REF_OFFSET,
    overrides: {},
    pending: [],
    history: [],
  };
}

function normalizeLoadedDatabase(raw: unknown): JournalDatabase {
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const entries = Array.isArray(base.entries)
    ? ([...(base.entries as JournalEntry[])].sort((a, b) =>
        (b.date ?? "").localeCompare(a.date ?? "")
      ))
    : [];
  const overrides =
    base.overrides &&
    typeof base.overrides === "object" &&
    !Array.isArray(base.overrides)
      ? (base.overrides as Record<string, GearOverride>)
      : {};
  const pending = Array.isArray(base.pending)
    ? (base.pending as string[])
    : [];
  const history = Array.isArray(base.history)
    ? (base.history as JournalDatabase["history"])
    : [];

  return {
    ...base,
    schemaVersion:
      typeof base.schemaVersion === "number" ? base.schemaVersion : 2,
    entries,
    duplicates: typeof base.duplicates === "number" ? base.duplicates : 0,
    skipped: typeof base.skipped === "number" ? base.skipped : 0,
    lastSync:
      typeof base.lastSync === "number"
        ? base.lastSync
        : Date.now() / 1000 - APPLE_REF_OFFSET,
    overrides,
    pending,
    history,
    deletedSourceIDs: Array.isArray(base.deletedSourceIDs)
      ? (base.deletedSourceIDs as string[])
      : undefined,
  };
}

function parseAppearance(raw: string | null | undefined): AppearanceMode {
  if (raw === "light" || raw === "浅色模式") return "light";
  if (raw === "dark" || raw === "深色模式") return "dark";
  return "system";
}

function parseLanguage(raw: string | null | undefined): AppLanguage {
  if (raw === "zh-Hans") return "zh-Hans";
  if (raw === "en") return "en";
  return "system";
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

interface JournalContextValue {
  database: JournalDatabase;
  config: AppConfigInfo | null;
  isLoading: boolean;
  isReadOnlyProtected: boolean;
  loadErrorMessage: string | null;
  backupCount: number;

  appearanceMode: AppearanceMode;
  setAppearanceMode: (mode: AppearanceMode) => void;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  isEnglish: boolean;

  toast: ToastState | null;
  showToast: (
    message: string,
    options?: { isLoading?: boolean; isError?: boolean }
  ) => void;
  dismissToast: () => void;

  catalogSnapshot: GearCatalogSnapshot;
  parsedProcessByEntryID: Record<string, ParsedProcess>;
  entriesByDate: Record<string, JournalEntry[]>;

  getParsedProcess: (entry: JournalEntry) => ParsedProcess;
  resolveGearItem: (
    category: GearCategory,
    rawValue: string
  ) => { key: string; override: GearOverride };
  getSearchCandidates: (category: GearCategory, query: string) => GearItem[];
  checkRazorAdjustable: (razorText: string) => boolean;
  getSuggestedNextBladeUse: (baseBladeName: string) => number;
  getEligibleDrawPool: (
    category: GearCategory,
    matchingRazor?: GearItem | null
  ) => GearItem[];
  getGearRawEntrySamples: (
    rawKey: string,
    category: GearCategory
  ) => { display: string; count: number };
  getGearReferencedEntryCount: (item: GearItem) => number;

  brandLogos: Record<string, string>;
  getBrandLogo: (brand: string) => string | null;
  refreshBrandLogos: () => Promise<void>;
  uploadCustomBrandLogo: (brand: string) => Promise<boolean>;

  reloadJournal: () => Promise<void>;
  upsertEntry: (entry: JournalEntry) => Promise<{ ok: boolean; error?: string }>;
  deleteEntry: (entry: JournalEntry) => Promise<{ ok: boolean; error?: string }>;
  createQuickGear: (
    category: GearCategory,
    name: string,
    brand?: string
  ) => Promise<{ ok: boolean; override?: GearOverride; error?: string }>;
  updateGearItem: (
    rawKeys: string[],
    category: GearCategory,
    newOverride: GearOverride,
    clearPending?: boolean
  ) => Promise<{ ok: boolean; error?: string }>;
  mergeGearItem: (
    source: GearItem,
    target: GearItem
  ) => Promise<{ ok: boolean; error?: string }>;
  splitRawKey: (
    rawKey: string,
    item: GearItem
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteGearItem: (
    item: GearItem,
    removeFromEntries: boolean
  ) => Promise<{ ok: boolean; error?: string }>;
  undoLastGearChange: () => Promise<{ ok: boolean; error?: string }>;
  copySOTD: (entry: JournalEntry) => Promise<void>;

  chooseCustomDataDir: () => Promise<void>;
  resetDataDirToDefault: () => Promise<void>;
  importJournalFile: () => Promise<void>;
  exportJournalFile: () => Promise<void>;
  exportGearCsv: () => Promise<void>;
  triggerBackupNow: () => Promise<void>;
  openActiveDataFolder: () => Promise<void>;
}

const JournalContext = createContext<JournalContextValue | null>(null);

export const JournalProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [database, setDatabase] = useState<JournalDatabase>(createEmptyDatabase);
  const [config, setConfig] = useState<AppConfigInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isReadOnlyProtected, setIsReadOnlyProtected] = useState<boolean>(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [backupCount, setBackupCount] = useState<number>(0);
  const [brandLogos, setBrandLogos] = useState<Record<string, string>>({});

  const [appearanceMode, setAppearanceModeState] = useState<AppearanceMode>(() =>
    parseAppearance(
      typeof localStorage !== "undefined"
        ? localStorage.getItem(LOCAL_PREF_APPEARANCE)
        : null
    )
  );
  const [language, setLanguageState] = useState<AppLanguage>(() =>
    parseLanguage(
      typeof localStorage !== "undefined"
        ? localStorage.getItem(LOCAL_PREF_LANGUAGE)
        : null
    )
  );

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const isEnglish = useMemo(() => resolveIsEnglish(language), [language]);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (
      message: string,
      options?: { isLoading?: boolean; isError?: boolean }
    ) => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      const isLoadingFlag = Boolean(options?.isLoading);
      setToast({
        id,
        message,
        isLoading: isLoadingFlag,
        isError: Boolean(options?.isError),
      });
      if (!isLoadingFlag) {
        toastTimerRef.current = window.setTimeout(() => {
          setToast((prev) => (prev?.id === id ? null : prev));
          toastTimerRef.current = null;
        }, 2600);
      }
    },
    []
  );

  // 同步应用浅色 / 深色主题到 <html class="dark">
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark =
        appearanceMode === "dark" ||
        (appearanceMode === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearanceMode]);

  const setAppearanceMode = useCallback(
    (mode: AppearanceMode) => {
      setAppearanceModeState(mode);
      try {
        localStorage.setItem(LOCAL_PREF_APPEARANCE, mode);
      } catch {
        // ignore storage quota errors
      }
      if (isTauriRuntime()) {
        savePreferences(mode, language)
          .then((updated) => setConfig(updated))
          .catch(() => {});
      }
    },
    [language]
  );

  const setLanguage = useCallback(
    (lang: AppLanguage) => {
      setLanguageState(lang);
      try {
        localStorage.setItem(LOCAL_PREF_LANGUAGE, lang);
      } catch {
        // ignore storage quota errors
      }
      if (isTauriRuntime()) {
        savePreferences(appearanceMode, lang)
          .then((updated) => setConfig(updated))
          .catch(() => {});
      }
    },
    [appearanceMode]
  );

  const refreshBrandLogos = useCallback(async () => {
    if (!isTauriRuntime()) return;
    try {
      const logos = await loadBrandLogos();
      setBrandLogos(logos);
    } catch {
      // 图标缓存加载失败不影响核心日记读写
    }
  }, []);

  const getBrandLogo = useCallback(
    (brand: string): string | null => {
      const trimmed = (brand || "").trim();
      if (
        !trimmed ||
        trimmed === "仿刀" ||
        trimmed === "品牌未注明" ||
        trimmed === "无品牌"
      ) {
        return null;
      }
      const key = normalizedBrandKey(trimmed);
      return brandLogos[key] ?? null;
    },
    [brandLogos]
  );

  const uploadCustomBrandLogo = useCallback(
    async (brand: string): Promise<boolean> => {
      const targetBrand = brand.trim();
      if (!targetBrand) return false;
      if (!isTauriRuntime()) {
        showToast(
          t("请在桌面客户端中上传自定义图标", "Available in desktop app only", isEnglish)
        );
        return false;
      }
      try {
        const picked = await pickBrandLogoImageDialog(
          t(
            `选择「${targetBrand}」品牌图标`,
            `Choose Icon for ${targetBrand}`,
            isEnglish
          )
        );
        if (!picked) return false;
        const result = await setCustomBrandLogo(targetBrand, picked);
        setBrandLogos((prev) => ({
          ...prev,
          [result.key]: result.dataUrl,
        }));
        showToast(
          t(
            `已更新「${targetBrand}」品牌图标`,
            `Updated custom icon for ${targetBrand}`,
            isEnglish
          )
        );
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(
          t(`更新图标失败：${msg}`, `Failed to update icon: ${msg}`, isEnglish),
          { isError: true }
        );
        return false;
      }
    },
    [isEnglish, showToast]
  );

  const reloadJournal = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isTauriRuntime()) {
        const [cfg, loaded, logos] = await Promise.all([
          getAppConfig(),
          loadJournal(),
          loadBrandLogos().catch(() => ({} as Record<string, string>)),
        ]);
        setConfig(cfg);
        setDatabase(normalizeLoadedDatabase(loaded.data));
        setBackupCount(loaded.backupCount);
        setBrandLogos(logos);
        setIsReadOnlyProtected(false);
        setLoadErrorMessage(null);
      } else {
        const saved = localStorage.getItem(BROWSER_FALLBACK_DB_KEY);
        if (saved) {
          setDatabase(normalizeLoadedDatabase(JSON.parse(saved)));
        } else {
          setDatabase(createEmptyDatabase());
        }
        setConfig({
          defaultDataDir: "%APPDATA%\\WetShaveJournal",
          customDataDir: null,
          activeDataDir: "%APPDATA%\\WetShaveJournal",
          journalFilePath: "%APPDATA%\\WetShaveJournal\\journal.json",
          backupsDirPath: "%APPDATA%\\WetShaveJournal\\Backups",
          appearanceMode,
          language,
        });
        setIsReadOnlyProtected(false);
        setLoadErrorMessage(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setIsReadOnlyProtected(true);
      setLoadErrorMessage(msg);
      showToast(
        t(
          "读取 journal.json 失败，已启用只读保护防止覆盖原数据",
          "Failed to read journal.json. Read-only protection enabled.",
          isEnglish
        ),
        { isError: true }
      );
    } finally {
      setIsLoading(false);
    }
  }, [appearanceMode, isEnglish, language, showToast]);

  // 首次启动加载配置与数据
  useEffect(() => {
    let active = true;
    const boot = async () => {
      setIsLoading(true);
      try {
        if (isTauriRuntime()) {
          const cfg = await getAppConfig();
          if (!active) return;
          setConfig(cfg);
          const cfgAppearance = parseAppearance(cfg.appearanceMode);
          const cfgLanguage = parseLanguage(cfg.language);
          setAppearanceModeState(cfgAppearance);
          setLanguageState(cfgLanguage);
          try {
            localStorage.setItem(LOCAL_PREF_APPEARANCE, cfgAppearance);
            localStorage.setItem(LOCAL_PREF_LANGUAGE, cfgLanguage);
          } catch {
            // ignore
          }

          const [loaded, logos] = await Promise.all([
            loadJournal(),
            loadBrandLogos().catch(() => ({} as Record<string, string>)),
          ]);
          if (!active) return;
          setDatabase(normalizeLoadedDatabase(loaded.data));
          setBackupCount(loaded.backupCount);
          setBrandLogos(logos);
          setIsReadOnlyProtected(false);
          setLoadErrorMessage(null);
        } else {
          const saved = localStorage.getItem(BROWSER_FALLBACK_DB_KEY);
          if (saved && active) {
            setDatabase(normalizeLoadedDatabase(JSON.parse(saved)));
          }
          if (active) {
            setConfig({
              defaultDataDir: "%APPDATA%\\WetShaveJournal",
              customDataDir: null,
              activeDataDir: "%APPDATA%\\WetShaveJournal",
              journalFilePath: "%APPDATA%\\WetShaveJournal\\journal.json",
              backupsDirPath: "%APPDATA%\\WetShaveJournal\\Backups",
              appearanceMode,
              language,
            });
          }
        }
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : String(err);
        setIsReadOnlyProtected(true);
        setLoadErrorMessage(msg);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void boot();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistCandidate = useCallback(
    async (
      candidate: JournalDatabase,
      createBackup = false
    ): Promise<{ ok: boolean; error?: string }> => {
      if (isReadOnlyProtected) {
        const msg = t(
          "当前处于只读保护状态，已阻止写入以保护原 journal.json",
          "Read-only protection active: write blocked to protect journal.json.",
          isEnglish
        );
        showToast(msg, { isError: true });
        return { ok: false, error: msg };
      }

      const sortedCandidate: JournalDatabase = {
        ...candidate,
        entries: [...candidate.entries].sort((a, b) =>
          (b.date ?? "").localeCompare(a.date ?? "")
        ),
      };

      try {
        if (isTauriRuntime()) {
          const res = await saveJournal(sortedCandidate, createBackup);
          setBackupCount(res.backupCount);
        } else {
          localStorage.setItem(
            BROWSER_FALLBACK_DB_KEY,
            JSON.stringify(sortedCandidate)
          );
        }
        setDatabase(sortedCandidate);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(msg, { isError: true });
        return { ok: false, error: msg };
      }
    },
    [isEnglish, isReadOnlyProtected, showToast]
  );

  const upsertEntry = useCallback(
    async (entry: JournalEntry) => {
      const existingIdx = database.entries.findIndex((e) => e.id === entry.id);
      const existing = existingIdx >= 0 ? database.entries[existingIdx] : null;

      // 保留该条目原有的任意未知扩展字段
      const updated: JournalEntry = {
        ...(existing ?? {}),
        ...entry,
        locallyModified: true,
      };
      delete updated.hasSyncConflict;
      delete updated.suspectedDuplicate;
      if (!updated.sourceFingerprint && existing?.sourceFingerprint) {
        updated.sourceFingerprint = existing.sourceFingerprint;
      }

      const nextEntries = [...database.entries];
      if (existingIdx >= 0) {
        nextEntries[existingIdx] = updated;
      } else {
        nextEntries.push(updated);
      }

      const candidate: JournalDatabase = {
        ...database,
        entries: nextEntries,
      };
      return persistCandidate(candidate, false);
    },
    [database, persistCandidate]
  );

  const deleteEntry = useCallback(
    async (entry: JournalEntry) => {
      const nextEntries = database.entries.filter((e) => e.id !== entry.id);
      const candidate: JournalDatabase = {
        ...database,
        entries: nextEntries,
      };

      // 与 Mac 版 S05 一致：非 local- 创建的备忘录同步来源记录保留删除墓碑
      if (!entry.id.startsWith("local-")) {
        const deleted = new Set(database.deletedSourceIDs ?? []);
        deleted.add(entry.id);
        candidate.deletedSourceIDs = Array.from(deleted).sort();
      }

      return persistCandidate(candidate, false);
    },
    [database, persistCandidate]
  );

  const createQuickGear = useCallback(
    async (category: GearCategory, name: string, brand?: string) => {
      const ov = inferDefaultOverride(name, category);
      const trimmedBrand = brand?.trim();
      if (trimmedBrand) {
        ov.brand = trimmedBrand;
      }

      const key = `${category}|${normalizeKey(ov.name)}`;
      const nextHistory = [
        ...database.history,
        {
          overrides: { ...database.overrides },
          pending: [...database.pending],
        },
      ].slice(-20);

      const nextOverrides: Record<string, GearOverride> = {
        ...database.overrides,
        [key]: ov,
      };
      const nextPending =
        ov.brand === "品牌未注明" && !database.pending.includes(key)
          ? [...database.pending, key]
          : [...database.pending];

      const candidate: JournalDatabase = {
        ...database,
        overrides: nextOverrides,
        pending: nextPending,
        history: nextHistory,
      };

      const res = await persistCandidate(candidate, false);
      if (res.ok) {
        return { ok: true, override: ov };
      }
      return { ok: false, error: res.error };
    },
    [database, persistCandidate]
  );

  const updateGearItem = useCallback(
    async (
      rawKeys: string[],
      category: GearCategory,
      newOverride: GearOverride,
      clearPending = true
    ) => {
      const plan = planUpdateGearItem(
        rawKeys,
        category,
        newOverride,
        clearPending,
        database,
        isEnglish
      );
      if (!plan.didMutate) return { ok: true };
      const res = await persistCandidate(plan.database, plan.shouldBackup);
      if (res.ok && plan.toastMessage) {
        showToast(plan.toastMessage);
      }
      return res;
    },
    [database, isEnglish, persistCandidate, showToast]
  );

  const mergeGearItem = useCallback(
    async (source: GearItem, target: GearItem) => {
      const plan = planMergeGearItem(source, target, database, isEnglish);
      if (plan.error) {
        return { ok: false, error: plan.error };
      }
      if (!plan.didMutate) return { ok: true };
      const res = await persistCandidate(plan.database, plan.shouldBackup);
      if (res.ok && plan.toastMessage) {
        showToast(plan.toastMessage);
      }
      return res;
    },
    [database, isEnglish, persistCandidate, showToast]
  );

  const splitRawKey = useCallback(
    async (rawKey: string, item: GearItem) => {
      const plan = planSplitRawKey(rawKey, item, database, isEnglish);
      if (!plan.didMutate) return { ok: true };
      const res = await persistCandidate(plan.database, plan.shouldBackup);
      if (res.ok && plan.toastMessage) {
        showToast(plan.toastMessage);
      }
      return res;
    },
    [database, isEnglish, persistCandidate, showToast]
  );

  const deleteGearItem = useCallback(
    async (item: GearItem, removeFromEntries: boolean) => {
      const plan = planDeleteGearItem(
        item,
        removeFromEntries,
        database,
        isEnglish
      );
      if (!plan.didMutate) return { ok: true };
      const res = await persistCandidate(plan.database, plan.shouldBackup);
      if (res.ok && plan.toastMessage) {
        showToast(plan.toastMessage);
      }
      return res;
    },
    [database, isEnglish, persistCandidate, showToast]
  );

  const undoLastGearChange = useCallback(async () => {
    const plan = planUndoLastGearChange(database, isEnglish);
    if (!plan.didMutate) {
      if (plan.toastMessage) showToast(plan.toastMessage);
      return { ok: false, error: plan.toastMessage };
    }
    const res = await persistCandidate(plan.database, plan.shouldBackup);
    if (res.ok && plan.toastMessage) {
      showToast(plan.toastMessage);
    }
    return res;
  }, [database, isEnglish, persistCandidate, showToast]);

  const copySOTD = useCallback(
    async (entry: JournalEntry) => {
      try {
        const text = formatSOTDForSharing(entry, database, isEnglish);
        await copyTextToClipboard(text);
        showToast(
          t("已复制 SOTD 到剪贴板", "SOTD copied to clipboard", isEnglish)
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(
          t(`复制失败：${msg}`, `Copy failed: ${msg}`, isEnglish),
          { isError: true }
        );
      }
    },
    [database, isEnglish, showToast]
  );

  const chooseCustomDataDir = useCallback(async () => {
    if (!isTauriRuntime()) {
      showToast(
        t("请在桌面客户端中切换数据目录", "Available in desktop app only", isEnglish)
      );
      return;
    }
    try {
      const selected = await pickDirectoryDialog(
        t("选择湿剃日记数据目录", "Choose WetShaveJournal Data Folder", isEnglish)
      );
      if (!selected) return;
      const updatedCfg = await setCustomDataDir(selected);
      setConfig(updatedCfg);
      const [loaded, logos] = await Promise.all([
        loadJournal(),
        loadBrandLogos().catch(() => ({} as Record<string, string>)),
      ]);
      setDatabase(normalizeLoadedDatabase(loaded.data));
      setBackupCount(loaded.backupCount);
      setBrandLogos(logos);
      setIsReadOnlyProtected(false);
      setLoadErrorMessage(null);
      showToast(
        t("已切换数据目录并重新加载", "Data folder updated and reloaded", isEnglish)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, { isError: true });
    }
  }, [isEnglish, showToast]);

  const resetDataDirToDefault = useCallback(async () => {
    if (!isTauriRuntime()) return;
    try {
      const updatedCfg = await setCustomDataDir(null);
      setConfig(updatedCfg);
      const [loaded, logos] = await Promise.all([
        loadJournal(),
        loadBrandLogos().catch(() => ({} as Record<string, string>)),
      ]);
      setDatabase(normalizeLoadedDatabase(loaded.data));
      setBackupCount(loaded.backupCount);
      setBrandLogos(logos);
      setIsReadOnlyProtected(false);
      setLoadErrorMessage(null);
      showToast(
        t("已恢复默认数据目录", "Restored default data folder", isEnglish)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, { isError: true });
    }
  }, [isEnglish, showToast]);

  const importJournalFile = useCallback(async () => {
    if (!isTauriRuntime()) {
      showToast(
        t("请在桌面客户端中导入文件", "Available in desktop app only", isEnglish)
      );
      return;
    }
    try {
      const sourcePath = await pickImportJsonDialog(
        t("选择要导入的 journal.json", "Select journal.json to Import", isEnglish)
      );
      if (!sourcePath) return;
      const loaded = await importJournal(sourcePath);
      setDatabase(normalizeLoadedDatabase(loaded.data));
      setBackupCount(loaded.backupCount);
      setIsReadOnlyProtected(false);
      setLoadErrorMessage(null);
      showToast(
        t(
          `导入成功：已加载 ${loaded.data.entries?.length ?? 0} 篇日记`,
          `Imported ${loaded.data.entries?.length ?? 0} entries`,
          isEnglish
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(
        t(`导入失败：${msg}`, `Import failed: ${msg}`, isEnglish),
        { isError: true }
      );
    }
  }, [isEnglish, showToast]);

  const exportJournalFile = useCallback(async () => {
    if (!isTauriRuntime()) {
      showToast(
        t("请在桌面客户端中导出文件", "Available in desktop app only", isEnglish)
      );
      return;
    }
    try {
      const targetPath = await pickExportJsonDialog(
        t("导出 journal.json", "Export journal.json", isEnglish),
        "journal.json"
      );
      if (!targetPath) return;
      await exportJournal(targetPath);
      showToast(
        t("已无损导出 journal.json", "Exported journal.json", isEnglish)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(
        t(`导出失败：${msg}`, `Export failed: ${msg}`, isEnglish),
        { isError: true }
      );
    }
  }, [isEnglish, showToast]);

  const triggerBackupNow = useCallback(async () => {
    if (isReadOnlyProtected) {
      showToast(
        t(
          "当前处于只读保护状态，无法创建备份",
          "Read-only protection active; backup skipped",
          isEnglish
        ),
        { isError: true }
      );
      return;
    }
    if (!isTauriRuntime()) {
      showToast(t("已创建本地备份", "Backup created", isEnglish));
      return;
    }
    try {
      const res = await backupNow();
      setBackupCount(res.backupCount);
      showToast(
        t("已创建并校验数据备份", "Verified backup created", isEnglish)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(
        t(`备份失败：${msg}`, `Backup failed: ${msg}`, isEnglish),
        { isError: true }
      );
    }
  }, [isEnglish, isReadOnlyProtected, showToast]);

  const openActiveDataFolder = useCallback(async () => {
    if (!isTauriRuntime()) return;
    try {
      await openDataFolder();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, { isError: true });
    }
  }, [showToast]);

  // 衍生快照（按 database 变更自动 memoize）
  const catalogSnapshot = useMemo(
    () => buildGearCatalogSnapshot(database),
    [database]
  );

  const { parsedProcessByEntryID, entriesByDate } = useMemo(() => {
    const parsedMap: Record<string, ParsedProcess> = {};
    const dateMap: Record<string, JournalEntry[]> = {};
    const textCache = new Map<string, ParsedProcess>();

    for (const entry of database.entries) {
      const procText = getProcessText(entry);
      let proc = textCache.get(procText);
      if (!proc) {
        proc = parseProcessText(procText);
        textCache.set(procText, proc);
      }
      parsedMap[entry.id] = proc;
      if (!dateMap[entry.date]) {
        dateMap[entry.date] = [];
      }
      dateMap[entry.date].push(entry);
    }
    return { parsedProcessByEntryID: parsedMap, entriesByDate: dateMap };
  }, [database.entries]);

  const getParsedProcess = useCallback(
    (entry: JournalEntry): ParsedProcess => {
      return (
        parsedProcessByEntryID[entry.id] ?? parseProcessText(getProcessText(entry))
      );
    },
    [parsedProcessByEntryID]
  );

  const resolveGearItem = useCallback(
    (category: GearCategory, rawValue: string) =>
      resolveGear(category, rawValue, database),
    [database]
  );

  const getSearchCandidates = useCallback(
    (category: GearCategory, query: string) =>
      searchGearCandidates(catalogSnapshot.itemsByCategory[category] ?? [], query),
    [catalogSnapshot]
  );

  const checkRazorAdjustable = useCallback(
    (razorText: string) => isRazorAdjustable(razorText, database),
    [database]
  );

  const getSuggestedNextBladeUse = useCallback(
    (baseBladeName: string) => suggestedNextBladeUseCount(baseBladeName, database),
    [database]
  );

  const getEligibleDrawPool = useCallback(
    (category: GearCategory, matchingRazor?: GearItem | null) =>
      getEligibleDrawItems(
        catalogSnapshot.itemsByCategory[category] ?? [],
        category,
        matchingRazor
      ),
    [catalogSnapshot]
  );

  const getGearRawEntrySamples = useCallback(
    (rawKey: string, category: GearCategory) =>
      getRawEntrySamples(rawKey, category, database),
    [database]
  );

  const getGearReferencedEntryCount = useCallback(
    (item: GearItem) => getReferencedEntryCount(item, database),
    [database]
  );

  const exportGearCsv = useCallback(async () => {
    const csv = exportGearLibraryCSV(catalogSnapshot);
    const defaultFilename = t("装备资料库.csv", "GearLibrary.csv", isEnglish);

    if (!isTauriRuntime()) {
      try {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(
          t("已导出装备资料库 CSV", "Exported Gear Library CSV", isEnglish)
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(
          t(`导出 CSV 失败：${msg}`, `CSV export failed: ${msg}`, isEnglish),
          { isError: true }
        );
      }
      return;
    }

    try {
      const targetPath = await pickExportCsvDialog(
        t("导出装备资料库（CSV）", "Export Gear Library (CSV)", isEnglish),
        defaultFilename
      );
      if (!targetPath) return;
      await exportCsvFile(targetPath, csv);
      showToast(
        t("已导出装备资料库 CSV", "Exported Gear Library CSV", isEnglish)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(
        t(`导出 CSV 失败：${msg}`, `CSV export failed: ${msg}`, isEnglish),
        { isError: true }
      );
    }
  }, [catalogSnapshot, isEnglish, showToast]);

  const value = useMemo<JournalContextValue>(
    () => ({
      database,
      config,
      isLoading,
      isReadOnlyProtected,
      loadErrorMessage,
      backupCount,
      appearanceMode,
      setAppearanceMode,
      language,
      setLanguage,
      isEnglish,
      toast,
      showToast,
      dismissToast,
      catalogSnapshot,
      parsedProcessByEntryID,
      entriesByDate,
      getParsedProcess,
      resolveGearItem,
      getSearchCandidates,
      checkRazorAdjustable,
      getSuggestedNextBladeUse,
      getEligibleDrawPool,
      getGearRawEntrySamples,
      getGearReferencedEntryCount,
      brandLogos,
      getBrandLogo,
      refreshBrandLogos,
      uploadCustomBrandLogo,
      reloadJournal,
      upsertEntry,
      deleteEntry,
      createQuickGear,
      updateGearItem,
      mergeGearItem,
      splitRawKey,
      deleteGearItem,
      undoLastGearChange,
      copySOTD,
      chooseCustomDataDir,
      resetDataDirToDefault,
      importJournalFile,
      exportJournalFile,
      exportGearCsv,
      triggerBackupNow,
      openActiveDataFolder,
    }),
    [
      appearanceMode,
      backupCount,
      brandLogos,
      catalogSnapshot,
      checkRazorAdjustable,
      chooseCustomDataDir,
      config,
      copySOTD,
      createQuickGear,
      database,
      deleteEntry,
      deleteGearItem,
      dismissToast,
      entriesByDate,
      exportGearCsv,
      exportJournalFile,
      getBrandLogo,
      getEligibleDrawPool,
      getGearRawEntrySamples,
      getGearReferencedEntryCount,
      getParsedProcess,
      getSearchCandidates,
      getSuggestedNextBladeUse,
      importJournalFile,
      isEnglish,
      isLoading,
      isReadOnlyProtected,
      language,
      loadErrorMessage,
      mergeGearItem,
      openActiveDataFolder,
      parsedProcessByEntryID,
      refreshBrandLogos,
      reloadJournal,
      resetDataDirToDefault,
      resolveGearItem,
      setAppearanceMode,
      setLanguage,
      showToast,
      splitRawKey,
      toast,
      triggerBackupNow,
      undoLastGearChange,
      updateGearItem,
      uploadCustomBrandLogo,
      upsertEntry,
    ]
  );

  return (
    <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
  );
};

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) {
    throw new Error("useJournal must be used within a JournalProvider");
  }
  return ctx;
}
