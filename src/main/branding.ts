import { app, nativeImage, type BrowserWindow, type NativeImage } from 'electron'
import { join } from 'node:path'
import { windowsWindowDetails } from '../shared/windows-identity'

let icon: NativeImage | undefined
export function applicationIcon(): NativeImage {
  if (!icon) icon = nativeImage.createFromPath(join(app.getAppPath(), 'resources', process.platform === 'win32' ? 'icon.ico' : 'icon.png'))
  return icon
}
export function applicationWindowDetails() {
  const root = app.getAppPath()
  return windowsWindowDetails({ packaged: app.isPackaged, isolated: process.argv.includes('--qa') || process.argv.includes('--smoke'), executablePath: app.getPath('exe'), appPath: root, iconPath: join(root, 'resources/icon.ico') })
}
export function applyWindowBranding(window: BrowserWindow): void {
  if (process.platform === 'win32') {
    window.setIcon(applicationIcon())
    window.setAppDetails(applicationWindowDetails())
  }
}
