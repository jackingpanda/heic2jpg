# Changelog

User-facing changes follow semantic versioning. This file is generated from `releases/history.json`; edit that source and run `npm run release:notes`.

## [1.2.2] - 2026-10-27

Save JPG copies even when a HEIC-named photo already contains JPEG data.

### Added

- JPEG data in HEIC/HEIF-named files can be saved as verified .jpg copies from the GUI or Explorer menu, without recompression.

### Changed

- Existing JPEG pixels, metadata and orientation are retained. Naming, destination, conflict and timestamp settings still apply.
- The queue and compact window explain whether JPEG copies are ready or saved.

### Fixed

- Already-JPEG inputs are ready to process instead of being blocked by a format-mismatch error.

### Security

- Original JPEGs are always retained, even when recycling is enabled for HEIC conversion.
- Corrupt and oversized JPEG data is rejected without leaving partial output. Metadata-disabled settings produce an explicit retention warning for unchanged JPEG copies.

### Important notes

- Quality and metadata-removal settings apply to HEIC/HEIF conversion; existing JPEGs are copied unchanged.
- Windows builds remain unsigned.

## [1.2.1] - 2026-10-27

Clear diagnostics for photos whose contents do not match their filename extension.

### Added

- Input diagnostics identify JPEG, PNG, WebP, GIF, TIFF, PDF, and AVIF data in HEIC/HEIF-named files.
- Conversion reports include detected formats, diagnostic codes, short file signatures, and recommended actions.

### Changed

- The main queue and compact Explorer window explain when HEIC-named files are already JPEGs and do not require conversion.

### Fixed

- Rescanning an Explorer selection clears obsolete format diagnostics when the input has changed.

### Security

- Diagnostics leave originals unchanged and do not upload photo data or reports. Exported reports identify their private path/signature contents.

### Important notes

- This update diagnoses filename/format mismatches. It does not rename or re-encode mismatched files automatically.
- Windows builds remain unsigned.

## [1.2.0] - 2026-10-26

Release-ready desktop experience, support, and GitHub update delivery.

### Added

- About panel with developer details, license information, and manual update checks.
- Automatic GitHub update checks with explicit download and restart controls.
- In-app problem report form with reviewed email/GitHub drafts and optional basic diagnostics.
- Release history, release validation, GitHub issue templates, CI, and tag-based publishing.
- Screenshot-based setup and right-click conversion guide.

### Changed

- Professional English copy throughout the application and installer.
- One shared brand icon across the interface, taskbar, notifications, installer, and uninstaller.
- Installer displays the installation stage and expanded activity details.
- Application licensing changes to personal, non-commercial use with unmodified redistribution, subject to third-party rights and earlier grants.

### Fixed

- Closing the main window no longer discards an Explorer selection that is waiting to start.

### Security

- Updater installs are blocked during conversion; automatic checks never trigger unattended installation.
- Reports do not collect photos, EXIF, file paths, preferences, or logs automatically.

### Important notes

- Windows builds are currently unsigned. Use the official GitHub Releases page.
- The new application license applies from 1.2.0; earlier MIT grants remain unaffected.

## [1.1.0] - 2026-10-26

Compact progress for practical Explorer conversion.

### Added

- Animated compact window with file counts, stages, elapsed time, taskbar progress, and safe Stop.
- Version label in advanced settings and a documented installer update procedure.

### Changed

- Explorer selections convert automatically even with the main window open.
- Successful compact sessions dismiss after eight seconds; errors stay available for review.

### Fixed

- Repeated selections requeue existing records while honoring conflict settings.
- Upgrade installation restores an existing right-click preference.

## [1.0.0] - 2026-10-26

Initial Windows desktop release.

### Added

- Local HEIC/HEIF decoding and full-resolution JPEG 4:4:4 encoding.
- Drag/drop, native dialogs, virtualized queue, search, filters, retries, and safe cancellation.
- Metadata and timestamp preservation, configurable outputs, dark/light themes, and keyboard controls.
- Opt-in Explorer integration, tray notifications, and Windows installer/uninstaller.

[1.2.2]: https://github.com/jackingpanda/heic2jpg/releases/tag/v1.2.2
[1.2.1]: https://github.com/jackingpanda/heic2jpg/releases/tag/v1.2.1
[1.2.0]: https://github.com/jackingpanda/heic2jpg/releases/tag/v1.2.0
[1.1.0]: https://github.com/jackingpanda/heic2jpg/releases/tag/v1.1.0
[1.0.0]: https://github.com/jackingpanda/heic2jpg/releases/tag/v1.0.0
