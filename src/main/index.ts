import { app, BrowserWindow, ipcMain, dialog, shell, Notification, Tray, Menu, nativeImage, clipboard } from 'electron'
import { release as osRelease } from 'node:os'
import { autoUpdater } from 'electron-updater'
import { version as applicationVersion } from '../../package.json'
import { join, dirname, isAbsolute } from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { QuickProgressWindow } from './quick-progress'
import type { QuickProgressState, AppInfo } from '../shared/types'
import { product } from '../shared/product'
import { conversionReport } from '../shared/input-diagnostics'
import { UpdateService } from './update-service'
import { validateReport, formatReport, reportDestination } from './support'
import { ConversionManager } from './manager'
import { loadSettings, storeSettings } from './settings'
import { validateSettings } from '../shared/validation'
import { parsePaths, contextMenuRegistered, setContextMenu } from './context-menu'

// Keep development and QA data in the workspace; packaged builds use normal app data.
if (!app.isPackaged) app.setPath('userData', join(app.getAppPath(), '.local-data'))
const isolated = process.argv.includes('--qa')
if (isolated) app.setPath('userData', join(app.isPackaged ? dirname(dirname(process.execPath)) : app.getAppPath(), '.local-data', 'qa'))
if (process.argv.includes('--smoke')) app.setPath('userData', join(app.getAppPath(), '.local-data', 'smoke'))
app.setAppUserModelId('com.heic2jpg.desktop')
let window: BrowserWindow | null = null
let tray: Tray | undefined
let manager: ConversionManager
let updates: UpdateService
let closing = false
let settingsWrite = Promise.resolve()
let cliPending: string[] = parsePaths(process.argv)
let cliTimer: ReturnType<typeof setTimeout> | undefined
let quickProgress: QuickProgressWindow
let quickPhase: QuickProgressState['phase'] = 'waiting'
let quickIds = new Set<string>()
let quickStartedAt = Date.now()
let quickFinishedAt = 0
let quickMessage: string | undefined
let quickSession = false
let quickCancelEpoch = 0
const dataDirectory = app.getPath('userData')
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

function quickSnapshot(): QuickProgressState {
  return {
    phase: manager.state.stopping && quickPhase === 'converting' ? 'stopping' : quickPhase,
    photos: manager.state.photos.filter(photo => quickIds.has(photo.id)),
    startedAt: quickStartedAt, finishedAt: quickFinishedAt, pending: cliPending.length > 0,
    theme: manager.state.settings.theme, message: quickMessage
  }
}
function announceCliRequest(): void {
  if (!manager || !quickProgress) return
  if (!quickSession || quickPhase === 'complete') {
    quickIds = new Set(); quickStartedAt = Date.now(); quickFinishedAt = 0; quickMessage = undefined; quickPhase = 'waiting'; quickSession = true
  }
  if (manager.state.settings.silentMode) void quickProgress.show().catch(error => notify('Could not show progress', error.message))
  else void showWindow()
  quickProgress.update()
}

function notify(title: string, body: string): void {
  if (Notification.isSupported()) {
    const notification = new Notification({ title, body, icon: join(app.getAppPath(), 'resources/icon.png') })
    notification.on('click', () => showWindow())
    notification.show()
  }
}
function updateTray(): void {
  if (!tray) return
  const ids = new Set(manager.state.batchIds)
  const current = manager.state.photos.filter(p => ids.has(p.id))
  const finished = current.filter(p => !['queued', 'converting', 'cancelled'].includes(p.status)).length
  tray.setToolTip(manager.state.running ? `HEIC2JPG · ${finished}/${current.length} photos` : 'HEIC2JPG · Ready')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open HEIC2JPG', click: showWindow },
    { label: manager.state.running ? 'Stop after current photos' : 'Ready to convert', enabled: manager.state.running, click: () => manager.cancel() },
    { type: 'separator' }, { label: 'Quit', click: () => { if (manager.state.running) showWindow(); else { closing = true; app.quit() } } }
  ]))
}
async function showWindow(): Promise<void> {
  if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); return }
  let bounds = { width: 1120, height: 800 }
  try { const saved = JSON.parse(await readFile(join(dataDirectory, 'window.json'), 'utf8')); bounds = { width: Math.max(760, Math.min(1800, saved.width)), height: Math.max(620, Math.min(1200, saved.height)) } } catch { /* default dimensions */ }
  window = new BrowserWindow({ ...bounds, minWidth: 760, minHeight: 620, title: 'HEIC2JPG', frame: false, show: false,
    backgroundColor: '#111216', icon: join(app.getAppPath(), 'resources/icon.png'),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false }
  })
  window.setMenu(null)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  window.once('ready-to-show', () => window?.show())
  window.on('close', event => {
    if (manager.state.running && !closing) {
      event.preventDefault()
      const choice = dialog.showMessageBoxSync(window!, { type: 'question', title: 'Conversion in progress', message: 'Keep converting in the background?', detail: 'You can reopen HEIC2JPG from the tray. Your photos will continue converting.', buttons: ['Keep converting', 'Stay here'], defaultId: 0, cancelId: 1 })
      if (choice === 0) window?.hide()
      return
    }
    const bounds = window!.getNormalBounds()
    void mkdir(dataDirectory, { recursive: true }).then(() => writeFile(join(dataDirectory, 'window.json'), JSON.stringify({ width: bounds.width, height: bounds.height })))
  })
  window.on('closed', () => { window = null; if (!manager.state.running && !manager.state.scanning && !cliPending.length && (!quickSession || quickPhase === 'complete')) app.quit() })
  if (process.env.ELECTRON_RENDERER_URL && !app.isPackaged) await window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await window.loadFile(join(__dirname, '../renderer/index.html'))
  window.show()
}
async function flushCli(): Promise<void> {
  if (!manager || !cliPending.length) return
  if (manager.state.running || manager.state.scanning) { quickProgress.update(); cliTimer = setTimeout(() => void flushCli(), 800); return }
  const incoming = cliPending; cliPending = []
  const cancelEpoch = quickCancelEpoch
  try {
    quickPhase = 'scanning'; quickProgress.update()
    const requested = await manager.add(incoming, true)
    for (const id of requested) quickIds.add(id)
    const ready = manager.state.photos.filter(p => requested.includes(p.id) && p.status === 'queued').map(p => p.id)
    if (cancelEpoch !== quickCancelEpoch) {
      for (const photo of manager.state.photos) if (ready.includes(photo.id)) photo.status = 'cancelled'
      manager.publish(true)
      return
    }
    if (ready.length) { quickPhase = 'converting'; quickProgress.update(); await manager.start(ready, true) }
    else if (!requested.length) quickMessage = manager.state.scanWarnings[0] || 'No HEIC photos were found in this selection.'
  } catch (error) { quickMessage = (error as Error).message; notify('Could not convert selection', quickMessage) }
  finally {
    quickPhase = cliPending.length ? 'waiting' : 'complete'; quickFinishedAt = Date.now(); quickProgress.update()
    if (cliPending.length) { clearTimeout(cliTimer); cliTimer = setTimeout(() => void flushCli(), 700) }
  }
}
app.on('second-instance', (_event, argv) => {
  const paths = parsePaths(argv)
  if (paths.length) { cliPending.push(...paths); announceCliRequest(); clearTimeout(cliTimer); cliTimer = setTimeout(() => void flushCli(), 700) }
  else void showWindow()
})
function validIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100000 || value.some(v => typeof v !== 'string')) throw new Error('Invalid photo selection.')
  return value
}
function appInfo(): AppInfo {
  return { version: applicationVersion, electron: process.versions.electron, platform: `Windows ${osRelease()}`, architecture: process.arch, packaged: app.isPackaged, update: updates.state }
}
function registerIpc(): void {
  const quickHandlers: Record<string, () => unknown> = {
    'quick:snapshot': quickSnapshot,
    'quick:open': async () => { await showWindow(); quickProgress.hide() },
    'quick:cancel': () => {
      quickCancelEpoch++
      // A queued Explorer selection must not cancel unrelated work in the main app.
      const active = manager.state.batchIds.some(id => quickIds.has(id))
      if (active && manager.state.running) manager.cancel()
      cliPending = []
      clearTimeout(cliTimer)
      if (!active || !manager.state.running) { quickPhase = 'complete'; quickFinishedAt = Date.now(); quickMessage = 'Queued selection cancelled. Your originals are unchanged.' }
      quickProgress.update()
    },
    'quick:reveal': () => {
      const photo = manager.state.photos.find(p => quickIds.has(p.id) && p.status === 'done')
      if (photo?.outputPath) shell.showItemInFolder(photo.outputPath)
    }
  }
  for (const [channel, handler] of Object.entries(quickHandlers)) ipcMain.handle(channel, event => {
    const popup = quickProgress.window
    if (!popup || event.sender !== popup.webContents || event.senderFrame !== popup.webContents.mainFrame) throw new Error('Untrusted progress request.')
    return handler()
  })
  ipcMain.on('quick:hide', event => { if (event.sender === quickProgress.window?.webContents) quickProgress.hide() })
  const handlers: Record<string, (...args: any[]) => unknown> = {
    'app:info': appInfo,
    'updates:check': () => updates.check(),
    'updates:download': () => updates.download(),
    'updates:install': async () => {
      if (manager.state.running || manager.state.scanning || cliPending.length) throw new Error('Finish the current conversion before installing an update.')
      const confirmation = await dialog.showMessageBox(window!, { type: 'question', title: 'Install update', message: 'Restart HEIC2JPG to install the downloaded update?', detail: 'The application will close and the Windows installer will open. Your conversion preferences will be retained.', buttons: ['Cancel', 'Restart and install'], defaultId: 0, cancelId: 0 })
      if (confirmation.response === 1) updates.install()
    },
    'app:link': async (key: unknown) => {
      const links: Record<string, string> = { website: product.website, repository: product.repository, releases: `${product.repository}/releases`, license: `${product.repository}/blob/main/LICENSE`, privacy: `${product.repository}/blob/main/PRIVACY.md`, notices: `${product.repository}/blob/main/THIRD_PARTY_NOTICES.md` }
      if (typeof key !== 'string' || !Object.hasOwn(links, key)) throw new Error('Unknown application link.')
      await shell.openExternal(links[key])
    },
    'support:report': async (value: unknown, target: unknown) => {
      if (!['email', 'github', 'copy'].includes(String(target))) throw new Error('Choose how to share the report.')
      const report = validateReport(value)
      const body = formatReport(report, appInfo())
      if (target === 'copy') { clipboard.writeText(`${report.summary}\n\n${body}`); return 'Report copied. Review it before sharing.' }
      const destination = reportDestination(report, body, target as 'email' | 'github')
      if (destination.length > 14000) throw new Error('This report is too long for a draft link. Use Copy report and paste it into an email.')
      await shell.openExternal(destination)
      return target === 'email' ? 'Email draft opened. Review and send it in your email application.' : 'GitHub issue draft opened. Review it before submitting.'
    },
    snapshot: () => manager.state,
    add: async (paths: unknown) => {
      const list = validIds(paths)
      if (list.some(p => !isAbsolute(p) || p.includes('\0'))) throw new Error('Choose valid local files or folders.')
      await manager.add(list)
    },
    pick: async (kind: unknown) => {
      if (kind !== 'files' && kind !== 'folder') throw new Error('Invalid picker.')
      const result = await dialog.showOpenDialog(window!, { title: kind === 'files' ? 'Add HEIC photos' : 'Add a folder of photos', properties: kind === 'files' ? ['openFile', 'multiSelections'] : ['openDirectory'], filters: [{ name: 'HEIC photos', extensions: ['heic', 'heif'] }] })
      if (!result.canceled) await manager.add(result.filePaths)
    },
    'pick-output': async () => {
      const result = await dialog.showOpenDialog(window!, { title: 'Choose where to save your JPEGs', properties: ['openDirectory', 'createDirectory'] })
      return result.canceled ? null : result.filePaths[0]
    },
    start: async (ids: unknown) => {
      await settingsWrite
      const list = ids === undefined ? undefined : validIds(ids)
      if (manager.state.settings.recycleOriginals) {
        const result = await dialog.showMessageBox(window!, { type: 'warning', title: 'Move originals to the Recycle Bin?', message: 'Move original HEIC photos to the Recycle Bin after conversion?', detail: 'Only verified conversions without metadata warnings qualify. Failed and skipped originals stay in place. You can restore photos from the Recycle Bin.', buttons: ['Keep originals', 'Move after conversion'], defaultId: 0, cancelId: 0 })
        if (result.response === 0) { void manager.start(list, true).catch(e => notify('Conversion could not start', e.message)); return }
      }
      // Return after startup; subsequent progress arrives through the subscription.
      if (manager.state.running || manager.state.scanning) throw new Error('Wait for the current operation to finish.')
      if (manager.state.settings.outputMode === 'custom' && !manager.state.settings.outputPath) throw new Error('Choose an output folder first.')
      void manager.start(list).catch(e => notify('Conversion could not start', e.message))
    },
    cancel: () => manager.cancel(), remove: (ids: unknown) => manager.remove(validIds(ids)), retry: (ids: unknown) => manager.retry(validIds(ids)),
    settings: async (value: unknown) => {
      if (manager.state.running) throw new Error('Settings are locked during conversion.')
      const settings = validateSettings(value)
      settingsWrite = settingsWrite.catch(() => {}).then(() => storeSettings(dataDirectory, settings))
      await settingsWrite; manager.state.settings = settings; updates.setAutomatic(settings.autoCheckUpdates); manager.publish(true)
    },
    'context-menu': async (value: unknown) => {
      if (typeof value !== 'boolean' || !app.isPackaged) throw new Error('Explorer integration is available in the packaged app.')
      const enabled = await setContextMenu(value, app.getPath('exe'))
      manager.state.contextMenu = enabled; manager.publish(true); return enabled
    },
    reveal: async (id: unknown) => {
      if (id !== undefined && typeof id !== 'string') throw new Error('Invalid photo.')
      const photo = id ? manager.state.photos.find(p => p.id === id) : manager.state.photos.find(p => p.status === 'done')
      if (photo) shell.showItemInFolder(photo.outputPath || photo.path)
      else if (manager.state.settings.outputMode === 'custom' && manager.state.settings.outputPath) await shell.openPath(manager.state.settings.outputPath)
    },
    'export-log': async () => {
      const result = await dialog.showSaveDialog(window!, { defaultPath: 'HEIC2JPG-conversion-log.txt', filters: [{ name: 'Text log', extensions: ['txt'] }] })
      if (result.canceled || !result.filePath) return false
      await writeFile(result.filePath, conversionReport(manager.state.photos, applicationVersion, manager.state.scanWarnings), 'utf8'); return true
    }
  }
  for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted request.')
    return handler(...args)
  })
  ipcMain.on('window', (event, action) => {
    if (event.sender !== window?.webContents) return
    if (action === 'minimize') window.minimize()
    if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize()
    if (action === 'close') window.close()
  })
}
if (gotLock) void app.whenReady().then(async () => {
  manager = new ConversionManager(await loadSettings(dataDirectory), app.isPackaged, file => shell.trashItem(file))
  const updatingEnabled = app.isPackaged && !isolated && !process.argv.includes('--smoke')
  if (updatingEnabled) { autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = false; autoUpdater.allowPrerelease = false; autoUpdater.allowDowngrade = false }
  updates = new UpdateService(updatingEnabled ? autoUpdater : null, () => manager.state.running || manager.state.scanning || cliPending.length > 0, () => { closing = true })
  let announcedUpdate = ''
  updates.on('change', state => {
    if (window && !window.isDestroyed()) window.webContents.send('updates:state', state)
    if (updatingEnabled && state.status === 'available' && state.version && state.version !== announcedUpdate) { announcedUpdate = state.version; notify('Update available', `HEIC2JPG ${state.version} is available. Open About and updates to review it.`) }
  })
  updates.setAutomatic(manager.state.settings.autoCheckUpdates)
  quickProgress = new QuickProgressWindow(quickSnapshot, () => closing)
  manager.state.contextMenu = await contextMenuRegistered()
  const icon = nativeImage.createFromPath(join(app.getAppPath(), 'resources/icon.png')).resize({ width: 20, height: 20 })
  tray = new Tray(icon)
  tray.on('double-click', showWindow)
  manager.on('change', state => { if (window && !window.isDestroyed()) window.webContents.send('state', state); quickProgress.update(); updateTray() })
  manager.on('complete', state => {
    const ids = new Set(state.batchIds)
    const batch = state.photos.filter((p: { id: string }) => ids.has(p.id))
    notify('Conversion finished', `${batch.filter((p: { status: string }) => p.status === 'done').length} JPEGs saved · ${batch.filter((p: { status: string }) => p.status === 'error').length} errors`)
    updateTray()
  })
  registerIpc(); updateTray()
  if (cliPending.length) { announceCliRequest(); cliTimer = setTimeout(() => void flushCli(), 700) }
  else await showWindow()
})
app.on('window-all-closed', () => { if (!manager?.state.running && !cliPending.length) app.quit() })
app.on('before-quit', event => { if (manager?.state.running && !closing) { event.preventDefault(); void showWindow() } else { closing = true; updates?.dispose() } })
