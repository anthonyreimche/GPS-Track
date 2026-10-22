// The only path that writes a location: build new catalog records, hand them
// to core's relocatePhotos (which persists them and updates this window's
// catalog), and remember what they held for the panel's Undo.

import type { GpsFix } from "./geo";
import { api } from "./rt";
import type { CatalogPhoto } from "./safelight";
import { store, type UndoEntry } from "./store";

export interface Placement {
  id: string;
  fix: GpsFix;
}

export interface GeotagDeps {
  photos(): readonly CatalogPhoto[];
  relocate(updated: CatalogPhoto[]): Promise<void>;
  pushUndo(entry: UndoEntry): void;
}

export function fixOf(p: CatalogPhoto): GpsFix | null {
  const { gpsLatitude: lat, gpsLongitude: lon, gpsAltitude: alt } = p.exif;
  if (lat === undefined || lon === undefined) return null;
  return alt === undefined ? { lat, lon } : { lat, lon, alt };
}

export function withFix(p: CatalogPhoto, fix: GpsFix): CatalogPhoto {
  const { gpsAltitude: _dropped, ...rest } = p.exif;
  const exif = { ...rest, gpsLatitude: fix.lat, gpsLongitude: fix.lon };
  return { ...p, exif: fix.alt === undefined ? exif : { ...exif, gpsAltitude: fix.alt } };
}

export function withoutFix(p: CatalogPhoto): CatalogPhoto {
  const { gpsLatitude: _lat, gpsLongitude: _lon, gpsAltitude: _alt, ...exif } = p.exif;
  return { ...p, exif };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export const trackLabel = (n: number) => `Undo tagging ${plural(n, "photo", "photos")} from the track`;

export async function applyPlacements(placements: readonly Placement[], label: string, deps: GeotagDeps): Promise<number> {
  const byId = new Map(deps.photos().map((p) => [p.id, p] as const));
  const updates = placements.flatMap((pl) => {
    const before = byId.get(pl.id);
    return before ? [{ before, after: withFix(before, pl.fix) }] : [];
  });
  if (updates.length === 0) return 0;
  await deps.relocate(updates.map((u) => u.after));
  deps.pushUndo({ label, previous: new Map(updates.map((u) => [u.before.id, fixOf(u.before)])) });
  return updates.length;
}

/** Restore the fixes an entry recorded. Not itself undoable. */
export async function applyUndo(entry: UndoEntry, deps: GeotagDeps): Promise<void> {
  const byId = new Map(deps.photos().map((p) => [p.id, p] as const));
  const restored: CatalogPhoto[] = [];
  for (const [id, fix] of entry.previous) {
    const p = byId.get(id);
    if (!p) continue;
    restored.push(fix ? withFix(p, fix) : withoutFix(p));
  }
  if (restored.length) await deps.relocate(restored);
}

let undoing: Promise<void> | null = null;

/** Undo the newest Apply. A failed write puts the entry back, so it can be
 *  retried, and the error goes to the caller to show. */
export function undoLast(deps: GeotagDeps = catalogDeps()): Promise<void> {
  // A second click while an undo is still writing must not revert the next-older batch too.
  if (undoing) return undoing;
  const run = async (): Promise<void> => {
    const entry = store().getState().popUndo();
    if (!entry) return;
    try {
      await applyUndo(entry, deps);
    } catch (err) {
      store().getState().pushUndo(entry);
      throw err;
    }
  };
  // Cleared with .finally, not inside run(): an empty stack settles run() before
  // this assignment, so a clear inside it would leave a settled promise in place.
  undoing = run().finally(() => {
    undoing = null;
  });
  return undoing;
}

/** The live catalog as GeotagDeps. */
export function catalogDeps(): GeotagDeps {
  const catalog = api.stores.useCatalogStore;
  return {
    photos: () => catalog.getState().photos,
    relocate: (updated) => catalog.getState().relocatePhotos(updated),
    pushUndo: (entry) => store().getState().pushUndo(entry),
  };
}
