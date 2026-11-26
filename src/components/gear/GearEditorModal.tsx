import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  GitMerge,
  ImagePlus,
  Split,
  Trash2,
  X,
} from "lucide-react";
import { normalizeGearStatus } from "../../lib/gearKnowledge";
import { sanitizeBrand, sanitizeMaterialStrict } from "../../lib/gearMutations";
import {
  badgerBandDisplay,
  badgerTreatmentDisplay,
  bladeTypeDisplay,
  brandDisplay,
  brushMaterialDisplay,
  categoryPluralName,
  categorySupportsSample,
  gearStatusDisplay,
  gearStatusOptions,
  handleTag,
  materialDisplay,
  plateTypeDisplay,
  razorTypeFullDisplay,
  t,
} from "../../lib/l10n";
import { useJournal } from "../../store/JournalContext";
import {
  ALL_BADGER_BANDS,
  ALL_BADGER_TREATMENTS,
  ALL_BLADE_TYPES,
  ALL_BRUSH_KNOT_SHAPES,
  ALL_BRUSH_MATERIALS,
  ALL_GEAR_CATEGORIES,
  ALL_PLATE_TYPES,
  ALL_RAZOR_TYPES,
  STANDARD_RAZOR_MATERIALS,
  type BadgerBand,
  type BadgerTreatment,
  type BladeType,
  type BrushKnotShape,
  type BrushMaterial,
  type GearCategory,
  type GearItem,
  type GearOverride,
  type GearStatus,
  type PlateType,
  type RazorType,
} from "../../types/journal";
import { BrandAvatar } from "../ui/BrandAvatar";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { SectionCard } from "../ui/SectionCard";
import { TagPill, type TagTone } from "../ui/TagPill";
import { GearDeleteDialog } from "./GearDeleteDialog";

interface GearEditorModalProps {
  open: boolean;
  item: GearItem | null;
  defaultCategory: GearCategory;
  onClose: () => void;
}

function statusTone(status: GearStatus): TagTone {
  if (status === "在用" || status === "有") return "forest";
  if (status === "借用") return "slate";
  return "neutral";
}

function isDefaultNormalStatus(status: GearStatus): boolean {
  return status === "在用" || status === "有";
}

export const GearEditorModal: React.FC<GearEditorModalProps> = ({
  open,
  item,
  defaultCategory,
  onClose,
}) => {
  const {
    catalogSnapshot,
    isEnglish,
    isReadOnlyProtected,
    getGearRawEntrySamples,
    updateGearItem,
    mergeGearItem,
    splitRawKey,
    uploadCustomBrandLogo,
  } = useJournal();

  const [category, setCategory] = useState<GearCategory>(defaultCategory);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState<GearStatus>("在用");
  const [isPending, setIsPending] = useState(false);
  const [isSample, setIsSample] = useState(false);

  // 剃须刀参数
  const [razorType, setRazorType] = useState<RazorType>("Double Edge (DE)");
  const [isAdjustable, setIsAdjustable] = useState(false);
  const [isSlant, setIsSlant] = useState(false);
  const [material, setMaterial] = useState("");
  const [plateType, setPlateType] = useState<PlateType | "">("");
  const [gapOrSpec, setGapOrSpec] = useState("");

  // 刀片参数
  const [bladeType, setBladeType] = useState<BladeType | "">("");

  // 剃须刷参数
  const [handleBrand, setHandleBrand] = useState("");
  const [brushMaterial, setBrushMaterial] = useState<BrushMaterial | "">("");
  const [badgerTreatment, setBadgerTreatment] = useState<BadgerTreatment | "">(
    ""
  );
  const [badgerBand, setBadgerBand] = useState<BadgerBand | "">("");
  const [knotSize, setKnotSize] = useState("");
  const [knotShape, setKnotShape] = useState<BrushKnotShape | "">("");

  const [notes, setNotes] = useState("");

  // 合并 / 拆分 / 删除状态
  const [mergeTargetID, setMergeTargetID] = useState("");
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [rawKeyToSplit, setRawKeyToSplit] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GearItem | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setMergeTargetID("");
    setShowMergeConfirm(false);
    setRawKeyToSplit(null);
    setDeleteTarget(null);

    if (item) {
      setCategory(item.category);
      setBrand(item.brand);
      setModel(item.model);
      setFullName(item.name);
      setStatus(normalizeGearStatus(item.status, item.category));
      setIsPending(item.isPending);
      setIsSample(item.isSample);
      setRazorType(item.razorType ?? "Double Edge (DE)");
      setIsAdjustable(item.isAdjustable);
      setIsSlant(item.isSlant);
      setMaterial(item.material ?? "");
      setPlateType(item.plateType ?? "");
      setGapOrSpec(item.gapOrSpec ?? "");
      setBladeType(item.bladeType ?? "");
      setHandleBrand(item.handleBrand ?? "");
      setBrushMaterial(item.brushMaterial ?? "");
      setBadgerTreatment(item.badgerTreatment ?? "");
      setBadgerBand(item.badgerBand ?? "");
      setKnotSize(item.knotSize ?? "");
      setKnotShape(item.knotShape ?? "");
      setNotes(item.notes ?? "");
    } else {
      setCategory(defaultCategory);
      setBrand("");
      setModel("");
      setFullName("");
      setStatus(normalizeGearStatus(undefined, defaultCategory));
      setIsPending(false);
      setIsSample(false);
      setRazorType("Double Edge (DE)");
      setIsAdjustable(false);
      setIsSlant(false);
      setMaterial("");
      setPlateType("");
      setGapOrSpec("");
      setBladeType("");
      setHandleBrand("");
      setBrushMaterial("");
      setBadgerTreatment("");
      setBadgerBand("");
      setKnotSize("");
      setKnotShape("");
      setNotes("");
    }
  }, [open, item, defaultCategory]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !showMergeConfirm &&
        !rawKeyToSplit &&
        !deleteTarget
      ) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, showMergeConfirm, rawKeyToSplit, deleteTarget, onClose]);

  const mergeCandidates = useMemo(() => {
    if (!item) return [];
    return (catalogSnapshot.itemsByCategory[item.category] ?? []).filter(
      (cand) => cand.id !== item.id
    );
  }, [catalogSnapshot, item]);

  const selectedMergeTarget = useMemo(
    () => mergeCandidates.find((c) => c.id === mergeTargetID) ?? null,
    [mergeCandidates, mergeTargetID]
  );

  if (!open) return null;

  const trimmedBrand = brand.trim();
  const headerBrandName = trimmedBrand || "品牌未注明";
  const headerTitle =
    model.trim() ||
    fullName.trim() ||
    (item
      ? t("编辑器材", "Edit Gear", isEnglish)
      : t("新增器材", "New Gear", isEnglish));

  const canUploadIcon =
    Boolean(trimmedBrand) &&
    trimmedBrand !== "品牌未注明" &&
    trimmedBrand !== "无品牌" &&
    trimmedBrand !== "仿刀";

  const canSave =
    (Boolean(fullName.trim()) || Boolean(model.trim())) &&
    !isReadOnlyProtected &&
    !isSaving;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    setSaveError(null);
    setIsSaving(true);

    const cleanBrand = trimmedBrand
      ? (sanitizeBrand(trimmedBrand) ?? trimmedBrand)
      : "品牌未注明";
    const cleanModel = model.trim();
    const cleanFull =
      fullName.trim() ||
      (cleanBrand === "仿刀" || cleanBrand === "品牌未注明"
        ? cleanModel
        : `${cleanBrand} ${cleanModel}`);

    const rawHandle = handleBrand.trim();
    const cleanHandle =
      rawHandle && rawHandle.toLowerCase() !== cleanBrand.toLowerCase()
        ? rawHandle
        : undefined;

    const nextOverride: GearOverride = {
      brand: cleanBrand,
      name: cleanFull,
      model: cleanModel || undefined,
      razorType: category === "剃须刀" ? razorType : undefined,
      isAdjustable: category === "剃须刀" && isAdjustable ? true : undefined,
      isSlant: category === "剃须刀" && isSlant ? true : undefined,
      material:
        category === "剃须刀" ? sanitizeMaterialStrict(material) : undefined,
      plateType:
        category === "剃须刀" && plateType ? plateType : undefined,
      gapOrSpec:
        category === "剃须刀" && gapOrSpec.trim()
          ? gapOrSpec.trim()
          : undefined,
      bladeType: category === "刀片" && bladeType ? bladeType : undefined,
      handleBrand: category === "剃须刷" ? cleanHandle : undefined,
      brushMaterial:
        category === "剃须刷" && brushMaterial ? brushMaterial : undefined,
      badgerTreatment:
        category === "剃须刷" && brushMaterial === "獾毛" && badgerTreatment
          ? badgerTreatment
          : undefined,
      badgerBand:
        category === "剃须刷" && brushMaterial === "獾毛" && badgerBand
          ? badgerBand
          : undefined,
      knotSize:
        category === "剃须刷" && knotSize.trim() ? knotSize.trim() : undefined,
      knotShape: category === "剃须刷" && knotShape ? knotShape : undefined,
      isSample:
        categorySupportsSample(category) && isSample ? true : undefined,
      status: normalizeGearStatus(status, category),
      notes: notes.trim() || undefined,
      recognizedSource: item?.recognizedSource,
      isManuallyConfirmed: true,
    };

    const res = await updateGearItem(
      item?.rawKeys ?? [],
      category,
      nextOverride,
      !isPending
    );
    setIsSaving(false);
    if (res.ok) {
      onClose();
    } else {
      setSaveError(res.error ?? t("保存失败", "Failed to save", isEnglish));
    }
  };

  const handleConfirmMerge = async () => {
    setShowMergeConfirm(false);
    if (!item || !selectedMergeTarget) return;
    setSaveError(null);
    const res = await mergeGearItem(item, selectedMergeTarget);
    if (res.ok) {
      onClose();
    } else if (res.error) {
      setSaveError(res.error);
    }
  };

  const handleConfirmSplit = async () => {
    const rk = rawKeyToSplit;
    setRawKeyToSplit(null);
    if (!item || !rk) return;
    setSaveError(null);
    const res = await splitRawKey(rk, item);
    if (res.ok) {
      onClose();
    } else if (res.error) {
      setSaveError(res.error);
    }
  };

  const handleBrandIconPick = () => {
    if (!canUploadIcon) return;
    void uploadCustomBrandLogo(trimmedBrand);
  };

  const inputClass =
    "w-full rounded-[9px] border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-3 py-2 text-[13.5px] text-[var(--wsj-text)] placeholder:text-[var(--wsj-text-tertiary)] outline-none focus:border-[var(--wsj-accent)]";

  const selectClass =
    "w-full cursor-pointer rounded-[9px] border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-3 py-2 text-[13.5px] text-[var(--wsj-text)] outline-none focus:border-[var(--wsj-accent)]";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-5 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={(e) => void handleSave(e)}
        className="flex max-h-[90vh] w-full max-w-[700px] flex-col overflow-hidden rounded-2xl border border-[var(--wsj-border)] bg-[var(--wsj-canvas)] shadow-2xl"
      >
        {/* 顶部栏：52px 品牌徽章（支持点击上传自定义图标）+ 标题 */}
        <div className="flex items-center gap-4 border-b border-[var(--wsj-border)] bg-[var(--wsj-card)] px-6 py-4">
          <button
            type="button"
            disabled={!canUploadIcon}
            onClick={handleBrandIconPick}
            title={t(
              "点击上传或更换该品牌的自定义图标（保存至 CustomLogos/）",
              "Click to upload custom logo for this brand (saved to CustomLogos/)",
              isEnglish
            )}
            className="group relative shrink-0 rounded-full transition disabled:cursor-default"
          >
            <BrandAvatar brand={headerBrandName} size={52} />
            {canUploadIcon && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--wsj-border)] bg-[var(--wsj-card)] text-[var(--wsj-text-secondary)] shadow-sm transition group-hover:bg-[var(--wsj-accent)] group-hover:text-white">
                <ImagePlus className="h-3 w-3" />
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-[var(--wsj-text-secondary)]">
                {brandDisplay(headerBrandName, isEnglish)}
              </span>
              {category === "剃须刷" &&
                handleBrand.trim() &&
                handleBrand.trim().toLowerCase() !==
                  headerBrandName.toLowerCase() && (
                  <>
                    <span className="text-[12px] text-[var(--wsj-text-tertiary)]">
                      ×
                    </span>
                    <span className="truncate text-[12.5px] font-medium text-[var(--wsj-text-secondary)]">
                      {handleTag(handleBrand.trim(), isEnglish)}
                    </span>
                  </>
                )}
              {!isDefaultNormalStatus(status) && (
                <TagPill
                  text={gearStatusDisplay(status, isEnglish)}
                  tone={statusTone(status)}
                />
              )}
              {isPending && (
                <TagPill
                  text={t("待确认", "Pending", isEnglish)}
                  tone="amber"
                  filled
                />
              )}
            </div>
            <h2 className="mt-0.5 truncate text-[19px] font-bold text-[var(--wsj-text)]">
              {headerTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--wsj-text-secondary)] transition hover:bg-[var(--wsj-subtle)] hover:text-[var(--wsj-text)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 表单滚动区 */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* 1. 基础信息 */}
          <SectionCard>
            <div className="space-y-4">
              <h3 className="text-[15.5px] font-semibold text-[var(--wsj-text)]">
                {t("基础信息", "Basic Info", isEnglish)}
              </h3>

              {!item && (
                <div>
                  <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                    {t("分类", "Category", isEnglish)}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const nextCat = e.target.value as GearCategory;
                      setCategory(nextCat);
                      setStatus((prev) => normalizeGearStatus(prev, nextCat));
                    }}
                    className={selectClass}
                  >
                    {ALL_GEAR_CATEGORIES.map((c) => (
                      <option
                        key={c}
                        value={c}
                        className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                      >
                        {categoryPluralName(c, isEnglish)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-[12.5px] text-[var(--wsj-text-secondary)]">
                      {category === "剃须刷"
                        ? t("毛结品牌（主品牌）", "Knot Brand (Primary)", isEnglish)
                        : t("品牌", "Brand", isEnglish)}
                    </label>
                    <div className="flex items-center gap-2.5">
                      {category === "剃须刀" && (
                        <button
                          type="button"
                          onClick={() => setBrand("仿刀")}
                          className="text-[12px] font-medium text-[var(--wsj-accent)] hover:underline"
                        >
                          {t("设为仿刀", "Clone", isEnglish)}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!canUploadIcon}
                        onClick={handleBrandIconPick}
                        className="text-[12px] font-medium text-[var(--wsj-accent)] hover:underline disabled:opacity-40"
                      >
                        {t("更换图标", "Custom Icon", isEnglish)}
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder={
                      category === "剃须刷"
                        ? "Shavemac / Frank Shaving / Wald..."
                        : "Blutt / Wolfman / Blackland..."
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                    {t(
                      "型号（保留版本代号）",
                      "Model (Keep Sub-Model Code)",
                      isEnglish
                    )}
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Next Level 112+ / WR1 0.74 / BR-1..."
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                  {t(
                    "完整名称（用于日记记录与单品区分）",
                    "Canonical Name (Unique Identifier)",
                    isEnglish
                  )}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Blutt BR-1 0.99"
                  className={inputClass}
                />
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-0.5">
                <div className="w-44">
                  <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                    {t("状态", "Status", isEnglish)}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as GearStatus)}
                    className={selectClass}
                  >
                    {gearStatusOptions(category).map((st) => (
                      <option
                        key={st}
                        value={st}
                        className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                      >
                        {gearStatusDisplay(st, isEnglish)}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="mt-5 inline-flex cursor-pointer items-center gap-2.5 select-none">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isPending}
                    onClick={() => setIsPending((prev) => !prev)}
                    className={`relative inline-flex h-[22px] w-10 items-center rounded-full transition ${
                      isPending ? "bg-[#D1851F]" : "bg-[var(--wsj-pill)]"
                    }`}
                  >
                    <span
                      className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition ${
                        isPending ? "translate-x-[20px]" : "translate-x-[2px]"
                      }`}
                    />
                  </button>
                  <span className="text-[13.5px] font-medium text-[var(--wsj-text)]">
                    {t("待确认", "Pending", isEnglish)}
                  </span>
                </label>

                {categorySupportsSample(category) && (
                  <label className="mt-5 inline-flex cursor-pointer items-center gap-2.5 select-none">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isSample}
                      onClick={() => setIsSample((prev) => !prev)}
                      className={`relative inline-flex h-[22px] w-10 items-center rounded-full transition ${
                        isSample ? "bg-[#5280B8]" : "bg-[var(--wsj-pill)]"
                      }`}
                    >
                      <span
                        className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition ${
                          isSample ? "translate-x-[20px]" : "translate-x-[2px]"
                        }`}
                      />
                    </button>
                    <span className="text-[13.5px] font-medium text-[var(--wsj-text)]">
                      {t("分装 / 小样", "Sample", isEnglish)}
                    </span>
                  </label>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 2. 品类专属参数 */}
          {category === "剃须刀" && (
            <SectionCard>
              <div className="space-y-4">
                <h3 className="text-[15.5px] font-semibold text-[var(--wsj-text)]">
                  {t("剃须刀参数", "Razor Specs", isEnglish)}
                </h3>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                      {t("刀型", "Type", isEnglish)}
                    </label>
                    <select
                      value={razorType}
                      onChange={(e) =>
                        setRazorType(e.target.value as RazorType)
                      }
                      className={selectClass}
                    >
                      {ALL_RAZOR_TYPES.map((rt) => (
                        <option
                          key={rt}
                          value={rt}
                          className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                        >
                          {razorTypeFullDisplay(rt, isEnglish)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                      {t("底板", "Baseplate", isEnglish)}
                    </label>
                    <select
                      value={plateType}
                      onChange={(e) =>
                        setPlateType(e.target.value as PlateType | "")
                      }
                      className={selectClass}
                    >
                      <option
                        value=""
                        className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                      >
                        {t("未标注", "None", isEnglish)}
                      </option>
                      {ALL_PLATE_TYPES.map((pt) => (
                        <option
                          key={pt}
                          value={pt}
                          className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                        >
                          {plateTypeDisplay(pt, isEnglish)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <label className="inline-flex cursor-pointer items-center gap-2.5 select-none">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isAdjustable}
                      onClick={() => setIsAdjustable((prev) => !prev)}
                      className={`relative inline-flex h-[22px] w-10 items-center rounded-full transition ${
                        isAdjustable
                          ? "bg-[var(--wsj-accent)]"
                          : "bg-[var(--wsj-pill)]"
                      }`}
                    >
                      <span
                        className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition ${
                          isAdjustable
                            ? "translate-x-[20px]"
                            : "translate-x-[2px]"
                        }`}
                      />
                    </button>
                    <span className="text-[13.5px] font-medium text-[var(--wsj-text)]">
                      {t("可调刀", "Adjustable", isEnglish)}
                    </span>
                  </label>

                  <label className="inline-flex cursor-pointer items-center gap-2.5 select-none">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isSlant}
                      onClick={() => setIsSlant((prev) => !prev)}
                      className={`relative inline-flex h-[22px] w-10 items-center rounded-full transition ${
                        isSlant
                          ? "bg-[var(--wsj-accent)]"
                          : "bg-[var(--wsj-pill)]"
                      }`}
                    >
                      <span
                        className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition ${
                          isSlant ? "translate-x-[20px]" : "translate-x-[2px]"
                        }`}
                      />
                    </button>
                    <span className="text-[13.5px] font-medium text-[var(--wsj-text)]">
                      {t("Slant 斜头", "Slant", isEnglish)}
                    </span>
                  </label>
                </div>

                <div>
                  <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                    {t("材质", "Material", isEnglish)}
                  </label>
                  <input
                    type="text"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    placeholder={t(
                      "不锈钢 / 钛合金 / 黄铜...",
                      "Stainless Steel / Titanium / Brass...",
                      isEnglish
                    )}
                    className={inputClass}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {STANDARD_RAZOR_MATERIALS.map((mat) => {
                      const active = material === mat;
                      return (
                        <button
                          key={mat}
                          type="button"
                          onClick={() => setMaterial(active ? "" : mat)}
                          className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-medium transition ${
                            active
                              ? "bg-[var(--wsj-accent)] text-white"
                              : "bg-[var(--wsj-subtle)] text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
                          }`}
                        >
                          {materialDisplay(mat, isEnglish)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                    {t(
                      "刀隙 / 版本短规格（最多 12 字符，留空则卡片自动隐藏不占位）",
                      "Gap / Version Short Spec (max 12 chars; hidden when blank)",
                      isEnglish
                    )}
                  </label>
                  <input
                    type="text"
                    value={gapOrSpec}
                    onChange={(e) => setGapOrSpec(e.target.value)}
                    placeholder="0.99 / 1.12+ / Standard / Lite..."
                    className={inputClass}
                  />
                </div>
              </div>
            </SectionCard>
          )}

          {category === "刀片" && (
            <SectionCard>
              <div className="space-y-3">
                <h3 className="text-[15.5px] font-semibold text-[var(--wsj-text)]">
                  {t("刀片参数", "Blade Specs", isEnglish)}
                </h3>
                <div className="max-w-[280px]">
                  <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                    {t("刀片类型", "Blade Type", isEnglish)}
                  </label>
                  <select
                    value={bladeType}
                    onChange={(e) =>
                      setBladeType(e.target.value as BladeType | "")
                    }
                    className={selectClass}
                  >
                    <option
                      value=""
                      className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                    >
                      {t("未标注", "None", isEnglish)}
                    </option>
                    {ALL_BLADE_TYPES.map((bt) => (
                      <option
                        key={bt}
                        value={bt}
                        className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                      >
                        {bladeTypeDisplay(bt, isEnglish)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </SectionCard>
          )}

          {category === "剃须刷" && (
            <SectionCard>
              <div className="space-y-4">
                <h3 className="text-[15.5px] font-semibold text-[var(--wsj-text)]">
                  {t("剃须刷参数", "Brush Specs", isEnglish)}
                </h3>

                <div>
                  <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                    {t(
                      "手柄品牌（混搭刷选填，原厂同品牌留空）",
                      "Handle Brand (Optional — leave blank for factory handle)",
                      isEnglish
                    )}
                  </label>
                  <input
                    type="text"
                    value={handleBrand}
                    onChange={(e) => setHandleBrand(e.target.value)}
                    placeholder="RV / Chisel & Hound / AKA / S.ghost..."
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                      {t("刷毛类型", "Hair", isEnglish)}
                    </label>
                    <select
                      value={brushMaterial}
                      onChange={(e) => {
                        const val = e.target.value as BrushMaterial | "";
                        setBrushMaterial(val);
                        if (val !== "獾毛") {
                          setBadgerTreatment("");
                          setBadgerBand("");
                        }
                      }}
                      className={selectClass}
                    >
                      <option
                        value=""
                        className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                      >
                        {t("未标注", "None", isEnglish)}
                      </option>
                      {ALL_BRUSH_MATERIALS.map((bm) => (
                        <option
                          key={bm}
                          value={bm}
                          className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                        >
                          {brushMaterialDisplay(bm, isEnglish)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                      {t("刷型 / 毛型", "Knot Shape", isEnglish)}
                    </label>
                    <select
                      value={knotShape}
                      onChange={(e) =>
                        setKnotShape(e.target.value as BrushKnotShape | "")
                      }
                      className={selectClass}
                    >
                      <option
                        value=""
                        className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                      >
                        {t("未标注", "None", isEnglish)}
                      </option>
                      {ALL_BRUSH_KNOT_SHAPES.map((sh) => (
                        <option
                          key={sh}
                          value={sh}
                          className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                        >
                          {sh}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                      {t("结径", "Knot Size", isEnglish)}
                    </label>
                    <input
                      type="text"
                      value={knotSize}
                      onChange={(e) => setKnotSize(e.target.value)}
                      placeholder="26mm"
                      className={inputClass}
                    />
                  </div>
                </div>

                {brushMaterial === "獾毛" && (
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                        {t("獾毛处理", "Badger Tips", isEnglish)}
                      </label>
                      <select
                        value={badgerTreatment}
                        onChange={(e) =>
                          setBadgerTreatment(
                            e.target.value as BadgerTreatment | ""
                          )
                        }
                        className={selectClass}
                      >
                        <option
                          value=""
                          className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                        >
                          {t("未标注", "None", isEnglish)}
                        </option>
                        {ALL_BADGER_TREATMENTS.map((bt) => (
                          <option
                            key={bt}
                            value={bt}
                            className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                          >
                            {badgerTreatmentDisplay(bt, isEnglish)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[12.5px] text-[var(--wsj-text-secondary)]">
                        {t("獾毛段数", "Badger Band", isEnglish)}
                      </label>
                      <select
                        value={badgerBand}
                        onChange={(e) =>
                          setBadgerBand(e.target.value as BadgerBand | "")
                        }
                        className={selectClass}
                      >
                        <option
                          value=""
                          className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                        >
                          {t("未标注", "None", isEnglish)}
                        </option>
                        {ALL_BADGER_BANDS.map((bb) => (
                          <option
                            key={bb}
                            value={bb}
                            className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                          >
                            {badgerBandDisplay(bb, isEnglish)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* 3. 详细参数 / 备注 */}
          <SectionCard>
            <div className="space-y-2.5">
              <h3 className="text-[15.5px] font-semibold text-[var(--wsj-text)]">
                {t("详细参数 / 备注", "Detailed Specs & Notes", isEnglish)}
              </h3>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t(
                  "露刃量、刀隙详述、克重、入手来源或个人使用备注...",
                  "Blade exposure, weight, provenance, or personal notes...",
                  isEnglish
                )}
                className={`${inputClass} resize-y`}
              />
            </div>
          </SectionCard>

          {/* 4. 合并与拆分（编辑已有器材时显示） */}
          {item && (
            <SectionCard>
              <div className="space-y-4">
                <h3 className="text-[15.5px] font-semibold text-[var(--wsj-text)]">
                  {t("合并与拆分", "Merge & Split", isEnglish)}
                </h3>

                {/* 合并到目标器材 */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    aria-label={t("选择合并目标", "Select merge target", isEnglish)}
                    value={mergeTargetID}
                    onChange={(e) => setMergeTargetID(e.target.value)}
                    className="min-w-0 flex-1 cursor-pointer rounded-[9px] border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-3 py-2 text-[13px] text-[var(--wsj-text)] outline-none focus:border-[var(--wsj-accent)]"
                  >
                    <option
                      value=""
                      className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                    >
                      {t(
                        "选择要合并到的目标器材...",
                        "Merge into another item...",
                        isEnglish
                      )}
                    </option>
                    {mergeCandidates.map((cand) => (
                      <option
                        key={cand.id}
                        value={cand.id}
                        className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                      >
                        [{brandDisplay(cand.brand, isEnglish)}] {cand.name} (
                        {cand.count})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={!mergeTargetID || isReadOnlyProtected}
                    onClick={() => setShowMergeConfirm(true)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3.5 py-2 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
                  >
                    <GitMerge className="h-3.5 w-3.5 text-[var(--wsj-accent)]" />
                    {t("合并到目标", "Merge", isEnglish)}
                  </button>
                </div>

                {/* 关联原始写法列表与拆分 */}
                <div className="border-t border-[var(--wsj-border)] pt-3.5">
                  <div className="mb-2 text-[12.5px] font-medium text-[var(--wsj-text-secondary)]">
                    {t(
                      `关联原始写法（${item.rawKeys.length}）`,
                      `Linked Raw Entries (${item.rawKeys.length})`,
                      isEnglish
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {item.rawKeys.map((rk) => {
                      const sample = getGearRawEntrySamples(rk, item.category);
                      return (
                        <div
                          key={rk}
                          className="flex items-center gap-2 rounded-[9px] bg-[var(--wsj-subtle)] px-3 py-2"
                        >
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--wsj-text)]">
                            {sample.display}
                          </span>
                          {sample.count > 0 && (
                            <TagPill
                              text={t(
                                `${sample.count} 次`,
                                `${sample.count}`,
                                isEnglish
                              )}
                              tone="neutral"
                            />
                          )}
                          {item.rawKeys.length > 1 && (
                            <button
                              type="button"
                              disabled={isReadOnlyProtected}
                              onClick={() => setRawKeyToSplit(rk)}
                              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-2.5 py-1 text-[12px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
                            >
                              <Split className="h-3 w-3" />
                              {t("拆分", "Split", isEnglish)}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="border-t border-[var(--wsj-border)] bg-[var(--wsj-card)] px-6 py-3.5">
          {saveError && (
            <div className="mb-2.5 flex items-center gap-2 text-[12.5px] text-[#CC3D3D]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="break-words">{saveError}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div>
              {item && (
                <button
                  type="button"
                  disabled={isReadOnlyProtected}
                  onClick={() => {
                    setSaveError(null);
                    setDeleteTarget(item);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#CC3D3D]/35 bg-[#CC3D3D]/8 px-3 py-1.5 text-[13px] font-medium text-[#CC3D3D] transition hover:bg-[#CC3D3D]/15 disabled:opacity-45"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("删除器材", "Delete Gear", isEnglish)}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-subtle)] px-4 py-1.5 text-[13.5px] font-medium text-[var(--wsj-text)] transition hover:opacity-85"
              >
                {t("取消", "Cancel", isEnglish)}
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="rounded-lg bg-[var(--wsj-accent)] px-4 py-1.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
              >
                {t("保存", "Save", isEnglish)}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* 合并二次确认弹窗 */}
      <ConfirmDialog
        open={showMergeConfirm && Boolean(item) && Boolean(selectedMergeTarget)}
        title={t("确认合并器材？", "Merge Gear?", isEnglish)}
        description={
          item && selectedMergeTarget
            ? t(
                `将「${item.name}」合并至「${selectedMergeTarget.name}」，合并前会自动备份 journal.json。`,
                `Merge "${item.name}" into "${selectedMergeTarget.name}". journal.json will be backed up first.`,
                isEnglish
              )
            : ""
        }
        confirmLabel={t("合并", "Merge", isEnglish)}
        cancelLabel={t("取消", "Cancel", isEnglish)}
        destructive
        onConfirm={() => void handleConfirmMerge()}
        onCancel={() => setShowMergeConfirm(false)}
      />

      {/* 拆分二次确认弹窗 */}
      <ConfirmDialog
        open={rawKeyToSplit !== null}
        title={t("拆分为独立器材？", "Split Into Separate Item?", isEnglish)}
        description={t(
          "该条原始写法将被拆出为独立新器材并标为待确认，拆分前会自动备份 journal.json。",
          "This raw entry will become a separate pending item. journal.json will be backed up first.",
          isEnglish
        )}
        confirmLabel={t("拆分", "Split", isEnglish)}
        cancelLabel={t("取消", "Cancel", isEnglish)}
        onConfirm={() => void handleConfirmSplit()}
        onCancel={() => setRawKeyToSplit(null)}
      />

      {/* 删除器材弹窗 */}
      <GearDeleteDialog
        item={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={onClose}
        onError={(err) => setSaveError(err)}
      />
    </div>
  );
};
