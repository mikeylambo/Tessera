import { BrowserStorage, SaveManager, SettingsStore, defaultCoreSettings, type CoreSettings } from "@slu/web-shell";
import type { LogEntry } from "../../sim/Replay";
import type { WorldConfig } from "../../sim/World";

/** Persistent profile (GDD §37): one slot, versioned schema, backup on every save (shell SaveManager). */
export interface Profile {
  hundred: Record<number, { rating: number; bestMarks: number }>;
  skips: number;
  /** Stages passed by spending a skip (unlock the next stage like a clear; GDD §18). Additive field, defaulted on load. */
  skipped: number[];
  bestDepth: number;
  bestScore: number;
  dailyRanked: Record<string, { score: number; depth: number }>;
  onboarding: { markSuccess: number; detonateSuccess: number; retired: boolean };
  palettes: string[];
  firstLaunchDone: boolean;
  suspended: SuspendedRun | null;
  pendingSubmissions: Array<{ mode: string; seed: string; score: number; depth: number; frames: number; entries: LogEntry[] }>;
  /** Board identity (additive; created on first load). Handle = NAME_A[nameA]-NAME_B[nameB]. */
  playerId: string;
  nameA: number;
  nameB: number;
}

export interface SuspendedRun {
  config: Omit<WorldConfig, "stage"> & { stageId?: number };
  entries: LogEntry[];
  frame: number;
  hash: string;
  savedAt: string;
}

export const PROFILE_VERSION = 1;

export function defaultProfile(): Profile {
  return {
    hundred: {},
    skips: 3,
    skipped: [],
    bestDepth: 0,
    bestScore: 0,
    dailyRanked: {},
    onboarding: { markSuccess: 0, detonateSuccess: 0, retired: false },
    palettes: [],
    firstLaunchDone: false,
    suspended: null,
    pendingSubmissions: [],
    playerId: "",
    nameA: 0,
    nameB: 0
  };
}

export interface TesseraSettings extends CoreSettings {
  voiceVolume: number;
  subtitles: boolean;
  reduceFlashes: boolean;
  hintSigils: boolean;
  assistSpeed: boolean;
  highContrast: boolean;
  uiScale: 100 | 125 | 150;
}

export const defaultSettings: TesseraSettings = {
  ...defaultCoreSettings,
  vibration: false,
  voiceVolume: 0.9,
  subtitles: true,
  reduceFlashes: false,
  hintSigils: true,
  assistSpeed: false,
  highContrast: false,
  uiScale: 100
};

export class ProfileStore {
  readonly storage = new BrowserStorage("tessera");
  readonly saves = new SaveManager<Profile>(this.storage, "profile", PROFILE_VERSION, {});
  readonly settings = new SettingsStore<TesseraSettings>(this.storage, "settings", { ...defaultSettings });
  data: Profile = defaultProfile();
  notice: string | null = null;

  async load(): Promise<void> {
    try {
      await this.settings.load();
    } catch {
      this.notice = "Settings were reset.";
    }
    try {
      const r = await this.saves.loadWithRecovery();
      this.data = { ...defaultProfile(), ...(r.data ?? {}) };
      if (r.error && r.source !== "primary") this.notice = "Progress restored from a backup.";
    } catch {
      this.data = defaultProfile();
      this.notice = "Progress could not be read; starting fresh.";
    }
  }

  async save(): Promise<void> {
    try {
      await this.saves.save(this.data);
    } catch {
      /* storage full or blocked: keep playing */
    }
  }

  get actOneCleared(): boolean {
    return !!this.data.hundred[10];
  }
}
