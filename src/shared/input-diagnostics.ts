import type { Photo } from './types'

export function inputDiagnosticSummary(photos: Photo[]): string | undefined {
  const pending = photos.filter(photo => ['queued', 'converting', 'cancelled'].includes(photo.status) && photo.inputDiagnostic?.detectedFormat === 'JPEG').length
  const saved = photos.filter(photo => photo.status === 'done' && photo.copiedUnchanged).length
  if (pending) return `${pending} ${pending === 1 ? 'file is already a JPEG' : 'files are already JPEGs'}. Convert to save .jpg copies without recompression, including existing metadata. Originals are kept.`
  if (saved) return `${saved} JPG ${saved === 1 ? 'copy saved' : 'copies saved'} without recompression. Existing metadata and originals are kept.`
  return undefined
}

export function conversionReport(photos: Photo[], version: string, warnings: string[] = []): string {
  const rows = photos.map(photo => [
    `${photo.status.toUpperCase()}  ${photo.path}`,
    photo.outputPath && `  Output: ${photo.outputPath}`,
    photo.error && `  Error: ${photo.error}`,
    photo.warning && `  Warning: ${photo.warning}`,
    photo.copiedUnchanged && '  Method: JPEG copied unchanged without recompression; original kept.',
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
