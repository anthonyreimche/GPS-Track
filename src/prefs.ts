// The gap limit (global, persisted through the host's per-extension settings)
// and one stored-only value: the last camera clock offset. Every stored value
// is untrusted and validated on read.

import { React, api } from "./rt";
import type { SettingsField } from "./safelight";

export interface Prefs {
  maxGapMinutes: number;
}

export const DEFAULT_PREFS: Readonly<Prefs> = { maxGapMinutes: 10 };

export const PREF_KEYS = ["maxGapMinutes"] as const satisfies readonly (keyof Prefs)[];

const GAP_RANGE = [1, 120] as const;

export const SETTINGS_FIELDS: readonly SettingsField[] = [
  {
    key: "maxGapMinutes",
    label: "Track gap limit (minutes)",
    hint: "Photos are not placed between two track points further apart than this.",
    type: "number",
    default: DEFAULT_PREFS.maxGapMinutes,
    min: GAP_RANGE[0],
    max: GAP_RANGE[1],
    step: 1,
  },
];

export const OFFSET_KEY = "lastOffsetSeconds";

export function validate<K extends keyof Prefs>(key: K, value: unknown): Prefs[K] {
  const v = typeof value === "number" && Number.isFinite(value) ? Math.min(GAP_RANGE[1], Math.max(GAP_RANGE[0], value)) : DEFAULT_PREFS[key];
  return v as Prefs[K];
}

export type Getter = <T>(key: string, fallback: T) => T;

export function readPrefs(get: Getter): Prefs {
  return { maxGapMinutes: validate("maxGapMinutes", get("maxGapMinutes", DEFAULT_PREFS.maxGapMinutes)) };
}

/** Live prefs: re-read whenever any of this extension's settings change. */
export function usePrefs(): Prefs {
  const [prefs, setPrefs] = React.useState(() => readPrefs(api.settings.get));
  React.useEffect(() => api.settings.onChange(() => setPrefs(readPrefs(api.settings.get))), []);
  return prefs;
}

export function readSavedOffset(get: Getter): number {
  const v = get<unknown>(OFFSET_KEY, 0);
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
}

export function writeSavedOffset(seconds: number): void {
  api.settings.set(OFFSET_KEY, Math.round(seconds));
}
