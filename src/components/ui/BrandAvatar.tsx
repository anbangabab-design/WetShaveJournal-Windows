import React, { useEffect, useState } from "react";
import { getBrandColor } from "../../lib/gearKnowledge";
import { useJournal } from "../../store/JournalContext";

interface BrandAvatarProps {
  brand: string;
  size?: number;
}

function getBrandInitials(brand: string): string {
  const trimmed = (brand || "").trim();
  if (!trimmed || trimmed === "品牌未注明" || trimmed === "无品牌") return "?";
  if (trimmed === "仿刀") return "仿";

  const firstChar = Array.from(trimmed)[0];
  if (firstChar && firstChar.codePointAt(0)! > 0x2e80) {
    return firstChar;
  }

  const words = trimmed
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words.length === 1) {
    return words[0].length <= 2
      ? words[0].toUpperCase()
      : words[0][0].toUpperCase();
  }
  return trimmed.slice(0, 1).toUpperCase();
}

export const BrandAvatar: React.FC<BrandAvatarProps> = ({
  brand,
  size = 24,
}) => {
  const { getBrandLogo } = useJournal();
  const logoUrl = getBrandLogo(brand);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [logoUrl]);

  if (logoUrl && !imgFailed) {
    const pad = Math.max(2, Math.round(size * 0.12));
    return (
      <span
        className="inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-[var(--wsj-border)] bg-white dark:bg-white/95"
        style={{
          width: size,
          height: size,
          padding: pad,
        }}
        aria-hidden="true"
      >
        <img
          src={logoUrl}
          alt=""
          draggable={false}
          onError={() => setImgFailed(true)}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  const bg = getBrandColor(brand);
  const label = getBrandInitials(brand);
  const fontSize = Math.max(
    9,
    Math.round(size * (label.length >= 2 ? 0.39 : 0.46))
  );

  return (
    <span
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundImage: `linear-gradient(135deg, ${bg}DB, ${bg})`,
        fontSize,
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
};
