// This window's session state: the loaded track as gps-track.state last
// delivered it (the same in every window), and the undo stack for Apply
// (this window's own). Nothing here persists.

import type { GpsFix } from "./geo";
import type { Track } from "./gpx";
import { api } from "./rt";
import type { StoreApi } from "./safelight";

export interface UndoEntry {
  /** Button label, e.g. "Undo tagging 3 photos from the track". */
  label: string;
  /** Each photo's fix before the change; null = it had none. */
  previous: Map<string, GpsFix | null>;
}

export interface TrackState {
  track: Track | null;
  /** The file it came from, e.g. "ride.gpx". */
  file: string | null;
}

export const EMPTY_TRACK_STATE: TrackState = { track: null, file: null };
export const UNDO_DEPTH = 20;

export interface GpsTrackState {
  loaded: TrackState;
  undo: UndoEntry[];
  setLoaded(loaded: TrackState): void;
  pushUndo(entry: UndoEntry): void;
  popUndo(): UndoEntry | undefined;
}

let bound: StoreApi<GpsTrackState> | null = null;

export function initStore(): void {
  bound = api.stores.create<GpsTrackState>((set, get) => ({
    loaded: EMPTY_TRACK_STATE,
    undo: [],
    setLoaded: (loaded) => set({ loaded }),
    pushUndo: (entry) => set({ undo: [...get().undo, entry].slice(-UNDO_DEPTH) }),
    popUndo: () => {
      const undo = get().undo;
      const top = undo[undo.length - 1];
      if (top) set({ undo: undo.slice(0, -1) });
      return top;
    },
  }));
}

export function store(): StoreApi<GpsTrackState> {
  if (bound === null) throw new Error("[gps-track] store() called before activate()");
  return bound;
}

/** React hook over the session store. */
export function useTrackStore<U>(selector: (s: GpsTrackState) => U): U {
  return store()(selector);
}
