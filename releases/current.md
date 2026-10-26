# HEIC2JPG 1.2.2

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

Download the Windows installer below. Update an existing installation by closing HEIC2JPG (including the tray icon) and running the new installer in the same location.

Personal, non-commercial use only. See LICENSE and THIRD_PARTY_NOTICES.md.
