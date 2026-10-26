import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import exiftoolPath from 'exiftool-vendored.exe'

const exec = promisify(execFile)
export async function exiftool(args: string[]): Promise<string> {
  const executable = exiftoolPath.replace('app.asar\\', 'app.asar.unpacked\\').replace('app.asar/', 'app.asar.unpacked/')
  const { stdout, stderr } = await exec(executable, ['-charset', 'filename=UTF8', ...args], { windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024 })
  if (/^Error:/m.test(stderr)) throw new Error(stderr.trim())
  return stdout
}
const verifyTags = ['Make', 'Model', 'DateTimeOriginal', 'GPSLatitude', 'GPSLongitude']
export async function readOrientation(input: string): Promise<{ orientation: number; rotation: number }> {
  const [tags] = JSON.parse(await exiftool(['-j', '-n', '-Orientation', '-Rotation', input]))
  return { orientation: Number(tags.Orientation) || 1, rotation: Number(tags.Rotation) || 0 }
}
export async function transferMetadata(input: string, output: string, width: number, height: number): Promise<string | undefined> {
  try {
    await exiftool(['-overwrite_original', '-TagsFromFile', input, '-EXIF:all', '-IPTC:all', '-XMP:all', '-ICC_Profile',
      '-Orientation#=1', '-XMP-tiff:Orientation#=1', `-ExifImageWidth=${width}`, `-ExifImageHeight=${height}`, output])
    const raw = await exiftool(['-j', '-n', ...verifyTags.map(t => `-${t}`), input, output])
    const [before, after] = JSON.parse(raw) as Record<string, unknown>[]
    const missing = verifyTags.filter(key => before[key] !== undefined && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    if (missing.length) return `Some metadata could not be preserved: ${missing.join(', ')}. Original kept.`
  } catch (error) { return `Photo converted, but metadata could not be fully verified. Original kept. ${(error as Error).message.slice(0, 200)}` }
}
