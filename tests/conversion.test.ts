import { beforeAll, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, writeFile, copyFile, stat, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { inspectPhoto, scanPhotos, isHeicHeader } from '../src/main/conversion/scanner'
import { convertPhoto, commitOutput } from '../src/main/conversion/converter'
import { exiftool } from '../src/main/conversion/metadata'
import { validateSettings } from '../src/shared/validation'
import { defaults, type Settings, type Photo } from '../src/shared/types'
import { parsePaths } from '../src/main/context-menu'

const root = resolve('.test-output')
const fixture = resolve('tests/fixtures/example.heic')
let directory: string
let photo: Photo
let originalHash: string
let metadataPhoto: Photo
let metadataSettings: Settings
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

beforeAll(async () => {
  await mkdir(root, { recursive: true })
  directory = await mkdtemp(join(root, 'run-'))
  const input = join(directory, 'A photo with spaces & symbols.heic')
  await copyFile(fixture, input)
  photo = await inspectPhoto(input)
  originalHash = hash(await readFile(input))
  metadataPhoto = await inspectPhoto(input)
  metadataSettings = { ...defaults, outputMode: 'custom', outputPath: join(directory, 'output') }
}, 60000)

describe('input and settings validation', () => {
  it('accepts a JPEG-named HEIC for unchanged copying and rejects an empty HEIC', async () => {
    const disguised = join(directory, 'fake.heic')
    await sharp({ create: { width: 10, height: 10, channels: 3, background: '#f00' } }).jpeg().toFile(disguised)
    await expect(inspectPhoto(disguised)).resolves.toMatchObject({ status: 'queued', inputDiagnostic: { detectedFormat: 'JPEG' } })
    const empty = join(directory, 'empty.heic'); await writeFile(empty, '')
    await expect(inspectPhoto(empty)).rejects.toThrow('empty')
    expect(isHeicHeader(Buffer.alloc(4))).toBe(false)
  })
  it('scans one level by default, recurses only on request and ignores unrelated files', async () => {
    const scan = join(directory, 'scan'); await mkdir(join(scan, 'nested'), { recursive: true })
    await copyFile(fixture, join(scan, 'one.HEIC')); await copyFile(fixture, join(scan, 'nested', 'two.heif'))
    await writeFile(join(scan, 'notes.txt'), 'leave this alone')
    const shallow: Photo[] = []; const deep: Photo[] = []
    await scanPhotos([scan], false, p => shallow.push(p), () => {})
    await scanPhotos([scan], true, p => deep.push(p), () => {})
    expect(shallow).toHaveLength(1); expect(deep).toHaveLength(2)
  })
  it('bounds untrusted settings and removes unsafe output-name characters', () => {
    const settings = validateSettings({ quality: 500, concurrency: -8, prefix: '../x/', suffix: ':?', conflict: 'evil' })
    expect(settings.quality).toBe(100); expect(settings.concurrency).toBe(1)
    expect(settings.prefix).not.toMatch(/[\\/:]/); expect(settings.conflict).toBe('skip')
    expect(validateSettings({ quality: NaN }).quality).toBe(95)
  })
  it('parses Explorer arguments with spaces without treating flags as paths', () => {
    expect(parsePaths(['app.exe', '--convert', 'C:\\My photos\\a.heic', '--qa'])).toEqual(['C:\\My photos\\a.heic'])
    expect(parsePaths(['app.exe'])).toEqual([])
  })
})

describe('real HEIC conversion', () => {
  it('creates a full-resolution readable 4:4:4 JPEG and preserves the original', async () => {
    const sourceTime = (await stat(photo.path)).mtimeMs
    const result = await convertPhoto({ photo, settings: { ...metadataSettings, preserveMetadata: false } })
    expect(result.status).toBe('done')
    const info = await sharp(result.outputPath).metadata()
    expect(info.format).toBe('jpeg'); expect(info.width).toBe(1280); expect(info.height).toBe(854)
    expect(info.chromaSubsampling).toBe('4:4:4')
    await expect(sharp(result.outputPath).stats()).resolves.toHaveProperty('channels')
    expect(hash(await readFile(photo.path))).toBe(originalHash)
    expect(Math.abs((await stat(result.outputPath)).mtimeMs - sourceTime)).toBeLessThan(10)
    expect((await readdir(metadataSettings.outputPath)).filter(p => p.startsWith('.heic2jpg-'))).toHaveLength(0)
  }, 60000)
  it('transfers and verifies camera, date, GPS, XMP and normalized orientation', async () => {
    const input = join(directory, 'metadata.heic'); await copyFile(fixture, input)
    await exiftool(['-overwrite_original', '-Make=Apple', '-Model=iPhone Test', '-DateTimeOriginal=2024:06:07 12:34:56', '-GPSLatitude=13.75', '-GPSLatitudeRef=N', '-GPSLongitude=100.5', '-GPSLongitudeRef=E', '-XMP-dc:Description=Metadata integration test', input])
    metadataPhoto = await inspectPhoto(input)
    const result = await convertPhoto({ photo: metadataPhoto, settings: metadataSettings })
    expect(result.status).toBe('done'); expect(result.warning).toBeUndefined()
    const [tags] = JSON.parse(await exiftool(['-j', '-n', '-Make', '-Model', '-DateTimeOriginal', '-GPSLatitude', '-GPSLongitude', '-Orientation', '-Description', result.outputPath]))
    expect(tags.Make).toBe('Apple'); expect(tags.Model).toBe('iPhone Test')
    expect(tags.DateTimeOriginal).toBe('2024:06:07 12:34:56')
    expect(tags.GPSLatitude).toBeCloseTo(13.75); expect(tags.GPSLongitude).toBeCloseTo(100.5)
    expect(tags.Orientation).toBe(1); expect(tags.Description).toBe('Metadata integration test')
  }, 60000)
  it('skips existing JPEGs and keeps both when rename is selected', async () => {
    const skipped = await convertPhoto({ photo, settings: { ...metadataSettings, preserveMetadata: false } })
    expect(skipped.status).toBe('skipped')
    const renamed = await convertPhoto({ photo, settings: { ...metadataSettings, preserveMetadata: false, conflict: 'rename' } })
    expect(renamed.outputPath).toContain('(1).jpg'); expect(renamed.status).toBe('done')
  }, 60000)
  it('rotates EXIF-only portrait photos even when metadata preservation is disabled', async () => {
    const input = join(directory, 'portrait.heic'); await copyFile(fixture, input)
    await exiftool(['-overwrite_original', '-Orientation#=6', input])
    const portrait = await inspectPhoto(input)
    const result = await convertPhoto({ photo: portrait, settings: { ...metadataSettings, preserveMetadata: false } })
    const info = await sharp(result.outputPath).metadata()
    expect(info.width).toBe(854); expect(info.height).toBe(1280)
  }, 60000)
  it('replaces an existing JPEG only in overwrite mode', async () => {
    const target = join(metadataSettings.outputPath, 'A photo with spaces & symbols.jpg')
    await writeFile(target, 'old file')
    const result = await convertPhoto({ photo, settings: { ...metadataSettings, preserveMetadata: false, conflict: 'overwrite' } })
    expect(result.status).toBe('done'); expect((await sharp(target).metadata()).format).toBe('jpeg')
  }, 60000)
  it('does not overwrite a competing file when two outputs race', async () => {
    const a = join(directory, 'temp-a.jpg'); const b = join(directory, 'temp-b.jpg'); const target = join(directory, 'race.jpg')
    await writeFile(a, 'A'); await writeFile(b, 'B')
    const results = await Promise.all([commitOutput(a, target, 'rename'), commitOutput(b, target, 'rename')])
    expect(new Set(results).size).toBe(2)
    expect(new Set(await Promise.all(results.map(file => readFile(file!, 'utf8'))))).toEqual(new Set(['A', 'B']))
  })
  it('rejects corrupt data without leaving a partial JPG', async () => {
    const input = join(directory, 'corrupt.heic'); const bytes = Buffer.alloc(32)
    bytes.writeUInt32BE(32); bytes.write('ftyp', 4); bytes.write('heic', 8); await writeFile(input, bytes)
    const corrupt = await inspectPhoto(input)
    await expect(convertPhoto({ photo: corrupt, settings: { ...defaults, preserveMetadata: false } })).rejects.toThrow()
    expect((await readdir(directory)).some(p => p === 'corrupt.jpg' || p.startsWith('.heic2jpg-'))).toBe(false)
  }, 60000)
})
