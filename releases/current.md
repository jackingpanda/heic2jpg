# HEIC2JPG 1.2.3

Fix saving JPG output on Google Drive shared drives.

### Fixed

- Google Drive for desktop can report EISDIR when creating a hard link between regular files. Saving now falls back to an exclusive file copy.
- Skip and rename modes continue to protect existing files when the cloud filesystem does not support hard links.

### Security

- Permission errors are still reported rather than bypassed. Existing JPGs and original photos remain protected.

### Important notes

- Windows builds remain unsigned.

Download the Windows installer below. Update an existing installation by closing HEIC2JPG (including the tray icon) and running the new installer in the same location.

Personal, non-commercial use only. See LICENSE and THIRD_PARTY_NOTICES.md.
