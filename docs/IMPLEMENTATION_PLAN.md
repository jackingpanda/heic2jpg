# Implementation Plan
# HEIC2JPG Converter

---

## Phase Overview

| Phase | Nama | Durasi | Deliverable |
|-------|------|--------|-------------|
| 0 | Project Setup | 1 hari | Skeleton project, dev environment |
| 1 | Core Engine | 2-3 hari | HEIC→JPG converter + metadata preservation |
| 2 | UI — Foundation | 2-3 hari | Drop zone, file queue, progress |
| 3 | Batch Processing | 1-2 hari | Worker pool, concurrent conversion |
| 4 | Settings & Config | 1 hari | Settings panel, persistence |
| 5 | Context Menu | 1-2 hari | Windows Explorer integration |
| 6 | Polish & UX | 1-2 hari | Animations, dark mode, notifications |
| 7 | Build & Package | 1 hari | Installer, testing |

**Total estimasi: 10-15 hari kerja**

---

## Phase 0: Project Setup

### Tasks

- [ ] **0.1** Initialize Electron + Vite + React + TypeScript project
  ```bash
  npm create @nicedoc/electron-vite@latest heic2jpg -- --template react-ts
  ```
- [ ] **0.2** Configure project structure sesuai ARCHITECTURE.md
- [ ] **0.3** Setup ESLint + Prettier
- [ ] **0.4** Install core dependencies:
  ```
  sharp
  heic-convert
  exifr
  piexif-ts
  electron-store
  zustand
  @tanstack/react-virtual
  ```
- [ ] **0.5** Setup dev scripts: `dev`, `build`, `package`
- [ ] **0.6** Verify sharp HEIC support di environment lokal
- [ ] **0.7** Create shared types (`src/shared/types.ts`)
- [ ] **0.8** Create IPC channel constants (`src/shared/ipc-channels.ts`)

### Deliverable
Skeleton project bisa `npm run dev` dan menampilkan window kosong.

---

## Phase 1: Core Conversion Engine

### Tasks

- [ ] **1.1** Implement `converter.ts` — HEIC to JPG conversion
  - Sharp sebagai primary decoder
  - heic-convert sebagai fallback
  - Configurable quality (1-100)
  - ChromaSubsampling 4:4:4 untuk max quality
  
- [ ] **1.2** Implement `metadata.ts` — EXIF extraction & injection
  - `extractMetadata(buffer)` → full EXIF object
  - `injectMetadata(jpegBuffer, exifData)` → JPEG with EXIF
  - Handle missing EXIF gracefully
  - Validate: compare field count before & after

- [ ] **1.3** Implement `file-scanner.ts` — file/folder scanning
  - Accept: single file, multiple files, folder path
  - Filter: only `.heic` and `.heif` extensions
  - Validate: check magic bytes (HEIC file signature)
  - Option: recursive subfolder scanning
  - Return: `FileInfo[]` with path, size, name

- [ ] **1.4** Write unit tests untuk converter
  - Test: valid HEIC → produces valid JPEG
  - Test: EXIF preserved (GPS, DateTime, Camera Model)
  - Test: corrupt file → graceful error
  - Test: 0-byte file → error
  - Test: non-HEIC file with .heic extension → error

- [ ] **1.5** Benchmark single-file conversion speed

### Deliverable
CLI-invocable converter: `node convert.ts input.heic output.jpg`

### Verification
```bash
# Convert a test file
node dist/converter.js test.heic test.jpg

# Compare EXIF
exiftool test.heic > exif_before.txt
exiftool test.jpg > exif_after.txt
diff exif_before.txt exif_after.txt
```

---

## Phase 2: UI Foundation

### Tasks

- [ ] **2.1** Implement custom `TitleBar` component
  - App name + icon
  - Minimize / Maximize / Close buttons
  - Draggable title bar region

- [ ] **2.2** Implement `DropZone` component
  - Large visual drop target
  - Accept: files and folders
  - Drag hover visual feedback (border glow, icon change)
  - Click-to-browse fallback (file dialog + folder dialog)
  - Filter dropped items: only `.heic`/`.heif` or folders

- [ ] **2.3** Implement `FileQueue` component
  - Virtual scrolled list (`@tanstack/react-virtual`)
  - Columns: checkbox, filename, size, status
  - Status icons: ⏳ Queued, 🔄 Converting, ✅ Done, ❌ Error
  - Select all / deselect all
  - Right-click row → "Remove from queue"
  - Empty state message

- [ ] **2.4** Implement `OverallProgress` component
  - Progress bar with percentage
  - File count: "12/27 files"
  - Elapsed time
  - ETA (estimated time remaining)

- [ ] **2.5** Implement `ActionBar`
  - "Convert All" button (primary, prominent)
  - "Clear" button
  - "Cancel" button (visible during conversion)
  - Button states: idle, converting, complete

- [ ] **2.6** Wire IPC between renderer and main
  - Drop files → send paths to main → receive FileInfo[] back
  - Connect file dialog results
  - Connect progress updates

### Deliverable
Working UI: drag files → see them in list → (convert button exists but not wired to worker pool yet).

---

## Phase 3: Batch Processing

### Tasks

- [ ] **3.1** Implement `ConversionManager` in main process
  - Queue management (add, remove, clear, cancel)
  - State machine per file: queued → converting → done/error
  - Dispatch to worker pool
  - Collect results, emit progress

- [ ] **3.2** Implement `WorkerPool`
  - Spawn `N` workers (N = CPU cores - 1, minimum 1)
  - Round-robin job dispatch
  - Handle worker crash → restart worker
  - Handle worker timeout (30s per file default)
  - Graceful shutdown on cancel

- [ ] **3.3** Implement `worker.ts` (worker thread script)
  - Receive job via `parentPort.on('message')`
  - Execute conversion pipeline
  - Report progress/completion/error back
  - Handle graceful termination signal

- [ ] **3.4** Wire batch processing to UI
  - "Convert All" → starts batch
  - Progress updates flow to renderer (throttled: max 30 updates/sec)
  - Per-file status updates
  - Batch complete → summary toast

- [ ] **3.5** Implement cancel functionality
  - Cancel button → terminate workers → respawn pool
  - Mark remaining files as "Cancelled"
  - Already-converted files are kept

- [ ] **3.6** Performance test
  - Benchmark: 100 files, 500 files, 1000 files
  - Monitor: memory usage, CPU usage, conversion time
  - Verify: UI stays responsive during batch

### Deliverable
Full end-to-end: drop files → click convert → see progress → files converted.

---

## Phase 4: Settings & Configuration

### Tasks

- [ ] **4.1** Implement `SettingsPanel` component
  - Collapsible panel (accordion style)
  - Quality slider (1-100) with visual preview indicator
  - Output location: "Same as source" / "Custom folder" + folder picker
  - Naming pattern selector
  - Conflict handling dropdown
  - Checkboxes: Scan subfolders, Delete originals, Preserve timestamps

- [ ] **4.2** Implement `electron-store` integration
  - Settings persist between app restarts
  - Default values defined in constants
  - Migration support for future schema changes

- [ ] **4.3** Connect settings to conversion pipeline
  - Quality → passed to converter
  - Output path → used in file writing
  - Naming → applied to output filename
  - Conflict → skip/overwrite/rename logic

- [ ] **4.4** "Delete originals" safety
  - Confirm dialog: "Are you sure you want to delete X original files?"
  - Only delete after successful conversion
  - If any conversion fails, don't delete that source file

### Deliverable
Fully configurable conversion with persistent settings.

---

## Phase 5: Windows Context Menu Integration

### Tasks

- [ ] **5.1** Implement `registry.ts`
  - `registerContextMenu()` → write HKCU registry keys
  - `unregisterContextMenu()` → remove registry keys
  - `isContextMenuRegistered()` → check current state
  - Registry paths:
    - `.heic` files: `HKCU\Software\Classes\.heic\shell\HEIC2JPG`
    - `.heif` files: `HKCU\Software\Classes\.heif\shell\HEIC2JPG`
    - Folders: `HKCU\Software\Classes\Directory\shell\HEIC2JPG`
    - Background: `HKCU\Software\Classes\Directory\Background\shell\HEIC2JPG`

- [ ] **5.2** Implement `cli-handler.ts`
  - Parse `process.argv` for file/folder paths
  - Detect if launched in CLI mode (args present)
  - Single-instance lock: if app already running, forward args to existing instance
  - If new instance: run in silent/tray mode

- [ ] **5.3** Implement silent/tray mode
  - No main window (or minimized to tray immediately)
  - System tray icon with progress tooltip
  - Tray context menu: "Show progress", "Cancel", "Quit"
  - Windows toast notification on completion

- [ ] **5.4** Settings UI for context menu
  - Toggle: "Enable right-click context menu"
  - Toggle: "Silent mode (tray only)"
  - Status indicator: "Context menu registered ✅" / "Not registered ❌"

- [ ] **5.5** Test scenarios
  - Right-click single .heic file → converts
  - Right-click multi-select .heic files → converts all
  - Right-click folder → scans and converts
  - App already open → files added to existing queue
  - App not running → launches in tray mode

### Deliverable
Full Windows Explorer integration with right-click "Convert to JPG".

---

## Phase 6: Polish & UX

### Tasks

- [ ] **6.1** Dark mode / Light mode theming
  - CSS variables for all colors
  - System preference detection (`prefers-color-scheme`)
  - Manual toggle in UI
  - Smooth transition between themes

- [ ] **6.2** Animations & micro-interactions
  - Drop zone: pulse animation on drag hover
  - File added: slide-in animation
  - Progress bar: smooth fill animation
  - Conversion complete: subtle success animation (checkmark)
  - Button hover effects
  - Panel expand/collapse animation

- [ ] **6.3** Error UX
  - Error tooltip on hover over failed file
  - Batch summary dialog at end (if errors exist)
  - Retry failed files button
  - Copy error log to clipboard

- [ ] **6.4** Keyboard shortcuts
  - `Ctrl+O` → Open file dialog
  - `Ctrl+Shift+O` → Open folder dialog
  - `Ctrl+Enter` → Start conversion
  - `Escape` → Cancel conversion
  - `Delete` → Remove selected files from queue
  - `Ctrl+A` → Select all files

- [ ] **6.5** Accessibility
  - Focus indicators
  - Screen reader labels
  - High contrast support
  - Tab navigation

- [ ] **6.6** Window management
  - Remember window size & position
  - Minimum window size: 480x600
  - Responsive layout (adapts to window resize)

### Deliverable
Polished, responsive, beautiful UI.

---

## Phase 7: Build, Package & Test

### Tasks

- [ ] **7.1** Configure electron-builder
  - NSIS installer for Windows
  - App icon (.ico)
  - File associations (`.heic`, `.heif`)
  - Custom installer pages (optional)
  - Uninstaller with registry cleanup

- [ ] **7.2** Integration testing
  - End-to-end: drop → convert → verify output
  - Batch: 100+ files → all converted with metadata
  - Context menu: right-click → convert → notification
  - Edge cases: empty folder, mixed files, read-only dir

- [ ] **7.3** Performance benchmarks (final)
  - Document: conversion speed per file
  - Document: memory usage at various batch sizes
  - Document: startup time

- [ ] **7.4** Create README.md
  - Feature overview
  - Screenshots
  - Installation instructions
  - Usage guide
  - Build from source instructions

- [ ] **7.5** Create CHANGELOG.md
  - v1.0.0 initial release notes

- [ ] **7.6** Final QA pass
  - Test on fresh Windows 10 VM
  - Test on Windows 11
  - Test with various HEIC sources (iPhone, iPad, Samsung)
  - Verify installer & uninstaller
  - Verify context menu appears & works

### Deliverable
Production-ready `.exe` installer and documentation.

---

## Dependency List

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `sharp` | ^0.33+ | HEIC decoding + JPEG encoding (native, fast) |
| `heic-convert` | ^2.1+ | Fallback HEIC decoder (pure JS) |
| `exifr` | ^7.1+ | EXIF metadata extraction from HEIC |
| `piexif-ts` | ^1.0+ | EXIF injection into JPEG |
| `electron-store` | ^10+ | Persistent settings storage |
| `zustand` | ^5+ | UI state management |
| `@tanstack/react-virtual` | ^3+ | Virtual scrolling for file list |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `electron` | ^33+ | Desktop runtime |
| `electron-vite` | ^3+ | Build tooling |
| `electron-builder` | ^25+ | Packaging & installer |
| `react` | ^18+ | UI framework |
| `react-dom` | ^18+ | React DOM renderer |
| `typescript` | ^5.5+ | Type safety |
| `@types/react` | latest | React type definitions |
| `eslint` | ^9+ | Linting |
| `prettier` | ^3+ | Code formatting |
| `vitest` | ^2+ | Unit testing |

---

## Risk Register

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|------------|--------|------------|-------|
| R1 | `sharp` doesn't support HEIC on target system | Medium | High | Bundle libvips with HEIC support; fallback to `heic-convert` | Phase 1 |
| R2 | EXIF data loss during conversion | Medium | Critical | Validate metadata before/after; integration tests | Phase 1 |
| R3 | Worker thread memory leak on large batches | Low | High | Monitor heap per worker; restart workers after N files | Phase 3 |
| R4 | Context menu registry fails (permissions) | Medium | Medium | HKCU only; graceful error with manual instruction | Phase 5 |
| R5 | Electron app size too large | Medium | Low | Exclude unnecessary native modules; optimize bundle | Phase 7 |
| R6 | Some HEIC variants not supported | Low | Medium | Test with diverse source devices; document limitations | Phase 1 |
