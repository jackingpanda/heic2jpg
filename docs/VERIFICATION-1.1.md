# HEIC2JPG 1.1.0 verification

26 October 2026, Windows x64. The installed user application was not replaced automatically.

## Passed

- Strict TypeScript and production build, including two separate sandboxed preloads.
- All 11 conversion/filesystem regression tests.
- Real Electron CLI/Explorer-routing integration test with a 404×276 compact window and no large window on initial compact-mode launch.
- Three real HEIC photos converted successfully with no metadata warnings.
- Repeat selection requeues the same three records and respects skip-existing behavior.
- Stop finishes active photos and marks unstarted ones stopped.
- Show app opens the main interface and hides the compact progress window.
- An Explorer request automatically converts only its own selection when the main app is already visible.
- The compact renderer has no full desktop API; its dedicated preload exposes only progress, hide, stop, output reveal and open-app operations. Zero renderer errors in the harness.
- Visual inspection of active and completed screenshots under `.test-output/quick-*.png`; CSS animates the orbit, sweep and real progress transitions, with reduced-motion support.
- Packaged v1.1.0 executable independently converted a real HEIC to a readable 1280×854 JPEG and preserved synthetic camera make/model and capture date using its bundled metadata executable. No stderr was emitted; executable file-version metadata reports 1.1.0.

Reports: `.test-output/quick-report.json`; conversion regression output from `npm test`.

## Installer and upgrade design

App ID, executable name, product name and settings path remain stable. Version is bumped to 1.1.0. The NSIS initialization hook records the existing right-click registration before invoking the old uninstaller; the install hook restores those verbs using the current installation path. Future uninstallers preserve verbs during updates and remove them on a real uninstall. Preferences remain in the existing per-user data directory.

The NSIS installer was successfully compiled under `release/v1.1.0/HEIC2JPG-Setup-1.1.0.exe` with the upgrade hooks. A SHA-256 checksum is saved alongside it. An actual upgrade of the user's installed copy is intentionally left to the user following `UPDATING.md`; no unattended installation or removal of their existing installation was performed.

Primary references: https://www.electron.build/v26/docs/nsis/ (stable app ID / installer GUID), https://www.electron.build/nsis/ (`isUpdated` and previous-uninstaller behavior), https://www.electronjs.org/docs/latest/api/browser-window (progress indicators, window sizing and focus behavior).
