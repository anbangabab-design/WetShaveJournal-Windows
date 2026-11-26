import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Package,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { buildBrandGroups } from "../../lib/gearMutations";
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
  materialDisplay,
  plateTypeDisplay,
  razorTypeFullDisplay,
  razorTypeShortLabel,
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
  type BadgerBand,
  type BadgerTreatment,
  type BladeType,
  type BrandGroup,
  type BrushKnotShape,
  type BrushMaterial,
  type GearCategory,
  type GearItem,
  type GearStatus,
  type PlateType,
  type RazorType,
} from "../../types/journal";
import { BrandAvatar } from "../ui/BrandAvatar";
import { TagPill } from "../ui/TagPill";
import { AIHealthCheckModal } from "./AIHealthCheckModal";
import { GearCard } from "./GearCard";
import { GearDeleteDialog } from "./GearDeleteDialog";
import { GearEditorModal } from "./GearEditorModal";

type GearViewMode = "single" | "byBrand";

interface ContextMenuState {
  item: GearItem;
  x: number;
  y: number;
}

interface BrandSectionProps {
  group: BrandGroup;
  isEnglish: boolean;
  onSelectItem: (item: GearItem) => void;
  onContextMenu: (e: React.MouseEvent, item: GearItem) => void;
}

const BrandSection: React.FC<BrandSectionProps> = ({
  group,
  isEnglish,
  onSelectItem,
  onContextMenu,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="rounded-2xl border border-[var(--wsj-border)] bg-[var(--wsj-card)]/65 p-5">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-3 text-left"
      >
        <BrandAvatar brand={group.brand} size={30} />
        <span className="truncate text-[17px] font-bold text-[var(--wsj-text)]">
          {brandDisplay(group.brand, isEnglish)}
        </span>
        <TagPill
          text={t(`${group.items.length} 款`, `${group.items.length}`, isEnglish)}
          tone="neutral"
        />
        <TagPill
          text={t(`${group.totalUses} 次`, `${group.totalUses} uses`, isEnglish)}
          tone="accent"
        />
        <span className="ml-auto text-[var(--wsj-text-secondary)]">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(285px,1fr))] gap-3.5">
          {group.items.map((item) => (
            <GearCard
              key={item.id}
              item={item}
              isEnglish={isEnglish}
              onClick={onSelectItem}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const GearLibraryView: React.FC = () => {
  const {
    database,
    catalogSnapshot,
    isEnglish,
    isReadOnlyProtected,
    triggerMissingLogosFetch,
    undoLastGearChange,
  } = useJournal();

  useEffect(() => {
    void triggerMissingLogosFetch();
  }, [triggerMissingLogosFetch]);

  const [selectedCategory, setSelectedCategory] =
    useState<GearCategory>("剃须刀");
  const [viewMode, setViewMode] = useState<GearViewMode>("single");
  const [searchText, setSearchText] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);

  // 通用状态筛选
  const [filterStatus, setFilterStatus] = useState<GearStatus | "">("");

  // 剃须刀专属筛选
  const [filterRazorType, setFilterRazorType] = useState<RazorType | "">("");
  const [filterAdjustableOnly, setFilterAdjustableOnly] = useState(false);
  const [filterSlantOnly, setFilterSlantOnly] = useState(false);
  const [filterPlateType, setFilterPlateType] = useState<PlateType | "">("");
  const [filterMaterial, setFilterMaterial] = useState("");

  // 刀片专属筛选
  const [filterBladeType, setFilterBladeType] = useState<BladeType | "">("");

  // 剃须刷专属筛选
  const [filterBrushMaterial, setFilterBrushMaterial] = useState<
    BrushMaterial | ""
  >("");
  const [filterBadgerTreatment, setFilterBadgerTreatment] = useState<
    BadgerTreatment | ""
  >("");
  const [filterBadgerBand, setFilterBadgerBand] = useState<BadgerBand | "">("");
  const [filterKnotShape, setFilterKnotShape] = useState<BrushKnotShape | "">(
    ""
  );

  // 剃须皂 / 须后小样筛选
  const [filterSampleOnly, setFilterSampleOnly] = useState(false);

  // 弹窗与菜单状态
  const [editingItem, setEditingItem] = useState<GearItem | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAIAuditModal, setShowAIAuditModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<GearItem | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const rawItems = useMemo(
    () => catalogSnapshot.itemsByCategory[selectedCategory] ?? [],
    [catalogSnapshot, selectedCategory]
  );

  const availableMaterials = useMemo(() => {
    const set = new Set<string>();
    for (const item of rawItems) {
      const m = item.material?.trim();
      if (m) set.add(m);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rawItems]);

  const pendingCountInCategory = useMemo(
    () => rawItems.filter((i) => i.isPending).length,
    [rawItems]
  );

  const hasActiveFilters = Boolean(
    searchText.trim() ||
      onlyPending ||
      filterStatus ||
      filterRazorType ||
      filterAdjustableOnly ||
      filterSlantOnly ||
      filterPlateType ||
      filterMaterial ||
      filterBladeType ||
      filterBrushMaterial ||
      filterBadgerTreatment ||
      filterBadgerBand ||
      filterKnotShape ||
      filterSampleOnly
  );

  const filteredItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return rawItems.filter((item) => {
      if (onlyPending && !item.isPending) return false;
      if (filterStatus && item.status !== filterStatus) return false;

      if (selectedCategory === "剃须刀") {
        if (filterRazorType && item.razorType !== filterRazorType) return false;
        if (filterAdjustableOnly && !item.isAdjustable) return false;
        if (filterSlantOnly && !item.isSlant) return false;
        if (filterPlateType && item.plateType !== filterPlateType) return false;
        if (filterMaterial && item.material !== filterMaterial) return false;
      } else if (selectedCategory === "刀片") {
        if (filterBladeType && item.bladeType !== filterBladeType) return false;
      } else if (selectedCategory === "剃须刷") {
        if (filterBrushMaterial && item.brushMaterial !== filterBrushMaterial) {
          return false;
        }
        if (!filterBrushMaterial || filterBrushMaterial === "獾毛") {
          if (
            filterBadgerTreatment &&
            item.badgerTreatment !== filterBadgerTreatment
          ) {
            return false;
          }
          if (filterBadgerBand && item.badgerBand !== filterBadgerBand) {
            return false;
          }
        }
        if (filterKnotShape && item.knotShape !== filterKnotShape) return false;
      } else if (categorySupportsSample(selectedCategory)) {
        if (filterSampleOnly && !item.isSample) return false;
      }

      if (!q) return true;
      const matMatch = item.material
        ? item.material.toLowerCase().includes(q) ||
          materialDisplay(item.material, isEnglish).toLowerCase().includes(q)
        : false;
      return (
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        brandDisplay(item.brand, isEnglish).toLowerCase().includes(q) ||
        item.model.toLowerCase().includes(q) ||
        (item.handleBrand?.toLowerCase().includes(q) ?? false) ||
        matMatch ||
        (item.gapOrSpec?.toLowerCase().includes(q) ?? false) ||
        (item.notes?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [
    rawItems,
    searchText,
    onlyPending,
    filterStatus,
    selectedCategory,
    filterRazorType,
    filterAdjustableOnly,
    filterSlantOnly,
    filterPlateType,
    filterMaterial,
    filterBladeType,
    filterBrushMaterial,
    filterBadgerTreatment,
    filterBadgerBand,
    filterKnotShape,
    filterSampleOnly,
    isEnglish,
  ]);

  const groupedByBrand = useMemo(
    () => buildBrandGroups(filteredItems),
    [filteredItems]
  );

  // 关闭右键菜单
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

  const resetCategoryFilters = () => {
    setFilterRazorType("");
    setFilterAdjustableOnly(false);
    setFilterSlantOnly(false);
    setFilterPlateType("");
    setFilterMaterial("");
    setFilterBladeType("");
    setFilterBrushMaterial("");
    setFilterBadgerTreatment("");
    setFilterBadgerBand("");
    setFilterKnotShape("");
    setFilterSampleOnly(false);
    setFilterStatus("");
    setOnlyPending(false);
  };

  const resetAllFilters = () => {
    setSearchText("");
    resetCategoryFilters();
  };

  const handleCardContextMenu = (e: React.MouseEvent, item: GearItem) => {
    e.preventDefault();
    setContextMenu({
      item,
      x: Math.min(e.clientX, window.innerWidth - 170),
      y: Math.min(e.clientY, window.innerHeight - 105),
    });
  };

  const filterSelectClass = (active: boolean) =>
    `cursor-pointer rounded-full border-0 px-3 py-1.5 text-[12.5px] outline-none transition ${
      active
        ? "bg-[var(--wsj-accent-soft)] font-semibold text-[var(--wsj-accent)]"
        : "bg-[var(--wsj-subtle)] font-medium text-[var(--wsj-text)] hover:opacity-85"
    }`;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* 顶部控制栏：7 大品类切换 + 排序/分组 + 撤销 + 新增 */}
      <div className="shrink-0 space-y-3 border-b border-[var(--wsj-border)] bg-[var(--wsj-canvas)] px-6 py-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 7 大品类胶囊 */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {ALL_GEAR_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              const count = (catalogSnapshot.itemsByCategory[cat] ?? []).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    resetCategoryFilters();
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] transition ${
                    active
                      ? "border-transparent bg-[var(--wsj-accent)] font-semibold text-white"
                      : "border-[var(--wsj-border)] bg-[var(--wsj-card)] font-medium text-[var(--wsj-text)] hover:bg-[var(--wsj-subtle)]"
                  }`}
                >
                  <span>{categoryPluralName(cat, isEnglish)}</span>
                  <span
                    className={`font-mono text-[11.5px] ${
                      active
                        ? "text-white/80"
                        : "text-[var(--wsj-text-tertiary)]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 排序 / 分组模式切换 */}
          <div className="inline-flex shrink-0 rounded-[10px] bg-[var(--wsj-subtle)] p-1">
            <button
              type="button"
              onClick={() => setViewMode("single")}
              className={`rounded-lg px-3 py-1 text-[12.5px] font-medium transition ${
                viewMode === "single"
                  ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                  : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
              }`}
            >
              {t("按使用次数", "By Uses", isEnglish)}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("byBrand")}
              className={`rounded-lg px-3 py-1 text-[12.5px] font-medium transition ${
                viewMode === "byBrand"
                  ? "bg-[var(--wsj-card)] text-[var(--wsj-text)] shadow-sm"
                  : "text-[var(--wsj-text-secondary)] hover:text-[var(--wsj-text)]"
              }`}
            >
              {t("按品牌", "By Brand", isEnglish)}
            </button>
          </div>

          {/* 撤销上次修改 */}
          {database.history.length > 0 && (
            <button
              type="button"
              disabled={isReadOnlyProtected}
              onClick={() => void undoLastGearChange()}
              title={t("撤销上次器材修改", "Undo last gear change", isEnglish)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
            >
              <Undo2 className="h-3.5 w-3.5 text-[var(--wsj-text-secondary)]" />
              {t("撤销", "Undo", isEnglish)}
            </button>
          )}

          {/* AI 体检 */}
          <button
            type="button"
            disabled={isReadOnlyProtected}
            onClick={() => setShowAIAuditModal(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--wsj-accent)]" />
            {t("AI 体检", "AI Audit", isEnglish)}
          </button>

          {/* 新增器材 */}
          <button
            type="button"
            disabled={isReadOnlyProtected}
            onClick={() => setShowNewModal(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
          >
            <Plus className="h-3.5 w-3.5 text-[var(--wsj-accent)]" />
            {t("新增", "Add", isEnglish)}
          </button>
        </div>

        {/* 搜索栏 + 品类专属筛选条 + 清除筛选 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-[245px] shrink-0 items-center gap-2 rounded-[10px] border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3 py-[7px] transition focus-within:border-[var(--wsj-accent)]">
            <Search className="h-3.5 w-3.5 shrink-0 text-[var(--wsj-text-secondary)]" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t(
                "搜索品牌、型号、材质、手柄...",
                "Search brand, model, spec...",
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

          {/* 待确认筛选 */}
          {(pendingCountInCategory > 0 || onlyPending) && (
            <button
              type="button"
              onClick={() => setOnlyPending((prev) => !prev)}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${
                onlyPending
                  ? "border-[#D1851F]/45 bg-[#D1851F]/15 font-semibold text-[#B97214] dark:text-[#E8A94B]"
                  : "border-transparent bg-[var(--wsj-subtle)] font-medium text-[var(--wsj-text)] hover:opacity-85"
              }`}
            >
              {t(
                `待确认 (${pendingCountInCategory})`,
                `Pending (${pendingCountInCategory})`,
                isEnglish
              )}
            </button>
          )}

          {/* 状态筛选 */}
          <select
            aria-label={t("状态筛选", "Status filter", isEnglish)}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as GearStatus | "")}
            className={filterSelectClass(Boolean(filterStatus))}
          >
            <option
              value=""
              className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
            >
              {t("状态", "Status", isEnglish)}
            </option>
            {gearStatusOptions(selectedCategory).map((st) => (
              <option
                key={st}
                value={st}
                className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
              >
                {gearStatusDisplay(st, isEnglish)}
              </option>
            ))}
          </select>

          {/* 剃须皂 / 须后：分装/小样 */}
          {categorySupportsSample(selectedCategory) && (
            <button
              type="button"
              onClick={() => setFilterSampleOnly((prev) => !prev)}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${
                filterSampleOnly
                  ? "border-[#5280B8]/45 bg-[#5280B8]/15 font-semibold text-[#436FA4] dark:text-[#7BA8DC]"
                  : "border-transparent bg-[var(--wsj-subtle)] font-medium text-[var(--wsj-text)] hover:opacity-85"
              }`}
            >
              {t("分装 / 小样", "Sample", isEnglish)}
            </button>
          )}

          {/* 剃须刀专属筛选 */}
          {selectedCategory === "剃须刀" && (
            <>
              <select
                aria-label={t("刀型筛选", "Razor type filter", isEnglish)}
                value={filterRazorType}
                onChange={(e) =>
                  setFilterRazorType(e.target.value as RazorType | "")
                }
                className={filterSelectClass(Boolean(filterRazorType))}
              >
                <option
                  value=""
                  className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                >
                  {t("刀型", "Type", isEnglish)}
                </option>
                {ALL_RAZOR_TYPES.map((rt) => (
                  <option
                    key={rt}
                    value={rt}
                    className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                  >
                    {filterRazorType === rt
                      ? razorTypeShortLabel(rt, isEnglish)
                      : razorTypeFullDisplay(rt, isEnglish)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setFilterAdjustableOnly((prev) => !prev)}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${
                  filterAdjustableOnly
                    ? "border-[var(--wsj-accent)]/40 bg-[var(--wsj-accent-soft)] font-semibold text-[var(--wsj-accent)]"
                    : "border-transparent bg-[var(--wsj-subtle)] font-medium text-[var(--wsj-text)] hover:opacity-85"
                }`}
              >
                {t("可调", "Adjustable", isEnglish)}
              </button>

              <button
                type="button"
                onClick={() => setFilterSlantOnly((prev) => !prev)}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${
                  filterSlantOnly
                    ? "border-[var(--wsj-accent)]/40 bg-[var(--wsj-accent-soft)] font-semibold text-[var(--wsj-accent)]"
                    : "border-transparent bg-[var(--wsj-subtle)] font-medium text-[var(--wsj-text)] hover:opacity-85"
                }`}
              >
                Slant
              </button>

              <select
                aria-label={t("底板筛选", "Plate type filter", isEnglish)}
                value={filterPlateType}
                onChange={(e) =>
                  setFilterPlateType(e.target.value as PlateType | "")
                }
                className={filterSelectClass(Boolean(filterPlateType))}
              >
                <option
                  value=""
                  className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                >
                  {t("底板", "Plate", isEnglish)}
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

              {availableMaterials.length > 0 && (
                <select
                  aria-label={t("材质筛选", "Material filter", isEnglish)}
                  value={filterMaterial}
                  onChange={(e) => setFilterMaterial(e.target.value)}
                  className={filterSelectClass(Boolean(filterMaterial))}
                >
                  <option
                    value=""
                    className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                  >
                    {t("材质", "Material", isEnglish)}
                  </option>
                  {availableMaterials.map((mat) => (
                    <option
                      key={mat}
                      value={mat}
                      className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                    >
                      {materialDisplay(mat, isEnglish)}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}

          {/* 刀片专属筛选 */}
          {selectedCategory === "刀片" && (
            <select
              aria-label={t("刀片类型筛选", "Blade type filter", isEnglish)}
              value={filterBladeType}
              onChange={(e) =>
                setFilterBladeType(e.target.value as BladeType | "")
              }
              className={filterSelectClass(Boolean(filterBladeType))}
            >
              <option
                value=""
                className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
              >
                {t("刀片类型", "Blade Type", isEnglish)}
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
          )}

          {/* 剃须刷专属筛选 */}
          {selectedCategory === "剃须刷" && (
            <>
              <select
                aria-label={t("刷毛筛选", "Hair filter", isEnglish)}
                value={filterBrushMaterial}
                onChange={(e) => {
                  const val = e.target.value as BrushMaterial | "";
                  setFilterBrushMaterial(val);
                  if (val && val !== "獾毛") {
                    setFilterBadgerTreatment("");
                    setFilterBadgerBand("");
                  }
                }}
                className={filterSelectClass(Boolean(filterBrushMaterial))}
              >
                <option
                  value=""
                  className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                >
                  {t("刷毛", "Hair", isEnglish)}
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

              {(!filterBrushMaterial || filterBrushMaterial === "獾毛") && (
                <>
                  <select
                    aria-label={t("獾毛处理筛选", "Tips filter", isEnglish)}
                    value={filterBadgerTreatment}
                    onChange={(e) =>
                      setFilterBadgerTreatment(
                        e.target.value as BadgerTreatment | ""
                      )
                    }
                    className={filterSelectClass(Boolean(filterBadgerTreatment))}
                  >
                    <option
                      value=""
                      className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                    >
                      {t("处理", "Tips", isEnglish)}
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

                  <select
                    aria-label={t("獾毛段数筛选", "Band filter", isEnglish)}
                    value={filterBadgerBand}
                    onChange={(e) =>
                      setFilterBadgerBand(e.target.value as BadgerBand | "")
                    }
                    className={filterSelectClass(Boolean(filterBadgerBand))}
                  >
                    <option
                      value=""
                      className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                    >
                      {t("段数", "Band", isEnglish)}
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
                </>
              )}

              <select
                aria-label={t("刷型筛选", "Shape filter", isEnglish)}
                value={filterKnotShape}
                onChange={(e) =>
                  setFilterKnotShape(e.target.value as BrushKnotShape | "")
                }
                className={filterSelectClass(Boolean(filterKnotShape))}
              >
                <option
                  value=""
                  className="bg-[var(--wsj-card)] text-[var(--wsj-text)]"
                >
                  {t("刷型", "Shape", isEnglish)}
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
            </>
          )}

          {/* 任意筛选激活时自动显示清除筛选按钮 */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--wsj-accent)] transition hover:bg-[var(--wsj-accent-soft)]"
            >
              {t("清除筛选", "Clear Filters", isEnglish)}
            </button>
          )}

          <span className="ml-auto rounded-full bg-[var(--wsj-pill)] px-2.5 py-1 font-mono text-[12px] font-medium text-[var(--wsj-text-secondary)]">
            {t(
              `${filteredItems.length} 件`,
              `${filteredItems.length}`,
              isEnglish
            )}
          </span>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {filteredItems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Package className="h-10 w-10 text-[var(--wsj-text-tertiary)]" />
            <div className="mt-3 text-[16px] font-semibold text-[var(--wsj-text)]">
              {t(
                `无符合条件的${categoryPluralName(selectedCategory, false)}`,
                `No Matching ${categoryPluralName(selectedCategory, true)}`,
                isEnglish
              )}
            </div>
            <p className="mt-1 text-[13px] text-[var(--wsj-text-secondary)]">
              {hasActiveFilters
                ? t(
                    "尝试调整关键词或清除筛选条件",
                    "Try adjusting your search or clearing filters",
                    isEnglish
                  )
                : t(
                    "点击右上角「新增」手动添加器材，或在日记中使用后自动归档",
                    "Click Add to create gear manually, or log an SOTD entry to auto-populate",
                    isEnglish
                  )}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-4 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-4 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)]"
              >
                {t("清除筛选", "Clear Filters", isEnglish)}
              </button>
            )}
          </div>
        ) : viewMode === "single" ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(295px,1fr))] gap-4">
            {filteredItems.map((item) => (
              <GearCard
                key={item.id}
                item={item}
                isEnglish={isEnglish}
                onClick={setEditingItem}
                onContextMenu={handleCardContextMenu}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {groupedByBrand.map((group) => (
              <BrandSection
                key={group.brand}
                group={group}
                isEnglish={isEnglish}
                onSelectItem={setEditingItem}
                onContextMenu={handleCardContextMenu}
              />
            ))}
          </div>
        )}
      </div>

      {/* 卡片右键菜单 */}
      {contextMenu && (
        <div
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-50 w-40 overflow-hidden rounded-xl border border-[var(--wsj-border)] bg-[var(--wsj-card)] p-1 shadow-2xl"
        >
          <button
            type="button"
            onClick={() => {
              const target = contextMenu.item;
              setContextMenu(null);
              setEditingItem(target);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)]"
          >
            <Pencil className="h-3.5 w-3.5 text-[var(--wsj-text-secondary)]" />
            {t("编辑器材", "Edit Gear", isEnglish)}
          </button>

          <div className="my-1 border-t border-[var(--wsj-border)]" />

          <button
            type="button"
            disabled={isReadOnlyProtected}
            onClick={() => {
              const target = contextMenu.item;
              setContextMenu(null);
              setItemToDelete(target);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[#CC3D3D] transition hover:bg-[#CC3D3D]/10 disabled:opacity-45"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("删除器材", "Delete Gear", isEnglish)}
          </button>
        </div>
      )}

      {/* 编辑器材弹窗 */}
      <GearEditorModal
        open={editingItem !== null}
        item={editingItem}
        defaultCategory={selectedCategory}
        onClose={() => setEditingItem(null)}
      />

      {/* 新增器材弹窗 */}
      <GearEditorModal
        open={showNewModal}
        item={null}
        defaultCategory={selectedCategory}
        onClose={() => setShowNewModal(false)}
      />

      {/* AI 器材库体检弹窗 */}
      <AIHealthCheckModal
        open={showAIAuditModal}
        initialCategory={selectedCategory}
        onClose={() => setShowAIAuditModal(false)}
      />

      {/* 删除器材弹窗 */}
      <GearDeleteDialog
        item={itemToDelete}
        onClose={() => setItemToDelete(null)}
      />
    </div>
  );
};
