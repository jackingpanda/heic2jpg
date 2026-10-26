import { open, opendir, lstat, realpath } from 'node:fs/promises'
import { extname, basename, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { InputDiagnostic, Photo } from '../../shared/types'

export class InputInspectionError extends Error {
  constructor(message: string, readonly diagnostic: InputDiagnostic) { super(message); this.name = 'InputInspectionError' }
}

export function detectOtherFormat(header: Buffer): InputDiagnostic['detectedFormat'] {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'JPEG'
  if (header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'PNG'
  if (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') return 'WebP'
  if (/^GIF8[79]a$/.test(header.toString('ascii', 0, 6))) return 'GIF'
  if (header.subarray(0, 4).equals(Buffer.from([73, 73, 42, 0])) || header.subarray(0, 4).equals(Buffer.from([77, 77, 0, 42]))) return 'TIFF'
  if (header.toString('ascii', 0, 5) === '%PDF-') return 'PDF'
  if (header.toString('ascii', 4, 8) === 'ftyp' && ['avif', 'avis'].includes(header.toString('ascii', 8, 12))) return 'AVIF'
  return 'Unknown'
}

const brands = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'])
export function isHeicHeader(buffer: Buffer): boolean {
  if (buffer.length < 16 || buffer.toString('ascii', 4, 8) !== 'ftyp') return false
  const length = Math.min(buffer.readUInt32BE(0), buffer.length)
  if (brands.has(buffer.toString('ascii', 8, 12))) return true
  for (let i = 16; i + 4 <= length; i += 4) if (brands.has(buffer.toString('ascii', i, i + 4))) return true
  return false
}
export async function inspectPhoto(file: string): Promise<Photo> {
  const info = await lstat(file)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('This is not a regular photo file.')
  if (!info.size) throw new Error('This file is empty.')
  if (info.size > 150 * 1024 * 1024) throw new Error('This photo exceeds the 150 MB safety limit.')
  const handle = await open(file, 'r')
  try {
    const header = Buffer.alloc(128)
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    const bytes = header.subarray(0, bytesRead)
    const detectedFormat = detectOtherFormat(bytes)
    if (detectedFormat !== 'Unknown' || !isHeicHeader(bytes)) {
      const recommendation = detectedFormat === 'JPEG'
        ? 'Save an unchanged copy with a .jpg extension. No conversion or re-encoding is needed. Keep the original.'
        : detectedFormat === 'Unknown'
          ? 'Verify the original file format and ensure the file is fully available on this device.'
          : 'Use the correct file extension and a converter that supports this format. Keep the original.'
      const message = detectedFormat === 'JPEG'
        ? 'This file is already a JPEG with a HEIC/HEIF extension. Save a .jpg copy; no conversion is needed.'
        : detectedFormat === 'Unknown'
          ? 'The file does not contain a supported HEIC/HEIF image. Its format could not be recognized.'
          : `This file contains ${detectedFormat} data, not HEIC/HEIF. Check its filename extension.`
      throw new InputInspectionError(message, { code: detectedFormat === 'Unknown' ? 'UNSUPPORTED_FORMAT' : 'FORMAT_MISMATCH', detectedFormat, expectedFormat: 'HEIC/HEIF', signature: bytes.subarray(0, 16).toString('hex').match(/.{2}/g)?.join(' ').toUpperCase() || '', recommendation })
    }
  } finally { await handle.close() }
  return { id: randomUUID(), path: await realpath(file), name: basename(file), size: info.size, status: 'queued' }
}
export async function scanPhotos(paths: string[], recursive: boolean, onPhoto: (photo: Photo) => void, onWarning: (message: string) => void): Promise<void> {
  const seen = new Set<string>()
  async function visit(input: string, depth: number): Promise<void> {
    const file = resolve(input)
    const key = file.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    try {
      const info = await lstat(file)
      if (info.isSymbolicLink()) return
      if (info.isDirectory()) {
        const dir = await opendir(file)
        for await (const entry of dir) {
          if (entry.isFile() || (entry.isDirectory() && recursive)) await visit(resolve(file, entry.name), depth + 1)
        }
      } else if (info.isFile() && /\.hei[cf]$/i.test(extname(file))) {
        try { onPhoto(await inspectPhoto(file)) }
        catch (error) {
          onPhoto({ id: randomUUID(), path: file, name: basename(file), size: info.size, status: 'error', error: (error as Error).message, inputDiagnostic: error instanceof InputInspectionError ? error.diagnostic : undefined })
        }
      }
    } catch (error) { onWarning(`${basename(file)}: ${(error as Error).message}`) }
  }
  for (const path of paths) await visit(path, -1)
}
