export type Status = 'queued' | 'converting' | 'done' | 'error' | 'skipped' | 'cancelled'
export interface InputDiagnostic {
  code: 'FORMAT_MISMATCH' | 'UNSUPPORTED_FORMAT'
  detectedFormat: 'JPEG' | 'PNG' | 'WebP' | 'GIF' | 'TIFF' | 'PDF' | 'AVIF' | 'Unknown'
  expectedFormat: 'HEIC/HEIF'
  signature: string
  recommendation: string
}
export interface Photo {
  id: string; path: string; name: string; size: number; status: Status
  stage?: string; outputPath?: string; outputSize?: number; error?: string; warning?: string
  inputDiagnostic?: InputDiagnostic
}
export interface Settings {
  quality: number; outputMode: 'same' | 'custom'; outputPath: string
  conflict: 'skip' | 'rename' | 'overwrite'; recursive: boolean
  preserveMetadata: boolean; preserveTimestamps: boolean; recycleOriginals: boolean
  prefix: string; suffix: string; concurrency: number; theme: 'dark' | 'light'
  silentMode: boolean
  autoCheckUpdates: boolean
}
export const defaults: Settings = {
  quality: 95, outputMode: 'same', outputPath: '', conflict: 'skip', recursive: false,
  preserveMetadata: true, preserveTimestamps: true, recycleOriginals: false,
  prefix: '', suffix: '', concurrency: 2, theme: 'dark', silentMode: true, autoCheckUpdates: true
}
export interface Snapshot {
  photos: Photo[]; running: boolean; stopping: boolean; scanning: boolean
  startedAt: number; finishedAt: number; batchIds: string[]
  settings: Settings; contextMenu: boolean; packaged: boolean; scanWarnings: string[]
}
export interface ConvertResult {
  status: 'done' | 'skipped'; outputPath: string; outputSize?: number; warning?: string
}
export interface WorkerJob { photo: Photo; settings: Settings }
export type WorkerReply = { stage: string; scratch?: string } | { result: ConvertResult } | { error: string }
export interface QuickProgressState {
  phase: 'waiting' | 'scanning' | 'converting' | 'stopping' | 'complete'
  photos: Photo[]; startedAt: number; finishedAt: number; pending: boolean
  theme: Settings['theme']; message?: string
}
export interface QuickProgressApi {
  snapshot(): Promise<QuickProgressState>
  subscribe(callback: (state: QuickProgressState) => void): () => void
  hide(): void
  openApp(): Promise<void>
  cancel(): Promise<void>
  reveal(): Promise<void>
}
export interface DesktopApi {
  appInfo(): Promise<AppInfo>
  checkUpdate(): Promise<UpdateState>
  downloadUpdate(): Promise<UpdateState>
  installUpdate(): Promise<void>
  subscribeUpdates(callback: (state: UpdateState) => void): () => void
  openLink(key: 'website' | 'repository' | 'releases' | 'license' | 'privacy' | 'notices'): Promise<void>
  report(report: SupportReport, target: 'email' | 'github' | 'copy'): Promise<string>
  snapshot(): Promise<Snapshot>
  add(paths: string[]): Promise<void>
  pick(kind: 'files' | 'folder'): Promise<void>
  pickOutput(): Promise<string | null>
  start(ids?: string[]): Promise<void>
  cancel(): Promise<void>
  remove(ids: string[]): Promise<void>
  retry(ids: string[]): Promise<void>
  saveSettings(settings: Settings): Promise<void>
  setContextMenu(enabled: boolean): Promise<boolean>
  reveal(id?: string): Promise<void>
  exportLog(): Promise<boolean>
  window(action: 'minimize' | 'maximize' | 'close'): void
  drop(files: File[]): Promise<void>
  subscribe(callback: (state: Snapshot) => void): () => void
}
export interface UpdateState {
  status: 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'error' | 'development' | 'not-published'
  version?: string; notes?: string; percent?: number; checkedAt?: number; message?: string
}
export interface AppInfo { version: string; electron: string; platform: string; architecture: string; packaged: boolean; update: UpdateState }
export interface SupportReport {
  category: 'bug' | 'conversion' | 'installation' | 'updates' | 'security' | 'feedback'
  summary: string; description: string; steps: string; includeDiagnostics: boolean
}
