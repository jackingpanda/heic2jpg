# HEIC2JPG: researched implementation plan

Date: 26 October 2026. This document supersedes speculative implementation details in the original plan. The original PRD remains product intent, rather than a claim of implemented behavior.

## Product outcome

A private, offline Windows desktop app: add HEIC/HEIF files or folders, review a queue, choose an output location and quality, convert, then reveal the results. Keep originals by default. Explain failures next to the affected file and allow retries without adding everything again.

## Research and decisions

1. Standard Sharp binaries do not decode HEVC HEIC. Use heic-decode/libheif for decoding in worker threads, Sharp for JPEG encoding at quality 95 and 4:4:4. Ship decoder code with the app; no codec-store or network dependency at runtime.
2. JPEG is lossy even at quality 100. Export the primary still image as an 8-bit JPEG. Do not promise identical pixels, HDR, depth, Live Photo video, or all container-specific metadata.
3. ExifTool handles more metadata than reconstructing an exifr object with piexif. Bundle its Windows executable; invoke it with argument arrays and no shell. Transfer writable EXIF, IPTC, XMP and ICC tags, normalize orientation after libheif's image transformations, update pixel dimensions, and verify key capture/camera/GPS fields. Surface transfer warnings and retain the original on a warning.
4. Use Electron with sandboxed, isolated preload APIs, React/TypeScript, electron-vite, and a virtualized queue. Only expose named operations, validate IPC senders/settings/IDs, reject navigation and new windows.
5. Bound conversion concurrency to a small memory-aware worker pool instead of CPU cores minus one without a ceiling. No full image buffers cross IPC. Start with at most two concurrent decodes; benchmark before raising limits.
6. Use a private temporary directory beside each destination. Encode, transfer metadata, validate the JPEG, then commit it. Skip and rename modes must never overwrite a competing output. Cancellation stops scheduling and lets active files finish safely; communicate that clearly.
7. Explorer integration is opt-in, per-user HKCU under SystemFileAssociations, with single-instance argument collection. Windows 11 classic verbs live under Show more options. A modern IExplorerCommand shell extension is a later milestone.
8. Keep settings in an atomic JSON file with validation. Original deletion is offered as moving to the Recycle Bin after verified success, with a per-batch confirmation. Context menu jobs always keep originals.

## Delivery sequence and acceptance gates

### 1. Foundation and UX
- Set up Electron, preload, shared contracts, build, test and installer configuration.
- Build a warm charcoal workspace with violet actions, clear typography, keyboard access, reduced-motion support, light/dark modes and helpful empty states.
- Place quality, output and conflict behavior beside the queue. Keep infrequent controls in an advanced settings dialog.
- Gate: production renderer builds; no Node access in renderer; empty, queued, converting, stopping, complete and error states make the next action clear.

### 2. Real file pipeline
- Scan directories asynchronously without following symlinks; deduplicate paths and validate ftyp brands. Show scan failures without losing valid files.
- Decode on a worker, encode 4:4:4 JPEG, transfer metadata, verify key tags/dimensions, preserve timestamps and commit safely.
- Gate: real HEIC fixture converts to a readable JPEG; capture date/camera/GPS and orientation checks pass; corrupt/disguised inputs fail cleanly; skip/rename/overwrite work without changing the source.

### 3. Queue and recovery
- Add search, status filters, selection, remove, retry, per-file stages, batch counts, elapsed time, cancellation and completion actions.
- Virtualize rows, throttle progress snapshots, lock settings during conversion, avoid misleading ETA until there is a sample.
- Gate: mixed success/error batch completes; cancel leaves committed outputs and resumable pending files; duplicate destinations remain safe; large queue scrolls without rendering every row.

### 4. Desktop integration
- Persist preferences and window bounds, native dialogs, tray/notifications, single-instance CLI handling, Explorer enable/disable, uninstall cleanup, keyboard shortcuts.
- Gate: packaged app runs without development server; menu commands correctly quote spaces; incoming CLI files are collected; ordinary GUI work is not automatically started by an Explorer request.

### 5. Verification and handoff
- Run TypeScript, behavioral tests, real-file integration tests, build, dependency audit and packaging.
- Inspect the actual Windows UI in empty/queued/finished/settings states; verify native file selection and output reveal.
- Deliver installer, runnable unpacked app, accurate README and test report. Record untested OS/device variants and benchmark results honestly.

## Release follow-up

Code signing; clean Windows 10/11 VM installation; representative iPhone/Samsung/HDR/portrait/rotated and large image corpus; memory and throughput measurements for 100/1,000 images; screen-reader and 200% DPI checks. Evaluate an IExplorerCommand extension only after the classic integration works reliably. No auto-updater, image editing, cloud uploads, or extra output formats in this version.

## Delivered implementation

The foundation, conversion pipeline, queue/recovery UI, desktop integration and NSIS packaging are implemented. TypeScript and production builds pass. Eleven real-file/behavior tests pass. The Electron UI harness verifies a real conversion, mixed errors, retry, safe cancellation, a 10,000-photo virtual list (10 rendered rows), minimum window size and both themes with zero renderer errors. See VERIFICATION.md for exact coverage and the release checks that remain.

## Primary sources

- Sharp HEIC and metadata support: https://sharp.pixelplumbing.com/api-output/ and https://sharp.pixelplumbing.com/install/
- Decoder API and resource lifecycle: https://github.com/catdad-experiments/heic-decode
- ExifTool tag copying and unsafe/profile caveats: https://exiftool.org/faq.html and https://exiftool.org/exiftool_pod.html
- Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- Native dropped-file paths: https://www.electronjs.org/docs/latest/api/web-utils
- Worker builds: https://electron-vite.org/guide/dev#worker-threads
- Windows shell verbs: https://learn.microsoft.com/en-us/windows/win32/shell/context
- Windows 11 context menu extensions: https://learn.microsoft.com/en-us/windows/apps/get-started/best-practices#context-menus
