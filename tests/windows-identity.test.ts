import { describe, expect, it } from 'vitest'
import { productionAppId, windowsApplicationId, windowsWindowDetails } from '../src/shared/windows-identity'

const context = { packaged: true, isolated: false, executablePath: 'C:\\Program Files\\HEIC2JPG\\HEIC2JPG.exe', appPath: 'C:\\Program Files\\HEIC2JPG\\resources\\app.asar', iconPath: 'C:\\Program Files\\HEIC2JPG\\resources\\app.asar\\resources\\icon.ico' }
describe('Windows application identity', () => {
  it('uses the installed executable as the taskbar icon and relaunch target', () => {
    const details = windowsWindowDetails(context)
    expect(details).toMatchObject({ appId: productionAppId, appIconPath: context.executablePath, appIconIndex: 0, relaunchDisplayName: 'HEIC2JPG' })
    expect(details.relaunchCommand).toBe(`"${context.executablePath}"`)
    expect(details.appIconPath).not.toContain('app.asar')
    expect(details.relaunchCommand).not.toContain('--convert')
  })
  it('does not let development and QA windows claim the installed identity', () => {
    const ids = [windowsApplicationId(true, false), windowsApplicationId(false, false), windowsApplicationId(true, true), windowsApplicationId(false, true)]
    expect(ids[0]).toBe(productionAppId)
    expect(ids.slice(1)).not.toContain(productionAppId)
    expect(new Set(ids).size).toBe(3)
  })
  it('uses a real icon file and quoted project path for development windows', () => {
    const development = { ...context, packaged: false, appPath: 'C:\\Projects\\photo converter', executablePath: 'C:\\Projects\\photo converter\\node_modules\\electron\\dist\\electron.exe', iconPath: 'C:\\Projects\\photo converter\\resources\\icon.ico' }
    const details = windowsWindowDetails(development)
    expect(details.appIconPath).toBe(development.iconPath)
    expect(details.relaunchCommand).toBe(`"${development.executablePath}" "${development.appPath}"`)
    expect(details.relaunchDisplayName).toBe('HEIC2JPG (Development)')
  })
  it('retains profile isolation when relaunching QA windows', () => {
    expect(windowsWindowDetails({ ...context, isolated: true }).relaunchCommand).toMatch(/ --qa$/)
    expect(windowsWindowDetails({ ...context, packaged: false, isolated: true }).relaunchCommand).toMatch(/ --smoke$/)
  })
})
