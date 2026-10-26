# Test photo provenance

`example.heic` comes from the libheif project's public example image:
https://github.com/strukturag/libheif/blob/master/examples/example.heic

It contains multiple still images. The app intentionally exports only the primary image. Run `node scripts/prepare-fixtures.cjs` if the file is missing. Tests create copies under `.test-output` and add synthetic metadata there; the fixture remains unchanged.

The binary image is not committed to this repository or included in application releases. `npm test` fetches it when necessary through `scripts/ensure-fixture.cjs` and verifies its pinned SHA-256 checksum. The image remains third-party test material under the upstream project's applicable terms, rather than KULAM application material.
