/** 对齐 Mac UpdateReleaseParser.localizedReleaseNotes：按语言自动截取 ## English / ## 简体中文 分段 */
export function extractLocalizedReleaseNotes(
  rawBody: string,
  isEnglish: boolean
): string {
  const normalized = rawBody.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");

  const sections: { lang: "zh" | "en"; startLine: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith("## ")) continue;
    const heading = trimmed.slice(3).trim().toLowerCase();
    if (heading === "english") {
      sections.push({ lang: "en", startLine: i });
    } else if (heading === "简体中文" || heading === "中文") {
      sections.push({ lang: "zh", startLine: i });
    }
  }

  const hasEn = sections.some((s) => s.lang === "en");
  const hasZh = sections.some((s) => s.lang === "zh");
  if (!hasEn || !hasZh) {
    return normalized.trim();
  }

  const targetLang = isEnglish ? "en" : "zh";
  const targetSection = sections.find((s) => s.lang === targetLang);
  if (!targetSection) {
    return normalized.trim();
  }

  const contentStart = targetSection.startLine + 1;
  let contentEnd = lines.length;
  for (let i = contentStart; i < lines.length; i++) {
    if (lines[i].trim().startsWith("## ")) {
      contentEnd = i;
      break;
    }
  }

  if (contentStart >= contentEnd) {
    return normalized.trim();
  }
  const sliced = lines.slice(contentStart, contentEnd).join("\n").trim();
  return sliced || normalized.trim();
}

export function formatBytesMB(bytes: number): string {
  const mb = Math.max(0, bytes) / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}
