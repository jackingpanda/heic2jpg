import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { validateSettings } from '../shared/validation'
import type { Settings } from '../shared/types'

export async function loadSettings(directory: string): Promise<Settings> {
  try { return validateSettings(JSON.parse(await readFile(join(directory, 'settings.json'), 'utf8'))) }
  catch { return validateSettings({}) }
}
export async function storeSettings(directory: string, settings: Settings): Promise<void> {
  await mkdir(directory, { recursive: true })
  const file = join(directory, 'settings.json')
  await writeFile(`${file}.tmp`, JSON.stringify(settings, null, 2), 'utf8')
  await rename(`${file}.tmp`, file)
}
