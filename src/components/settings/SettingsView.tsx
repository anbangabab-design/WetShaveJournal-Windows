import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Contrast,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FolderCog,
  FolderOpen,
  HardDriveDownload,
  Info,
  KeyRound,
  Loader2,
  Moon,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { validateEndpointPreview } from "../../lib/aiService";
import {
  appearanceModeDisplay,
  languageDisplay,
  t,
} from "../../lib/l10n";
import { aiTestConnection, isTauriRuntime } from "../../lib/tauriApi";
import { useJournal } from "../../store/JournalContext";
import type { AIPreset, AppearanceMode, AppLanguage } from "../../types/journal";
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
    aiConfig,
    updateAiConfig,
    saveApiKeyToKeyring,
    clearApiKeyFromKeyring,
    loadApiKeyFromKeyring,
    autoCheckUpdates,
    setAutoCheckUpdates,
    isCheckingUpdate,
    updateStatusMessage,
    updateStatusIsError,
    updateStatusIsUpToDate,
    checkForAppUpdates,
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

  // AI 表单本地草稿（Base URL / Model 在失焦或按钮时保存；API Key 仅存于 Windows 凭据管理器）
  const [baseUrlInput, setBaseUrlInput] = useState(aiConfig.baseUrl);
  const [modelInput, setModelInput] = useState(aiConfig.model);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    setBaseUrlInput(aiConfig.baseUrl);
    setModelInput(aiConfig.model);
  }, [aiConfig.baseUrl, aiConfig.model]);

  // 初次进入设置页从系统凭据管理器回显已保存的 API Key（仅内存中持有）
  useEffect(() => {
    let active = true;
    void loadApiKeyFromKeyring().then((key) => {
      if (active && key) {
        setApiKeyInput(key);
      }
    });
    return () => {
      active = false;
    };
  }, [loadApiKeyFromKeyring]);

  const endpointCheck = validateEndpointPreview(baseUrlInput, isEnglish);
  const logoCount = Object.keys(brandLogos).length;
  const isCustomDir = Boolean(config?.customDataDir);
  const activeDir = config?.activeDataDir ?? "%APPDATA%\\WetShaveJournal";
  const defaultDir = config?.defaultDataDir ?? "%APPDATA%\\WetShaveJournal";

  const handleSelectPreset = (nextPreset: AIPreset) => {
    setAiTestResult(null);
    if (nextPreset === "deepseek") {
      const nextUrl = "https://api.deepseek.com/v1";
      const nextModel = "deepseek-flash";
      setBaseUrlInput(nextUrl);
      setModelInput(nextModel);
      void updateAiConfig({
        preset: "deepseek",
        baseUrl: nextUrl,
        model: nextModel,
        enableWebSearch: true,
        enableGoogleSearch: false,
      });
    } else {
      void updateAiConfig({
        preset: "custom",
        baseUrl: baseUrlInput.trim() || aiConfig.baseUrl,
        model: modelInput.trim() || aiConfig.model,
        enableWebSearch: false,
      });
    }
  };

  const handleSaveApiKey = async () => {
    setIsSavingKey(true);
    await saveApiKeyToKeyring(apiKeyInput);
    setIsSavingKey(false);
  };

  const handleClearApiKey = async () => {
    setIsSavingKey(true);
    const ok = await clearApiKeyFromKeyring();
    setIsSavingKey(false);
    if (ok) {
      setApiKeyInput("");
      setAiTestResult(null);
    }
  };

  const handleTestConnection = async () => {
    if (isTestingAi) return;
    if (!isTauriRuntime()) {
      setAiTestResult({
        ok: false,
        message: t(
          "请在桌面客户端中测试 AI 连接",
          "Connection test requires the desktop app",
          isEnglish
        ),
      });
      return;
    }

    const trimmedUrl = baseUrlInput.trim();
    const trimmedModel = modelInput.trim();
    const trimmedKey = apiKeyInput.trim();

    if (!endpointCheck.valid) {
      setAiTestResult({
        ok: false,
        message:
          endpointCheck.error ??
          t("请先填写有效的 Base URL", "Please enter a valid Base URL", isEnglish),
      });
      return;
    }

    // 先同步保存非敏感字段与 Key（若用户输入了新 Key）
    await updateAiConfig({
      baseUrl: trimmedUrl,
      model: trimmedModel,
    });
    if (trimmedKey) {
      await saveApiKeyToKeyring(trimmedKey);
    }

    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await aiTestConnection({
        baseUrl: trimmedUrl,
        model: trimmedModel,
        preset: aiConfig.preset,
        apiKeyOverride: trimmedKey || null,
      });
      setAiTestResult({
        ok: res.ok,
        message: res.ok
          ? t(
              `连接成功（实际模型：${res.actualModel ?? trimmedModel}，耗时 ${res.latencyMs} ms）`,
              `Connected (model: ${res.actualModel ?? trimmedModel}, ${res.latencyMs} ms)`,
              isEnglish
            )
          : t(`连接失败：${res.message}`, `Failed: ${res.message}`, isEnglish),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiTestResult({
        ok: false,
        message: t(`连接失败：${msg}`, `Failed: ${msg}`, isEnglish),
      });
    } finally {
      setIsTestingAi(false);
    }
  };

  const isDeepSeek =
    aiConfig.preset === "deepseek" ||
    baseUrlInput.toLowerCase().includes("deepseek.com");

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

        {/* 2. AI 识别接口（Windows 凭据管理器安全存储） */}
        <SectionCard>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--wsj-accent)]" />
                <h2 className="text-[16px] font-semibold text-[var(--wsj-text)]">
                  {t("AI 识别接口", "AI Recognition API", isEnglish)}
                </h2>
                {aiConfig.hasApiKey && (
                  <TagPill
                    text={t("凭据已安全存储", "Key Secured", isEnglish)}
                    tone="forest"
                  />
                )}
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2.5 select-none">
                <span className="text-[13px] font-medium text-[var(--wsj-text)]">
                  {t("启用 AI 接口识别", "Enable AI API", isEnglish)}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={aiConfig.enabled}
                  onClick={() =>
                    void updateAiConfig({ enabled: !aiConfig.enabled })
                  }
                  className={`relative inline-flex h-[22px] w-10 items-center rounded-full transition ${
                    aiConfig.enabled
                      ? "bg-[var(--wsj-accent)]"
                      : "bg-[var(--wsj-pill)]"
                  }`}
                >
                  <span
                    className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition ${
                      aiConfig.enabled ? "translate-x-[20px]" : "translate-x-[2px]"
                    }`}
                  />
                </button>
              </label>
            </div>

            {/* 快捷预设 */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-32 shrink-0 text-[13.5px] text-[var(--wsj-text-secondary)]">
                {t("快捷预设", "Preset", isEnglish)}
              </div>
              <div className="inline-flex rounded-[10px] bg-[var(--wsj-subtle)] p-1">
                <button
                  type="button"
                  onClick={() => handleSelectPreset("deepseek")}
                  className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
                    aiConfig.preset === "deepseek"
                      ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                      : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                  }`}
                >
                  DeepSeek
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset("custom")}
                  className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
                    aiConfig.preset === "custom"
                      ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                      : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                  }`}
                >
                  {t("自定义 OpenAI 兼容", "Custom OpenAI-Compatible", isEnglish)}
                </button>
              </div>
            </div>

            {/* Base URL */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-4">
                <label className="w-32 shrink-0 text-[13.5px] text-[var(--wsj-text-secondary)]">
                  Base URL
                </label>
                <input
                  type="text"
                  value={baseUrlInput}
                  onChange={(e) => {
                    setBaseUrlInput(e.target.value);
                    setAiTestResult(null);
                  }}
                  onBlur={() =>
                    void updateAiConfig({ baseUrl: baseUrlInput.trim() })
                  }
                  placeholder="https://api.deepseek.com/v1"
                  className="min-w-[260px] flex-1 rounded-[9px] border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-3 py-1.5 font-mono text-[13px] text-[var(--wsj-text)] outline-none focus:border-[var(--wsj-accent)]"
                />
              </div>

              {endpointCheck.isLocalHttp && (
                <div className="flex items-center gap-1.5 pl-0 text-[12px] text-[#B97214] dark:text-[#E8A94B] sm:pl-36">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {t(
                      "本机明文 HTTP 模式：仅限 localhost / 127.0.0.1 / [::1] 本地代理（如本地 CPA）使用",
                      "Local HTTP endpoint allowed for localhost / 127.0.0.1 / [::1] local proxy (e.g. local CPA) only.",
                      isEnglish
                    )}
                  </span>
                </div>
              )}

              {endpointCheck.error && (
                <div className="flex items-center gap-1.5 pl-0 text-[12px] text-[#CC3D3D] sm:pl-36">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  <span>{endpointCheck.error}</span>
                </div>
              )}
            </div>

            {/* Model */}
            <div className="flex flex-wrap items-center gap-4">
              <label className="w-32 shrink-0 text-[13.5px] text-[var(--wsj-text-secondary)]">
                {t("模型名称", "Model", isEnglish)}
              </label>
              <input
                type="text"
                value={modelInput}
                onChange={(e) => {
                  setModelInput(e.target.value);
                  setAiTestResult(null);
                }}
                onBlur={() =>
                  void updateAiConfig({ model: modelInput.trim() })
                }
                placeholder="deepseek-flash"
                className="min-w-[260px] flex-1 rounded-[9px] border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-3 py-1.5 font-mono text-[13px] text-[var(--wsj-text)] outline-none focus:border-[var(--wsj-accent)]"
              />
            </div>

            {/* API Key（Windows 凭据管理器） */}
            <div className="flex flex-wrap items-center gap-4">
              <label className="w-32 shrink-0 text-[13.5px] text-[var(--wsj-text-secondary)]">
                API Key
              </label>
              <div className="flex min-w-[260px] flex-1 items-center gap-2">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setAiTestResult(null);
                  }}
                  placeholder="sk-..."
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-[9px] border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-3 py-1.5 font-mono text-[13px] text-[var(--wsj-text)] outline-none focus:border-[var(--wsj-accent)]"
                />

                <button
                  type="button"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  title={
                    showApiKey
                      ? t("隐藏 Key", "Hide Key", isEnglish)
                      : t("显示 Key", "Show Key", isEnglish)
                  }
                  aria-label="Toggle key visibility"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] text-[var(--wsj-text-secondary)] hover:bg-[var(--wsj-subtle)] hover:text-[var(--wsj-text)]"
                >
                  {showApiKey ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  disabled={isSavingKey || !apiKeyInput.trim()}
                  onClick={() => void handleSaveApiKey()}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-2.5 text-[12.5px] font-medium text-[var(--wsj-text)] hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
                >
                  <KeyRound className="h-3.5 w-3.5 text-[var(--wsj-accent)]" />
                  {t("保存 Key", "Save Key", isEnglish)}
                </button>

                {(aiConfig.hasApiKey || Boolean(apiKeyInput)) && (
                  <button
                    type="button"
                    disabled={isSavingKey}
                    onClick={() => void handleClearApiKey()}
                    title={t(
                      "从 Windows 凭据管理器清除 API Key",
                      "Delete API key from Credential Manager",
                      isEnglish
                    )}
                    aria-label="Clear API key"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#CC3D3D]/35 bg-[#CC3D3D]/8 text-[#CC3D3D] hover:bg-[#CC3D3D]/15 disabled:opacity-45"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 联网搜索开关 */}
            <div className="space-y-2.5 pt-1">
              <label className="flex cursor-pointer items-center gap-3 select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={aiConfig.enableWebSearch}
                  onClick={() =>
                    void updateAiConfig({
                      enableWebSearch: !aiConfig.enableWebSearch,
                    })
                  }
                  className={`relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition ${
                    aiConfig.enableWebSearch
                      ? "bg-[var(--wsj-accent)]"
                      : "bg-[var(--wsj-pill)]"
                  }`}
                >
                  <span
                    className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition ${
                      aiConfig.enableWebSearch
                        ? "translate-x-[20px]"
                        : "translate-x-[2px]"
                    }`}
                  />
                </button>
                <span className="text-[13px] text-[var(--wsj-text)]">
                  {t(
                    "启用 DeepSeek 联网搜索（deepseek_web_search）",
                    "Enable DeepSeek Web Search (deepseek_web_search)",
                    isEnglish
                  )}
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={aiConfig.enableGoogleSearch}
                  onClick={() =>
                    void updateAiConfig({
                      enableGoogleSearch: !aiConfig.enableGoogleSearch,
                    })
                  }
                  className={`relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition ${
                    aiConfig.enableGoogleSearch
                      ? "bg-[var(--wsj-accent)]"
                      : "bg-[var(--wsj-pill)]"
                  }`}
                >
                  <span
                    className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition ${
                      aiConfig.enableGoogleSearch
                        ? "translate-x-[20px]"
                        : "translate-x-[2px]"
                    }`}
                  />
                </button>
                <span className="text-[13px] text-[var(--wsj-text)]">
                  {t(
                    "启用 Google 联网搜索（适配 Gemini / 本地 CPA）",
                    "Enable Google Web Search (Gemini / Local CPA)",
                    isEnglish
                  )}
                </span>
                {aiConfig.enableGoogleSearch && isDeepSeek && (
                  <TagPill
                    text={t("非 DeepSeek 时生效", "Non-DeepSeek only", isEnglish)}
                    tone="neutral"
                  />
                )}
              </label>
            </div>

            {/* 测试连接 + 安全说明 */}
            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--wsj-border)] pt-3.5">
              <button
                type="button"
                disabled={
                  isTestingAi ||
                  (!apiKeyInput.trim() && !aiConfig.hasApiKey) ||
                  !endpointCheck.valid
                }
                onClick={() => void handleTestConnection()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
              >
                {isTestingAi && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isTestingAi
                  ? t("测试中...", "Testing...", isEnglish)
                  : t("测试连接", "Test Connection", isEnglish)}
              </button>

              {aiTestResult ? (
                <div
                  className={`flex items-center gap-1.5 text-[12.5px] font-medium ${
                    aiTestResult.ok ? "text-[#2E8F5C]" : "text-[#CC3D3D]"
                  }`}
                >
                  {aiTestResult.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span className="break-words">{aiTestResult.message}</span>
                </div>
              ) : (
                <span className="text-[12px] text-[var(--wsj-text-tertiary)]">
                  {t(
                    "API Key 存于 Windows 凭据管理器，绝不写入 journal.json；不支持联网工具时自动降级重试。",
                    "API key is stored in Windows Credential Manager (never in journal.json). Auto-downgrades if tools are unsupported.",
                    isEnglish
                  )}
                </span>
              )}
            </div>
          </div>
        </SectionCard>

        {/* 3. 器材库与品牌图标 */}
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

        {/* 4. 数据目录与备份 */}
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

            <div className="rounded-[10px] border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-3.5 py-2.5">
              <div className="text-[11.5px] font-medium text-[var(--wsj-text-secondary)]">
                {t(
                  "当前数据目录（journal.json 与 Backups/）",
                  "Active Data Folder (journal.json & Backups/)",
                  isEnglish
                )}
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

        {/* 5. 关于湿剃日记与 FlClash 风格 GitHub 联网更新 */}
        <SectionCard>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img
                src="/app-icon.png"
                alt="WetShaveJournal"
                className="h-14 w-14 shrink-0 rounded-[13px] shadow-sm"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[17px] font-bold text-[var(--wsj-text)]">
                    {t("湿剃日记", "WetShaveJournal", isEnglish)}
                  </span>
                  <TagPill text="v1.3.4" tone="accent" />
                  <TagPill text="Windows · Tauri 2" tone="neutral" />
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--wsj-text-secondary)]">
                  {t(
                    "专为传统湿剃爱好者打造的 Windows 桌面 SOTD 日记、器材档案库、统计图表与 AI 配装工具，数据与 macOS 版 100% 互通。",
                    "Windows desktop SOTD journal, gear archive, analytics, and AI shaving companion — 100% compatible with macOS journal.json.",
                    isEnglish
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--wsj-border)] pt-3.5">
              <label className="inline-flex cursor-pointer items-center gap-2.5 select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoCheckUpdates}
                  onClick={() => setAutoCheckUpdates(!autoCheckUpdates)}
                  className={`relative inline-flex h-[22px] w-10 items-center rounded-full transition ${
                    autoCheckUpdates
                      ? "bg-[var(--wsj-accent)]"
                      : "bg-[var(--wsj-pill)]"
                  }`}
                >
                  <span
                    className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition ${
                      autoCheckUpdates ? "translate-x-[20px]" : "translate-x-[2px]"
                    }`}
                  />
                </button>
                <span className="text-[13px] font-medium text-[var(--wsj-text)]">
                  {t(
                    "启动时自动检查更新（GitHub Releases）",
                    "Auto-check updates on launch (GitHub Releases)",
                    isEnglish
                  )}
                </span>
              </label>

              <button
                type="button"
                disabled={isCheckingUpdate}
                onClick={() => void checkForAppUpdates(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
              >
                {isCheckingUpdate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--wsj-accent)]" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-[var(--wsj-accent)]" />
                )}
                {isCheckingUpdate
                  ? t("检查中...", "Checking...", isEnglish)
                  : t("检查更新", "Check for Updates", isEnglish)}
              </button>
            </div>

            {updateStatusMessage && (
              <div
                className={`flex items-center gap-1.5 text-[12.5px] font-medium ${
                  updateStatusIsError
                    ? "text-[#CC3D3D]"
                    : updateStatusIsUpToDate
                      ? "text-[#2E8F5C]"
                      : "text-[var(--wsj-accent)]"
                }`}
              >
                {updateStatusIsError ? (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                )}
                <span>{updateStatusMessage}</span>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
