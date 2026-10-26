# HEIC2JPG 1.2.1

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

Download the Windows installer below. Update an existing installation by closing HEIC2JPG (including the tray icon) and running the new installer in the same location.

Personal, non-commercial use only. See LICENSE and THIRD_PARTY_NOTICES.md.
