import React from "react";
import {
  Contrast,
  Download,
  FileSpreadsheet,
  FolderCog,
  FolderOpen,
  HardDriveDownload,
  Moon,
  RefreshCw,
  RotateCcw,
  Sun,
  Undo2,
  Upload,
} from "lucide-react";
import {
  appearanceModeDisplay,
  languageDisplay,
  t,
} from "../../lib/l10n";
import { useJournal } from "../../store/JournalContext";
import type { AppearanceMode, AppLanguage } from "../../types/journal";
import { SectionCard } from "../ui/SectionCard";
import { TagPill } from "../ui/TagPill";

const APPLE_REF_OFFSET = 978307200;

const APPEARANCE_OPTIONS: {
  id: AppearanceMode;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "system", icon: Contrast },
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
];

const LANGUAGE_OPTIONS: AppLanguage[] = ["system", "zh-Hans", "en"];

function formatAppleTimestamp(ts: number, isEn: boolean): string {
  if (!Number.isFinite(ts) || ts <= 0) {
    return t("未记录", "N/A", isEn);
  }
  const date = new Date((ts + APPLE_REF_OFFSET) * 1000);
  if (Number.isNaN(date.getTime())) return t("未记录", "N/A", isEn);
  return date.toLocaleString(isEn ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const SettingsView: React.FC = () => {
  const {
    database,
    config,
    backupCount,
    brandLogos,
    appearanceMode,
    setAppearanceMode,
    language,
    setLanguage,
    isEnglish,
    isReadOnlyProtected,
    chooseCustomDataDir,
    resetDataDirToDefault,
    importJournalFile,
    exportJournalFile,
    exportGearCsv,
    undoLastGearChange,
    refreshBrandLogos,
    showToast,
    triggerBackupNow,
    openActiveDataFolder,
  } = useJournal();

  const logoCount = Object.keys(brandLogos).length;

  const isCustomDir = Boolean(config?.customDataDir);
  const activeDir = config?.activeDataDir ?? "%APPDATA%\\WetShaveJournal";
  const defaultDir = config?.defaultDataDir ?? "%APPDATA%\\WetShaveJournal";

  return (
    <div className="h-full w-full overflow-y-auto px-7 py-6">
      <div className="max-w-[840px] space-y-6">
        <h1 className="text-[26px] font-bold tracking-tight text-[var(--wsj-text)]">
          {t("外观与设置", "Settings", isEnglish)}
        </h1>

        {/* 1. 界面与语言 */}
        <SectionCard>
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-[var(--wsj-text)]">
              {t("界面与语言", "Appearance & Language", isEnglish)}
            </h2>

            <div className="flex flex-wrap items-center gap-4">
              <div className="w-32 shrink-0 text-[13.5px] text-[var(--wsj-text-secondary)]">
                {t("外观模式", "Appearance", isEnglish)}
              </div>
              <div className="inline-flex rounded-[10px] bg-[var(--wsj-subtle)] p-1">
                {APPEARANCE_OPTIONS.map(({ id, icon: Icon }) => {
                  const active = appearanceMode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAppearanceMode(id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
                        active
                          ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                          : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {appearanceModeDisplay(id, isEnglish)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="w-32 shrink-0 text-[13.5px] text-[var(--wsj-text-secondary)]">
                {t("语言 / Language", "Language", isEnglish)}
              </div>
              <div className="inline-flex rounded-[10px] bg-[var(--wsj-subtle)] p-1">
                {LANGUAGE_OPTIONS.map((lang) => {
                  const active = language === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLanguage(lang)}
                      className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
                        active
                          ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                          : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                      }`}
                    >
                      {languageDisplay(lang, isEnglish)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* 2. 器材库与品牌图标 */}
        <SectionCard>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-[var(--wsj-text)]">
                {t("器材库与品牌图标", "Gear Library & Brand Logos", isEnglish)}
              </h2>
              <TagPill
                text={t(
                  `已加载 ${logoCount} 个品牌图标`,
                  `${logoCount} logos loaded`,
                  isEnglish
                )}
                tone={logoCount > 0 ? "accent" : "neutral"}
              />
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => void exportGearCsv()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wsj-accent)] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t("导出装备资料库（CSV）", "Export Gear Library (CSV)", isEnglish)}
              </button>

              <button
                type="button"
                disabled={database.history.length === 0 || isReadOnlyProtected}
                onClick={() => void undoLastGearChange()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3.5 py-2 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
              >
                <Undo2 className="h-4 w-4 text-[var(--wsj-text-secondary)]" />
                {t("撤销上次器材修改", "Undo Last Gear Edit", isEnglish)}
              </button>

              <button
                type="button"
                onClick={() => {
                  void refreshBrandLogos().then(() => {
                    showToast(
                      t(
                        "已重新扫描 CustomLogos/ 与 LogoCache/ 品牌图标",
                        "Reloaded brand icons from CustomLogos/ and LogoCache/",
                        isEnglish
                      )
                    );
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3.5 py-2 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)]"
              >
                <RefreshCw className="h-4 w-4 text-[var(--wsj-text-secondary)]" />
                {t("重新加载品牌图标", "Reload Brand Logos", isEnglish)}
              </button>
            </div>

            <p className="text-[12px] leading-relaxed text-[var(--wsj-text-tertiary)]">
              {t(
                "支持直接复用 Mac 版数据目录下的 CustomLogos/ 与 LogoCache/ 品牌图标，也可在「器材库 → 编辑器材」中点击品牌头像上传本地自定义图标。",
                "Automatically reads CustomLogos/ and LogoCache/ from the active data folder (100% compatible with macOS), or upload custom brand logos from the Gear Editor.",
                isEnglish
              )}
            </p>
          </div>
        </SectionCard>

        {/* 3. 数据目录与备份 */}
        <SectionCard>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-[var(--wsj-text)]">
                {t("数据目录与备份", "Data Directory & Backup", isEnglish)}
              </h2>
              <TagPill
                text={
                  isCustomDir
                    ? t("自定义目录", "Custom Folder", isEnglish)
                    : t("默认目录", "Default Folder", isEnglish)
                }
                tone={isCustomDir ? "accent" : "neutral"}
              />
            </div>

            <div className="text-[13px] text-[var(--wsj-text-secondary)]">
              {t(
                `${database.entries.length} 篇日记 · ${Object.keys(database.overrides).length} 条器材规则 · ${backupCount} 份滚动备份 · 上次同步 ${formatAppleTimestamp(database.lastSync, isEnglish)}`,
                `${database.entries.length} entries · ${Object.keys(database.overrides).length} gear rules · ${backupCount} rolling backups · Last sync ${formatAppleTimestamp(database.lastSync, isEnglish)}`,
                isEnglish
              )}
            </div>

            {/* 当前数据路径展示 */}
            <div className="rounded-[10px] border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-3.5 py-2.5">
              <div className="text-[11.5px] font-medium text-[var(--wsj-text-secondary)]">
                {t("当前数据目录（journal.json 与 Backups/）", "Active Data Folder (journal.json & Backups/)", isEnglish)}
              </div>
              <div className="mt-1 break-all font-mono text-[12.5px] text-[var(--wsj-text)] select-all">
                {activeDir}
              </div>
              {isCustomDir && (
                <div className="mt-1.5 break-all text-[11.5px] text-[var(--wsj-text-tertiary)]">
                  {t("默认路径：", "Default: ", isEnglish)}
                  <span className="font-mono">{defaultDir}</span>
                </div>
              )}
            </div>

            {/* 目录与文件操作按钮 */}
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => void chooseCustomDataDir()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3.5 py-2 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)]"
              >
                <FolderCog className="h-4 w-4 text-[var(--wsj-accent)]" />
                {t("自定义数据目录", "Change Data Folder", isEnglish)}
              </button>

              {isCustomDir && (
                <button
                  type="button"
                  onClick={() => void resetDataDirToDefault()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3.5 py-2 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)]"
                >
                  <RotateCcw className="h-4 w-4 text-[var(--wsj-text-secondary)]" />
                  {t("恢复默认目录", "Use Default Folder", isEnglish)}
                </button>
              )}

              <button
                type="button"
                onClick={() => void openActiveDataFolder()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3.5 py-2 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)]"
              >
                <FolderOpen className="h-4 w-4 text-[var(--wsj-text-secondary)]" />
                {t("打开数据目录", "Open Data Folder", isEnglish)}
              </button>
            </div>

            <div className="border-t border-[var(--wsj-border)] pt-3.5">
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => void importJournalFile()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wsj-accent)] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
                >
                  <Upload className="h-4 w-4" />
                  {t("导入 journal.json", "Import journal.json", isEnglish)}
                </button>

                <button
                  type="button"
                  onClick={() => void exportJournalFile()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3.5 py-2 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)]"
                >
                  <Download className="h-4 w-4 text-[var(--wsj-text-secondary)]" />
                  {t("导出 journal.json", "Export journal.json", isEnglish)}
                </button>

                <button
                  type="button"
                  disabled={isReadOnlyProtected}
                  onClick={() => void triggerBackupNow()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3.5 py-2 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
                >
                  <HardDriveDownload className="h-4 w-4 text-[var(--wsj-text-secondary)]" />
                  {t("立即备份", "Backup Now", isEnglish)}
                </button>
              </div>

              <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--wsj-text-tertiary)]">
                {t(
                  "读写 journal.json 时完整保留 Mac 版全部顶层及扩展字段（entries、overrides、pending、history、deletedSourceIDs 等），采用临时文件原子替换并在 Backups/ 保留最多 30 份已校验滚动备份。",
                  "Reads and writes journal.json losslessly preserving all Mac fields (entries, overrides, pending, history, deletedSourceIDs, etc.) using atomic temp-file replacement and up to 30 verified rolling backups in Backups/.",
                  isEnglish
                )}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* 3. 关于湿剃日记 */}
        <SectionCard>
          <div className="flex items-center gap-4">
            <img
              src="/app-icon.png"
              alt="WetShaveJournal"
              className="h-14 w-14 shrink-0 rounded-[13px] shadow-sm"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-bold text-[var(--wsj-text)]">
                  {t("湿剃日记", "WetShaveJournal", isEnglish)}
                </span>
                <TagPill text="v1.3.4" tone="accent" />
                <TagPill text="Windows · Tauri 2" tone="neutral" />
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--wsj-text-secondary)]">
                {t(
                  "专为传统湿剃爱好者打造的 Windows 桌面 SOTD 日记工具，数据格式与 macOS 版 journal.json 100% 互通。",
                  "Minimalist Windows desktop SOTD journal for traditional wet shaving, 100% compatible with macOS journal.json.",
                  isEnglish
                )}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
