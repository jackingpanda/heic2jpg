import { EventEmitter } from 'node:events'
import { Worker } from 'node:worker_threads'
import { join, resolve as resolvePath, dirname, basename } from 'node:path'
import { rm } from 'node:fs/promises'
import { freemem, availableParallelism } from 'node:os'
import { scanPhotos } from './conversion/scanner'
import type { Snapshot, Settings, Photo, WorkerReply, ConvertResult } from '../shared/types'

export class ConversionManager extends EventEmitter {
  state: Snapshot
  private timer?: ReturnType<typeof setTimeout>
  private workers = new Set<Worker>()
  private scratchDirectories = new Map<string, string>()
  constructor(settings: Settings, packaged: boolean, private recycle: (path: string) => Promise<void>) {
    super()
    this.state = { photos: [], running: false, stopping: false, scanning: false, startedAt: 0, finishedAt: 0, batchIds: [], settings, contextMenu: false, packaged, scanWarnings: [] }
  }
  publish(immediate = false): void {
    if (immediate) { clearTimeout(this.timer); this.timer = undefined; this.emit('change', this.state); return }
    if (!this.timer) this.timer = setTimeout(() => { this.timer = undefined; this.emit('change', this.state) }, 100)
  }
  async add(paths: string[], requeueExisting = false): Promise<string[]> {
    if (this.state.running || this.state.scanning) throw new Error('Wait for the current operation to finish before adding photos.')
    this.state.scanning = true; this.state.scanWarnings = []; this.publish(true)
    const known = new Map(this.state.photos.map(p => [p.path.toLowerCase(), p]))
    const ids = new Set<string>()
    let added = 0
    try {
      await scanPhotos(paths, this.state.settings.recursive, photo => {
        const key = photo.path.toLowerCase()
        const existing = known.get(key)
        if (!existing) { known.set(key, photo); this.state.photos.push(photo); ids.add(photo.id); added++; this.publish() }
        else if (requeueExisting && !ids.has(existing.id)) {
          Object.assign(existing, photo, { id: existing.id, outputPath: undefined, outputSize: undefined, warning: undefined, error: photo.error, stage: undefined, inputDiagnostic: photo.inputDiagnostic })
          ids.add(existing.id); added++; this.publish()
        }
      }, message => { if (this.state.scanWarnings.length < 20) this.state.scanWarnings.push(message) })
      if (!added && !this.state.scanWarnings.length) this.state.scanWarnings.push('No new HEIC or HEIF photos found. Photos already in the queue are added only once.')
    } finally { this.state.scanning = false; this.publish(true) }
    return [...ids]
  }
  remove(ids: string[]): void {
    if (this.state.running || this.state.scanning) throw new Error('Wait for the current operation to finish.')
    const selected = new Set(ids)
    this.state.photos = this.state.photos.filter(p => !selected.has(p.id))
    this.publish(true)
  }
  retry(ids: string[]): void {
    if (this.state.running) throw new Error('Wait for conversion to finish.')
    const selected = new Set(ids)
    for (const photo of this.state.photos) if (selected.has(photo.id) && ['error', 'cancelled', 'skipped'].includes(photo.status)) {
      photo.status = 'queued'; photo.error = undefined; photo.warning = undefined; photo.stage = undefined
    }
    this.publish(true)
  }
  cancel(): void { if (this.state.running) { this.state.stopping = true; this.publish(true) } }
  private run(worker: Worker, photo: Photo, settings: Settings): Promise<ConvertResult> {
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timeout); worker.off('message', message); worker.off('error', error); worker.off('exit', exit) }
      const error = (e: Error) => { cleanup(); reject(e) }
      const exit = (code: number) => error(new Error(`The photo worker stopped (${code}). Retry this photo.`))
      const message = (reply: WorkerReply) => {
        if ('stage' in reply) {
          photo.stage = reply.stage
          const folder = settings.outputMode === 'custom' ? settings.outputPath : dirname(photo.path)
          if (reply.scratch && dirname(resolvePath(reply.scratch)).toLowerCase() === resolvePath(folder).toLowerCase() && basename(reply.scratch).startsWith('.heic2jpg-')) this.scratchDirectories.set(photo.id, reply.scratch)
          this.publish()
        }
        else { cleanup(); if ('error' in reply) reject(new Error(reply.error)); else resolve(reply.result) }
      }
      const timeout = setTimeout(() => { cleanup(); void worker.terminate(); reject(new Error('This photo took more than two minutes. Original kept.')) }, 120000)
      worker.on('message', message); worker.once('error', error); worker.once('exit', exit)
      worker.postMessage({ photo, settings })
    })
  }
  async start(ids?: string[], keepOriginals = false): Promise<void> {
    if (this.state.running || this.state.scanning) throw new Error('Wait for the current operation to finish.')
    const selected = ids ? new Set(ids) : undefined
    const photos = this.state.photos.filter(p => (p.status === 'queued' || p.status === 'cancelled') && (!selected || selected.has(p.id)))
    if (!photos.length) throw new Error('Add or retry some photos first.')
    const settings = { ...this.state.settings, recycleOriginals: keepOriginals ? false : this.state.settings.recycleOriginals }
    if (settings.outputMode === 'custom' && !settings.outputPath) throw new Error('Choose an output folder first.')
    this.state.running = true; this.state.stopping = false; this.state.startedAt = Date.now(); this.state.finishedAt = 0
    this.state.batchIds = photos.map(p => p.id); this.publish(true)
    const concurrency = settings.conflict === 'overwrite' ? 1 : Math.max(1, Math.min(settings.concurrency, availableParallelism() - 1, Math.floor(freemem() / (512 * 1024 * 1024)), photos.length))
    let cursor = 0
    const lane = async () => {
      let worker: Worker | undefined
      while (cursor < photos.length && !this.state.stopping) {
        const photo = photos[cursor++]
        photo.status = 'converting'; photo.error = undefined; photo.warning = undefined; this.publish()
        try {
          if (!worker) { worker = new Worker(join(__dirname, 'worker.js')); this.workers.add(worker) }
          const result = await this.run(worker, photo, settings)
          Object.assign(photo, result); photo.stage = undefined
          if (result.status === 'done' && settings.recycleOriginals && !result.warning) {
            try { await this.recycle(photo.path) } catch { photo.warning = 'JPEG saved. The original could not be moved to the Recycle Bin.' }
          }
        } catch (error) {
          photo.status = 'error'; photo.error = (error as Error).message; photo.stage = undefined
          if (worker) { this.workers.delete(worker); await worker.terminate(); worker = undefined }
          const scratch = this.scratchDirectories.get(photo.id)
          if (scratch) await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {})
        }
        this.scratchDirectories.delete(photo.id)
        this.publish()
      }
      if (worker) { this.workers.delete(worker); await worker.terminate() }
    }
    try { await Promise.all(Array.from({ length: concurrency }, lane)) }
    finally {
      for (const photo of photos) if (photo.status === 'queued') photo.status = 'cancelled'
      this.state.running = false; this.state.stopping = false; this.state.finishedAt = Date.now(); this.publish(true); this.emit('complete', this.state)
    }
  }
}
