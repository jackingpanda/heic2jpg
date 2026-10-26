import { HelpCenter } from './HelpCenter'
import { inputDiagnosticSummary } from '../../shared/input-diagnostics'
import logo from '../../../resources/icon.svg'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, CircleAlert, Clock3, FileImage, Folder, FolderOpen, HardDrive, Info, LoaderCircle, LockKeyhole, Maximize2, Minus, Moon, Plus, RotateCcw, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Square, Sun, Trash2, Upload, X } from 'lucide-react'
import { version } from '../../../package.json'
import { defaults, type Photo, type Settings, type Snapshot, type Status } from '../../shared/types'

const api = window.desktop
const initial: Snapshot = { photos: [], settings: defaults, running: false, stopping: false, scanning: false, batchIds: [], startedAt: 0, finishedAt: 0, contextMenu: false, packaged: false, scanWarnings: [] }
function size(bytes: number): string { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function duration(ms: number): string { const seconds = Math.max(0, Math.floor(ms / 1000)); return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s` }
const labels: Record<Status, string> = { queued: 'Ready', converting: 'Converting', done: 'Saved', error: 'Needs attention', skipped: 'Skipped', cancelled: 'Stopped' }

function StatusIcon({ photo }: { photo: Photo }) {
  if (photo.status === 'converting') return <LoaderCircle className="spin" size={14} />
  if (photo.status === 'done' && !photo.warning) return <Check size={14} />
  if (photo.status === 'error' || photo.warning) return <CircleAlert size={14} />
  if (photo.status === 'queued') return <span className="status-dot" />
  return <Minus size={14} />
}
function Toggle({ checked, onChange, label, detail, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail?: string; disabled?: boolean }) {
  return <label className={`toggle-row ${disabled ? 'muted' : ''}`}><span><span className="toggle-label">{label}</span>{detail && <span className="toggle-detail">{detail}</span>}</span><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /><span className="switch" aria-hidden="true" /></label>
}

export function App() {
  const [state, setState] = useState(initial)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const dragDepth = useRef(0)
  const preferences = useRef<Settings>({ ...defaults })
  const pendingPreferences = useRef(0)
  const { photos, settings, running, scanning, stopping } = state
  const locked = running || scanning || busy

  const run = useCallback(async (task: () => Promise<unknown>) => {
    try { await task() } catch (error) { setToast((error as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')) }
  }, [])
  useEffect(() => {
    const receive = (next: Snapshot) => {
      if (!pendingPreferences.current) preferences.current = next.settings
      setState({ ...next, settings: preferences.current })
    }
    const unsubscribe = api.subscribe(receive)
    void run(async () => receive(await api.snapshot()))
    return unsubscribe
  }, [run])
  useEffect(() => { document.documentElement.dataset.theme = settings.theme }, [settings.theme])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 6500); return () => clearTimeout(timer) } }, [toast])
  useEffect(() => { setSelected(previous => new Set([...previous].filter(id => photos.some(p => p.id === id)))) }, [photos.length])
  useEffect(() => {
    if (settingsOpen) dialog.current?.showModal()
    else dialog.current?.close()
  }, [settingsOpen])

  const counts = useMemo(() => ({
    ready: photos.filter(p => p.status === 'queued' || p.status === 'cancelled').length,
    saved: photos.filter(p => p.status === 'done').length,
    issues: photos.filter(p => p.status === 'error' || p.warning).length,
    skipped: photos.filter(p => p.status === 'skipped').length
  }), [photos])
  const visible = useMemo(() => photos.filter(p => {
    const match = filter === 'all' || (filter === 'ready' && ['queued', 'cancelled'].includes(p.status)) || (filter === 'saved' && p.status === 'done') || (filter === 'issues' && (p.status === 'error' || p.warning))
    return match && p.name.toLowerCase().includes(query.toLowerCase())
  }), [photos, filter, query])
  const rows = useVirtualizer({ count: visible.length, getScrollElement: () => scroll.current, estimateSize: () => 61, overscan: 6 })
  const batch = useMemo(() => { const ids = new Set(state.batchIds); return photos.filter(p => ids.has(p.id)) }, [photos, state.batchIds])
  const completed = batch.filter(p => ['done', 'error', 'skipped'].includes(p.status)).length
  const percentage = batch.length ? Math.round(completed / batch.length * 100) : 0
  const selectedReady = photos.filter(p => selected.has(p.id) && ['queued', 'cancelled'].includes(p.status)).length
  const convertCount = selected.size ? selectedReady : counts.ready
  const elapsed = (state.finishedAt || now) - state.startedAt
  const eta = completed && running ? (elapsed / completed) * (batch.length - completed) : 0
  const detail = selected.size === 1 ? photos.find(p => selected.has(p.id)) : undefined
  const inputNotice = useMemo(() => inputDiagnosticSummary(photos), [photos])

  async function update(patch: Partial<Settings>) {
    const next = { ...preferences.current, ...patch }
    preferences.current = next
    pendingPreferences.current++
    setState(previous => ({ ...previous, settings: next }))
    await run(() => api.saveSettings(next))
    pendingPreferences.current--
    if (!pendingPreferences.current) await run(async () => {
      const latest = await api.snapshot()
      // A new edit may have started while this request was in flight.
      if (!pendingPreferences.current) { preferences.current = latest.settings; setState(latest) }
    })
  }
  async function chooseOutput() {
    await run(async () => { const folder = await api.pickOutput(); if (folder) await update({ outputMode: 'custom', outputPath: folder }) })
  }
  async function start() {
    setBusy(true)
    await run(() => api.start(selected.size ? [...selected] : undefined))
    setBusy(false)
  }
  const pick = (kind: 'files' | 'folder') => run(() => api.pick(kind))
  function select(id: string, shift: boolean) {
    setSelected(previous => {
      const next = new Set(previous)
      if (shift && previous.size) {
        const anchor = visible.findIndex(p => p.id === [...previous].at(-1))
        const end = visible.findIndex(p => p.id === id)
        if (anchor >= 0) { for (let i = Math.min(anchor, end); i <= Math.max(anchor, end); i++) next.add(visible[i].id); return next }
      }
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      const input = (e.target as HTMLElement).closest('input, select, textarea')
      if (settingsOpen || helpOpen) return
      if (e.ctrlKey && e.key.toLowerCase() === 'o' && !locked) { e.preventDefault(); void pick(e.shiftKey ? 'folder' : 'files') }
      if (e.ctrlKey && e.key === 'Enter' && !locked && convertCount) { e.preventDefault(); void start() }
      if (e.key === 'Escape' && running) void run(() => api.cancel())
      if (input) return
      if (e.ctrlKey && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelected(new Set(visible.map(p => p.id))) }
      if (e.key === 'Delete' && !locked && selected.size) { e.preventDefault(); void run(() => api.remove([...selected])) }
      if (e.ctrlKey && e.key === ',') { e.preventDefault(); setSettingsOpen(true) }
      if (e.key === 'F5' && !locked) { e.preventDefault(); void run(() => api.retry(photos.filter(p => p.status === 'error').map(p => p.id))) }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  })

  return <div className="app" onDragOver={e => e.preventDefault()} onDrop={e => e.preventDefault()}>
    <header className="titlebar">
      <div className="brand"><span className="brand-mark"><img src={logo} alt="HEIC2JPG logo" /></span><strong>HEIC<span>2</span>JPG</strong><span className="brand-divider" /><span className="brand-caption">by KULAM</span></div>
      <div className="title-actions"><span className="offline"><span />Local conversion</span><button className="icon-button" title={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} aria-label="Toggle theme" disabled={running} onClick={() => void update({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}>{settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button><button className="icon-button" aria-label="Open settings" title="Settings · Ctrl+," onClick={() => setSettingsOpen(true)}><Settings2 size={16} /></button><button className="icon-button" aria-label="About and updates" title="About, updates, and support" onClick={() => setHelpOpen(true)}><Info size={16} /></button><div className="window-controls"><button aria-label="Minimize" onClick={() => api.window('minimize')}><Minus size={14} /></button><button aria-label="Maximize or restore" onClick={() => api.window('maximize')}><Maximize2 size={12} /></button><button className="close-window" aria-label="Close" onClick={() => api.window('close')}><X size={16} /></button></div></div>
    </header>

    <main>
      <section className="hero"><div><div className="eyebrow"><span /> HEIC & HEIF PHOTO CONVERTER</div><h1>HEIC to JPEG.<br className="compact-break" /> Made simple<span>.</span></h1><p>Convert locally. Keep full resolution and essential photo metadata.</p></div><div className="format-badge"><span>HEIC</span><ArrowRight size={18} /><span>JPG<Check size={11} /></span></div></section>

      <div className="workspace">
        <section className="queue-workspace" aria-label="Photo workspace">
          <div className={`dropzone ${dragging ? 'dragging' : ''} ${photos.length ? 'has-photos' : ''} ${locked ? 'disabled' : ''}`}
            onDragEnter={e => { e.preventDefault(); if (!locked) { dragDepth.current++; setDragging(true) } }}
            onDragLeave={e => { e.preventDefault(); if (--dragDepth.current <= 0) { setDragging(false); dragDepth.current = 0 } }}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = locked ? 'none' : 'copy' }}
            onDrop={e => { e.preventDefault(); dragDepth.current = 0; setDragging(false); if (!locked) { const files = [...e.dataTransfer.files]; void run(() => api.drop(files)) } }}>
            <div className="drop-art" aria-hidden="true"><div className="photo-sheet back"><FileImage size={23} /></div><div className="photo-sheet front"><svg viewBox="0 0 42 36"><circle cx="29" cy="9" r="4" /><path d="M3 30 15 15 23 24 29 18 39 30Z" /></svg><span>HEIC</span></div><span className="art-plus"><Plus size={12} /></span></div>
            <div className="drop-copy"><h2>{scanning ? 'Finding your photos…' : dragging ? 'Drop them right here' : 'Add photos to your conversion queue'}</h2><p>{running ? 'Your photos are converting. You can add more when they finish.' : 'Drag HEIC/HEIF photos or folders here, or select files.'}</p><div className="drop-actions"><button className="button secondary" disabled={locked} onClick={() => void pick('files')}>{scanning ? <LoaderCircle size={14} className="spin" /> : <Plus size={15} />}Add photos</button><button className="text-button" disabled={locked} onClick={() => void pick('folder')}>Choose folder<ArrowUpRight size={13} /></button><span className="file-types">.HEIC / .HEIF</span></div></div>
          </div>

          <div className="queue-heading"><div><h2>Conversion queue <span className="count">{photos.length}</span></h2></div><div className="queue-tools">{selected.size > 0 && <button className="text-button remove-button" disabled={locked} onClick={() => void run(() => api.remove([...selected]))}><Trash2 size={13} />Remove {selected.size}</button>}{photos.length > 0 && <button className="text-button" disabled={locked} onClick={() => void run(() => api.remove(photos.map(p => p.id)))}>Clear all</button>}</div></div>
          <div className="queue-panel">
            <div className="queue-navigation"><div className="tabs">{[['all', 'All photos', photos.length], ['ready', 'Ready', counts.ready], ['saved', 'Saved', counts.saved], ['issues', 'Issues', counts.issues]].map(([value, label, count]) => <button key={value} className={`tab ${filter === value ? 'active' : ''}`} onClick={() => setFilter(String(value))}>{label}{Number(count) > 0 && <span>{count}</span>}</button>)}</div><label className="search"><Search size={13} /><input aria-label="Search photos" placeholder="Find a photo" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
            <div className="column-head"><input type="checkbox" aria-label="Select all visible photos" checked={visible.length > 0 && visible.every(p => selected.has(p.id))} onChange={e => setSelected(e.target.checked ? new Set(visible.map(p => p.id)) : new Set())} disabled={!visible.length} /><span>FILE NAME</span><span>SIZE</span><span>STATUS</span><span /></div>
            <div className="queue-scroll" ref={scroll}>
              {!visible.length ? <div className="empty-state">{photos.length ? <><Search size={25} /><h3>No photos match</h3><p>Try another search or view all photos.</p><button className="text-button" onClick={() => { setFilter('all'); setQuery('') }}>Reset filters<ArrowRight size={13} /></button></> : <><div className="empty-icon"><FileImage size={22} /><span><Plus size={10} /></span></div><h3>No photos in the queue</h3><p>Add HEIC or HEIF photos to start converting.<br />Your original files are retained by default.</p><span className="keyboard-hint"><kbd>Ctrl</kbd> + <kbd>O</kbd> to add photos</span></>}</div> : <div style={{ height: rows.getTotalSize(), width: '100%', position: 'relative' }}>{rows.getVirtualItems().map(item => {
                const photo = visible[item.index]
                return <div key={photo.id} className={`file-row ${selected.has(photo.id) ? 'selected' : ''}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: item.size, transform: `translateY(${item.start}px)` }}>
                  <input type="checkbox" aria-label={`Select ${photo.name}`} checked={selected.has(photo.id)} onChange={e => select(photo.id, (e.nativeEvent as MouseEvent).shiftKey)} />
                  <button className="file-info" onClick={() => select(photo.id, false)} title={photo.error || photo.warning || photo.path}><span className={`file-type ${photo.status === 'done' ? 'saved' : ''}`}><FileImage size={17} /></span><span><strong>{photo.name}</strong><small>{photo.error || photo.warning || (photo.status === 'done' ? `${photo.outputSize ? size(photo.outputSize) : 'JPEG'} · ${photo.outputPath?.split(/[\\/]/).pop()}` : photo.stage || 'HEIC photo')}</small></span></button>
                  <span className="file-size">{size(photo.size)}</span>
                  <span className={`status ${photo.warning ? 'warning' : photo.status}`} title={photo.error || photo.warning || photo.stage}><StatusIcon photo={photo} /><span>{photo.warning ? 'Check metadata' : labels[photo.status]}</span></span>
                  <div className="row-action">{['error', 'cancelled', 'skipped'].includes(photo.status) ? <button className="icon-button" aria-label={`Retry ${photo.name}`} title="Prepare to retry" disabled={locked} onClick={() => void run(() => api.retry([photo.id]))}><RotateCcw size={14} /></button> : <button className="icon-button" aria-label={`Show ${photo.name} in Explorer`} title="Show in Explorer" onClick={() => void run(() => api.reveal(photo.id))}><FolderOpen size={14} /></button>}</div>
                </div>
              })}</div>}
            </div>
            <div className="queue-footnote">{detail && (detail.error || detail.warning) ? <span className="issue-detail" title={detail.error || detail.warning}><CircleAlert size={13} />{detail.error || detail.warning}</span> : <><span>{selected.size ? `${selected.size} selected` : photos.length ? `${photos.length} photos · ${size(photos.reduce((sum, p) => sum + p.size, 0))}` : 'Select HEIC or HEIF photos to begin.'}</span><span>{photos.length ? 'Shift + click to select a range' : <><LockKeyhole size={11} />Your photos stay on this device</>}</span></>}</div>
          </div>
          {inputNotice && <div className="scan-notice" role="status"><CircleAlert size={14} /><span title={inputNotice}>{inputNotice}</span></div>}
          {state.scanWarnings.length > 0 && <div className="scan-notice" role="status"><Info size={14} /><span title={state.scanWarnings.join('\n')}>{state.scanWarnings[0]}{state.scanWarnings.length > 1 ? ` (+${state.scanWarnings.length - 1} more)` : ''}</span></div>}
        </section>

        <aside className="sidebar">
          <section className="settings-card"><div className="card-title"><SlidersHorizontal size={15} /><h2>Conversion settings</h2><span>JPG</span></div>
            <div className="setting-section"><div className="setting-label"><label htmlFor="quality">Image quality</label><output htmlFor="quality">{settings.quality}<span>/100</span></output></div><input id="quality" className="quality-range" aria-label="Image quality" type="range" min="1" max="100" value={settings.quality} disabled={locked} onChange={e => void update({ quality: Number(e.target.value) })} style={{ '--range': `${settings.quality}%` } as React.CSSProperties} /><div className="range-labels"><span>Smaller file</span><span>Best quality</span></div><div className="quality-note"><Sparkles size={12} />{settings.quality >= 90 ? 'High quality. Ready for the details.' : settings.quality >= 70 ? 'A balance of quality and file size.' : 'Compact files. Some detail is lost.'}</div></div>
            <div className="setting-section output-section"><label className="section-label">Save JPEGs to</label><button className={`output-option ${settings.outputMode === 'same' ? 'chosen' : ''}`} disabled={locked} onClick={() => void update({ outputMode: 'same' })}><Folder size={16} /><span><strong>Same folder as original</strong><small>Keep everything together</small></span><span className="radio">{settings.outputMode === 'same' && <span />}</span></button><button className={`output-option ${settings.outputMode === 'custom' ? 'chosen' : ''}`} disabled={locked} onClick={() => void chooseOutput()}><FolderOpen size={16} /><span><strong>Choose a folder</strong><small title={settings.outputPath}>{settings.outputMode === 'custom' ? settings.outputPath : 'Save somewhere new'}</small></span><span className="radio">{settings.outputMode === 'custom' && <span />}</span></button></div>
            <div className="setting-section conflict-section"><label htmlFor="conflict">If a JPEG already exists</label><div className="select-wrap"><select id="conflict" value={settings.conflict} disabled={locked} onChange={e => void update({ conflict: e.target.value as Settings['conflict'] })}><option value="skip">Skip existing files</option><option value="rename">Keep both · add a number</option><option value="overwrite">Replace existing JPEG</option></select><ChevronDown size={13} /></div></div>
            <div className="quick-toggles"><Toggle label="Keep photo metadata" detail="Date, camera, location & more" checked={settings.preserveMetadata} disabled={locked} onChange={v => void update({ preserveMetadata: v })} /><Toggle label="Include subfolders" detail="When adding a folder" checked={settings.recursive} disabled={locked} onChange={v => void update({ recursive: v })} /></div>
            <button className="advanced-button" onClick={() => setSettingsOpen(true)}>Advanced settings<ArrowUpRight size={13} /></button>
          </section>
          <div className="reassurance"><span className="reassurance-icon"><ShieldCheck size={19} /></span><div><strong>{settings.recycleOriginals ? 'Recycle originals after saving' : 'Your originals are safe'}</strong><p>{settings.recycleOriginals ? 'You’ll confirm before each batch.' : 'We keep your HEIC files untouched.'}</p></div></div>
          <div className="jpeg-note"><Info size={12} /><p>JPEG uses lossy compression. We preserve full resolution and export the main still photo.</p></div>
        </aside>
      </div>
    </main>

    <footer className="action-footer">
      <div className="batch-status" aria-live="polite"><div className={`batch-icon ${running ? 'working' : counts.saved && state.finishedAt ? 'complete' : ''}`}>{running ? <LoaderCircle className="spin" size={18} /> : counts.saved && state.finishedAt ? <CheckCheck size={18} /> : <HardDrive size={18} />}</div><div><strong>{scanning ? 'Finding your photos…' : stopping ? 'Finishing current photos…' : running ? `${completed} of ${batch.length} photos processed` : state.finishedAt ? `${counts.saved} JPEG${counts.saved === 1 ? '' : 's'} saved${counts.issues ? ` · ${counts.issues} need attention` : ''}` : counts.ready ? `${counts.ready} photo${counts.ready === 1 ? '' : 's'} ready to convert` : 'Ready to convert'}</strong><span>{running ? `${percentage}% complete · ${duration(elapsed)} elapsed${eta > 2000 ? ` · about ${duration(eta)} left` : ''}` : state.finishedAt ? `${duration(elapsed)} elapsed${counts.skipped ? ` · ${counts.skipped} skipped` : ''}${counts.ready ? ` · ${counts.ready} remaining` : ''}` : settings.outputMode === 'same' ? 'JPEGs will be saved beside your originals' : settings.outputPath || 'Choose an output folder to continue'}</span>{running && <div className="mini-progress"><span style={{ width: `${percentage}%` }} /></div>}</div></div>
      <div className="conversion-actions">{!running && counts.issues > 0 && <button className="text-button" disabled={locked} onClick={() => void run(() => api.retry(photos.filter(p => p.status === 'error').map(p => p.id)))}><RotateCcw size={13} />Retry errors</button>}{!running && counts.saved > 0 && <button className="button secondary" onClick={() => void run(() => api.reveal())}><FolderOpen size={15} />Open output</button>}{running ? <button className="button stop-button" disabled={stopping} onClick={() => void run(() => api.cancel())}><Square size={12} />{stopping ? 'Stopping…' : 'Stop after current'}</button> : <button className="button primary" disabled={locked || !convertCount || (settings.outputMode === 'custom' && !settings.outputPath)} onClick={() => void start()}>{busy ? <LoaderCircle size={16} className="spin" /> : <ArrowRight size={16} />}{selected.size ? 'Convert selected' : 'Convert photos'}{convertCount > 0 && <span className="button-count">{convertCount}</span>}</button>}</div>
    </footer>

    <dialog ref={dialog} className="settings-dialog" onCancel={() => setSettingsOpen(false)} onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false) }} aria-labelledby="settings-title"><div className="dialog-content"><div className="dialog-header"><div><div className="eyebrow">APPLICATION SETTINGS</div><h2 id="settings-title">Conversion preferences</h2></div><button className="icon-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={19} /></button></div><p className="dialog-intro">HEIC2JPG {version} · Preferences save automatically.</p><fieldset disabled={locked}><legend>Files & conversion</legend><Toggle label="Preserve file timestamps" detail="Keep the original modification date on your JPEGs." checked={settings.preserveTimestamps} onChange={v => void update({ preserveTimestamps: v })} /><Toggle label="Move originals to Recycle Bin" detail="Only after verified success. You’ll confirm each batch." checked={settings.recycleOriginals} onChange={v => void update({ recycleOriginals: v })} /><div className="name-fields"><label>Filename prefix<input placeholder="e.g. holiday_" value={settings.prefix} onChange={e => void update({ prefix: e.target.value })} maxLength={80} /></label><label>Filename suffix<input placeholder="e.g. _converted" value={settings.suffix} onChange={e => void update({ suffix: e.target.value })} maxLength={80} /></label></div><p className="filename-preview">Preview <span>{settings.prefix}IMG_0001{settings.suffix}.jpg</span></p><label className="parallel-setting"><span>Parallel conversions<small>Fewer workers use less memory. Replace mode uses one.</small></span><select value={settings.concurrency} onChange={e => void update({ concurrency: Number(e.target.value) })}><option value={1}>1 photo</option><option value={2}>2 photos</option><option value={3}>3 photos</option><option value={4}>4 photos</option></select></label></fieldset><fieldset disabled={locked}><legend>Windows Explorer</legend><Toggle label="Add “Convert to JPG” to right-click" detail={state.packaged ? 'On Windows 11, look under “Show more options”.' : 'Available after packaging or installing the app.'} checked={state.contextMenu} disabled={!state.packaged} onChange={v => void run(() => api.setContextMenu(v))} /><Toggle label="Use compact progress window" detail="Animated progress for right-click conversions. Originals are kept." checked={settings.silentMode} onChange={v => void update({ silentMode: v })} /></fieldset><div className="dialog-bottom"><button className="text-button" onClick={() => void run(async () => { if (await api.exportLog()) setToast('Conversion report saved.') })}><ArrowDown size={14} />Save conversion report</button><button className="button primary" onClick={() => setSettingsOpen(false)}>Done<Check size={15} /></button></div></div></dialog>
    <HelpCenter open={helpOpen} onClose={() => setHelpOpen(false)} settings={settings} updateSettings={update} />
    {toast && <div className="toast" role="alert"><Info size={17} /><span>{toast}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>
}
