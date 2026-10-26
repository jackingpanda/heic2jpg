import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, writeFile, readFile, readdir, copyFile, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import sharp from 'sharp'
import { inspectPhoto, scanPhotos } from '../src/main/conversion/scanner'
import { convertPhoto } from '../src/main/conversion/converter'
import { conversionReport, inputDiagnosticSummary } from '../src/shared/input-diagnostics'
import { ConversionManager } from '../src/main/manager'
import { defaults, type Photo } from '../src/shared/types'

async function directory() {
  const root = resolve('.test-output'); await mkdir(root, { recursive: true })
  return mkdtemp(join(root, 'format-diagnostics-'))
}
describe('input format diagnostics', () => {
  it('diagnoses a mixed batch without changing originals or creating JPEG outputs', async () => {
    const folder = await directory()
    const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#abc' } }).jpeg().toBuffer()
    const file = join(folder, 'extension-mismatch.HEIC')
    await writeFile(file, jpeg)
    await copyFile(resolve('tests/fixtures/example.heic'), join(folder, 'real.heic'))
    await writeFile(join(folder, 'unknown.heif'), 'not an image, without a recognized signature')
    const photos: Photo[] = []; const warnings: string[] = []
    await scanPhotos([folder], false, photo => photos.push(photo), warning => warnings.push(warning))
    expect(warnings).toEqual([])
    expect(photos.find(photo => photo.name === 'real.heic')?.status).toBe('queued')
    const mismatch = photos.find(photo => photo.name === 'extension-mismatch.HEIC')!
    expect(mismatch.status).toBe('queued')
    expect(mismatch.inputDiagnostic).toMatchObject({ code: 'FORMAT_MISMATCH', detectedFormat: 'JPEG', expectedFormat: 'HEIC/HEIF' })
    expect(mismatch.inputDiagnostic?.signature.startsWith('FF D8 FF')).toBe(true)
    expect(mismatch.inputDiagnostic?.recommendation).toContain('without recompression')
    expect(photos.find(photo => photo.name === 'unknown.heif')?.inputDiagnostic?.code).toBe('UNSUPPORTED_FORMAT')
    expect(await readFile(file)).toEqual(jpeg)
    expect((await readdir(folder)).filter(name => name.endsWith('.jpg'))).toEqual([])
    const report = conversionReport(photos, 'test-version', ['Example scan warning'])
    expect(report).toContain('Diagnostic: FORMAT_MISMATCH')
    expect(report).toContain('Detected format: JPEG')
    expect(report).toContain('Private report: contains local file paths')
    expect(report).toContain('Example scan warning')
    expect(inputDiagnosticSummary(photos)).toContain('1 file is already a JPEG')
    expect(inputDiagnosticSummary([mismatch, { ...mismatch, id: 'second' }])).toContain('2 files are already JPEGs')
  })
  it('recognizes PNG and AVIF data instead of treating a compatible brand as HEIC', async () => {
    const folder = await directory()
    const png = join(folder, 'renamed-png.heic')
    await sharp({ create: { width: 8, height: 8, channels: 3, background: '#abc' } }).png().toFile(png)
    await expect(inspectPhoto(png)).rejects.toMatchObject({ diagnostic: { detectedFormat: 'PNG' } })
    const bytes = Buffer.alloc(32); bytes.writeUInt32BE(32); bytes.write('ftyp', 4); bytes.write('avif', 8); bytes.write('mif1', 16)
    const avif = join(folder, 'renamed-avif.heif'); await writeFile(avif, bytes)
    await expect(inspectPhoto(avif)).rejects.toMatchObject({ diagnostic: { detectedFormat: 'AVIF' } })
  })
  it('clears stale mismatch diagnostics when an Explorer selection is rescanned', async () => {
    const folder = await directory(); const file = join(folder, 'rescanned.heic')
    await sharp({ create: { width: 8, height: 8, channels: 3, background: '#abc' } }).jpeg().toFile(file)
    const manager = new ConversionManager({ ...defaults }, false, async () => {})
    await manager.add([file], true)
    const id = manager.state.photos[0].id
    expect(manager.state.photos[0].inputDiagnostic?.detectedFormat).toBe('JPEG')
    await copyFile(resolve('tests/fixtures/example.heic'), file)
    await manager.add([file], true)
    expect(manager.state.photos).toHaveLength(1)
    expect(manager.state.photos[0]).toMatchObject({ id, status: 'queued' })
    expect(manager.state.photos[0].inputDiagnostic).toBeUndefined()
    expect(inputDiagnosticSummary(manager.state.photos)).toBeUndefined()
  })
  it('saves a byte-identical JPG with metadata, orientation, timestamps and conflict handling', async () => {
    const folder = await directory(); const file = join(folder, 'already-jpeg.HEIC')
    const bytes = await sharp({ create: { width: 16, height: 8, channels: 3, background: '#abc' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    await writeFile(file, bytes)
    const photo = await inspectPhoto(file)
    const sourceTime = (await stat(file)).mtimeMs
    const settings = { ...defaults, quality: 1, outputMode: 'custom' as const, outputPath: join(folder, 'output'), prefix: 'copy_', suffix: '_saved', recycleOriginals: true }
    const stages: string[] = []
    const result = await convertPhoto({ photo, settings }, stage => stages.push(stage))
    expect(result).toMatchObject({ status: 'done', copiedUnchanged: true, keepOriginal: true })
    expect(result.warning).toBeUndefined()
    expect(result.outputPath).toBe(join(settings.outputPath, 'copy_already-jpeg_saved.jpg'))
    expect(await readFile(result.outputPath)).toEqual(bytes)
    expect(await readFile(file)).toEqual(bytes)
    expect((await sharp(result.outputPath).metadata()).orientation).toBe(6)
    expect(Math.abs((await stat(result.outputPath)).mtimeMs - sourceTime)).toBeLessThan(10)
    expect(stages).toContain('Copying existing JPEG without recompression')
    expect((await convertPhoto({ photo, settings })).status).toBe('skipped')
    const renamed = await convertPhoto({ photo, settings: { ...settings, conflict: 'rename' } })
    expect(renamed.outputPath).toContain('(1).jpg'); expect(await readFile(renamed.outputPath)).toEqual(bytes)
    await writeFile(result.outputPath, 'old destination')
    const replaced = await convertPhoto({ photo, settings: { ...settings, conflict: 'overwrite' } })
    expect(await readFile(replaced.outputPath)).toEqual(bytes)
    expect((await readdir(settings.outputPath)).some(name => name.startsWith('.heic2jpg-'))).toBe(false)
  })
  it('explains metadata retention when an unchanged JPEG copy is requested with metadata disabled', async () => {
    const folder = await directory(); const file = join(folder, 'metadata-retained.heif')
    const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#abc' } }).jpeg().withMetadata().toBuffer()
    await writeFile(file, bytes)
    const result = await convertPhoto({ photo: await inspectPhoto(file), settings: { ...defaults, preserveMetadata: false } })
    expect(result.status).toBe('done'); expect(result.keepOriginal).toBe(true)
    expect(result.warning).toContain('including existing metadata')
    expect(await readFile(result.outputPath)).toEqual(bytes)
  })
  it.each(['corrupt', 'oversized'])('rejects a %s JPEG copy without leaving partial output', async kind => {
    const folder = await directory(); const file = join(folder, 'unsafe.heic')
    let bytes = Buffer.from([255, 216, 255, 224, 0, 16, 0, 0])
    if (kind === 'oversized') {
      bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#abc' } }).jpeg().toBuffer()
      const frame = bytes.indexOf(Buffer.from([255, 192])); expect(frame).toBeGreaterThan(0)
      bytes.writeUInt16BE(20000, frame + 5); bytes.writeUInt16BE(20000, frame + 7)
    }
    await writeFile(file, bytes)
    await expect(convertPhoto({ photo: await inspectPhoto(file), settings: { ...defaults } })).rejects.toThrow()
    expect(await readFile(file)).toEqual(bytes)
    expect((await readdir(folder)).some(name => name.endsWith('.jpg') || name.startsWith('.heic2jpg-'))).toBe(false)
  })
})
