import { open, opendir, lstat, realpath } from 'node:fs/promises'
import { extname, basename, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Photo } from '../../shared/types'

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
    if (!isHeicHeader(header.subarray(0, bytesRead))) throw new Error('The file does not contain a supported HEIC/HEIF image.')
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
          onPhoto({ id: randomUUID(), path: file, name: basename(file), size: info.size, status: 'error', error: (error as Error).message })
        }
      }
    } catch (error) { onWarning(`${basename(file)}: ${(error as Error).message}`) }
  }
  for (const path of paths) await visit(path, -1)
}
