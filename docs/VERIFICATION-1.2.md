# HEIC2JPG 1.2.0 verification

26 October 2026 · Windows x64 · Node 24 / Electron 45.

## Passed locally

- Strict TypeScript and production main, worker, full preload, compact preload and renderer builds.
- 11 existing real-photo/filesystem tests and 5 support/updater tests (16 total). The latter cover report validation, optional diagnostics, fixed destinations, private security reports, update availability, explicit downloads/installation, busy conversion blocking, automatic checking/opt-out, missing releases and development behavior.
- Real compact-window regression: three HEIC conversions, repeat selection/skip, safe cancellation, opening the main app and automatic conversion of only an Explorer selection when the main app is visible. No renderer errors.
- Documentation capture opened the actual About, report and release-history panels, converted two public sample photos, and captured eight application/progress screenshots without including personal photos.
- NSIS compilation with canonical icons, English-only installer copy, license page, readable installation phases, visible activity details, upgrade hooks and a generated GitHub latest.yml manifest.
- Build-time ASAR guard verified application metadata, required entry points and 4,380 archived file hashes before packaging.
- The rebuilt packaged executable independently produced a readable 1280×854 JPEG and preserved synthetic camera/capture-date metadata, with no stderr.
- Dependency audit: zero known vulnerabilities at preparation time. This is an advisory snapshot, not a guarantee against unknown issues.

## Important packaging lesson

An earlier local packaging attempt was rejected during verification after documentation changed while the package was being assembled. It was not published. The build now has an afterPack archive consistency/hash check, and included source files were kept unchanged while the verified package was created.

## Release boundaries

Windows builds remain unsigned. The existing installed user copy was not overwritten automatically. A real two-version download/restart upgrade and clean Windows 10/11 installation/Explorer checks remain isolated-machine release validation. Updater unit tests and generated manifests do not claim an actual installed upgrade has occurred.

The current personal-use license is prospective, preserves prior MIT grants and third-party/mandatory rights, and should receive qualified legal review for jurisdiction-specific enforcement. Report forms prepare user-reviewed email/issue drafts; no support messages were sent during testing.
