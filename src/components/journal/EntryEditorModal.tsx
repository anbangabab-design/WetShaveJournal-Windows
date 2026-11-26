import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { parseBladeUsage } from "../../lib/gearKnowledge";
import {
  categorySingularName,
  irritationDisplay,
  latheringShortDisplay,
  loadingMethodDisplay,
  ordinal,
  passDisplay,
  t,
} from "../../lib/l10n";
import {
  buildMergedFields,
  formatDateISO,
  formatParsedProcess,
  getAfterShave,
  getAfterShower,
  getAlum,
  getBowl,
  getBrush,
  getHotTowel,
  getLoadingMethod,
  getPreShave,
  getPrimaryBlade,
  getPrimaryRazor,
  getProcessText,
  getPureLatheringMethod,
  getSoap,
  parseProcessText,
} from "../../lib/processParser";
import { useJournal } from "../../store/JournalContext";
import {
  ALL_IRRITATION_LEVELS,
  ALL_LATHERING_METHODS,
  ALL_LOADING_METHODS,
  ALL_SHAVE_PASS_TYPES,
  ALL_SHAVE_RESULTS,
  type IrritationLevel,
  type JournalEntry,
  type LatheringMethod,
  type PassStep,
  type ShavePassType,
  type ShaveResult,
  type SoapLoadingMethod,
  type SOTDDraft,
} from "../../types/journal";
import { SectionCard } from "../ui/SectionCard";
import { TagPill } from "../ui/TagPill";
import { GearAutocompleteField } from "./GearAutocompleteField";

interface EntryEditorModalProps {
  open: boolean;
  editingEntry: JournalEntry | null;
  initialDateISO?: string | null;
  initialDraft?: SOTDDraft | null;
  onClose: () => void;
  onSaved?: (entry: JournalEntry) => void;
}

const DEFAULT_PASSES: Partial<Record<ShavePassType, string>> = {
  顺刮: "",
  逆刮: "",
  补刀: "",
};

function isValidLoading(raw: string): raw is SoapLoadingMethod {
  return raw === "挖取" || raw === "刷取" || raw === "涂抹";
}

function isValidLathering(raw: string): raw is LatheringMethod {
  return raw === "碗起" || raw === "脸起" || raw === "手起";
}

export const EntryEditorModal: React.FC<EntryEditorModalProps> = ({
  open,
  editingEntry,
  initialDateISO = null,
  initialDraft = null,
  onClose,
  onSaved,
}) => {
  const {
    database,
    isEnglish,
    isReadOnlyProtected,
    checkRazorAdjustable,
    getSuggestedNextBladeUse,
    upsertEntry,
    showToast,
  } = useJournal();

  const [dateStr, setDateStr] = useState<string>(() => formatDateISO(new Date()));
  const [razor, setRazor] = useState("");
  const [bladeBase, setBladeBase] = useState("");
  const [bladeUseCount, setBladeUseCount] = useState<number>(1);
  const [brush, setBrush] = useState("");
  const [soap, setSoap] = useState("");
  const [bowlName, setBowlName] = useState("");
  const [preShave, setPreShave] = useState("");
  const [afterShave, setAfterShave] = useState("");

  const [loadingMethod, setLoadingMethod] = useState<SoapLoadingMethod>("刷取");
  const [latheringMode, setLatheringMode] = useState<LatheringMethod>("碗起");
  const [afterShower, setAfterShower] = useState(true);
  const [hotTowel, setHotTowel] = useState(false);
  const [useAlum, setUseAlum] = useState(true);

  const [selectedPasses, setSelectedPasses] =
    useState<Partial<Record<ShavePassType, string>>>(DEFAULT_PASSES);
  const [shaveResult, setShaveResult] = useState<ShaveResult>("BBS");
  const [irritation, setIrritation] = useState<IrritationLevel>("无痛");
  const [processNote, setProcessNote] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 打开弹窗时初始化表单（与 Mac 版 EntryEditorSheet.loadInitialValues 一致）
  useEffect(() => {
    if (!open) return;
    setSaveError(null);

    if (editingEntry) {
      setDateStr(editingEntry.date || formatDateISO(new Date()));
      setRazor(getPrimaryRazor(editingEntry));
      const bladeParsed = parseBladeUsage(getPrimaryBlade(editingEntry));
      setBladeBase(bladeParsed.baseName);
      setBladeUseCount(bladeParsed.useCount ?? 1);
      setBrush(getBrush(editingEntry));
      setSoap(getSoap(editingEntry));
      const bowl = getBowl(editingEntry);
      setBowlName(bowl);
      const pre = getPreShave(editingEntry);
      setPreShave(pre === "无" ? "" : pre);
      const after = getAfterShave(editingEntry);
      setAfterShave(after === "无" ? "" : after);

      const pureLath = getPureLatheringMethod(editingEntry);
      if (isValidLathering(pureLath)) {
        setLatheringMode(pureLath);
      } else {
        setLatheringMode(bowl ? "碗起" : "脸起");
      }

      const load = getLoadingMethod(editingEntry);
      if (isValidLoading(load)) {
        setLoadingMethod(load);
      } else if (load === "涂取") {
        setLoadingMethod("涂抹");
      } else {
        setLoadingMethod("刷取");
      }

      setAfterShower(getAfterShower(editingEntry).startsWith("是"));
      setHotTowel(getHotTowel(editingEntry));
      setUseAlum(getAlum(editingEntry).startsWith("是"));

      const parsed = parseProcessText(getProcessText(editingEntry));
      const nextPasses: Partial<Record<ShavePassType, string>> = {};
      for (const step of parsed.passes) {
        nextPasses[step.pass] = step.setting;
      }
      setSelectedPasses(nextPasses);
      setShaveResult(parsed.result ?? "BBS");
      setIrritation(parsed.irritation ?? "无痛");
      setProcessNote(parsed.note);
      return;
    }

    // 新建日记 / 补记某一天 / 随机抽签带入
    setDateStr(initialDateISO || formatDateISO(new Date()));
    setLoadingMethod("刷取");
    setAfterShower(true);
    setHotTowel(false);
    setUseAlum(true);
    setSelectedPasses({ ...DEFAULT_PASSES });
    setShaveResult("BBS");
    setIrritation("无痛");
    setProcessNote("");

    if (initialDraft) {
      setRazor(initialDraft.razor);
      setBladeBase(initialDraft.blade);
      setBladeUseCount(
        initialDraft.blade
          ? getSuggestedNextBladeUse(initialDraft.blade)
          : 1
      );
      setBrush(initialDraft.brush);
      setSoap(initialDraft.soap);
      setBowlName(initialDraft.bowl);
      setPreShave(initialDraft.preShave);
      setAfterShave(initialDraft.afterShave);
      setLatheringMode(initialDraft.bowl ? "碗起" : "脸起");
      return;
    }

    setRazor("");
    setBladeBase("");
    setBladeUseCount(1);
    setBrush("");
    setSoap("");

    const latest = database.entries[0];
    if (latest) {
      const latestPre = getPreShave(latest);
      const latestAfter = getAfterShave(latest);
      const latestBowl = getBowl(latest);
      const latestLath = getPureLatheringMethod(latest);
      setPreShave(latestPre === "无" ? "" : latestPre);
      setAfterShave(latestAfter === "无" ? "" : latestAfter);
      setBowlName(latestBowl);
      setLatheringMode(isValidLathering(latestLath) ? latestLath : "碗起");
    } else {
      setPreShave("");
      setAfterShave("");
      setBowlName("");
      setLatheringMode("碗起");
    }
  }, [
    open,
    editingEntry,
    initialDateISO,
    initialDraft,
    database.entries,
    getSuggestedNextBladeUse,
  ]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const isAdjustable = useMemo(
    () => checkRazorAdjustable(razor),
    [checkRazorAdjustable, razor]
  );

  if (!open) return null;

  const togglePass = (pass: ShavePassType) => {
    setSelectedPasses((prev) => {
      const next = { ...prev };
      if (next[pass] !== undefined) {
        delete next[pass];
      } else {
        next[pass] = "";
      }
      return next;
    });
  };

  const updatePassSetting = (pass: ShavePassType, setting: string) => {
    setSelectedPasses((prev) => ({
      ...prev,
      [pass]: setting,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!razor.trim() || isReadOnlyProtected || isSaving) return;

    setSaveError(null);
    setIsSaving(true);

    const orderedPasses: PassStep[] = [];
    for (const p of ALL_SHAVE_PASS_TYPES) {
      const setting = selectedPasses[p];
      if (setting !== undefined) {
        orderedPasses.push({ pass: p, setting });
      }
    }

    const processText = formatParsedProcess(
      {
        passes: orderedPasses,
        result: shaveResult,
        irritation,
        note: processNote,
      },
      isAdjustable
    );

    const trimmedBlade = bladeBase.trim();
    const bladeValue = trimmedBlade
      ? `${trimmedBlade} ${ordinal(bladeUseCount)}`
      : "";

    const effectiveDate = dateStr.trim() || formatDateISO(new Date());

    const fields = buildMergedFields({
      existingEntry: editingEntry,
      dateStr: effectiveDate,
      razor: razor.trim(),
      blade: bladeValue,
      brush: brush.trim(),
      soap: soap.trim(),
      bowl: bowlName.trim(),
      preShave: preShave.trim(),
      afterShave: afterShave.trim(),
      afterShower,
      hotTowel,
      useAlum,
      processText,
      loadingMethod,
      latheringMethod: latheringMode,
    });

    const newId =
      editingEntry?.id ??
      `local-${
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().toUpperCase()
          : `${Date.now()}`
      }`;

    const entry: JournalEntry = {
      id: newId,
      date: effectiveDate,
      fields,
      sourceFingerprint: editingEntry?.sourceFingerprint,
      locallyModified: true,
    };

    const res = await upsertEntry(entry);
    setIsSaving(false);
    if (res.ok) {
      showToast(t("已保存 SOTD 日记", "Saved SOTD entry", isEnglish));
      onSaved?.(entry);
      onClose();
    } else {
      setSaveError(res.error ?? t("保存失败", "Failed to save", isEnglish));
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-5 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={(e) => void handleSave(e)}
        className="flex max-h-[90vh] w-full max-w-[780px] flex-col overflow-hidden rounded-2xl border border-[var(--wsj-border)] bg-[var(--wsj-canvas)] shadow-2xl"
      >
        {/* 顶部栏 */}
        <div className="flex items-center justify-between border-b border-[var(--wsj-border)] bg-[var(--wsj-card)] px-6 py-4">
          <h2 className="text-[19px] font-bold text-[var(--wsj-text)]">
            {editingEntry
              ? t("编辑 SOTD", "Edit SOTD", isEnglish)
              : t("记录今日 SOTD", "New SOTD", isEnglish)}
          </h2>

          <div className="flex items-center gap-3">
            <input
              type="date"
              required
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-2.5 py-1.5 font-mono text-[13px] font-medium text-[var(--wsj-text)] outline-none focus:border-[var(--wsj-accent)]"
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--wsj-text-secondary)] transition hover:bg-[var(--wsj-subtle)] hover:text-[var(--wsj-text)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 表单滚动区 */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* 1. 装备搭配 */}
          <SectionCard>
            <div className="space-y-4">
              <h3 className="text-[15.5px] font-semibold text-[var(--wsj-text)]">
                {t("装备搭配", "Setup", isEnglish)}
              </h3>

              <GearAutocompleteField
                title={categorySingularName("剃须刀", isEnglish)}
                category="剃须刀"
                value={razor}
                onChange={setRazor}
                placeholder={t(
                  "搜索或输入剃须刀...",
                  "Search or enter razor...",
                  isEnglish
                )}
              />

              {/* 刀片 + 使用次数累计 & 换新刀片 */}
              <div className="space-y-2.5">
                <GearAutocompleteField
                  title={categorySingularName("刀片", isEnglish)}
                  category="刀片"
                  value={bladeBase}
                  onChange={setBladeBase}
                  placeholder={t(
                    "搜索或输入刀片...",
                    "Search or enter blade...",
                    isEnglish
                  )}
                  onSelectItem={(selected) => {
                    setBladeUseCount(getSuggestedNextBladeUse(selected.name));
                  }}
                />

                <div className="flex flex-wrap items-center gap-3 pl-0.5">
                  <span className="text-[12.5px] text-[var(--wsj-text-secondary)]">
                    {t("使用次数", "Use Count", isEnglish)}
                  </span>

                  <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] p-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setBladeUseCount((c) => Math.max(1, c - 1))
                      }
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--wsj-text)] transition hover:bg-[var(--wsj-card)]"
                      aria-label="Decrease"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[96px] px-2 text-center font-mono text-[13px] font-semibold text-[var(--wsj-accent)]">
                      {isEnglish
                        ? ordinal(bladeUseCount)
                        : `第 ${bladeUseCount} 次 (${ordinal(bladeUseCount)})`}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setBladeUseCount((c) => Math.min(50, c + 1))
                      }
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--wsj-text)] transition hover:bg-[var(--wsj-card)]"
                      aria-label="Increase"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setBladeUseCount(1)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t("换新刀片 (1st)", "Fresh Blade (1st)", isEnglish)}
                  </button>
                </div>
              </div>

              <GearAutocompleteField
                title={categorySingularName("剃须刷", isEnglish)}
                category="剃须刷"
                value={brush}
                onChange={setBrush}
                placeholder={t(
                  "搜索或输入剃须刷...",
                  "Search or enter brush...",
                  isEnglish
                )}
              />

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <GearAutocompleteField
                  title={categorySingularName("剃须皂", isEnglish)}
                  category="剃须皂"
                  value={soap}
                  onChange={setSoap}
                  placeholder={t(
                    "搜索或输入剃须皂...",
                    "Search or enter soap...",
                    isEnglish
                  )}
                />
                <GearAutocompleteField
                  title={categorySingularName("剃须碗", isEnglish)}
                  category="剃须碗"
                  value={bowlName}
                  onChange={setBowlName}
                  placeholder={t("选填...", "Optional...", isEnglish)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <GearAutocompleteField
                  title={categorySingularName("须前", isEnglish)}
                  category="须前"
                  value={preShave}
                  onChange={setPreShave}
                  placeholder={t("选填...", "Optional...", isEnglish)}
                />
                <GearAutocompleteField
                  title={categorySingularName("须后", isEnglish)}
                  category="须后"
                  value={afterShave}
                  onChange={setAfterShave}
                  placeholder={t("选填...", "Optional...", isEnglish)}
                />
              </div>
            </div>
          </SectionCard>

          {/* 2. 剃须流程 */}
          <SectionCard>
            <div className="space-y-4">
              <h3 className="text-[15.5px] font-semibold text-[var(--wsj-text)]">
                {t("剃须流程", "Prep & Lather", isEnglish)}
              </h3>

              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="mb-1.5 text-[12.5px] text-[var(--wsj-text-secondary)]">
                    {t("取皂方式", "Loading", isEnglish)}
                  </div>
                  <div className="inline-flex rounded-[10px] bg-[var(--wsj-subtle)] p-1">
                    {ALL_LOADING_METHODS.map((m) => {
                      const active = loadingMethod === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setLoadingMethod(m)}
                          className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
                            active
                              ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                              : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                          }`}
                        >
                          {loadingMethodDisplay(m, isEnglish)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[12.5px] text-[var(--wsj-text-secondary)]">
                    {t("起泡方式", "Lathering", isEnglish)}
                  </div>
                  <div className="inline-flex rounded-[10px] bg-[var(--wsj-subtle)] p-1">
                    {ALL_LATHERING_METHODS.map((m) => {
                      const active = latheringMode === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setLatheringMode(m)}
                          className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
                            active
                              ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                              : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                          }`}
                        >
                          {latheringShortDisplay(m, isEnglish)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 开关项 */}
              <div className="flex flex-wrap items-center gap-6 pt-0.5">
                {[
                  {
                    label: t("热敷", "Hot Towel", isEnglish),
                    checked: hotTowel,
                    onChange: setHotTowel,
                  },
                  {
                    label: t("浴后", "Post-Shower", isEnglish),
                    checked: afterShower,
                    onChange: setAfterShower,
                  },
                  {
                    label: t("明矾", "Alum Block", isEnglish),
                    checked: useAlum,
                    onChange: setUseAlum,
                  },
                ].map((item) => (
                  <label
                    key={item.label}
                    className="inline-flex cursor-pointer items-center gap-2.5 select-none"
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.checked}
                      onClick={() => item.onChange(!item.checked)}
                      className={`relative inline-flex h-[22px] w-10 items-center rounded-full transition ${
                        item.checked
                          ? "bg-[var(--wsj-accent)]"
                          : "bg-[var(--wsj-pill)]"
                      }`}
                    >
                      <span
                        className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition ${
                          item.checked ? "translate-x-[20px]" : "translate-x-[2px]"
                        }`}
                      />
                    </button>
                    <span className="text-[13.5px] font-medium text-[var(--wsj-text)]">
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* 3. 过程与体验 */}
          <SectionCard>
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <h3 className="text-[15.5px] font-semibold text-[var(--wsj-text)]">
                  {t("过程与体验", "Passes & Result", isEnglish)}
                </h3>
                {isAdjustable && (
                  <TagPill
                    text={t("可调刀", "Adjustable", isEnglish)}
                    tone="accent"
                  />
                )}
              </div>

              {/* 刮剃步骤：四列顶部对齐（items-start），档位槽位定高防跳动 */}
              <div className="grid grid-cols-4 items-start gap-2.5">
                {ALL_SHAVE_PASS_TYPES.map((pass) => {
                  const isOn = selectedPasses[pass] !== undefined;
                  return (
                    <div key={pass} className="flex flex-col items-stretch">
                      <button
                        type="button"
                        onClick={() => togglePass(pass)}
                        className={`flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] text-[13.5px] font-semibold transition ${
                          isOn
                            ? "bg-[var(--wsj-accent)] text-white"
                            : "bg-[var(--wsj-subtle)] text-[var(--wsj-text)] hover:opacity-85"
                        }`}
                      >
                        {isOn ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        )}
                        <span>{passDisplay(pass, isEnglish)}</span>
                      </button>

                      {isAdjustable && (
                        <div className="mt-1.5 flex h-8 items-center justify-center">
                          {isOn ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] text-[var(--wsj-text-secondary)]">
                                {t("档位", "Set", isEnglish)}
                              </span>
                              <input
                                type="text"
                                placeholder="5"
                                value={selectedPasses[pass] ?? ""}
                                onChange={(e) =>
                                  updatePassSetting(pass, e.target.value)
                                }
                                className="h-7 w-14 rounded-md border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-2 text-center font-mono text-[13px] text-[var(--wsj-text)] outline-none focus:border-[var(--wsj-accent)]"
                              />
                            </div>
                          ) : (
                            <div className="h-7 w-full" aria-hidden="true" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 剃须效果 & 刺激程度 */}
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="mb-1.5 text-[12.5px] text-[var(--wsj-text-secondary)]">
                    {t("剃须效果", "Closeness", isEnglish)}
                  </div>
                  <div className="inline-flex rounded-[10px] bg-[var(--wsj-subtle)] p-1">
                    {ALL_SHAVE_RESULTS.map((res) => {
                      const active = shaveResult === res;
                      return (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setShaveResult(res)}
                          className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
                            active
                              ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                              : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                          }`}
                        >
                          {res}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[12.5px] text-[var(--wsj-text-secondary)]">
                    {t("刺激程度", "Comfort", isEnglish)}
                  </div>
                  <div className="inline-flex rounded-[10px] bg-[var(--wsj-subtle)] p-1">
                    {ALL_IRRITATION_LEVELS.map((lvl) => {
                      const active = irritation === lvl;
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setIrritation(lvl)}
                          className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
                            active
                              ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                              : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                          }`}
                        >
                          {irritationDisplay(lvl, isEnglish)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 备注 */}
              <div>
                <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                  {t("备注（选填）", "Notes (Optional)", isEnglish)}
                </label>
                <input
                  type="text"
                  value={processNote}
                  onChange={(e) => setProcessNote(e.target.value)}
                  placeholder={t(
                    "例如：有血点、泡沫偏干...",
                    "e.g., weeper, dry lather...",
                    isEnglish
                  )}
                  className="w-full rounded-[9px] border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-3 py-2 text-[13.5px] text-[var(--wsj-text)] placeholder:text-[var(--wsj-text-tertiary)] outline-none focus:border-[var(--wsj-accent)]"
                />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* 底部操作栏 */}
        <div className="border-t border-[var(--wsj-border)] bg-[var(--wsj-card)] px-6 py-3.5">
          {saveError && (
            <div className="mb-2.5 flex items-center gap-2 text-[12.5px] text-[#CC3D3D]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="truncate">{saveError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-4 py-1.5 text-[13.5px] font-medium text-[var(--wsj-text)] transition hover:opacity-85"
            >
              {t("取消", "Cancel", isEnglish)}
            </button>
            <button
              type="submit"
              disabled={!razor.trim() || isReadOnlyProtected || isSaving}
              className="rounded-lg bg-[var(--wsj-accent)] px-4 py-1.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
            >
              {editingEntry
                ? t("更新日记", "Update Entry", isEnglish)
                : t("保存日记", "Save Entry", isEnglish)}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
