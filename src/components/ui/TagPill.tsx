import React from "react";

export type TagTone = "neutral" | "accent" | "forest" | "amber" | "crimson" | "slate";

interface TagPillProps {
  text: string;
  tone?: TagTone;
  filled?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<
  Exclude<TagTone, "neutral">,
  { soft: string; filled: string }
> = {
  accent: {
    soft: "bg-[#2973CC]/12 text-[#2973CC] dark:bg-[#3B88E8]/18 dark:text-[#66A8F5]",
    filled: "bg-[#2973CC] text-white dark:bg-[#3B88E8]",
  },
  forest: {
    soft: "bg-[#2E8F5C]/13 text-[#2E8F5C] dark:bg-[#2E8F5C]/22 dark:text-[#57C288]",
    filled: "bg-[#2E8F5C] text-white",
  },
  amber: {
    soft: "bg-[#D1851F]/14 text-[#B97214] dark:bg-[#D1851F]/22 dark:text-[#E8A94B]",
    filled: "bg-[#D1851F] text-white",
  },
  crimson: {
    soft: "bg-[#CC3D3D]/13 text-[#CC3D3D] dark:bg-[#CC3D3D]/22 dark:text-[#EF6B6B]",
    filled: "bg-[#CC3D3D] text-white",
  },
  slate: {
    soft: "bg-[#5280B8]/14 text-[#436FA4] dark:bg-[#5280B8]/22 dark:text-[#7BA8DC]",
    filled: "bg-[#5280B8] text-white",
  },
};

export const TagPill: React.FC<TagPillProps> = ({
  text,
  tone = "neutral",
  filled = false,
  className = "",
}) => {
  const toneClass =
    tone === "neutral"
      ? "bg-[var(--wsj-pill)] text-[var(--wsj-text)]/80"
      : filled
        ? TONE_CLASSES[tone].filled
        : TONE_CLASSES[tone].soft;

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-medium leading-tight ${toneClass} ${className}`}
    >
      {text}
    </span>
  );
};
