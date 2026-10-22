import { beforeEach, describe, expect, it } from "vitest";
import { PANEL_ID, SETTINGS_TITLE, activate, deactivate } from "../src/index";
import { PREF_KEYS } from "../src/prefs";
import { OVERLAYS_VAR, STATE_VAR, loadTrack } from "../src/state";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeEach(() => {
  h = createHarness();
  activate(h.api);
});

describe("activate", () => {
  it("registers the panel in Library's right rail, and the settings", () => {
    expect(h.panels.map((p) => [p.id, p.title])).toEqual([[PANEL_ID, "GPS Track"]]);
    expect(PANEL_ID).toBe("gps-track.panel");
    expect(h.panels[0].defaultDock).toEqual({ module: "library", direction: "right", order: 0, width: 280 });
    expect(h.panels[0].replaces).toEqual(["map.track"]);
    expect(h.settings[0].title).toBe(SETTINGS_TITLE);
    expect(h.settings[0].fields.map((f) => f.key)).toEqual([...PREF_KEYS]);
    expect(h.settings[0].keywords).toEqual(expect.arrayContaining(["gpx", "geotag"]));
  });

  it("registers its state and map.overlays", () => {
    expect(h.variables.snapshot(STATE_VAR)?.value).toEqual({ track: null, file: null });
    expect(h.variables.snapshot(OVERLAYS_VAR)?.value).toEqual({});
  });

  it("deactivate leaves no line on the map and no track behind", () => {
    loadTrack({ name: null, segments: [[{ t: 0, lat: 1, lon: 1 }, { t: 1, lat: 2, lon: 2 }]], pointCount: 2, start: 0, end: 1 }, "a.gpx");
    deactivate();
    expect(h.variables.snapshot(OVERLAYS_VAR)?.value).toEqual({});
    expect(h.variables.snapshot(STATE_VAR)?.value).toEqual({ track: null, file: null });
  });
});
