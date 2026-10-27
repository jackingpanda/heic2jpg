# HEIC2JPG 1.2.4

Keep the Windows taskbar associated with the correct HEIC2JPG icon.

### Added

- Windows packaging verifies every embedded executable icon size against the canonical application logo.

### Changed

- Main and compact windows explicitly identify their taskbar icon and relaunch target.
- Application windows use the multi-resolution ICO on Windows.

### Fixed

- Development and QA runs no longer share the installed application's Windows identity, preventing Electron shortcuts from representing HEIC2JPG on the taskbar.

### Important notes

- Windows builds remain unsigned.

Download the Windows installer below. Update an existing installation by closing HEIC2JPG (including the tray icon) and running the new installer in the same location.

Personal, non-commercial use only. See LICENSE and THIRD_PARTY_NOTICES.md.
