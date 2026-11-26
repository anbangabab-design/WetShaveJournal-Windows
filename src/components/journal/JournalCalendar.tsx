import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight, PlusCircle } from "lucide-react";
import { t } from "../../lib/l10n";
import {
  formatDateISO,
  getPrimaryRazor,
  getProcessText,
  parseDateISO,
} from "../../lib/processParser";
import { useJournal } from "../../store/JournalContext";
import type { JournalEntry } from "../../types/journal";

interface JournalCalendarProps {
  activeDateISO: string | null;
  displayedMonth: Date;
  selectedEmptyDateISO: string | null;
  onChangeMonth: (next: Date) => void;
  onSelectRecordedDate: (isoDate: string, dayEntries: JournalEntry[]) => void;
  onSelectEmptyDate: (isoDate: string) => void;
  onRequestBackfill: (isoDate: string) => void;
}

const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS_EN_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function dotHexForEntry(
  entry: JournalEntry,
  irritation: "无痛" | "微痛" | "刺痛" | null
): string {
  const lower = getProcessText(entry).toLowerCase();
  const hasCut =
    lower.includes("刮伤") ||
    lower.includes("出血") ||
    lower.includes("破皮") ||
    lower.includes("cut") ||
    lower.includes("nick") ||
    lower.includes("bleed") ||
    lower.includes("weeper");
  if (irritation === "刺痛" || hasCut) return "#CC3D3D";
  if (irritation === "微痛") return "#D1851F";
  return "#2E8F5C";
}

export const JournalCalendar: React.FC<JournalCalendarProps> = ({
  activeDateISO,
  displayedMonth,
  selectedEmptyDateISO,
  onChangeMonth,
  onSelectRecordedDate,
  onSelectEmptyDate,
  onRequestBackfill,
}) => {
  const { entriesByDate, getParsedProcess, isEnglish, isReadOnlyProtected } =
    useJournal();

  const currentYear = displayedMonth.getFullYear();
  const currentMonth = displayedMonth.getMonth() + 1;
  const todayISO = formatDateISO(new Date());

  const availableYears = useMemo(() => {
    const nowYear = new Date().getFullYear();
    const entryYears = Object.keys(entriesByDate)
      .map((iso) => Number.parseInt(iso.slice(0, 4), 10))
      .filter((y) => !Number.isNaN(y));
    const minY = Math.min(
      entryYears.length ? Math.min(...entryYears) : nowYear,
      nowYear - 1,
      currentYear
    );
    const maxY = Math.max(
      entryYears.length ? Math.max(...entryYears) : nowYear,
      nowYear + 1,
      currentYear
    );
    const list: number[] = [];
    for (let y = maxY; y >= minY; y--) {
      list.push(y);
    }
    return list;
  }, [entriesByDate, currentYear]);

  const monthCells = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const leadingBlanks = firstDay.getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: {
      id: string;
      day: number | null;
      iso: string | null;
    }[] = [];

    for (let i = 0; i < leadingBlanks; i++) {
      cells.push({ id: `blank-${i}`, day: null, iso: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${String(currentYear).padStart(4, "0")}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ id: iso, day, iso });
    }
    return cells;
  }, [currentYear, currentMonth]);

  const monthRecordCount = useMemo(() => {
    const prefix = `${String(currentYear).padStart(4, "0")}-${String(currentMonth).padStart(2, "0")}-`;
    let count = 0;
    for (const [iso, list] of Object.entries(entriesByDate)) {
      if (iso.startsWith(prefix)) count += list.length;
    }
    return count;
  }, [entriesByDate, currentYear, currentMonth]);

  const shiftMonth = (delta: number) => {
    onChangeMonth(new Date(currentYear, currentMonth - 1 + delta, 1));
  };

  const jumpToToday = () => {
    const now = new Date();
    onChangeMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    const todayEntries = entriesByDate[todayISO] ?? [];
    if (todayEntries.length > 0) {
      onSelectRecordedDate(todayISO, todayEntries);
    } else {
      onSelectEmptyDate(todayISO);
    }
  };

  const tooltipText = (iso: string, entries: JournalEntry[]): string => {
    if (entries.length === 0) {
      return t(`${iso} · 暂无记录`, `${iso} · No entry`, isEnglish);
    }
    if (entries.length === 1) {
      const r =
        getPrimaryRazor(entries[0]) ||
        t("未记录剃须刀", "No razor", isEnglish);
      return `${iso} · ${r}`;
    }
    return t(
      `${iso} · 共 ${entries.length} 条记录`,
      `${iso} · ${entries.length} entries`,
      isEnglish
    );
  };

  const activeDayEntries = activeDateISO
    ? (entriesByDate[activeDateISO] ?? [])
    : [];
  const showEmptyBackfill =
    selectedEmptyDateISO &&
    parseDateISO(selectedEmptyDateISO) !== null &&
    (entriesByDate[selectedEmptyDateISO] ?? []).length === 0;

  return (
    <div className="border-b border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3.5 py-3">
      {/* 顶部年月导航 */}
      <div className="mb-2.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          title={t("上个月", "Previous Month", isEnglish)}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--wsj-subtle)] text-[var(--wsj-text)] transition hover:opacity-80"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-center gap-1">
          <select
            aria-label={t("年份", "Year", isEnglish)}
            value={currentYear}
            onChange={(e) =>
              onChangeMonth(
                new Date(Number(e.target.value), currentMonth - 1, 1)
              )
            }
            className="h-7 cursor-pointer rounded-md border border-transparent bg-[var(--wsj-subtle)] px-1.5 text-[12.5px] font-semibold text-[var(--wsj-text)] outline-none focus:border-[var(--wsj-accent)]"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr} className="bg-[var(--wsj-card)]">
                {isEnglish ? yr : `${yr}年`}
              </option>
            ))}
          </select>

          <select
            aria-label={t("月份", "Month", isEnglish)}
            value={currentMonth}
            onChange={(e) =>
              onChangeMonth(new Date(currentYear, Number(e.target.value) - 1, 1))
            }
            className="h-7 cursor-pointer rounded-md border border-transparent bg-[var(--wsj-subtle)] px-1.5 text-[12.5px] font-semibold text-[var(--wsj-text)] outline-none focus:border-[var(--wsj-accent)]"
          >
            {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
              <option key={m} value={m} className="bg-[var(--wsj-card)]">
                {isEnglish ? MONTHS_EN_SHORT[m - 1] : `${m}月`}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => shiftMonth(1)}
          title={t("下个月", "Next Month", isEnglish)}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--wsj-subtle)] text-[var(--wsj-text)] transition hover:opacity-80"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={jumpToToday}
          className="rounded-full bg-[var(--wsj-accent-soft)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--wsj-accent)] transition hover:opacity-85"
        >
          {t("今天", "Today", isEnglish)}
        </button>
      </div>

      {/* 星期表头 */}
      <div className="mb-1 grid grid-cols-7 gap-1 text-center">
        {(isEnglish ? WEEKDAYS_EN : WEEKDAYS_ZH).map((sym) => (
          <div
            key={sym}
            className="text-[11px] font-semibold text-[var(--wsj-text-secondary)]"
          >
            {sym}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1">
        {monthCells.map((cell) => {
          if (cell.day === null || cell.iso === null) {
            return <div key={cell.id} className="h-9" />;
          }

          const iso = cell.iso;
          const dayEntries = entriesByDate[iso] ?? [];
          const isActive = activeDateISO === iso && dayEntries.length > 0;
          const isToday = todayISO === iso;
          const isSelectedEmpty =
            selectedEmptyDateISO === iso && dayEntries.length === 0;

          return (
            <button
              key={cell.id}
              type="button"
              title={tooltipText(iso, dayEntries)}
              onClick={() => {
                if (dayEntries.length > 0) {
                  onSelectRecordedDate(iso, dayEntries);
                } else {
                  onSelectEmptyDate(iso);
                }
              }}
              className={`relative flex h-9 flex-col items-center justify-center rounded-lg transition ${
                isActive
                  ? "bg-[var(--wsj-accent)] text-white"
                  : isSelectedEmpty
                    ? "border border-[var(--wsj-accent)]/60 bg-[var(--wsj-accent-soft)] text-[var(--wsj-text)]"
                    : isToday
                      ? "border border-[var(--wsj-accent)]/55 text-[var(--wsj-accent)] hover:bg-[var(--wsj-subtle)]"
                      : dayEntries.length > 0
                        ? "text-[var(--wsj-text)] hover:bg-[var(--wsj-subtle)]"
                        : "text-[var(--wsj-text-secondary)] hover:bg-[var(--wsj-subtle)]"
              }`}
            >
              <span
                className={`text-[12px] leading-none ${
                  isActive || isToday || dayEntries.length > 0
                    ? "font-semibold"
                    : "font-normal"
                }`}
              >
                {cell.day}
              </span>

              <div className="mt-1 flex h-[5px] items-center justify-center gap-[2.5px]">
                {dayEntries.slice(0, 2).map((entry) => {
                  const proc = getParsedProcess(entry);
                  const dotColor = isActive
                    ? "rgba(255,255,255,0.92)"
                    : dotHexForEntry(entry, proc.irritation);
                  return (
                    <span
                      key={entry.id}
                      className="rounded-full"
                      style={{
                        width: dayEntries.length > 1 ? 4.5 : 5,
                        height: dayEntries.length > 1 ? 4.5 : 5,
                        backgroundColor: dotColor,
                      }}
                    />
                  );
                })}
              </div>

              {dayEntries.length > 1 && (
                <span
                  className={`absolute right-1 top-0.5 font-mono text-[8.5px] font-bold leading-none ${
                    isActive ? "text-white/95" : "text-[var(--wsj-accent)]"
                  }`}
                >
                  {dayEntries.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 图例与当月统计 */}
      <div className="mt-2.5 flex items-center justify-between border-t border-[var(--wsj-border)] pt-2">
        <div className="flex items-center gap-2.5 text-[11px] text-[var(--wsj-text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2E8F5C]" />
            {t("无痛", "Painless", isEnglish)}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D1851F]" />
            {t("微痛", "Mild", isEnglish)}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#CC3D3D]" />
            {t("刺痛/刮伤", "Sting/Cut", isEnglish)}
          </span>
        </div>
        <span className="font-mono text-[11px] text-[var(--wsj-text-secondary)]">
          {t(
            `本月 ${monthRecordCount} 次`,
            `${monthRecordCount} this mo`,
            isEnglish
          )}
        </span>
      </div>

      {/* 无记录日期：补记这一天 */}
      {showEmptyBackfill && selectedEmptyDateISO && (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-[9px] bg-[var(--wsj-subtle)] px-2.5 py-2">
          <span className="truncate text-[12px] text-[var(--wsj-text-secondary)]">
            {t(
              `${selectedEmptyDateISO} 暂无记录`,
              `No entry on ${selectedEmptyDateISO}`,
              isEnglish
            )}
          </span>
          <button
            type="button"
            disabled={isReadOnlyProtected}
            onClick={() => onRequestBackfill(selectedEmptyDateISO)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--wsj-accent)] px-2.5 py-1 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            {t("补记这一天", "Log This Day", isEnglish)}
          </button>
        </div>
      )}

      {/* 同日多条记录提示 */}
      {!showEmptyBackfill && activeDateISO && activeDayEntries.length > 1 && (
        <p className="mt-2 text-[11.5px] text-[var(--wsj-text-secondary)]">
          {t(
            `${activeDateISO} 当天共有 ${activeDayEntries.length} 条记录，再次点击该日期可依次切换`,
            `${activeDayEntries.length} entries on ${activeDateISO} — click the date again to cycle`,
            isEnglish
          )}
        </p>
      )}
    </div>
  );
};
