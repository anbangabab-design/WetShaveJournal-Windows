import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  AppConfigInfo,
  BackupResponse,
  CustomLogoResponse,
  JournalDatabase,
  LoadJournalResponse,
  SaveJournalResponse,
} from "../types/journal";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getAppConfig(): Promise<AppConfigInfo> {
  return invoke<AppConfigInfo>("get_app_config");
}

export async function setCustomDataDir(
  path: string | null
): Promise<AppConfigInfo> {
  return invoke<AppConfigInfo>("set_custom_data_dir", { path });
}

export async function savePreferences(
  appearanceMode: string,
  language: string
): Promise<AppConfigInfo> {
  return invoke<AppConfigInfo>("save_preferences", {
    appearanceMode,
    language,
  });
}

export async function loadJournal(): Promise<LoadJournalResponse> {
  return invoke<LoadJournalResponse>("load_journal");
}

export async function saveJournal(
  data: JournalDatabase,
  createBackup = false
): Promise<SaveJournalResponse> {
  return invoke<SaveJournalResponse>("save_journal", {
    data,
    createBackup,
  });
}

export async function backupNow(): Promise<BackupResponse> {
  return invoke<BackupResponse>("backup_now");
}

export async function importJournal(
  sourcePath: string
): Promise<LoadJournalResponse> {
  return invoke<LoadJournalResponse>("import_journal", { sourcePath });
}

export async function exportJournal(targetPath: string): Promise<string> {
  return invoke<string>("export_journal", { targetPath });
}

export async function openDataFolder(): Promise<void> {
  return invoke<void>("open_data_folder");
}

export async function loadBrandLogos(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("load_brand_logos");
}

export async function setCustomBrandLogo(
  brand: string,
  sourcePath: string
): Promise<CustomLogoResponse> {
  return invoke<CustomLogoResponse>("set_custom_brand_logo", {
    brand,
    sourcePath,
  });
}

export async function exportCsvFile(
  targetPath: string,
  content: string
): Promise<string> {
  return invoke<string>("export_csv", { targetPath, content });
}

export async function pickBrandLogoImageDialog(
  title: string
): Promise<string | null> {
  const selected = await open({
    title,
    directory: false,
    multiple: false,
    filters: [
      {
        name: "Image",
        extensions: ["png", "jpg", "jpeg", "webp", "gif", "ico", "bmp", "svg"],
      },
    ],
  });
  if (typeof selected === "string" && selected.trim()) {
    return selected;
  }
  return null;
}

export async function pickExportCsvDialog(
  title: string,
  defaultPath: string
): Promise<string | null> {
  const selected = await save({
    title,
    defaultPath,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (typeof selected === "string" && selected.trim()) {
    return selected;
  }
  return null;
}

export async function pickDirectoryDialog(title: string): Promise<string | null> {
  const selected = await open({
    title,
    directory: true,
    multiple: false,
  });
  if (typeof selected === "string" && selected.trim()) {
    return selected;
  }
  return null;
}

export async function pickImportJsonDialog(
  title: string
): Promise<string | null> {
  const selected = await open({
    title,
    directory: false,
    multiple: false,
    filters: [{ name: "Journal JSON", extensions: ["json"] }],
  });
  if (typeof selected === "string" && selected.trim()) {
    return selected;
  }
  return null;
}

export async function pickExportJsonDialog(
  title: string,
  defaultPath: string
): Promise<string | null> {
  const selected = await save({
    title,
    defaultPath,
    filters: [{ name: "Journal JSON", extensions: ["json"] }],
  });
  if (typeof selected === "string" && selected.trim()) {
    return selected;
  }
  return null;
}
