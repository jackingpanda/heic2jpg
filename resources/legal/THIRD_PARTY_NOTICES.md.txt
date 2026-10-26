# Third-party software

HEIC2JPG includes software distributed under separate licenses. Their licenses remain applicable; the application's KULAM Personal Use License does not replace them.

- Electron (MIT): https://github.com/electron/electron
- React (MIT): https://github.com/facebook/react
- Sharp (Apache-2.0), including libvips (LGPL-2.1-or-later) and its dependencies: https://sharp.pixelplumbing.com and the notices in `node_modules/@img/sharp-win32-x64`.
- heic-decode (MIT): https://github.com/catdad-experiments/heic-decode
- libheif-js and libheif (LGPL-3.0), libde265 (LGPL-3.0): https://github.com/catdad-experiments/libheif-js and https://github.com/strukturag/libheif. The decoder ships as a separate, unmodified module in the unpacked application resources and can be replaced with a compatible build. Build/source instructions: https://github.com/catdad-experiments/libheif-emscripten.
- ExifTool (Perl Artistic License or GPL): https://exiftool.org. Windows distribution: https://github.com/photostructure/exiftool-vendored.exe. It ships as a separate executable with its included license and runtime files.
- Lucide icons (ISC): https://lucide.dev/license
- TanStack Virtual (MIT): https://github.com/TanStack/virtual

The real integration-test image belongs to libheif's examples collection; see `tests/fixtures/README.md`. It is not bundled into the installed application.

- electron-updater (MIT): https://github.com/electron-userland/electron-builder
- electron-builder NSIS template portions (MIT): https://github.com/electron-userland/electron-builder

Full bundled notice copies and a version inventory are included under resources/legal in official builds. LGPL replacement/debugging rights are expressly preserved in section 5 of LICENSE. See THIRD_PARTY_SOURCES.md for source and build access.
