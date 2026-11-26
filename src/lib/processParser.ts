import type {
  IrritationLevel,
  JournalEntry,
  JournalField,
  ParsedProcess,
  PassStep,
  ShavePassType,
  ShaveResult,
} from "../types/journal";
import { passShortChar } from "./l10n";

const GLOBAL_SETTING_REGEX = /^(\d+(?:\.\d+)?)\s*档/;

const PASS_MATCHERS: {
  type: ShavePassType;
  char: string;
  beforeRegex: RegExp;
  afterRegex: RegExp;
}[] = (
  [
    ["顺刮", "顺"],
    ["横刮", "横"],
    ["逆刮", "逆"],
    ["补刀", "补"],
  ] as [ShavePassType, string][]
).map(([type, ch]) => ({
  type,
  char: ch,
  beforeRegex: new RegExp(`(\\d+(?:\\.\\d+)?)\\s*档?\\s*${ch}`),
  afterRegex: new RegExp(`${ch}\\s*(\\d+(?:\\.\\d+)?)`),
}));

const STRIP_REGEXES: RegExp[] = [
  /\b(?:BBS|DFS|CCS|SAS)\b/gi,
  /(?:BBS|DFS|CCS|SAS)/gi,
  /微微痛|无痛|微痛|刺痛/g,
  /[一二三四五六七八九十\d]+(?:\.\d+)?\s*档?/g,
  /顺刮|横刮|逆刮|补刀|[顺横逆补]/g,
];

const CN_NUM_PAIRS: [string, string][] = [
  ["一", "1"],
  ["二", "2"],
  ["三", "3"],
  ["四", "4"],
  ["五", "5"],
  ["六", "6"],
  ["七", "7"],
  ["八", "8"],
  ["九", "9"],
  ["十", "10"],
];

const NOTE_TRIM_EDGE_REGEX = /^[\s，,。.;；/+\-·]+|[\s，,。.;；/+\-·]+$/g;

/** 与 Mac 版 ProcessParser 100% 一致的过程文本解析器 */
export function parseProcessText(text: string): ParsedProcess {
  const trimmed = text.trim();
  if (!trimmed) {
    return { passes: [], result: null, irritation: null, note: "" };
  }

  let normalizedForPass = trimmed;
  for (const [cn, num] of CN_NUM_PAIRS) {
    if (normalizedForPass.includes(cn)) {
      normalizedForPass = normalizedForPass.split(cn).join(num);
    }
  }

  let result: ShaveResult | null = null;
  const upper = trimmed.toUpperCase();
  if (upper.includes("BBS")) result = "BBS";
  else if (upper.includes("DFS")) result = "DFS";
  else if (upper.includes("CCS")) result = "CCS";
  else if (upper.includes("SAS")) result = "SAS";

  let irritation: IrritationLevel | null = null;
  if (trimmed.includes("刺痛")) irritation = "刺痛";
  else if (trimmed.includes("微痛")) irritation = "微痛";
  else if (trimmed.includes("无痛")) irritation = "无痛";

  let globalSetting = "";
  const globalMatch = normalizedForPass.match(GLOBAL_SETTING_REGEX);
  if (globalMatch?.[1]) {
    globalSetting = globalMatch[1];
  }

  const passes: PassStep[] = [];
  for (const matcher of PASS_MATCHERS) {
    if (!normalizedForPass.includes(matcher.char)) continue;
    let setting = globalSetting;
    const beforeMatch = normalizedForPass.match(matcher.beforeRegex);
    const afterMatch = normalizedForPass.match(matcher.afterRegex);
    if (beforeMatch?.[1]) {
      setting = beforeMatch[1];
    } else if (afterMatch?.[1]) {
      setting = afterMatch[1];
    }
    passes.push({ pass: matcher.type, setting });
  }

  let leftover = trimmed;
  for (const regex of STRIP_REGEXES) {
    leftover = leftover.replace(regex, " ");
  }
  const trimmedLeftover = leftover.replace(NOTE_TRIM_EDGE_REGEX, "");
  const note = trimmedLeftover ? trimmedLeftover.replace(/\s+/g, " ") : "";

  return { passes, result, irritation, note };
}

/** 与 Mac 版 ParsedProcess.formattedString(isAdjustable:) 100% 一致 */
export function formatParsedProcess(
  parsed: ParsedProcess,
  isAdjustable: boolean
): string {
  const parts: string[] = [];
  for (const step of parsed.passes) {
    const cleanSetting = step.setting.trim();
    if (isAdjustable && cleanSetting) {
      parts.push(`${cleanSetting}${passShortChar(step.pass)}`);
    } else {
      parts.push(passShortChar(step.pass));
    }
  }
  let text = parts.join("");
  if (parsed.irritation) {
    text += parsed.irritation;
  }
  if (parsed.result) {
    text += parsed.result;
  }
  const trimmedNote = parsed.note.trim();
  if (trimmedNote) {
    text += (text ? " " : "") + trimmedNote;
  }
  return text;
}

// MARK: - JournalEntry 字段读取与就地合并（100% 兼容 Mac 版）

export function extractBowlName(lathering: string): string | null {
  const trimmed = lathering.trim();
  if (!trimmed) return null;
  if (
    trimmed === "脸起" ||
    trimmed === "手起" ||
    trimmed === "碗起" ||
    trimmed === "无"
  ) {
    return null;
  }
  if (trimmed.endsWith("碗起")) {
    const base = trimmed.slice(0, -2).trim();
    return base || null;
  }
  return trimmed;
}

export function getFieldValue(entry: JournalEntry, label: string): string {
  const found = entry.fields.find((f) => f.label === label);
  return found ? found.value.trim() : "";
}

function isDigitsOnly(str: string): boolean {
  return str.length > 0 && /^\d+$/.test(str);
}

export function getFieldValues(entry: JournalEntry, prefixes: string[]): string[] {
  const results: string[] = [];
  for (const field of entry.fields) {
    const trimmed = field.value.trim();
    if (!trimmed || trimmed === "无" || trimmed === "-") continue;
    for (const prefix of prefixes) {
      if (
        field.label === prefix ||
        (field.label.startsWith(prefix) &&
          isDigitsOnly(field.label.slice(prefix.length)))
      ) {
        results.push(trimmed);
        break;
      }
    }
  }
  return results;
}

export function getPrimaryRazor(entry: JournalEntry): string {
  return getFieldValue(entry, "剃须刀") || getFieldValue(entry, "剃须刀1");
}

export function getPrimaryBlade(entry: JournalEntry): string {
  return getFieldValue(entry, "刀片") || getFieldValue(entry, "刀片1");
}

export function getBrush(entry: JournalEntry): string {
  return getFieldValue(entry, "剃须刷");
}

export function getSoap(entry: JournalEntry): string {
  return getFieldValue(entry, "剃须皂");
}

export function getPreShave(entry: JournalEntry): string {
  return getFieldValue(entry, "须前");
}

export function getAfterShave(entry: JournalEntry): string {
  return getFieldValue(entry, "须后");
}

export function getProcessText(entry: JournalEntry): string {
  return getFieldValue(entry, "过程");
}

export function getLoadingMethod(entry: JournalEntry): string {
  return getFieldValue(entry, "取皂");
}

export function getLathering(entry: JournalEntry): string {
  return getFieldValue(entry, "起泡");
}

export function getAfterShower(entry: JournalEntry): string {
  return getFieldValue(entry, "是否浴后");
}

export function getAlum(entry: JournalEntry): string {
  return getFieldValue(entry, "是否明矾");
}

export function getBowl(entry: JournalEntry): string {
  const explicit = getFieldValue(entry, "剃须碗");
  if (explicit && explicit !== "无" && explicit !== "-") {
    return explicit;
  }
  return extractBowlName(getLathering(entry)) ?? "";
}

export function getPureLatheringMethod(entry: JournalEntry): string {
  const raw = getLathering(entry).trim();
  const bowl = getBowl(entry);
  if (!raw) {
    return bowl ? "碗起" : "";
  }
  if (raw === "脸起" || raw === "手起" || raw === "碗起") {
    return raw;
  }
  if (raw.endsWith("碗起") || bowl) {
    return "碗起";
  }
  return raw;
}

export function getHotTowel(entry: JournalEntry): boolean {
  const explicit = getFieldValue(entry, "是否热敷");
  if (explicit === "是") return true;
  if (explicit === "否") return false;
  return (
    getAfterShower(entry).includes("热敷") ||
    getPreShave(entry).includes("热敷") ||
    getProcessText(entry).includes("热敷")
  );
}

export interface BuildMergedFieldsInput {
  existingEntry: JournalEntry | null;
  dateStr: string;
  razor: string;
  blade: string;
  brush: string;
  soap: string;
  bowl: string;
  preShave: string;
  afterShave: string;
  afterShower: boolean;
  hotTowel: boolean;
  useAlum: boolean;
  processText: string;
  loadingMethod: string;
  latheringMethod: string;
}

/** 与 Mac 版 JournalEntry.buildMergedFields 100% 一致：编辑时就地合并，完整保留 剃须刀1/2、刀片1/2 及自定义字段 */
export function buildMergedFields(input: BuildMergedFieldsInput): JournalField[] {
  const {
    existingEntry,
    dateStr,
    razor,
    blade,
    brush,
    soap,
    bowl,
    preShave,
    afterShave,
    afterShower,
    hotTowel,
    useAlum,
    processText,
    loadingMethod,
    latheringMethod,
  } = input;

  if (!existingEntry) {
    return [
      { label: "日期", value: dateStr },
      { label: "剃须刀", value: razor },
      { label: "刀片", value: blade },
      { label: "剃须刷", value: brush },
      { label: "剃须皂", value: soap },
      { label: "剃须碗", value: bowl || "无" },
      { label: "须前", value: preShave || "无" },
      { label: "须后", value: afterShave || "无" },
      { label: "是否浴后", value: afterShower ? "是" : "否" },
      { label: "是否热敷", value: hotTowel ? "是" : "否" },
      { label: "是否明矾", value: useAlum ? "是" : "否" },
      { label: "过程", value: processText },
      { label: "取皂", value: loadingMethod },
      { label: "起泡", value: latheringMethod },
    ];
  }

  const merged: JournalField[] = existingEntry.fields.map((f) => ({ ...f }));

  const upsertField = (
    label: string,
    value: string,
    appendIfMissing = true
  ) => {
    const idx = merged.findIndex((f) => f.label === label);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], value };
    } else if (appendIfMissing) {
      merged.push({ label, value });
    }
  };

  upsertField("日期", dateStr);

  if (merged.some((f) => f.label === "剃须刀")) {
    upsertField("剃须刀", razor);
  } else if (merged.some((f) => f.label === "剃须刀1")) {
    upsertField("剃须刀1", razor);
  } else if (razor) {
    merged.push({ label: "剃须刀", value: razor });
  }

  if (merged.some((f) => f.label === "刀片")) {
    upsertField("刀片", blade);
  } else if (merged.some((f) => f.label === "刀片1")) {
    upsertField("刀片1", blade);
  } else if (blade) {
    merged.push({ label: "刀片", value: blade });
  }

  upsertField("剃须刷", brush, Boolean(brush));
  upsertField("剃须皂", soap, Boolean(soap));
  upsertField("剃须碗", bowl || "无", Boolean(bowl));
  upsertField("须前", preShave || "无", Boolean(preShave));
  upsertField("须后", afterShave || "无", Boolean(afterShave));
  upsertField("是否浴后", afterShower ? "是" : "否");
  upsertField("是否热敷", hotTowel ? "是" : "否", hotTowel || getHotTowel(existingEntry));
  upsertField("是否明矾", useAlum ? "是" : "否");
  upsertField("过程", processText);
  upsertField("取皂", loadingMethod);
  upsertField("起泡", latheringMethod);

  return merged;
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateISO(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt;
}
