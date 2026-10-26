# Maintaining releases

Only the project owner or an authorized maintainer should publish official builds. No signing certificate or personal access token belongs in Git history.

## One source of release information

`releases/history.json` is authoritative. Add a new first entry with a semantic version, ISO date, concise summary and user-facing added/changed/fixed/security/notes lists. Explain changes in terms of behavior and impact. Record known limitations and licensing changes. Do not edit generated CHANGELOG.md or releases/current.md directly.

1. Add the release entry and set the matching version with `npm version 1.2.1 --no-git-tag-version --ignore-scripts` (use the actual intended version).
2. Run `npm run release:notes`. Review the generated changelog and current release notes.
3. Run `npm run release:check`, `npm test`, `npm run build`, `npm run test:ui`, and `npm run test:progress`.
4. Run `npm run package`. This generates the icons, license inventory, checked NSIS stage customization, Windows installer, latest.yml and block map. Local packaging explicitly does not publish.
5. Verify the packaged build with `node scripts/verify-package.cjs <release-output-directory>`. Test the installer/upgrade on an isolated Windows machine. Refresh documentation screenshots when the workflow changes.
6. Commit the reviewed source, assets and documentation. Push main, then create and push the matching `v1.2.1` tag. Never move an already-published release tag to different code.

The tag triggers `.github/workflows/release.yml` on Windows. It verifies the version/notes, runs tests and builds the installer without publishing through electron-builder. `scripts/publish-release.cjs` verifies the installer against latest.yml, creates one draft release, uploads and verifies all three assets sequentially, then publishes the complete release using the workflow's repository-scoped token. This avoids concurrent release creation and a public feed with missing assets. The About updater reads that public feed. Installer assets are release attachments, never Git source files.

A failed upload leaves an unpublished draft. Rerunning the same tag resumes a matching draft, verifies existing assets, and uploads only missing ones. Different or incomplete existing assets fail validation without replacement. A fully matching published release is left unchanged. Do not move a published tag or replace an installer under an existing version.

## Automated checks

Pushes/PRs run Windows conversion/support/updater tests and a production build. The UI harness uses public fixtures and isolated local profiles. The updater state-machine tests cover opt-in downloads, explicit installation, active-conversion blocking, missing feeds and diagnostics privacy; they do not replace a two-version real update test on a separate Windows installation.

## Icons and installer details

`resources/icon.svg` is the canonical application mark. `npm run assets` generates the PNG, multi-resolution ICO and installer bitmaps from it. Renderer, native windows, tray/notifications, installer and uninstaller all use these assets. Windows may continue displaying a cached pinned shortcut icon until that shortcut is refreshed.

`scripts/prepare-installer.cjs` derives the NSIS script from the installed electron-builder template and checks expected tokens before adding readable installation phases and visible details. Do not hand-edit installer/generated. Review the generator when updating electron-builder. NSIS include hooks preserve the right-click setting across older uninstallers and genuine uninstall removes the verbs.

## Signing and update integrity

Current Windows builds are unsigned. A public release checksum protects integrity relative to the trusted release manifest; it is not an Authenticode publisher identity. Before promising signed production distribution, obtain an appropriate signing service/certificate and configure it securely in CI. Never ship a GitHub token in the app. Current clients check automatically but require explicit actions to download and restart/install.

## License and source obligations

The current custom license does not revoke previous MIT grants or override upstream licenses. Keep legal files, LGPL exceptions, third-party inventory and source access information with each release. Ensure source corresponding to redistributed LGPL-covered binaries remains available for the required period. Follow legal/README.md before broad distribution or enforcement.

## GitHub Desktop

Choose File → Add local repository and select this project folder. The repository is already initialized with origin `https://github.com/jackingpanda/heic2jpg.git`. GitHub Desktop can show changes, commits and push/pull state. Tag-based releases can be prepared with Git or by an authorized maintainer; the Actions page shows build and publication results.
