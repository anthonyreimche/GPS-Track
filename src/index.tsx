// GPS Track — Safelight extension (MIT). Registration and teardown only; the
// panel lives in TrackPanel.tsx, the shared track and the Map overlay in
// state.ts.

import { SETTINGS_FIELDS } from "./prefs";
import { initRuntime } from "./rt";
import type { SafelightAPI } from "./safelight";
import { initState, teardownState } from "./state";
import { initStore } from "./store";
import { TrackPanel } from "./TrackPanel";

export const PANEL_ID = "gps-track.panel";
export const SETTINGS_TITLE = "GPS Track";

export function activate(host: SafelightAPI): void {
  initRuntime(host);
  initStore();
  initState();

  host.registerPanel({
    id: PANEL_ID,
    title: "GPS Track",
    component: TrackPanel,
    defaultDock: { module: "library", direction: "right", order: 0, width: 280 },
    // Map 1.x had its own GPS Track panel; layouts saved then show this one in its spot.
    replaces: ["map.track"],
  });

  host.registerSettings({
    title: SETTINGS_TITLE,
    keywords: ["gps", "gpx", "track", "geotag", "offset", "location"],
    fields: [...SETTINGS_FIELDS],
  });
}

export function deactivate(): void {
  try {
    teardownState();
  } catch {
    // Disabling an extension that never finished activate(): nothing to tear down.
  }
}
