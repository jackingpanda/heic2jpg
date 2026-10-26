import { EventEmitter } from 'node:events'
import type { UpdateState } from '../shared/types'

export interface UpdaterAdapter {
  on(event: string, listener: (...args: any[]) => void): unknown
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(silent?: boolean, forceRunAfter?: boolean): void
}
export function plainReleaseNotes(value: unknown): string {
  const text = typeof value === 'string' ? value : Array.isArray(value) ? value.map(v => typeof v?.note === 'string' ? v.note : '').join('\n') : ''
  return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').slice(0, 8000).trim()
}
export class UpdateService extends EventEmitter {
  state: UpdateState = { status: 'idle' }
  private automatic = false
  private timer?: ReturnType<typeof setInterval>
  private initial?: ReturnType<typeof setTimeout>
  constructor(private updater: UpdaterAdapter | null, private busy: () => boolean, private beforeInstall: () => void) {
    super()
    if (!updater) { this.state = { status: 'development', message: 'Update checks are available in the installed application.' }; return }
    updater.on('checking-for-update', () => this.set({ status: 'checking', message: 'Checking GitHub Releases…' }))
    updater.on('update-available', info => this.set({ status: 'available', version: String(info.version), notes: plainReleaseNotes(info.releaseNotes), checkedAt: Date.now(), message: 'A new version is available.' }))
    updater.on('update-not-available', () => this.set({ status: 'current', checkedAt: Date.now(), message: 'You are using the latest published version.' }))
    updater.on('download-progress', progress => this.set({ ...this.state, status: 'downloading', percent: Math.min(100, Math.max(0, Number(progress.percent) || 0)), message: 'Downloading the update…' }))
    updater.on('update-downloaded', info => this.set({ ...this.state, status: 'downloaded', version: String(info.version), percent: 100, message: 'Update downloaded. Restart to install it.' }))
    updater.on('error', error => this.fail(error))
  }
  private set(state: UpdateState): void { this.state = state; this.emit('change', state) }
  private fail(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error)
    const missing = /404|no published versions|latest.*not found|ERR_UPDATER_LATEST_VERSION_NOT_FOUND/i.test(message)
    this.set({ status: missing ? 'not-published' : 'error', checkedAt: Date.now(), message: missing ? 'The update feed is not published yet. Check the Releases page or try again later.' : 'The update check or download could not finish. Check your connection and try again.' })
  }
  async check(): Promise<UpdateState> {
    if (!this.updater || ['checking', 'downloading', 'downloaded'].includes(this.state.status)) return this.state
    this.set({ status: 'checking', message: 'Checking GitHub Releases…' })
    try { await this.updater.checkForUpdates() } catch (error) { this.fail(error) }
    return this.state
  }
  async download(): Promise<UpdateState> {
    if (!this.updater || this.state.status !== 'available') throw new Error('Check for an available update first.')
    this.set({ ...this.state, status: 'downloading', percent: 0, message: 'Downloading the update…' })
    try { await this.updater.downloadUpdate() } catch (error) { this.fail(error) }
    return this.state
  }
  install(): void {
    if (!this.updater || this.state.status !== 'downloaded') throw new Error('Download the update before installing it.')
    if (this.busy()) throw new Error('Finish the current photo conversion before installing the update.')
    this.beforeInstall(); this.updater.quitAndInstall(false, true)
  }
  setAutomatic(enabled: boolean): void {
    if (enabled === this.automatic && (this.timer || !enabled)) return
    this.automatic = enabled
    clearInterval(this.timer); clearTimeout(this.initial)
    if (!enabled || !this.updater) return
    const check = () => { if (this.automatic && !this.busy() && !['available', 'downloaded'].includes(this.state.status)) void this.check() }
    this.initial = setTimeout(check, 15000); this.initial.unref()
    this.timer = setInterval(check, 6 * 60 * 60 * 1000); this.timer.unref()
  }
  dispose(): void { clearInterval(this.timer); clearTimeout(this.initial) }
}
