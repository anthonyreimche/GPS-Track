import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, PREF_KEYS, SETTINGS_FIELDS, readPrefs, readSavedOffset, validate } from "../src/prefs";

describe("prefs", () => {
  it("has the gap limit as its one setting", () => {
    expect(PREF_KEYS).toEqual(["maxGapMinutes"]);
    expect(SETTINGS_FIELDS.map((f) => [f.key, f.label])).toEqual([["maxGapMinutes", "Track gap limit (minutes)"]]);
    expect(DEFAULT_PREFS.maxGapMinutes).toBe(10);
  });

  it("clamps the gap limit and falls back on junk", () => {
    expect(validate("maxGapMinutes", 0)).toBe(1);
    expect(validate("maxGapMinutes", 1000)).toBe(120);
    expect(validate("maxGapMinutes", 30)).toBe(30);
    expect(validate("maxGapMinutes", "x")).toBe(10);
    expect(readPrefs(<T,>(_k: string, fb: T) => fb)).toEqual({ maxGapMinutes: 10 });
  });

  it("reads the saved offset as whole seconds, 0 when missing or junk", () => {
    expect(readSavedOffset(<T,>(_k: string, _fb: T) => -3600 as T)).toBe(-3600);
    expect(readSavedOffset(<T,>(_k: string, _fb: T) => "x" as T)).toBe(0);
  });
});
