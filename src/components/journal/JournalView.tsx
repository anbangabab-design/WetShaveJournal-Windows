import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Calendar,
  Copy,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { getDisplayModel } from "../../lib/gearKnowledge";
import { brandDisplay, irritationDisplay, t } from "../../lib/l10n";
import {
  getPrimaryBlade,
  getPrimaryRazor,
  getSoap,
  parseDateISO,
} from "../../lib/processParser";
import { useJournal } from "../../store/JournalContext";
import {
  ALL_IRRITATION_LEVELS,
  ALL_SHAVE_RESULTS,
  type IrritationLevel,
  type JournalEntry,
  type ShaveResult,
} from "../../types/journal";
import { BrandAvatar } from "../ui/BrandAvatar";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { TagPill, type TagTone } from "../ui/TagPill";
import { EntryDetailPane } from "./EntryDetailPane";
import { EntryEditorModal } from "./EntryEditorModal";
import { JournalCalendar } from "./JournalCalendar";

interface JournalViewProps {
  onCreateNew: () => void;
}

function irritationTone(level: IrritationLevel | null): TagTone {
  if (level === "无痛") return "forest";
  if (level === "微痛") return "amber";
  if (level === "刺痛") return "crimson";
  return "neutral";
}

interface ContextMenuState {
  entry: JournalEntry;
  x: number;
  y: number;
}

export const JournalView: React.FC<JournalViewProps> = ({ onCreateNew }) => {
  const {
    database,
    isEnglish,
    isReadOnlyProtected,
    getParsedProcess,
    resolveGearItem,
    deleteEntry,
    copySOTD,
    showToast,
  } = useJournal();

  const [searchText, setSearchText] = useState("");
  const [selectedEntryID, setSelectedEntryID] = useState<string | null>(null);
  const [filterResult, setFilterResult] = useState<ShaveResult | "">("");
  const [filterIrritation, setFilterIrritation] = useState<IrritationLevel | "">(
    ""
  );

  // 编辑 / 补记 / 删除状态
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [backfillDateISO, setBackfillDateISO] = useState<string | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);

  // 日历展开/定位状态
  const [showCalendar, setShowCalendar] = useState(false);
  const [displayedMonth, setDisplayedMonth] = useState<Date>(() => new Date());
  const [selectedEmptyDateISO, setSelectedEmptyDateISO] = useState<
    string | null
  >(null);
  const [scrollTarget, setScrollTarget] = useState<{
    id: string;
    token: number;
  } | null>(null);

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const hasActiveFilters =
    Boolean(searchText.trim()) ||
    Boolean(filterResult) ||
    Boolean(filterIrritation);

  const filteredEntries = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return database.entries.filter((entry) => {
      if (filterResult || filterIrritation) {
        const proc = getParsedProcess(entry);
        if (filterResult && proc.result !== filterResult) return false;
        if (filterIrritation && proc.irritation !== filterIrritation) {
          return false;
        }
      }
      if (!q) return true;
      if (entry.date.toLowerCase().includes(q)) return true;
      return entry.fields.some((f) => f.value.toLowerCase().includes(q));
    });
  }, [
    database.entries,
    filterIrritation,
    filterResult,
    getParsedProcess,
    searchText,
  ]);

  const activeEntry = useMemo(() => {
    if (selectedEntryID) {
      const hit = filteredEntries.find((e) => e.id === selectedEntryID);
      if (hit) return hit;
    }
    return filteredEntries[0] ?? null;
  }, [filteredEntries, selectedEntryID]);

  // 平滑滚动到目标日记
  useEffect(() => {
    if (!scrollTarget) return;
    const raf = window.requestAnimationFrame(() => {
      const el = rowRefs.current[scrollTarget.id];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [scrollTarget, filteredEntries]);

  // 关闭右键菜单监听
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  const clearFilters = () => {
    setSearchText("");
    setFilterResult("");
    setFilterIrritation("");
  };

  const toggleCalendar = () => {
    if (!showCalendar) {
      const activeDate = activeEntry ? parseDateISO(activeEntry.date) : null;
      setDisplayedMonth(activeDate ?? new Date());
      setSelectedEmptyDateISO(null);
    }
    setShowCalendar((prev) => !prev);
  };

  const handleSelectRecordedDate = (
    isoDate: string,
    dayEntries: JournalEntry[]
  ) => {
    if (dayEntries.length === 0) return;
    setSelectedEmptyDateISO(null);

    const visibleIDs = new Set(filteredEntries.map((e) => e.id));
    const hasVisibleMatch = dayEntries.some((e) => visibleIDs.has(e.id));
    if (!hasVisibleMatch && hasActiveFilters) {
      clearFilters();
      showToast(
        t(
          `已清除冲突筛选并定位到 ${isoDate}`,
          `Cleared filters and jumped to ${isoDate}`,
          isEnglish
        )
      );
    }

    let target = dayEntries[0];
    if (dayEntries.length > 1 && selectedEntryID) {
      const idx = dayEntries.findIndex((e) => e.id === selectedEntryID);
      if (idx >= 0) {
        target = dayEntries[(idx + 1) % dayEntries.length];
      }
    }

    setSelectedEntryID(target.id);
    setScrollTarget({ id: target.id, token: Date.now() });
  };

  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;
    const target = entryToDelete;
    setEntryToDelete(null);
    const res = await deleteEntry(target);
    if (res.ok) {
      if (selectedEntryID === target.id) {
        setSelectedEntryID(null);
      }
      showToast(t("已删除这篇 SOTD 日记", "Deleted SOTD entry", isEnglish));
    }
  };

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden">
      {/* 中间栏：搜索 + 筛选 + 月视图日历 + 日记列表 */}
      <section className="flex h-full w-[365px] min-w-[325px] shrink-0 flex-col border-r border-[var(--wsj-border)] bg-[var(--wsj-canvas)]">
        {/* 搜索与筛选头部 */}
        <div className="space-y-2.5 border-b border-[var(--wsj-border)] p-3.5">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-[10px] border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3 py-[7px] transition focus-within:border-[var(--wsj-accent)]">
              <Search className="h-3.5 w-3.5 shrink-0 text-[var(--wsj-text-secondary)]" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t(
                  "搜索日期、器材或过程...",
                  "Search date, gear, notes...",
                  isEnglish
                )}
                className="w-full bg-transparent text-[13px] text-[var(--wsj-text)] placeholder:text-[var(--wsj-text-tertiary)] outline-none"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText("")}
                  className="rounded-full p-0.5 text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={toggleCalendar}
              title={t("日历定位", "Calendar Jump", isEnglish)}
              aria-label={t("日历定位", "Calendar Jump", isEnglish)}
              className={`flex h-[34px] w-[36px] shrink-0 items-center justify-center rounded-[10px] border transition ${
                showCalendar
                  ? "border-[var(--wsj-accent)]/50 bg-[var(--wsj-accent-soft)] text-[var(--wsj-accent)]"
                  : "border-[var(--wsj-border)] bg-[var(--wsj-card)] text-[var(--wsj-text)] hover:bg-[var(--wsj-subtle)]"
              }`}
            >
              <Calendar className="h-4 w-4" />
            </button>
          </div>

          {/* 筛选条件 + 总篇数徽章 */}
          <div className="flex items-center gap-1.5">
            <select
              aria-label={t("效果筛选", "Filter by result", isEnglish)}
              value={filterResult}
              onChange={(e) =>
                setFilterResult(e.target.value as ShaveResult | "")
              }
              className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-[12px] font-medium outline-none transition ${
                filterResult
                  ? "bg-[var(--wsj-accent-soft)] font-semibold text-[var(--wsj-accent)]"
                  : "bg-[var(--wsj-subtle)] text-[var(--wsj-text)]"
              }`}
            >
              <option value="" className="bg-[var(--wsj-card)] text-[var(--wsj-text)]">
                {t("效果", "Result", isEnglish)}
              </option>
              {ALL_SHAVE_RESULTS.map((r) => (
                <option
                  key={r}
                  value={r}
                  className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                >
                  {r}
                </option>
              ))}
            </select>

            <select
              aria-label={t("肤感筛选", "Filter by comfort", isEnglish)}
              value={filterIrritation}
              onChange={(e) =>
                setFilterIrritation(e.target.value as IrritationLevel | "")
              }
              className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-[12px] font-medium outline-none transition ${
                filterIrritation
                  ? "bg-[var(--wsj-accent-soft)] font-semibold text-[var(--wsj-accent)]"
                  : "bg-[var(--wsj-subtle)] text-[var(--wsj-text)]"
              }`}
            >
              <option value="" className="bg-[var(--wsj-card)] text-[var(--wsj-text)]">
                {t("肤感", "Comfort", isEnglish)}
              </option>
              {ALL_IRRITATION_LEVELS.map((l) => (
                <option
                  key={l}
                  value={l}
                  className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                >
                  {irritationDisplay(l, isEnglish)}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-1.5 py-0.5 text-[12px] font-medium text-[var(--wsj-accent)] hover:underline"
              >
                {t("清除", "Clear", isEnglish)}
              </button>
            )}

            <span className="ml-auto rounded-full bg-[var(--wsj-pill)] px-2 py-0.5 font-mono text-[11.5px] font-medium text-[var(--wsj-text-secondary)]">
              {t(`${filteredEntries.length} 篇`, `${filteredEntries.length}`, isEnglish)}
            </span>
          </div>
        </div>

        {/* 可展开/收起的月视图日历 */}
        {showCalendar && (
          <JournalCalendar
            activeDateISO={activeEntry?.date ?? null}
            displayedMonth={displayedMonth}
            selectedEmptyDateISO={selectedEmptyDateISO}
            onChangeMonth={setDisplayedMonth}
            onSelectRecordedDate={handleSelectRecordedDate}
            onSelectEmptyDate={setSelectedEmptyDateISO}
            onRequestBackfill={(isoDate) => {
              setSelectedEmptyDateISO(null);
              setBackfillDateISO(isoDate);
            }}
          />
        )}

        {/* 日记列表 */}
        {filteredEntries.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <BookOpen className="h-9 w-9 text-[var(--wsj-text-tertiary)]" />
            <div className="mt-3 text-[15px] font-semibold text-[var(--wsj-text)]">
              {database.entries.length === 0
                ? t("还没有湿剃日记", "No Shave Entries", isEnglish)
                : t("无匹配记录", "No Matching Entries", isEnglish)}
            </div>
            <p className="mt-1 text-[12.5px] text-[var(--wsj-text-secondary)]">
              {database.entries.length === 0
                ? t(
                    "点击右上角「记一次 SOTD」开始记录",
                    "Click New SOTD to log your first shave",
                    isEnglish
                  )
                : t(
                    "尝试更换关键词或清除筛选",
                    "Try another keyword or clear filters",
                    isEnglish
                  )}
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
            {filteredEntries.map((entry) => {
              const isSelected = activeEntry?.id === entry.id;
              const proc = getParsedProcess(entry);
              const razorRaw = getPrimaryRazor(entry);
              const bladeRaw = getPrimaryBlade(entry);
              const soapRaw = getSoap(entry);
              const razorOv = razorRaw
                ? resolveGearItem("剃须刀", razorRaw).override
                : null;
              const soapOv = soapRaw
                ? resolveGearItem("剃须皂", soapRaw).override
                : null;

              return (
                <div
                  key={entry.id}
                  ref={(el) => {
                    rowRefs.current[entry.id] = el;
                  }}
                  onClick={() => setSelectedEntryID(entry.id)}
                  onDoubleClick={() => {
                    setSelectedEntryID(entry.id);
                    if (!isReadOnlyProtected) setEditingEntry(entry);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSelectedEntryID(entry.id);
                    setContextMenu({
                      entry,
                      x: Math.min(e.clientX, window.innerWidth - 170),
                      y: Math.min(e.clientY, window.innerHeight - 135),
                    });
                  }}
                  className={`cursor-pointer select-none rounded-[13px] border p-3.5 transition ${
                    isSelected
                      ? "border-[var(--wsj-accent)]/55 bg-[var(--wsj-accent-soft)]"
                      : "border-[var(--wsj-border)] bg-[var(--wsj-card)] hover:border-[var(--wsj-text-tertiary)]/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono text-[13px] font-semibold ${
                          isSelected
                            ? "text-[var(--wsj-accent)]"
                            : "text-[var(--wsj-text-secondary)]"
                        }`}
                      >
                        {entry.date}
                      </span>
                      {entry.hasSyncConflict && (
                        <TagPill
                          text={t("同步冲突", "Conflict", isEnglish)}
                          tone="crimson"
                        />
                      )}
                      {!entry.hasSyncConflict && entry.suspectedDuplicate && (
                        <TagPill
                          text={t("疑似重复", "Dup?", isEnglish)}
                          tone="amber"
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {proc.irritation && (
                        <TagPill
                          text={irritationDisplay(proc.irritation, isEnglish)}
                          tone={irritationTone(proc.irritation)}
                        />
                      )}
                      {proc.result && (
                        <TagPill
                          text={proc.result}
                          tone="forest"
                          filled={proc.result === "BBS"}
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-2">
                    {razorOv ? (
                      <div className="flex items-center gap-2">
                        <BrandAvatar brand={razorOv.brand} size={20} />
                        <span className="shrink-0 text-[12px] font-medium text-[var(--wsj-text-secondary)]">
                          {brandDisplay(razorOv.brand, isEnglish)}
                        </span>
                        <span className="truncate text-[14.5px] font-semibold text-[var(--wsj-text)]">
                          {getDisplayModel(razorOv)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[13.5px] font-medium text-[var(--wsj-text-secondary)]">
                        {t("未记录剃须刀", "No razor recorded", isEnglish)}
                      </div>
                    )}
                  </div>

                  {(bladeRaw || soapOv) && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--wsj-text-secondary)]">
                      {bladeRaw && <span className="truncate">{bladeRaw}</span>}
                      {bladeRaw && soapOv && (
                        <span className="shrink-0 text-[var(--wsj-text-tertiary)]">
                          ·
                        </span>
                      )}
                      {soapOv && (
                        <span className="truncate">{soapOv.name}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 右侧栏：SOTD 详情 */}
      {activeEntry ? (
        <EntryDetailPane
          entry={activeEntry}
          onCopySOTD={() => void copySOTD(activeEntry)}
          onEdit={() => setEditingEntry(activeEntry)}
          onDelete={() => setEntryToDelete(activeEntry)}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <BookOpen className="h-11 w-11 text-[var(--wsj-text-tertiary)]" />
          <div className="mt-3 text-[18px] font-semibold text-[var(--wsj-text)]">
            {database.entries.length === 0
              ? t("湿剃日记", "WetShave Journal", isEnglish)
              : t("选择一篇日记", "Select an Entry", isEnglish)}
          </div>
          <p className="mt-1.5 text-[13.5px] text-[var(--wsj-text-secondary)]">
            {t(
              "支持导入 Mac 版 journal.json 或直接开始记录你的今日剃须装备",
              "Import your Mac journal.json in Settings or start logging today's shave",
              isEnglish
            )}
          </p>
          <button
            type="button"
            disabled={isReadOnlyProtected}
            onClick={onCreateNew}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--wsj-accent)] px-4 py-2 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
          >
            <Plus className="h-4 w-4" />
            {t("记一次 SOTD", "New SOTD", isEnglish)}
          </button>
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-50 w-40 overflow-hidden rounded-xl border border-[var(--wsj-border)] bg-[var(--wsj-card)] p-1 shadow-2xl"
        >
          <button
            type="button"
            disabled={isReadOnlyProtected}
            onClick={() => {
              const target = contextMenu.entry;
              setContextMenu(null);
              setEditingEntry(target);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
          >
            <Pencil className="h-3.5 w-3.5 text-[var(--wsj-text-secondary)]" />
            {t("编辑", "Edit", isEnglish)}
          </button>

          <button
            type="button"
            onClick={() => {
              const target = contextMenu.entry;
              setContextMenu(null);
              void copySOTD(target);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)]"
          >
            <Copy className="h-3.5 w-3.5 text-[var(--wsj-text-secondary)]" />
            {t("复制 SOTD", "Copy SOTD", isEnglish)}
          </button>

          <div className="my-1 border-t border-[var(--wsj-border)]" />

          <button
            type="button"
            disabled={isReadOnlyProtected}
            onClick={() => {
              const target = contextMenu.entry;
              setContextMenu(null);
              setEntryToDelete(target);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[#CC3D3D] transition hover:bg-[#CC3D3D]/10 disabled:opacity-45"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("删除", "Delete", isEnglish)}
          </button>
        </div>
      )}

      {/* 编辑已有日记弹窗 */}
      <EntryEditorModal
        open={editingEntry !== null}
        editingEntry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSaved={(saved) => {
          setSelectedEntryID(saved.id);
        }}
      />

      {/* 日历补记某一天弹窗 */}
      <EntryEditorModal
        open={backfillDateISO !== null}
        editingEntry={null}
        initialDateISO={backfillDateISO}
        onClose={() => setBackfillDateISO(null)}
        onSaved={(saved) => {
          if (hasActiveFilters) clearFilters();
          setSelectedEntryID(saved.id);
          setScrollTarget({ id: saved.id, token: Date.now() });
        }}
      />

      {/* 删除确认框 */}
      <ConfirmDialog
        open={entryToDelete !== null}
        title={t("删除这篇 SOTD 日记？", "Delete this SOTD entry?", isEnglish)}
        description={t(
          "删除前系统会自动向 Backups 目录保留一份备份；如为 Mac 备忘录同步记录，也会保留墓碑标记防止重复复活。",
          "A rolling backup is saved to Backups/ before deletion. Synced Mac Notes entries keep a deletion tombstone.",
          isEnglish
        )}
        confirmLabel={t("删除", "Delete", isEnglish)}
        cancelLabel={t("取消", "Cancel", isEnglish)}
        destructive
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setEntryToDelete(null)}
      />
    </div>
  );
};
