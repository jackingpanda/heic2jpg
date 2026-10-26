# Third-party source and replacement information

The personal-use/no-unrelated-modification restrictions apply to KULAM-owned application material only. They do not override third-party permissions or source requirements.

HEIC2JPG uses unmodified third-party packages. Exact installed package versions are pinned in package-lock.json. The packaged resources/legal/dependencies.json inventory records resolved production package versions and their declared licenses/repositories; accompanying license files are copied from those packages. The runtime packages also retain their own notices.

## LGPL image libraries

| Component | Source / build information |
|---|---|
| libheif-js / libheif | https://github.com/catdad-experiments/libheif-js and https://github.com/strukturag/libheif |
| libheif WebAssembly build | https://github.com/catdad-experiments/libheif-emscripten (use the version matching the libheif-js package) |
| libde265 | https://github.com/strukturag/libde265 |
| libvips and Sharp binary dependencies | https://github.com/libvips/libvips and https://github.com/lovell/sharp-libvips |
| Sharp wrapper | https://github.com/lovell/sharp |

For matching binary versions, see the installed package's package.json, included license/versions notices, libheif-js release tag and require('sharp').versions in a source checkout. Use the upstream build recipes and their dependency versions. Source archives and build instructions are available through those repositories' tags/releases. For a copy of the corresponding third-party source and build information for a particular official HEIC2JPG release, contact heic2jpg@kulam.my.id; identify the application version and component. KULAM will provide source required by the applicable third-party license without additional application-use restrictions. This offer remains available for at least three years after the last distribution of the relevant release, and longer where its license requires it.

## Replacing a compatible library

The Windows application's resources/app.asar.unpacked/node_modules/libheif-js and native Sharp/@img modules are deliberately kept outside the application archive. You may replace an LGPL-covered library with an interface-compatible build to exercise its license rights. Keep architecture and ABI requirements compatible, retain backups, and verify outputs before relying on a custom library build. The application license permits necessary debugging/reverse engineering and relinking of the combined work for this purpose. These rights do not authorize unrelated application rebranding or commercial use of KULAM-owned portions.

## ExifTool and other components

ExifTool is a separate executable with its Perl runtime and notices: https://exiftool.org and https://github.com/photostructure/exiftool-vendored.exe. Electron/Chromium, React, TanStack Virtual, Lucide, electron-updater and their dependencies retain their own licenses. Generated installer customizations derive from electron-builder's MIT-licensed NSIS templates; their copyright/license notice is included in resources/legal.
