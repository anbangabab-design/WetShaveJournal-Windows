import React from "react";
import { BarChart3 } from "lucide-react";
import { t } from "../../lib/l10n";
import { useJournal } from "../../store/JournalContext";
import { SectionCard } from "../ui/SectionCard";
import { TagPill } from "../ui/TagPill";

interface PlaceholderViewProps {
  section: "stats";
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({ section }) => {
  const { database, isEnglish } = useJournal();

  const meta = {
    stats: {
      icon: BarChart3,
      title: t("数据统计", "Statistics", isEnglish),
      badge: t("第 3 轮开发", "Planned · Round 3", isEnglish),
      summary: t(
        `已加载 ${database.entries.length} 篇湿剃日记。月度趋势、BBS 达成率、刀架×刀片组合胜率与刀片寿命图表将在后续版本上线。`,
        `${database.entries.length} entries loaded. Monthly trends, BBS rate, razor-blade combo matrices, and blade longevity charts are coming soon.`,
        isEnglish
      ),
    },
  }[section];

  const Icon = meta.icon;

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <SectionCard className="max-w-[460px] text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--wsj-accent-soft)] text-[var(--wsj-accent)]">
          <Icon className="h-6 w-6" />
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <h2 className="text-[18px] font-bold text-[var(--wsj-text)]">
            {meta.title}
          </h2>
          <TagPill text={meta.badge} tone="accent" />
        </div>

        <p className="mt-2.5 text-[13.5px] leading-relaxed text-[var(--wsj-text-secondary)]">
          {meta.summary}
        </p>
      </SectionCard>
    </div>
  );
};
