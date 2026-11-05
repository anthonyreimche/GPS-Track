# GPS Track for SafeLight

A [SafeLight](https://github.com/anthonyreimche/SafeLight) extension that
geotags photos from a GPX track. Import the `.gpx` file your phone, watch or
GPS logger recorded while you shot, set the camera clock offset, preview how
many photos match by capture time, and apply.

## What it does

- **Import track…** reads a `.gpx` file: its track segments, or its route when
  it has no track. Points without a time are skipped.
- **Match by time.**
  - Set the **camera clock offset** (`±h:mm:ss`): the camera clock's error,
    plus the time-zone difference if the camera was set to another zone than
    this computer.
  - Set the **gap limit**: photos are never placed between two track points
    further apart than this.
  - Targets are the selected photos, or else every photo without a location
    that the Library shows. Photos that already have one are touched only
    behind *Overwrite existing locations*.
- **Apply** writes the locations to the catalogue in one batch, and **Undo**
  restores what those photos had before, for the session. Original files are
  never modified. Export's EXIF embedding (when it includes location) and
  Advanced EXIF Tools read the same catalogue fields.
- The panel docks in **Library** by default. The loaded track is shared by the
  panel in every SafeLight window.

## With Map

With the [Map](https://github.com/anthonyreimche/Map) extension 2.0.0 or later
installed, the loaded track is drawn on the map, the map fits to it when you
import a new file, and the panel sits in Map's right rail by default. GPS Track
and Map work without each other. They meet through core's shared variables:
- GPS Track writes its track into `map.overlays` under the key `gps-track`, and removes it on *Clear* or when the extension is disabled.
- GPS Track leaves Map's *Filter Library to map view* filter (`map.in-view`) out when it looks for untagged photos, because that filter hides every photo without a location.

## Install

Install from the SafeLight **Extensions** window. Needs SafeLight 3.0.1 or
later (shared variables). Build from source with
`npm install && npm run build`, which outputs `dist/index.js`.

## Tests

`npm run check` runs the typecheck, the build and the tests. The bundle test
checks that `dist/index.js` never reads `import.meta` and never bundles React.

## Licence

MIT. See [LICENSE](LICENSE).
