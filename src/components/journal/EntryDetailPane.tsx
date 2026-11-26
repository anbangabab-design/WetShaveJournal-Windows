import React from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";
import {
  getDisplayModel,
  getSpecTags,
  parseBladeUsage,
} from "../../lib/gearKnowledge";
import {
  brandDisplay,
  categorySingularName,
  handleTag,
  irritationDisplay,
  latheringDisplay,
  loadingDisplay,
  ordinal,
  passDisplay,
  shaveResultFullDescription,
  t,
} from "../../lib/l10n";
import {
  getAfterShave,
  getAfterShower,
  getAlum,
  getBowl,
  getBrush,
  getFieldValues,
  getHotTowel,
  getLoadingMethod,
  getPreShave,
  getPureLatheringMethod,
  getSoap,
} from "../../lib/processParser";
import { useJournal } from "../../store/JournalContext";
import type {
  GearCategory,
  IrritationLevel,
  JournalEntry,
} from "../../types/journal";
import { BrandAvatar } from "../ui/BrandAvatar";
import { SectionCard } from "../ui/SectionCard";
import { TagPill, type TagTone } from "../ui/TagPill";

interface EntryDetailPaneProps {
  entry: JournalEntry;
  onCopySOTD: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function irritationTone(level: IrritationLevel | null): TagTone {
  if (level === "无痛") return "forest";
  if (level === "微痛") return "amber";
  if (level === "刺痛") return "crimson";
  return "neutral";
}

interface GearMiniTileProps {
  category: GearCategory;
  rawValue: string;
}

const GearMiniTile: React.FC<GearMiniTileProps> = ({ category, rawValue }) => {
  const { resolveGearItem, isEnglish } = useJournal();
  const { override: ov } = resolveGearItem(category, rawValue);
  const bladeParsed =
    category === "刀片" ? parseBladeUsage(rawValue) : { baseName: rawValue, useCount: null };
  const specTags = getSpecTags(category, ov, isEnglish, true);
  const modelText = getDisplayModel(ov);

  return (
    <div className="flex h-full flex-col gap-2.5 rounded-[11px] bg-[var(--wsj-subtle)] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-[var(--wsj-text-secondary)]">
          {categorySingularName(category, isEnglish)}
        </span>
        {bladeParsed.useCount !== null && (
          <TagPill
            text={
              isEnglish
                ? ordinal(bladeParsed.useCount)
                : `第 ${bladeParsed.useCount} 次`
            }
            tone="accent"
          />
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <BrandAvatar brand={ov.brand} size={22} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--wsj-text-secondary)]">
            <span className="truncate">{brandDisplay(ov.brand, isEnglish)}</span>
            {category === "剃须刷" && ov.handleBrand && (
              <>
                <span className="text-[var(--wsj-text-tertiary)]">×</span>
                <span className="truncate">
                  {handleTag(ov.handleBrand, isEnglish)}
                </span>
              </>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="truncate text-[14.5px] font-semibold text-[var(--wsj-text)]">
              {modelText}
            </span>
            {category === "剃须刷" && ov.knotSize && (
              <span className="shrink-0 rounded-full bg-[var(--wsj-accent-soft)] px-2 py-0.5 font-mono text-[11.5px] font-bold text-[var(--wsj-accent)]">
                {ov.knotSize}
              </span>
            )}
          </div>
        </div>
      </div>

      {specTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {specTags.map((tag, idx) => (
            <TagPill key={`${tag}-${idx}`} text={tag} tone="neutral" />
          ))}
        </div>
      )}
    </div>
  );
};

export const EntryDetailPane: React.FC<EntryDetailPaneProps> = ({
  entry,
  onCopySOTD,
  onEdit,
  onDelete,
}) => {
  const { getParsedProcess, isEnglish, isReadOnlyProtected } = useJournal();
  const proc = getParsedProcess(entry);

  const razors = getFieldValues(entry, ["剃须刀"]);
  const blades = getFieldValues(entry, ["刀片"]);
  const brush = getBrush(entry);
  const soap = getSoap(entry);
  const bowl = getBowl(entry);
  const preShave = getPreShave(entry);
  const afterShave = getAfterShave(entry);
  const loading = getLoadingMethod(entry);
  const pureLather = getPureLatheringMethod(entry);
  const hotTowel = getHotTowel(entry);
  const afterShower = getAfterShower(entry).startsWith("是");
  const alum = getAlum(entry).startsWith("是");

  const hasAnyGear =
    razors.length > 0 ||
    blades.length > 0 ||
    Boolean(brush) ||
    Boolean(soap) ||
    Boolean(bowl) ||
    (Boolean(preShave) && preShave !== "无") ||
    (Boolean(afterShave) && afterShave !== "无");

  return (
    <div className="h-full flex-1 overflow-y-auto px-7 py-6">
      <div className="mx-auto max-w-[920px] space-y-6">
        {/* 顶部标题栏 + 复制 SOTD / 编辑 / 删除 */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2.5">
            <h1 className="text-[26px] font-bold tracking-tight text-[var(--wsj-text)]">
              SOTD · {entry.date}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5">
              {proc.result && (
                <TagPill
                  text={shaveResultFullDescription(proc.result, isEnglish)}
                  tone="forest"
                  filled
                />
              )}
              {proc.irritation && (
                <TagPill
                  text={irritationDisplay(proc.irritation, isEnglish)}
                  tone={irritationTone(proc.irritation)}
                />
              )}
              {hotTowel && (
                <TagPill text={t("热敷", "Hot Towel", isEnglish)} tone="neutral" />
              )}
              {afterShower && (
                <TagPill
                  text={t("浴后", "Post-Shower", isEnglish)}
                  tone="neutral"
                />
              )}
              {alum && (
                <TagPill text={t("明矾", "Alum", isEnglish)} tone="neutral" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopySOTD}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)]"
            >
              <Copy className="h-3.5 w-3.5" />
              {t("复制 SOTD", "Copy SOTD", isEnglish)}
            </button>

            <button
              type="button"
              disabled={isReadOnlyProtected}
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] px-3 py-1.5 text-[13px] font-medium text-[var(--wsj-text)] transition hover:bg-[var(--wsj-subtle)] disabled:opacity-45"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t("编辑", "Edit", isEnglish)}
            </button>

            <button
              type="button"
              disabled={isReadOnlyProtected}
              onClick={onDelete}
              title={t("删除", "Delete", isEnglish)}
              aria-label={t("删除", "Delete", isEnglish)}
              className="inline-flex items-center justify-center rounded-lg border border-[var(--wsj-border)] bg-[var(--wsj-card)] p-2 text-[#CC3D3D] transition hover:bg-[#CC3D3D]/10 disabled:opacity-45"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 本日装备（含独立剃须碗栏位） */}
        <SectionCard>
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-[var(--wsj-text)]">
              {t("本日装备", "Setup", isEnglish)}
            </h2>

            {hasAnyGear ? (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {razors.map((raw, idx) => (
                  <GearMiniTile
                    key={`razor-${idx}-${raw}`}
                    category="剃须刀"
                    rawValue={raw}
                  />
                ))}
                {blades.map((raw, idx) => (
                  <GearMiniTile
                    key={`blade-${idx}-${raw}`}
                    category="刀片"
                    rawValue={raw}
                  />
                ))}
                {brush && <GearMiniTile category="剃须刷" rawValue={brush} />}
                {soap && <GearMiniTile category="剃须皂" rawValue={soap} />}
                {bowl && <GearMiniTile category="剃须碗" rawValue={bowl} />}
                {preShave && preShave !== "无" && (
                  <GearMiniTile category="须前" rawValue={preShave} />
                )}
                {afterShave && afterShave !== "无" && (
                  <GearMiniTile category="须后" rawValue={afterShave} />
                )}
              </div>
            ) : (
              <p className="text-[13.5px] text-[var(--wsj-text-secondary)]">
                {t("本篇未记录装备信息", "No gear recorded for this entry", isEnglish)}
              </p>
            )}
          </div>
        </SectionCard>

        {/* 流程与过程 */}
        <SectionCard>
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-[var(--wsj-text)]">
              {t("流程与过程", "Shave Details", isEnglish)}
            </h2>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-[12.5px] text-[var(--wsj-text-secondary)]">
                  {t("取皂", "Loading", isEnglish)}
                </div>
                <div className="mt-1 text-[14.5px] font-semibold text-[var(--wsj-text)]">
                  {loading ? loadingDisplay(loading, isEnglish) : "—"}
                </div>
              </div>

              <div>
                <div className="text-[12.5px] text-[var(--wsj-text-secondary)]">
                  {t("起泡", "Lather", isEnglish)}
                </div>
                <div className="mt-1 text-[14.5px] font-semibold text-[var(--wsj-text)]">
                  {pureLather ? latheringDisplay(pureLather, isEnglish) : "—"}
                </div>
              </div>

              <div>
                <div className="text-[12.5px] text-[var(--wsj-text-secondary)]">
                  {t("热敷", "Hot Towel", isEnglish)}
                </div>
                <div className="mt-1 text-[14.5px] font-semibold text-[var(--wsj-text)]">
                  {hotTowel ? t("是", "Yes", isEnglish) : t("否", "No", isEnglish)}
                </div>
              </div>

              <div>
                <div className="text-[12.5px] text-[var(--wsj-text-secondary)]">
                  {t("浴后 / 明矾", "Shower / Alum", isEnglish)}
                </div>
                <div className="mt-1 text-[14.5px] font-semibold text-[var(--wsj-text)]">
                  {afterShower
                    ? t("浴后", "Shower", isEnglish)
                    : t("非浴后", "No Shower", isEnglish)}
                  {" · "}
                  {alum
                    ? t("明矾", "Alum", isEnglish)
                    : t("无明矾", "No Alum", isEnglish)}
                </div>
              </div>
            </div>

            {(proc.passes.length > 0 || Boolean(proc.note)) && (
              <div className="border-t border-[var(--wsj-border)] pt-4 space-y-3">
                {proc.passes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[13.5px] font-medium text-[var(--wsj-text-secondary)]">
                      {t("步骤", "Passes", isEnglish)}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {proc.passes.map((step) => (
                        <div
                          key={step.pass}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wsj-subtle)] px-3 py-1.5"
                        >
                          <span className="text-[13.5px] font-semibold text-[var(--wsj-text)]">
                            {passDisplay(step.pass, isEnglish)}
                          </span>
                          {step.setting && (
                            <span className="rounded-full bg-[var(--wsj-accent-soft)] px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-[var(--wsj-accent)]">
                              {isEnglish ? `#${step.setting}` : `${step.setting}档`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {proc.note && (
                  <div className="rounded-[9px] bg-[var(--wsj-subtle)] px-3.5 py-2.5 text-[14px] leading-relaxed text-[var(--wsj-text)]">
                    {proc.note}
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
