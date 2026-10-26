import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const root = 'HKCU\\Software\\Classes\\'
const keys = ['SystemFileAssociations\\.heic', 'SystemFileAssociations\\.heif', 'Directory', 'Directory\\Background'].map(k => `${root}${k}\\shell\\HEIC2JPG`)
const reg = (args: string[]) => exec('reg.exe', args, { windowsHide: true, timeout: 10000 })
export async function contextMenuRegistered(): Promise<boolean> {
  if (process.platform !== 'win32') return false
  try { await reg(['query', `${keys[0]}\\command`]); return true } catch { return false }
}
export async function setContextMenu(enabled: boolean, executable: string): Promise<boolean> {
  if (process.platform !== 'win32') throw new Error('Explorer integration is available on Windows.')
  if (!enabled) {
    for (const key of keys) {
      try { await reg(['delete', key, '/f']) }
      catch { try { await reg(['query', key]); throw new Error('Could not remove the Explorer menu.') } catch (error) { if ((error as Error).message === 'Could not remove the Explorer menu.') throw error } }
    }
    return false
  }
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    await reg(['add', key, '/ve', '/t', 'REG_SZ', '/d', 'Convert to JPG', '/f'])
    await reg(['add', key, '/v', 'Icon', '/t', 'REG_SZ', '/d', `"${executable}",0`, '/f'])
    await reg(['add', key, '/v', 'MultiSelectModel', '/t', 'REG_SZ', '/d', 'Player', '/f'])
    await reg(['add', `${key}\\command`, '/ve', '/t', 'REG_SZ', '/d', `"${executable}" ${i < 2 ? '--convert "%1"' : '--convert-folder "%V"'}`, '/f'])
  }
  return true
}
export function parsePaths(args: string[]): string[] {
  const index = args.findIndex(a => a === '--convert' || a === '--convert-folder')
  if (index < 0) return []
  return args.slice(index + 1).filter(p => !p.startsWith('--'))
}
