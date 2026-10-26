import { defaults, type Settings } from './types'

export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') return { ...defaults }
  const v = value as Record<string, unknown>
  const text = (key: string, fallback = '') => typeof v[key] === 'string' ? (v[key] as string).slice(0, 4096) : fallback
  const bool = (key: keyof Settings) => typeof v[key] === 'boolean' ? v[key] as boolean : defaults[key] as boolean
  const safeName = (key: string) => text(key).replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 80).trim()
  return {
    quality: typeof v.quality === 'number' && Number.isFinite(v.quality) ? Math.max(1, Math.min(100, Math.round(v.quality))) : 95,
    outputMode: v.outputMode === 'custom' ? 'custom' : 'same', outputPath: text('outputPath'),
    conflict: v.conflict === 'rename' || v.conflict === 'overwrite' ? v.conflict : 'skip',
    recursive: bool('recursive'), preserveMetadata: bool('preserveMetadata'), preserveTimestamps: bool('preserveTimestamps'),
    recycleOriginals: bool('recycleOriginals'), prefix: safeName('prefix'), suffix: safeName('suffix'),
    concurrency: typeof v.concurrency === 'number' && Number.isFinite(v.concurrency) ? Math.max(1, Math.min(4, Math.round(v.concurrency))) : 2,
    theme: v.theme === 'light' ? 'light' : 'dark', silentMode: bool('silentMode'), autoCheckUpdates: bool('autoCheckUpdates')
  }
}
