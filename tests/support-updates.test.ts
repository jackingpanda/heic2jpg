import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { UpdateService, plainReleaseNotes } from '../src/main/update-service'
import { formatReport, reportDestination, validateReport } from '../src/main/support'
import type { AppInfo } from '../src/shared/types'

const info: AppInfo = { version: '1.2.0', electron: '45.0.0', platform: 'Windows test', architecture: 'x64', packaged: true, update: { status: 'idle' } }
describe('support reports', () => {
  it('requires useful text and excludes diagnostics unless requested', () => {
    expect(() => validateReport({ category: 'bug', summary: 'x', description: 'tiny' })).toThrow()
    const report = validateReport({ category: 'conversion', summary: 'Conversion does not finish', description: 'The conversion stops on a particular photo.', steps: 'Choose a photo and convert.', includeDiagnostics: false })
    const text = formatReport(report, info)
    expect(text).not.toContain('Architecture:'); expect(text).not.toContain('Windows test')
    expect(text).toContain('No photos, photo metadata, file paths')
    expect(formatReport({ ...report, includeDiagnostics: true }, info)).toContain('HEIC2JPG: 1.2.0')
  })
  it('opens fixed destinations and keeps security reports private', () => {
    const report = validateReport({ category: 'security', summary: 'A security concern', description: 'Please review this privately reported issue.' })
    const mail = new URL(reportDestination(report, 'Details with & symbols', 'email'))
    expect(mail.pathname).toBe('heic2jpg@kulam.my.id'); expect(mail.searchParams.get('body')).toBe('Details with & symbols')
    expect(() => reportDestination(report, 'Private', 'github')).toThrow('privately')
    const github = new URL(reportDestination({ ...report, category: 'bug' }, 'Public report', 'github'))
    expect(github.origin).toBe('https://github.com'); expect(github.pathname).toBe('/jackingpanda/heic2jpg/issues/new')
  })
})
class FakeUpdater extends EventEmitter {
  checkForUpdates = vi.fn(async () => { this.emit('update-available', { version: '1.3.0', releaseNotes: '<p>A new release</p>' }) })
  downloadUpdate = vi.fn(async () => { this.emit('download-progress', { percent: 50 }); this.emit('update-downloaded', { version: '1.3.0' }) })
  quitAndInstall = vi.fn()
}
describe('update lifecycle', () => {
  it('checks automatically without downloads and stops when the preference is disabled', async () => {
    vi.useFakeTimers()
    const updater = new FakeUpdater()
    updater.checkForUpdates.mockImplementation(async () => { updater.emit('update-not-available') })
    const service = new UpdateService(updater, () => false, () => {})
    service.setAutomatic(true)
    await vi.advanceTimersByTimeAsync(15000)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    service.setAutomatic(false)
    await vi.advanceTimersByTimeAsync(7 * 60 * 60 * 1000)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    service.dispose(); vi.useRealTimers()
  })
  it('checks without downloading, then requires an explicit install and blocks active work', async () => {
    const updater = new FakeUpdater(); let busy = true; const beforeInstall = vi.fn()
    const service = new UpdateService(updater, () => busy, beforeInstall)
    await service.check(); expect(service.state.status).toBe('available'); expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect(service.state.notes).toBe('A new release')
    await service.download(); expect(service.state.status).toBe('downloaded'); expect(updater.quitAndInstall).not.toHaveBeenCalled()
    expect(() => service.install()).toThrow('Finish the current'); busy = false; service.install()
    expect(beforeInstall).toHaveBeenCalledOnce(); expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true); service.dispose()
  })
  it('reports missing releases accurately and leaves development builds unconfigured', async () => {
    const updater = new FakeUpdater(); updater.checkForUpdates.mockRejectedValue(new Error('ERR_UPDATER_LATEST_VERSION_NOT_FOUND 404'))
    const service = new UpdateService(updater, () => false, () => {})
    await service.check(); expect(service.state.status).toBe('not-published')
    const development = new UpdateService(null, () => false, () => {})
    expect((await development.check()).status).toBe('development')
    expect(plainReleaseNotes('<b>Notes</b>')).toBe('Notes')
  })
})
