import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  AiChatRequestPayload,
  AiChatResponsePayload,
  AiConnectionTestResponse,
  AppConfigInfo,
  BackupResponse,
  CustomLogoResponse,
  DownloadProgressEvent,
  JournalDatabase,
  LoadJournalResponse,
  SaveJournalResponse,
  UpdateCheckResult,
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

export async function saveAiConfig(params: {
  enabled: boolean;
  preset: string;
  baseUrl: string;
  model: string;
  enableWebSearch: boolean;
  enableGoogleSearch: boolean;
}): Promise<AppConfigInfo> {
  return invoke<AppConfigInfo>("save_ai_config", params);
}

export async function getAiApiKey(): Promise<string> {
  return invoke<string>("get_ai_api_key");
}

export async function setAiApiKey(apiKey: string): Promise<AppConfigInfo> {
  return invoke<AppConfigInfo>("set_ai_api_key", { apiKey });
}

export async function clearAiApiKey(): Promise<AppConfigInfo> {
  return invoke<AppConfigInfo>("clear_ai_api_key");
}

export async function aiChatCompletion(
  request: AiChatRequestPayload
): Promise<AiChatResponsePayload> {
  return invoke<AiChatResponsePayload>("ai_chat_completion", { request });
}

export async function aiTestConnection(params: {
  baseUrl: string;
  model: string;
  preset: string;
  apiKeyOverride?: string | null;
}): Promise<AiConnectionTestResponse> {
  return invoke<AiConnectionTestResponse>("ai_test_connection", {
    baseUrl: params.baseUrl,
    model: params.model,
    preset: params.preset,
    apiKeyOverride: params.apiKeyOverride ?? null,
  });
}

export async function saveUpdatePreferences(
  autoCheckUpdates: boolean,
  ignoredUpdateVersion: string
): Promise<AppConfigInfo> {
  return invoke<AppConfigInfo>("save_update_preferences", {
    autoCheckUpdates,
    ignoredUpdateVersion,
  });
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  return invoke<UpdateCheckResult>("check_for_updates");
}

export async function downloadAndOpenUpdate(params: {
  downloadUrl: string;
  fileName: string;
  expectedSize: number;
}): Promise<string> {
  return invoke<string>("download_and_open_update", params);
}

export async function cancelUpdateDownload(): Promise<void> {
  return invoke<void>("cancel_update_download");
}

export async function openExternalUrl(url: string): Promise<void> {
  return invoke<void>("open_external_url", { url });
}

export async function revealFileInFolder(path: string): Promise<void> {
  return invoke<void>("reveal_file_in_folder", { path });
}

export async function listenUpdateDownloadProgress(
  handler: (payload: DownloadProgressEvent) => void
): Promise<UnlistenFn> {
  return listen<DownloadProgressEvent>("update-download-progress", (event) => {
    handler(event.payload);
  });
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
