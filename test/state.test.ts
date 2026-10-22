import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../src/gpx";
import { initRuntime } from "../src/rt";
import {
  OVERLAYS_DESCRIPTION,
  OVERLAYS_VAR,
  OVERLAY_KEY,
  STATE_DESCRIPTION,
  STATE_VAR,
  clearTrack,
  initState,
  loadTrack,
  teardownState,
  trackStateOf,
} from "../src/state";
import { EMPTY_TRACK_STATE, initStore, store, type TrackState } from "../src/store";
import { createHarness, type Harness } from "./harness";

const TRACK: Track = {
  name: "Walk",
  segments: [
    [
      { t: 0, lat: 48, lon: 2 },
      { t: 60_000, lat: 48.1, lon: 2.1 },
    ],
  ],
  pointCount: 2,
  start: 0,
  end: 60_000,
};

let h: Harness;
const start = (opts: Parameters<typeof createHarness>[0] = {}) => {
  h = createHarness(opts);
  initRuntime(h.api);
  initStore();
  initState();
};

describe("gps-track.state and map.overlays", () => {
  beforeEach(() => start());

  it("registers both variables, the overlays one with Map's description", () => {
    expect(h.variables.snapshot(STATE_VAR)).toMatchObject({ value: EMPTY_TRACK_STATE, description: STATE_DESCRIPTION });
    expect(h.variables.snapshot(OVERLAYS_VAR)).toMatchObject({ value: {}, description: OVERLAYS_DESCRIPTION });
  });

  it("loading shares the track and draws it under its own key", () => {
    loadTrack(TRACK, "walk.gpx");
    expect(store().getState().loaded).toEqual({ track: TRACK, file: "walk.gpx" });
    expect(h.variables.snapshot<Record<string, unknown>>(OVERLAYS_VAR)?.value[OVERLAY_KEY]).toEqual({
      label: "walk.gpx",
      geojson: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "LineString", coordinates: [[2, 48], [2.1, 48.1]] }, properties: {} }] },
    });
  });

  it("follows a track another window loaded", () => {
    const other = h.variables.forExtension("gps-track");
    other.update<TrackState>(STATE_VAR, () => ({ track: TRACK, file: "other.gpx" }));
    expect(store().getState().loaded.file).toBe("other.gpx");
  });

  it("clearing removes the track and only its own overlay entry", () => {
    h.variables.forExtension("trips").update<Record<string, unknown>>(OVERLAYS_VAR, (o) => ({ ...o, trips: { label: "t", geojson: { type: "FeatureCollection", features: [] } } }));
    loadTrack(TRACK, "walk.gpx");
    clearTrack();
    expect(store().getState().loaded).toEqual(EMPTY_TRACK_STATE);
    expect(Object.keys(h.variables.snapshot<Record<string, unknown>>(OVERLAYS_VAR)!.value)).toEqual(["trips"]);
  });

  it("teardown takes the line off the map and forgets the track", () => {
    loadTrack(TRACK, "walk.gpx");
    teardownState();
    expect(h.variables.snapshot<TrackState>(STATE_VAR)?.value).toEqual(EMPTY_TRACK_STATE);
    expect(h.variables.snapshot<Record<string, unknown>>(OVERLAYS_VAR)?.value).toEqual({});
  });

  it("ignores a gps-track.state value that isn't a track", () => {
    loadTrack(TRACK, "walk.gpx");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      h.variables.forExtension("other").update<unknown>(STATE_VAR, () => ({ track: {}, file: 3 }));
      expect(store().getState().loaded).toEqual(EMPTY_TRACK_STATE);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith("[gps-track] ignored a gps-track.state value that isn't a track");
    } finally {
      warn.mockRestore();
    }
  });

  it("stays quiet about the normal empty, loaded and cleared states", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      loadTrack(TRACK, "walk.gpx");
      clearTrack();
      teardownState();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("teardown tolerates a map.overlays value that isn't an object", () => {
    loadTrack(TRACK, "walk.gpx");
    h.variables.forExtension("other").update<unknown>(OVERLAYS_VAR, () => "junk");
    expect(() => teardownState()).not.toThrow();
    expect(h.variables.snapshot<TrackState>(STATE_VAR)?.value).toEqual(EMPTY_TRACK_STATE);
  });

  it.each<[string, unknown]>([
    ["a string", "junk"],
    ["a number", 7],
    ["null", null],
    ["an array", [OVERLAY_KEY]],
  ])("clearing leaves a map.overlays value that is %s as it found it", (_what, junk) => {
    h.variables.forExtension("other").update<unknown>(OVERLAYS_VAR, () => junk);
    expect(() => clearTrack()).not.toThrow();
    expect(h.variables.snapshot<unknown>(OVERLAYS_VAR)?.value).toEqual(junk);
  });
});

describe("trackStateOf", () => {
  const VALID: TrackState = { track: TRACK, file: "walk.gpx" };
  const withPoint = (point: unknown): unknown => ({ track: { ...TRACK, segments: [[point]] }, file: "walk.gpx" });

  it("passes a valid state through unchanged", () => {
    expect(trackStateOf(VALID)).toBe(VALID);
    expect(trackStateOf(EMPTY_TRACK_STATE)).toBe(EMPTY_TRACK_STATE);
    const withElevation = { track: { ...TRACK, name: null, segments: [[{ t: 0, lat: 1, lon: 2, ele: 30 }], []] }, file: null };
    expect(trackStateOf(withElevation)).toBe(withElevation);
  });

  it.each<[string, unknown]>([
    ["null", null],
    ["a string", "junk"],
    ["an array", []],
    ["an empty object", {}],
    ["a track that is an empty object", { track: {}, file: 3 }],
    ["a file that is not a string", { track: null, file: 3 }],
    ["a missing file", { track: null }],
    ["segments that are not an array", { track: { segments: "x" }, file: null }],
    ["a segment that is not an array", { track: { ...TRACK, segments: ["x"] }, file: null }],
    ["a name that is not a string", { track: { ...TRACK, name: 5 }, file: null }],
    ["a pointCount that is not finite", { track: { ...TRACK, pointCount: Number.NaN }, file: null }],
    ["a start that is not a number", { track: { ...TRACK, start: "0" }, file: null }],
    ["an end that is infinite", { track: { ...TRACK, end: Infinity }, file: null }],
    ["a point that is not an object", withPoint(null)],
    ["a point with a string lat", withPoint({ t: 0, lat: "1", lon: 2 })],
    ["a point with a missing lon", withPoint({ t: 0, lat: 1 })],
    ["a point with a NaN time", withPoint({ t: Number.NaN, lat: 1, lon: 2 })],
    ["a point with a string elevation", withPoint({ t: 0, lat: 1, lon: 2, ele: "3" })],
  ])("gives the empty state for %s", (_what, value) => {
    expect(trackStateOf(value)).toBe(EMPTY_TRACK_STATE);
  });
});

describe("with Map installed first", () => {
  it("joins Map's map.overlays instead of creating it", () => {
    const shared = createHarness().variables;
    shared.forExtension("map").register(OVERLAYS_VAR, { initial: {}, description: OVERLAYS_DESCRIPTION });
    start({ variables: shared });
    expect(h.variables.snapshot(OVERLAYS_VAR)?.registeredBy.extension).toBe("map");
    loadTrack(TRACK, "walk.gpx");
    expect(h.variables.snapshot<Record<string, unknown>>(OVERLAYS_VAR)?.value[OVERLAY_KEY]).toMatchObject({ label: "walk.gpx" });
  });
});
