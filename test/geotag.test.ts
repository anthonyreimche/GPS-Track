import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyPlacements, applyUndo, catalogDeps, fixOf, trackLabel, undoLast, withFix, withoutFix, type GeotagDeps } from "../src/geotag";
import { initRuntime } from "../src/rt";
import { UNDO_DEPTH, initStore, store } from "../src/store";
import { createHarness, located, photo, type Harness } from "./harness";

let h: Harness;
beforeEach(() => {
  h = createHarness({ photos: [located("a", 1, 1), photo({ id: "b" })] });
  initRuntime(h.api);
  initStore();
});

describe("fixes", () => {
  it("reads, writes and removes a photo's location, keeping altitude only when given", () => {
    const p = photo({ id: "x", exif: { gpsLatitude: 1, gpsLongitude: 2, gpsAltitude: 3 } });
    expect(fixOf(p)).toEqual({ lat: 1, lon: 2, alt: 3 });
    expect(withFix(p, { lat: 5, lon: 6 }).exif).toEqual({ gpsLatitude: 5, gpsLongitude: 6 });
    expect(fixOf(withoutFix(p))).toBeNull();
  });
});

describe("applyPlacements and undo", () => {
  it("writes the placements as one batch and records what they replaced", async () => {
    const n = await applyPlacements([{ id: "b", fix: { lat: 9, lon: 9 } }, { id: "gone", fix: { lat: 0, lon: 0 } }], trackLabel(1), catalogDeps());
    expect(n).toBe(1);
    expect(h.relocated[0].map((p) => [p.id, p.exif.gpsLatitude])).toEqual([["b", 9]]);
    expect(store().getState().undo).toEqual([{ label: "Undo tagging 1 photo from the track", previous: new Map([["b", null]]) }]);
  });

  it("undoLast restores the newest batch and pops it", async () => {
    await applyPlacements([{ id: "a", fix: { lat: 7, lon: 7 } }], trackLabel(1), catalogDeps());
    await undoLast();
    expect(h.catalog.getState().photos.find((p) => p.id === "a")?.exif.gpsLatitude).toBe(1);
    expect(store().getState().undo).toEqual([]);
  });

  it("undoLast puts the entry back when the write fails, and rethrows", async () => {
    store().getState().pushUndo({ label: "Undo tagging 1 photo from the track", previous: new Map([["a", null]]) });
    const failing: GeotagDeps = { ...catalogDeps(), relocate: vi.fn(async () => Promise.reject(new Error("disk full"))) };
    await expect(undoLast(failing)).rejects.toThrow("disk full");
    expect(store().getState().undo).toHaveLength(1);
  });

  it("applyUndo skips photos that are no longer in the catalogue", async () => {
    const deps = catalogDeps();
    await applyUndo({ label: "x", previous: new Map([["missing", null]]) }, deps);
    expect(h.relocated).toEqual([]);
  });

  it("two undoLast calls fired together undo only the newest batch", async () => {
    await applyPlacements([{ id: "a", fix: { lat: 7, lon: 7 } }], trackLabel(1), catalogDeps());
    await applyPlacements([{ id: "b", fix: { lat: 9, lon: 9 } }], trackLabel(1), catalogDeps());
    await Promise.all([undoLast(), undoLast()]);
    const photos = h.catalog.getState().photos;
    expect(photos.find((p) => p.id === "b")?.exif.gpsLatitude).toBeUndefined();
    expect(photos.find((p) => p.id === "a")?.exif.gpsLatitude).toBe(7);
    expect(store().getState().undo).toEqual([{ label: trackLabel(1), previous: new Map([["a", { lat: 1, lon: 1 }]]) }]);
  });

  it(`keeps the last ${UNDO_DEPTH} batches`, () => {
    for (let i = 0; i < UNDO_DEPTH + 3; i++) store().getState().pushUndo({ label: `u${i}`, previous: new Map<string, null>() });
    expect(store().getState().undo).toHaveLength(UNDO_DEPTH);
  });

  it("names the batch", () => {
    expect(trackLabel(12)).toBe("Undo tagging 12 photos from the track");
  });
});
