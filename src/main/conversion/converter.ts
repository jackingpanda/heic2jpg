import { readFile, stat, mkdir, mkdtemp, rm, link, rename, utimes, copyFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, dirname, join, parse } from 'node:path'
import sharp from 'sharp'
import decode from 'heic-decode'
import type { WorkerJob, ConvertResult } from '../../shared/types'
import { inspectPhoto } from './scanner'
import { transferMetadata, readOrientation } from './metadata'

sharp.cache(false)
sharp.concurrency(1)
export function outputName(input: string, prefix: string, suffix: string): string {
  return `${prefix}${parse(input).name}${suffix}.jpg`
}
async function exists(file: string): Promise<boolean> {
  try { await stat(file); return true } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error }
}
export async function commitOutput(temp: string, destination: string, conflict: WorkerJob['settings']['conflict']): Promise<string | null> {
  if (conflict === 'overwrite') { await rename(temp, destination); return destination }
  const { name, ext, dir } = parse(destination)
  for (let i = 0; i < 10000; i++) {
    const target = i ? join(dir, `${name} (${i})${ext}`) : destination
    try {
      try { await link(temp, target) }
      catch (error) {
        // Hard links give an atomic commit on NTFS. Other volumes/sandboxes can
        // still guarantee no clobber using an exclusive filesystem copy.
        // Google Drive for desktop reports EISDIR for link() even when both
        // paths refer to regular files. Exclusive copy still prevents clobbering.
        if (!['EPERM', 'ENOTSUP', 'EXDEV', 'EOPNOTSUPP', 'EISDIR'].includes((error as NodeJS.ErrnoException).code || '')) throw error
        await copyFile(temp, target, constants.COPYFILE_EXCL)
      }
      return target
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (conflict === 'skip') return null
    }
  }
  throw new Error('Too many files with the same name. Choose another output folder.')
}
export async function convertPhoto(job: WorkerJob, stage: (text: string, scratch?: string) => void = () => {}): Promise<ConvertResult> {
  const { photo, settings } = job
  const inspected = await inspectPhoto(photo.path)
  const folder = settings.outputMode === 'custom' ? settings.outputPath : dirname(photo.path)
  if (!folder) throw new Error('Choose an output folder first.')
  await mkdir(folder, { recursive: true })
  const destination = join(folder, outputName(photo.path, settings.prefix, settings.suffix))
  if (settings.conflict === 'skip' && await exists(destination)) return { status: 'skipped', outputPath: destination }
  const directory = await mkdtemp(join(folder, '.heic2jpg-'))
  stage('Preparing output', directory)
  const temp = join(directory, 'photo.jpg')
  try {
    const original = await stat(photo.path)
    if (inspected.inputDiagnostic?.detectedFormat === 'JPEG') {
      stage('Copying existing JPEG without recompression')
      await copyFile(photo.path, temp, constants.COPYFILE_EXCL)
      stage('Verifying JPG copy')
      const image = sharp(temp, { failOn: 'warning', limitInputPixels: 100_000_000 })
      const info = await image.metadata()
      if (info.format !== 'jpeg' || !info.width || !info.height) throw new Error('The JPEG copy could not be verified. Original kept.')
      await image.stats()
      const outputSize = (await stat(temp)).size
      if (settings.preserveTimestamps) await utimes(temp, original.atime, original.mtime)
      stage('Saving JPG copy')
      const saved = await commitOutput(temp, destination, settings.conflict)
      if (saved && settings.preserveTimestamps) await utimes(saved, original.atime, original.mtime)
      return saved ? { status: 'done', outputPath: saved, outputSize, copiedUnchanged: true, keepOriginal: true,
        warning: settings.preserveMetadata ? undefined : 'JPEG copied unchanged, including existing metadata. Metadata removal applies only to HEIC/HEIF conversion. Original kept.' }
        : { status: 'skipped', outputPath: destination, keepOriginal: true }
    }
    stage('Reading orientation')
    let orientation = { orientation: 1, rotation: 0 }
    let orientationWarning: string | undefined
    try { orientation = await readOrientation(photo.path) }
    catch { orientationWarning = 'JPEG saved, but photo orientation could not be verified. Original kept.' }
    stage('Decoding photo')
    // Inspect dimensions before allocating RGBA pixels, and always dispose decoder handles.
    const images = await decode.all({ buffer: await readFile(photo.path) })
    let decoded: { width: number; height: number; data: Uint8ClampedArray }
    try {
      if (!images.length) throw new Error('No still photo was found in this file.')
      if (images[0].width * images[0].height > 100_000_000) throw new Error('This photo exceeds the 100 megapixel safety limit.')
      decoded = await images[0].decode()
    } finally { images.dispose() }
    const { width, height, data } = decoded
    stage('Creating JPEG')
    let pipeline = sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels: 4 } }).flatten({ background: '#ffffff' })
    // libheif applies HEIF container rotation. Apply EXIF-only orientations only
    // when there is no container rotation, avoiding the common double rotation.
    const exif = orientation.rotation % 360 === 0 ? orientation.orientation : 1
    if (exif === 2 || exif === 7) pipeline = pipeline.flop()
    if (exif === 4 || exif === 5) pipeline = pipeline.flip()
    if (exif === 3) pipeline = pipeline.rotate(180)
    if ([5, 6, 7].includes(exif)) pipeline = pipeline.rotate(90)
    if (exif === 8) pipeline = pipeline.rotate(270)
    const outputWidth = [5, 6, 7, 8].includes(exif) ? height : width
    const outputHeight = [5, 6, 7, 8].includes(exif) ? width : height
    await pipeline.jpeg({ quality: settings.quality, chromaSubsampling: '4:4:4' }).toFile(temp)
    let warning: string | undefined = orientationWarning
    if (settings.preserveMetadata) {
      stage('Keeping metadata')
      warning = (await transferMetadata(photo.path, temp, outputWidth, outputHeight)) || warning
    }
    const output = await sharp(temp).metadata()
    if (output.format !== 'jpeg' || output.width !== outputWidth || output.height !== outputHeight) throw new Error('The output photo could not be verified. Original kept.')
    // Decode once to verify the complete JPEG, rather than trusting just its header.
    await sharp(temp).stats()
    const outputSize = (await stat(temp)).size
    if (settings.preserveTimestamps) await utimes(temp, original.atime, original.mtime)
    stage('Saving JPEG')
    const saved = await commitOutput(temp, destination, settings.conflict)
    if (saved && settings.preserveTimestamps) await utimes(saved, original.atime, original.mtime)
    return saved ? { status: 'done', outputPath: saved, outputSize, warning } : { status: 'skipped', outputPath: destination }
  } catch (error) {
    const e = error as NodeJS.ErrnoException
    if (e.code === 'EACCES' || e.code === 'EPERM') throw new Error('Cannot write here. Choose a folder you can write to.')
    if (e.code === 'ENOSPC') throw new Error('Your disk is full. Free some space and retry.')
    throw new Error(`${basename(photo.path)}: ${e.message || 'This image could not be decoded.'}`)
  } finally { await rm(directory, { recursive: true, force: true }) }
}
