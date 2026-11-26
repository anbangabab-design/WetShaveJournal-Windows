import React from "react";
import {
  BarChart3,
  BookOpen,
  Contrast,
  Dices,
  Moon,
  Package,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import {
  appearanceModeDisplay,
  t,
  tabDisplayName,
} from "../lib/l10n";
import { useJournal } from "../store/JournalContext";
import type { AppearanceMode, AppTab } from "../types/journal";

interface SidebarProps {
  selectedTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

const NAV_ITEMS: { id: AppTab; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "journal", icon: BookOpen },
  { id: "gear", icon: Package },
  { id: "randomDraw", icon: Dices },
  { id: "stats", icon: BarChart3 },
  { id: "settings", icon: SlidersHorizontal },
];

const THEME_MODES: {
  id: AppearanceMode;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "system", icon: Contrast },
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
];

export const Sidebar: React.FC<SidebarProps> = ({
  selectedTab,
  onSelectTab,
}) => {
  const {
    database,
    appearanceMode,
    setAppearanceMode,
    isEnglish,
  } = useJournal();

  const entryCount = database.entries.length;
  const pendingCount = database.pending.length;

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-[var(--wsj-border)] bg-[var(--wsj-sidebar)] select-none">
      {/* 品牌头部 */}
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <img
          src="/app-icon.png"
          alt="WetShaveJournal"
          className="h-7 w-7 rounded-[7px] shadow-sm"
        />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-bold tracking-tight text-[var(--wsj-text)]">
            {t("湿剃日记", "WetShaveJournal", isEnglish)}
          </div>
          <div className="text-[11px] font-medium text-[var(--wsj-text-tertiary)]">
            Windows
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 space-y-1 px-2.5 py-2">
        {NAV_ITEMS.map(({ id, icon: Icon }) => {
          const active = selectedTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              className={`flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[14px] transition ${
                active
                  ? "bg-[var(--wsj-accent-soft)] font-semibold text-[var(--wsj-accent)]"
                  : "font-normal text-[var(--wsj-text)] hover:bg-[var(--wsj-subtle)]"
              }`}
            >
              <Icon
                className={`h-[16px] w-[16px] shrink-0 ${
                  active
                    ? "text-[var(--wsj-accent)]"
                    : "text-[var(--wsj-text-secondary)]"
                }`}
              />
              <span className="flex-1 truncate">
                {tabDisplayName(id, isEnglish)}
              </span>

              {id === "journal" && (
                <span className="font-mono text-[12px] font-medium text-[var(--wsj-text-secondary)]">
                  {entryCount}
                </span>
              )}

              {id === "gear" && pendingCount > 0 && (
                <span className="rounded-full bg-[#D1851F]/18 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#D1851F]">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 底部快速主题切换（复刻 Mac 侧边栏底部三态按钮） */}
      <div className="border-t border-[var(--wsj-border)] p-2.5">
        <div className="grid grid-cols-3 gap-1">
          {THEME_MODES.map(({ id, icon: Icon }) => {
            const active = appearanceMode === id;
            const label = appearanceModeDisplay(id, isEnglish);
            return (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => setAppearanceMode(id)}
                className={`flex h-8 items-center justify-center rounded-lg transition ${
                  active
                    ? "bg-[var(--wsj-accent-soft)] text-[var(--wsj-accent)]"
                    : "text-[var(--wsj-text-secondary)] hover:bg-[var(--wsj-subtle)] hover:text-[var(--wsj-text)]"
                }`}
              >
                <Icon className="h-[15px] w-[15px]" />
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
