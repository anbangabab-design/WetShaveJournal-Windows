import React, { useState } from "react";
import {
  FolderOpen,
  Plus,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { GearLibraryView } from "./components/gear/GearLibraryView";
import { EntryEditorModal } from "./components/journal/EntryEditorModal";
import { JournalView } from "./components/journal/JournalView";
import { RandomDrawView } from "./components/randomDraw/RandomDrawView";
import { SettingsView } from "./components/settings/SettingsView";
import { StatsView } from "./components/stats/StatsView";
import { ToastBar } from "./components/ui/ToastBar";
import { UpdateModal } from "./components/update/UpdateModal";
import { t, tabDisplayName } from "./lib/l10n";
import { JournalProvider, useJournal } from "./store/JournalContext";
import type { AppTab, SOTDDraft } from "./types/journal";

const AppShell: React.FC = () => {
  const {
    isEnglish,
    isLoading,
    isReadOnlyProtected,
    loadErrorMessage,
    toast,
    dismissToast,
    reloadJournal,
    openActiveDataFolder,
  } = useJournal();

  const [selectedTab, setSelectedTab] = useState<AppTab>("journal");
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [newEntryDraft, setNewEntryDraft] = useState<SOTDDraft | null>(null);

  const openNewEntry = (draft: SOTDDraft | null = null) => {
    setNewEntryDraft(draft);
    setShowNewEntryModal(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--wsj-canvas)] text-[var(--wsj-text)]">
      {/* 左侧固定导航栏 */}
      <Sidebar selectedTab={selectedTab} onSelectTab={setSelectedTab} />

      {/* 右侧主区域 */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 顶部工具栏 */}
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--wsj-border)] bg-[var(--wsj-card)]/75 px-5 backdrop-blur-md">
          <div className="text-[15px] font-semibold text-[var(--wsj-text)]">
            {tabDisplayName(selectedTab, isEnglish)}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isReadOnlyProtected}
              onClick={() => openNewEntry(null)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wsj-accent)] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
            >
              <Plus className="h-4 w-4" />
              {t("记一次 SOTD", "New SOTD", isEnglish)}
            </button>
          </div>
        </header>

        {/* 只读保护横幅 */}
        {isReadOnlyProtected && (
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#CC3D3D]/25 bg-[#CC3D3D]/10 px-5 py-2.5">
            <ShieldAlert className="h-4 w-4 shrink-0 text-[#CC3D3D]" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-[var(--wsj-text)]">
                {t(
                  "只读保护已启用：journal.json 读取失败",
                  "Read-Only Protection Active: Failed to decode journal.json",
                  isEnglish
                )}
              </div>
              {loadErrorMessage && (
                <div className="truncate text-[12px] text-[var(--wsj-text-secondary)]">
                  {loadErrorMessage}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void openActiveDataFolder()}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-2.5 py-1 text-[12px] font-medium text-[var(--wsj-text)] hover:bg-[var(--wsj-subtle)]"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                {t("打开数据目录", "Open Folder", isEnglish)}
              </button>
              <button
                type="button"
                onClick={() => void reloadJournal()}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--wsj-accent)] px-2.5 py-1 text-[12px] font-semibold text-white hover:opacity-90"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("重新加载", "Retry", isEnglish)}
              </button>
            </div>
          </div>
        )}

        {/* 主视图内容区 */}
        <main className="relative min-h-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-[13.5px] text-[var(--wsj-text-secondary)]">
              {t("正在加载本地日记数据...", "Loading journal data...", isEnglish)}
            </div>
          ) : selectedTab === "journal" ? (
            <JournalView onCreateNew={() => openNewEntry(null)} />
          ) : selectedTab === "gear" ? (
            <GearLibraryView />
          ) : selectedTab === "randomDraw" ? (
            <RandomDrawView onRecordSOTD={(draft) => openNewEntry(draft)} />
          ) : selectedTab === "stats" ? (
            <StatsView />
          ) : (
            <SettingsView />
          )}
        </main>
      </div>

      {/* 全局新建 SOTD 弹窗 */}
      <EntryEditorModal
        open={showNewEntryModal}
        editingEntry={null}
        initialDraft={newEntryDraft}
        onClose={() => {
          setShowNewEntryModal(false);
          setNewEntryDraft(null);
        }}
        onSaved={() => {
          setSelectedTab("journal");
        }}
      />

      {/* FlClash 风格联网更新弹窗 */}
      <UpdateModal />

      {/* 底部 Toast */}
      <ToastBar toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default function App() {
  return (
    <JournalProvider>
      <AppShell />
    </JournalProvider>
  );
}
