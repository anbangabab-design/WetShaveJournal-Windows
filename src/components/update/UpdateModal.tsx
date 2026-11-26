import React, { useEffect } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  FolderOpen,
  X,
} from "lucide-react";
import { t } from "../../lib/l10n";
import {
  extractLocalizedReleaseNotes,
  formatBytesMB,
} from "../../lib/updateUtils";
import { useJournal } from "../../store/JournalContext";
import { TagPill } from "../ui/TagPill";

const CURRENT_APP_VERSION = "1.3.4";

export const UpdateModal: React.FC = () => {
  const {
    isEnglish,
    availableUpdate,
    updateDownloadState,
    startUpdateDownload,
    cancelAppUpdateDownload,
    ignoreAvailableUpdate,
    dismissUpdateModal,
    openExternalLink,
    revealDownloadedFile,
  } = useJournal();

  const isDownloading = updateDownloadState.status === "downloading";

  useEffect(() => {
    if (!availableUpdate) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDownloading) {
        dismissUpdateModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [availableUpdate, isDownloading, dismissUpdateModal]);

  if (!availableUpdate) return null;

  const asset = availableUpdate.matchedAsset;
  const localizedNotes = extractLocalizedReleaseNotes(
    availableUpdate.body,
    isEnglish
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isDownloading) {
          dismissUpdateModal();
        }
      }}
    >
      <div className="flex w-full max-w-[540px] flex-col overflow-hidden rounded-2xl border border-[var(--wsj-border)] bg-[var(--wsj-card)] shadow-2xl">
        {/* 顶部：图标 + 版本号对比 */}
        <div className="flex items-center gap-3.5 border-b border-[var(--wsj-border)] px-6 py-4">
          <img
            src="/app-icon.png"
            alt="WetShaveJournal"
            className="h-12 w-12 shrink-0 rounded-[11px] shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-bold text-[var(--wsj-text)]">
              {t(
                `发现新版本 v${availableUpdate.version}`,
                `Update Available: v${availableUpdate.version}`,
                isEnglish
              )}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <TagPill
                text={t(
                  `当前 v${CURRENT_APP_VERSION}`,
                  `Current v${CURRENT_APP_VERSION}`,
                  isEnglish
                )}
                tone="neutral"
              />
              <ArrowRight className="h-3 w-3 text-[var(--wsj-text-secondary)]" />
              <TagPill text={`v${availableUpdate.version}`} tone="accent" />
              {asset && (
                <span className="truncate font-mono text-[11.5px] text-[var(--wsj-text-secondary)]">
                  · {asset.name}
                  {asset.size > 0 ? ` (${formatBytesMB(asset.size)})` : ""}
                </span>
              )}
            </div>
          </div>
          {!isDownloading && (
            <button
              type="button"
              onClick={dismissUpdateModal}
              className="rounded-lg p-1.5 text-[var(--wsj-text-secondary)] hover:bg-[var(--wsj-subtle)] hover:text-[var(--wsj-text)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 中部：更新日志 + 下载进度 */}
        <div className="space-y-3.5 px-6 py-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[var(--wsj-text-secondary)]">
              {t("更新日志", "Release Notes", isEnglish)}
            </span>
            {availableUpdate.isFromWebFallback && (
              <TagPill
                text={t("网页免限流通道", "Web Fallback Channel", isEnglish)}
                tone="amber"
              />
            )}
          </div>

          <div className="max-h-[230px] min-h-[150px] overflow-y-auto rounded-[11px] border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] p-3.5 text-[13.5px] leading-relaxed text-[var(--wsj-text)] whitespace-pre-wrap select-text">
            {localizedNotes ||
              t(
                "点击下方「前往发布页」查看完整更新说明。",
                'Click "Release Page" below to view full release notes.',
                isEnglish
              )}
          </div>

          {/* 下载状态反馈区 */}
          {updateDownloadState.status === "downloading" && (
            <div className="space-y-2 rounded-[11px] bg-[var(--wsj-accent-soft)] p-3">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-medium text-[var(--wsj-text)]">
                  {t("正在下载更新包...", "Downloading installer...", isEnglish)}
                </span>
                <span className="font-mono text-[12px] text-[var(--wsj-text-secondary)]">
                  {updateDownloadState.totalBytes > 0
                    ? `${Math.round(updateDownloadState.progress * 100)}% · ${formatBytesMB(updateDownloadState.downloadedBytes)} / ${formatBytesMB(updateDownloadState.totalBytes)}`
                    : formatBytesMB(updateDownloadState.downloadedBytes)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--wsj-card)]">
                <div
                  className="h-full rounded-full bg-[var(--wsj-accent)] transition-all"
                  style={{
                    width: `${
                      updateDownloadState.totalBytes > 0
                        ? Math.round(updateDownloadState.progress * 100)
                        : 35
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {updateDownloadState.status === "completed" && (
            <div className="flex items-center gap-3 rounded-[11px] bg-[#2E8F5C]/12 p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2E8F5C]" />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-[var(--wsj-text)]">
                  {t(
                    "已下载至 Downloads 并自动打开安装程序",
                    "Downloaded to Downloads and launched installer",
                    isEnglish
                  )}
                </div>
                <div className="truncate font-mono text-[11.5px] text-[var(--wsj-text-secondary)]">
                  {updateDownloadState.filePath}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  void revealDownloadedFile(updateDownloadState.filePath)
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-2.5 py-1 text-[12px] font-medium text-[var(--wsj-text)] hover:bg-[var(--wsj-subtle)]"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                {t("打开位置", "Reveal", isEnglish)}
              </button>
            </div>
          )}

          {updateDownloadState.status === "failed" && (
            <div className="flex items-start gap-2 rounded-[11px] bg-[#CC3D3D]/10 p-3 text-[12.5px] text-[#CC3D3D]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{updateDownloadState.message}</span>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--wsj-border)] px-6 py-4">
          <button
            type="button"
            disabled={isDownloading}
            onClick={() => void ignoreAvailableUpdate()}
            className="rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] transition hover:opacity-85 disabled:opacity-45"
          >
            {t("忽略此版本", "Ignore This Version", isEnglish)}
          </button>

          <div className="flex items-center gap-2">
            {isDownloading ? (
              <button
                type="button"
                onClick={() => void cancelAppUpdateDownload()}
                className="rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-4 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] hover:opacity-85"
              >
                {t("取消下载", "Cancel", isEnglish)}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void openExternalLink(availableUpdate.htmlUrl)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)]"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[var(--wsj-text-secondary)]" />
                  {t("前往发布页", "Release Page", isEnglish)}
                </button>

                {updateDownloadState.status === "completed" ? (
                  <button
                    type="button"
                    onClick={dismissUpdateModal}
                    className="rounded-lg bg-[var(--wsj-accent)] px-4 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90"
                  >
                    {t("完成", "Done", isEnglish)}
                  </button>
                ) : asset ? (
                  <button
                    type="button"
                    onClick={() => void startUpdateDownload()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wsj-accent)] px-4 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t("立即下载", "Download Now", isEnglish)}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      void openExternalLink(availableUpdate.htmlUrl);
                      dismissUpdateModal();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wsj-accent)] px-4 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t("前往下载", "Open Release Page", isEnglish)}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
