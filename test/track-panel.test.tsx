import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initRuntime } from "../src/rt";
import { OVERLAYS_VAR, OVERLAY_KEY, STATE_VAR, initState, teardownState } from "../src/state";
import { initStore, store } from "../src/store";
import { MAP_IN_VIEW_FILTER, TrackPanel, previewText, targetsText } from "../src/TrackPanel";
import { createHarness, flush, located, photo, type Harness } from "./harness";

const T0 = Date.UTC(2024, 5, 1, 10, 0, 0);
const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();
const local = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const GPX = `<gpx version="1.1"><trk><name>Walk</name><trkseg>
  <trkpt lat="48.0" lon="2.0"><time>${iso(T0)}</time></trkpt>
  <trkpt lat="48.1" lon="2.1"><time>${iso(T0 + 10 * MIN)}</time></trkpt>
  <trkpt lat="48.2" lon="2.2"><time>${iso(T0 + 20 * MIN)}</time></trkpt>
</trkseg></trk></gpx>`;

let h: Harness;
beforeEach(() => {
  h = createHarness({
    photos: [
      photo({ id: "in", exif: { dateTimeOriginal: local(T0 + 5 * MIN) } }),
      photo({ id: "none" }),
      located("tagged", 9, 9, local(T0 + 15 * MIN)),
    ],
  });
  initRuntime(h.api);
  initStore();
  initState();
});

afterEach(() => {
  cleanup();
  teardownState();
});

async function importTrack(text = GPX, name = "walk.gpx") {
  render(<TrackPanel readFile={async () => text} />);
  fireEvent.change(screen.getByLabelText("Import track"), { target: { files: [new File(["x"], name)] } });
  await flush();
}

describe("TrackPanel", () => {
  it("imports a GPX file, describes it, and shares and draws it", async () => {
    await importTrack();
    expect(screen.getByText(/Walk · 3 points/)).toBeTruthy();
    expect(h.variables.snapshot<{ file: string }>(STATE_VAR)?.value.file).toBe("walk.gpx");
    expect(h.variables.snapshot<Record<string, { label: string }>>(OVERLAYS_VAR)?.value[OVERLAY_KEY].label).toBe("walk.gpx");
    expect(screen.queryByRole("button", { name: "Fit to track" })).toBeNull();
  });

  it("previews the matches for the untagged visible photos", async () => {
    await importTrack();
    expect(screen.getByText(targetsText(0, 2))).toBeTruthy();
    expect(screen.getByText(previewText({ matched: 1, unmatched: 1, noTime: 1, outside: 0, gap: 0 }))).toBeTruthy();
  });

  it("ignores Map's map-view filter when finding untagged photos", async () => {
    h.api.registerGridFilter({ id: MAP_IN_VIEW_FILTER, test: (p) => p.exif.gpsLatitude !== undefined });
    await importTrack();
    expect(screen.getByText(targetsText(0, 2))).toBeTruthy();
  });

  it("targets the selection instead when there is one, and gates already-tagged photos", async () => {
    await importTrack();
    act(() => h.catalog.setState({ selectedIds: new Set(["in", "tagged"]) }));
    expect(screen.getByText(targetsText(2, 2))).toBeTruthy();
    expect(screen.getByText(previewText({ matched: 1, unmatched: 0, noTime: 0, outside: 0, gap: 0 }))).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Overwrite existing locations"));
    expect(screen.getByText(previewText({ matched: 2, unmatched: 0, noTime: 0, outside: 0, gap: 0 }))).toBeTruthy();
  });

  it("applies with the offset as one batch, and Undo restores it", async () => {
    await importTrack();
    fireEvent.change(screen.getByLabelText("Camera clock offset"), { target: { value: "-0:05:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await flush();
    expect(h.relocated[0].map((p) => [p.id, p.exif.gpsLatitude])).toEqual([["in", 48]]);
    expect(h.values.get("lastOffsetSeconds")).toBe(-300);
    fireEvent.click(screen.getByRole("button", { name: "Undo tagging 1 photo from the track" }));
    await flush();
    expect(h.relocated[1].map((p) => [p.id, p.exif.gpsLatitude])).toEqual([["in", undefined]]);
    expect(screen.queryByRole("button", { name: /Undo tagging/ })).toBeNull();
  });

  it("rejects a malformed offset", async () => {
    await importTrack();
    fireEvent.change(screen.getByLabelText("Camera clock offset"), { target: { value: "abc" } });
    expect(screen.getByText("Offset must be ±h:mm:ss.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("reports a file with no timed points", async () => {
    await importTrack("<gpx></gpx>", "empty.gpx");
    expect(screen.getByText("No timed track points in empty.gpx.")).toBeTruthy();
    expect(store().getState().loaded.track).toBeNull();
  });

  it("shows the read failure inline instead of an unhandled rejection", async () => {
    render(
      <TrackPanel
        readFile={async () => {
          throw new Error("disk error");
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Import track"), { target: { files: [new File(["x"], "walk.gpx")] } });
    await flush();
    expect(screen.getByText("Could not read walk.gpx.")).toBeTruthy();
    expect(store().getState().loaded.track).toBeNull();
  });

  it("clears the track and its line", async () => {
    await importTrack();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(store().getState().loaded.track).toBeNull();
    expect(h.variables.snapshot<Record<string, unknown>>(OVERLAYS_VAR)?.value).toEqual({});
    expect(screen.getByText(/No track loaded/)).toBeTruthy();
  });
});

describe("contract with Map", () => {
  it("keeps the names Map depends on", () => {
    expect(MAP_IN_VIEW_FILTER).toBe("map.in-view");
    expect(OVERLAYS_VAR).toBe("map.overlays");
    expect(OVERLAY_KEY).toBe("gps-track");
    expect(STATE_VAR).toBe("gps-track.state");
  });
});

describe("text", () => {
  it("names the targets", () => {
    expect(targetsText(0, 3)).toBe("Targets: 3 untagged photos in view");
    expect(targetsText(0, 1)).toBe("Targets: 1 untagged photo in view");
    expect(targetsText(2, 3)).toBe("Targets: 2 selected photos");
  });

  it("summarises a preview with only the reasons that occur", () => {
    expect(previewText({ matched: 3, unmatched: 0, noTime: 0, outside: 0, gap: 0 })).toBe("3 matched · 0 unmatched");
    expect(previewText({ matched: 1, unmatched: 3, noTime: 1, outside: 0, gap: 2 })).toBe(
      "1 matched · 3 unmatched (1 no capture time, 2 across a gap)",
    );
  });
});
