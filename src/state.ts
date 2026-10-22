// The two shared variables (core's api.variables). gps-track.state holds the
// loaded track, so this panel shows the same file in every window.
// map.overlays is Map's drawing contract: one entry per extension under its
// own key. GPS Track adds and removes only "gps-track", always with update(),
// so it never overwrites another extension's entry. Either side may register
// map.overlays first; without Map the entry is simply never drawn.

import { trackGeoJSON, type Track, type TrackPoint } from "./gpx";
import { api } from "./rt";
import { EMPTY_TRACK_STATE, store, type TrackState } from "./store";

export const STATE_VAR = "gps-track.state";
export const STATE_DESCRIPTION = "The GPX track GPS Track has loaded, shared by its panel in every window.";
export const OVERLAYS_VAR = "map.overlays";
export const OVERLAYS_DESCRIPTION =
  "Lines and points drawn on the Map. One entry per extension, keyed by its id; add and remove your own with update().";
export const OVERLAY_KEY = "gps-track";

type Overlays = Record<string, unknown>;

let stop: (() => void) | null = null;

// Any extension can write these two variables, and so can Developer Tools'
// Variables tab, so a delivered value is checked before anything reads it.

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isTrackPoint(p: unknown): p is TrackPoint {
  return isRecord(p) && isFiniteNumber(p.t) && isFiniteNumber(p.lat) && isFiniteNumber(p.lon) && (p.ele === undefined || isFiniteNumber(p.ele));
}

function isTrack(t: unknown): t is Track {
  return (
    isRecord(t) &&
    (t.name === null || typeof t.name === "string") &&
    isFiniteNumber(t.pointCount) &&
    isFiniteNumber(t.start) &&
    isFiniteNumber(t.end) &&
    Array.isArray(t.segments) &&
    t.segments.every((seg: unknown) => Array.isArray(seg) && seg.every(isTrackPoint))
  );
}

function isTrackState(v: unknown): v is TrackState {
  return isRecord(v) && (v.file === null || typeof v.file === "string") && (v.track === null || isTrack(v.track));
}

/** A gps-track.state value as a TrackState, or the empty state when it isn't
 *  one: a malformed track would otherwise throw inside correlate on every
 *  render, in every window, until the variable was rewritten. */
export function trackStateOf(value: unknown): TrackState {
  return isTrackState(value) ? value : EMPTY_TRACK_STATE;
}

export function initState(): void {
  api.variables.register<TrackState>(STATE_VAR, { initial: EMPTY_TRACK_STATE, description: STATE_DESCRIPTION });
  api.variables.register<Overlays>(OVERLAYS_VAR, { initial: {}, description: OVERLAYS_DESCRIPTION });
  // Subscribing also keeps this extension's view of the state current, so its
  // own set() is never refused as stale. Two windows loading at the same moment
  // both see ok; core logs the losing write in Issues, and this subscription
  // then shows the winning track in every window.
  stop = api.variables.subscribe<unknown>(STATE_VAR, (s) => {
    if (isTrackState(s.value)) {
      store().getState().setLoaded(s.value);
      return;
    }
    // Once per delivered revision, and the panel falls back to "No track
    // loaded" so importing a file (which overwrites the bad value) still works.
    console.warn("[gps-track] ignored a gps-track.state value that isn't a track");
    store().getState().setLoaded(EMPTY_TRACK_STATE);
  });
}

function removeOverlay(): void {
  const current = api.variables.get<unknown>(OVERLAYS_VAR)?.value;
  // `in` throws on a string or number, and in teardown that would skip
  // clearing the state; a value that isn't Map's keyed object has no entry of
  // ours to remove, and isn't ours to rewrite.
  if (!isRecord(current) || !Object.hasOwn(current, OVERLAY_KEY)) return;
  api.variables.update<Overlays>(OVERLAYS_VAR, ({ [OVERLAY_KEY]: _gone, ...rest }) => rest);
}

/** Share a parsed track and draw it on the map. The map is only touched once
 *  the state write is accepted, so a refused write leaves the line as it was. */
export function loadTrack(track: Track, file: string): void {
  if (!api.variables.set<TrackState>(STATE_VAR, { track, file }).ok) return;
  api.variables.update<Overlays>(OVERLAYS_VAR, (o) => ({ ...o, [OVERLAY_KEY]: { label: file, geojson: trackGeoJSON(track) } }));
}

/** Forget the track and take it off the map, again only once the state write
 *  is accepted. */
export function clearTrack(): void {
  if (!api.variables.set<TrackState>(STATE_VAR, EMPTY_TRACK_STATE).ok) return;
  removeOverlay();
}

/** deactivate(): a disabled GPS Track leaves no line behind and starts empty
 *  when enabled again. Every open window runs this; their writes carry equal
 *  values, which core doesn't report as a race. */
export function teardownState(): void {
  removeOverlay();
  if (trackStateOf(api.variables.get<unknown>(STATE_VAR)?.value).track) api.variables.set<TrackState>(STATE_VAR, EMPTY_TRACK_STATE);
  stop?.();
  stop = null;
}
