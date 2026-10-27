import { BrowserWindow, app, screen } from 'electron'
import { join } from 'node:path'
import type { QuickProgressState } from '../shared/types'
import { applicationIcon, applyWindowBranding } from './branding'

export class QuickProgressWindow {
  window: BrowserWindow | null = null
  private creating?: Promise<void>
  private hideTimer?: ReturnType<typeof setTimeout>
  private lastPhase?: QuickProgressState['phase']

  constructor(private snapshot: () => QuickProgressState, private isQuitting: () => boolean) {}

  async show(): Promise<void> {
    clearTimeout(this.hideTimer)
    if (this.creating) return this.creating
    if (this.window && !this.window.isDestroyed()) { this.window.showInactive(); this.update(); return }
    this.creating = this.create()
    try { await this.creating } finally { this.creating = undefined }
  }

  private async create(): Promise<void> {
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
    const width = 404, height = 276
    const popup = new BrowserWindow({
      width, height, x: area.x + Math.max(0, area.width - width - 20), y: area.y + Math.max(0, area.height - height - 20),
      title: 'HEIC2JPG · Quick convert', frame: false, transparent: true, show: false,
      resizable: false, maximizable: false, fullscreenable: false, alwaysOnTop: true,
      backgroundColor: '#00000000', icon: applicationIcon(),
      webPreferences: { preload: join(__dirname, '../preload/progress.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: false }
    })
    this.window = popup
    applyWindowBranding(popup)
    popup.setMenu(null)
    popup.on('page-title-updated', event => event.preventDefault())
    popup.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    popup.webContents.on('will-navigate', event => event.preventDefault())
    popup.on('close', event => { if (!this.isQuitting()) { event.preventDefault(); this.hide() } })
    popup.on('closed', () => { this.window = null })
    if (process.env.ELECTRON_RENDERER_URL && !app.isPackaged) {
      const url = new URL(process.env.ELECTRON_RENDERER_URL)
      url.searchParams.set('view', 'progress')
      await popup.loadURL(url.toString())
    } else await popup.loadFile(join(__dirname, '../renderer/index.html'), { query: { view: 'progress' } })
    popup.showInactive()
    this.update()
  }

  hide(): void { clearTimeout(this.hideTimer); this.window?.hide() }

  update(): void {
    const popup = this.window
    if (!popup || popup.isDestroyed()) return
    const state = this.snapshot()
    popup.webContents.send('quick:state', state)
    const done = state.photos.filter(p => ['done', 'error', 'skipped'].includes(p.status)).length
    const issues = state.photos.some(p => p.status === 'error' || p.warning)
    if (state.phase === 'complete') popup.setProgressBar(issues ? 1 : -1, { mode: issues ? 'error' : 'none' })
    else if (state.phase === 'waiting' || state.phase === 'scanning') popup.setProgressBar(2, { mode: 'indeterminate' })
    else popup.setProgressBar(state.photos.length ? done / state.photos.length : 0, { mode: state.phase === 'stopping' ? 'paused' : 'normal' })
    if (state.phase === 'complete' && this.lastPhase !== 'complete') {
      clearTimeout(this.hideTimer)
      if (!issues && state.photos.length && !state.photos.some(p => p.status === 'cancelled')) this.hideTimer = setTimeout(() => this.hide(), 8000)
    } else if (state.phase !== 'complete') clearTimeout(this.hideTimer)
    this.lastPhase = state.phase
  }
}
