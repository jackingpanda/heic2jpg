import type { Photo } from './types'

export function inputDiagnosticSummary(photos: Photo[]): string | undefined {
  const count = photos.filter(photo => photo.status === 'error' && photo.inputDiagnostic?.detectedFormat === 'JPEG').length
  if (!count) return undefined
  return `${count} ${count === 1 ? 'file is already a JPEG' : 'files are already JPEGs'} with a HEIC/HEIF extension. Save .jpg copies; no conversion is needed. Originals are unchanged.`
}

export function conversionReport(photos: Photo[], version: string, warnings: string[] = []): string {
  const rows = photos.map(photo => [
    `${photo.status.toUpperCase()}  ${photo.path}`,
    photo.outputPath && `  Output: ${photo.outputPath}`,
    photo.error && `  Error: ${photo.error}`,
    photo.warning && `  Warning: ${photo.warning}`,
    photo.inputDiagnostic && [
      `  Diagnostic: ${photo.inputDiagnostic.code}`,
      `  Expected format: ${photo.inputDiagnostic.expectedFormat}`,
      `  Detected format: ${photo.inputDiagnostic.detectedFormat}`,
      `  File signature (first 16 bytes): ${photo.inputDiagnostic.signature}`,
      `  Recommended action: ${photo.inputDiagnostic.recommendation}`
    ].join('\n')
  ].filter(Boolean).join('\n'))
  return [
    `HEIC2JPG ${version} conversion report`, new Date().toISOString(),
    'Private report: contains local file paths and file signatures. Review before sharing. No image pixels or EXIF metadata are included.',
    `Files: ${photos.length} | Ready: ${photos.filter(photo => photo.status === 'queued').length} | Saved: ${photos.filter(photo => photo.status === 'done').length} | Needs attention: ${photos.filter(photo => photo.status === 'error').length}`,
    inputDiagnosticSummary(photos), warnings.length ? `Scan warnings:\n${warnings.join('\n')}` : undefined,
    '', rows.join('\n\n'), ''
  ].filter(line => line !== undefined).join('\n')
}
