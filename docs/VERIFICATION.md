# HEIC2JPG verification

26 October 2026. Windows x64 host (Windows build 26300), Node 24.19.0, Electron 45.0.0. This is a working unsigned first release, not a certification of all Windows/device combinations.

## Conversion and filesystem tests

`npm test`: 11 passing real-file/behavior tests.

- A public libheif HEIC fixture produces a fully decodable 1280×854 JPEG with 4:4:4 chroma. Source bytes and modification time checks pass.
- Synthetic camera make/model, capture date, GPS and XMP description survive the HEIC→JPEG pipeline. Output orientation is normalized to 1.
- An EXIF-only orientation-6 source becomes an 854×1280 portrait JPEG, including with metadata copying disabled.
- Renamed non-HEIC input and empty/corrupt files fail clearly.
- Nonrecursive/recursive scanning and unrelated-file filtering behave as configured.
- Skip, rename, overwrite and racing output names behave correctly without changing source files.
- Settings are bounded and filename modifiers are sanitized; CLI paths with spaces are parsed correctly.

The fixture has multiple images; the app exports the first primary still exposed by the decoder. Metadata tests add synthetic fields to copies of that fixture; they are not a substitute for a diverse real iPhone/Samsung image corpus.

## Desktop UI verification

`npm run test:ui` launches a real Electron main/preload/renderer and actual conversion workers using the production bundles. It saves screenshots and `.test-output/ui-report.json`.

Checks cover the empty state, a real queued conversion, completion, advanced settings, a synthetic 10,000-photo virtual queue, 760×620 layout and light/dark themes. Screenshots were visually inspected. The compact window has no horizontal overflow; the sidebar scrolls to less frequent controls.

Final harness results: 10 DOM rows for a 10,000-photo queue; mixed batch saved 2 photos and isolated 1 damaged file; retry returned the failed photo to ready state; cancellation finished 2 active photos and left 4 resumable. There were zero renderer errors and no leftover conversion temporary directories. Nine screenshots were saved.

## Build and dependencies

`npm run build` includes a strict TypeScript check and production main, worker, preload and renderer builds. The current dependency audit has zero known advisories. Sharp and the test toolchain were updated after the initial audit identified older vulnerable versions.

`npm run package` creates an NSIS installer and unpacked Windows application. The executable includes the app icon and version resources but has no signing certificate. The public conversion fixture and QA scripts are excluded from the installed app.

`node scripts/verify-package.cjs` performs a real background conversion through the unpacked executable, independently of the development runtime/server; its report is `.test-output/package-report.json`.

Packaged check passed: a 1280×854 JPEG decoded successfully, synthetic camera make/model and capture date were preserved using the bundled ExifTool, and the process emitted no stderr. Executable product/version resources read HEIC2JPG / 1.0.0. Installer archive inspection found no QA profile entries. The finished application was opened for review.

The native Add HEIC Photos picker and Ctrl+O shortcut were verified through the packaged Windows interface, then cancelled without opening personal files.

## Environment notes

The managed command sandbox prevented ExifTool's Windows runtime from loading and restricted hard-link/cache moves. Metadata and desktop verification were run outside that sandbox. Tests use only public fixtures and generated data inside this workspace. Output commit also supports an exclusive-copy fallback for filesystems without hard links.

## Remaining release validation

- Clean Windows 10 and Windows 11 installation/uninstallation and actual Explorer selection/menu invocation.
- Code signing and installer reputation.
- Real-device rotated/mirrored, wide-gamut, HDR, portrait/depth and vendor-specific metadata samples. Export remains 8-bit JPEG; archival fidelity is not promised.
- Performance/memory measurements for 100/1,000 actual conversions. The 10,000-row test validates rendering, not 10,000 conversions or the original PRD's timing/RAM targets.
- Full screen-reader, high-contrast and 200% DPI checks.
- Power-loss durability, worker timeout/forced-crash injection and Recycle Bin recovery across unusual/network filesystems.

No claim is made that these follow-ups have passed.
