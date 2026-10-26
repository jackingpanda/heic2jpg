import logo from '../../../resources/icon.svg'
import { inputDiagnosticSummary } from '../../shared/input-diagnostics'
import { useEffect, useState } from 'react'
import { ArrowRight, Check, CircleAlert, FileImage, FolderOpen, LoaderCircle, Square, X } from 'lucide-react'
import type { QuickProgressState } from '../../shared/types'
import './progress.css'

const api = window.quickProgress
const initial: QuickProgressState = { phase: 'waiting', photos: [], startedAt: Date.now(), finishedAt: 0, pending: true, theme: 'dark' }
export function QuickProgress() {
  const [state, setState] = useState(initial)
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState('')
  useEffect(() => {
    let received = false
    const unsubscribe = api.subscribe(next => { received = true; setState(next) })
    void api.snapshot().then(next => { if (!received) setState(next) }).catch(e => setError(e.message))
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => { unsubscribe(); clearInterval(timer) }
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = state.theme }, [state.theme])
  const complete = state.phase === 'complete'
  const waiting = state.phase === 'waiting' || state.phase === 'scanning'
  const done = state.photos.filter(p => p.status === 'done').length
  const skipped = state.photos.filter(p => p.status === 'skipped').length
  const failed = state.photos.filter(p => p.status === 'error' || p.warning).length
  const stopped = state.photos.filter(p => p.status === 'cancelled').length
  const finished = state.photos.filter(p => ['done', 'error', 'skipped'].includes(p.status)).length
  const percent = state.photos.length ? Math.round(finished / state.photos.length * 100) : 0
  const active = state.photos.find(p => p.status === 'converting')
  const seconds = Math.max(0, Math.floor(((state.finishedAt && complete ? state.finishedAt : now) - state.startedAt) / 1000))
  const elapsed = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const title = state.phase === 'scanning' ? 'Finding your photos' : state.phase === 'waiting' ? 'Preparing your selection' : state.phase === 'stopping' ? 'Finishing current photos' : complete ? failed ? done ? 'Completed with warnings' : 'Some photos need attention' : stopped ? 'Stopped safely' : done ? 'Your JPEGs are ready' : skipped ? 'Already converted' : 'Nothing to convert' : 'Converting photos to JPEG'
  const subtitle = error || state.message || (complete && inputDiagnosticSummary(state.photos)) || (complete ? [done ? `${done} saved` : '', skipped ? `${skipped} skipped` : '', failed ? `${failed} to review` : '', stopped ? `${stopped} stopped` : ''].filter(Boolean).join(' · ') : state.phase === 'scanning' ? 'Looking for HEIC and HEIF files…' : state.phase === 'waiting' ? 'Preparing your selection or waiting for the current batch.' : active?.stage || 'Preparing the next photo…')
  async function run(task: () => Promise<unknown>) { try { await task() } catch (e) { setError((e as Error).message) } }
  return <div className={`quick-card ${complete ? failed || state.message ? 'has-issues' : 'is-complete' : 'is-active'}`}>
    <header className="quick-header"><span className="quick-wordmark"><img src={logo} alt="" /> HEIC2JPG <span>QUICK CONVERT</span></span><button aria-label="Hide progress" title={complete ? 'Dismiss' : 'Hide · conversion continues in the tray'} onClick={() => api.hide()}><X size={14} /></button></header>
    <section className="quick-body"><div className="quick-status-line"><div className="quick-orbit" aria-hidden="true"><span className="orbit-ring" />{complete ? failed || state.message ? <CircleAlert size={21} /> : <Check size={23} /> : <FileImage size={22} />}{!complete && <span className="orbit-spark" />}</div><div className="quick-copy"><h1>{title}</h1><p title={subtitle}>{subtitle}</p></div></div>
      <div className="quick-meter-label"><span>{waiting ? 'HEIC → JPG' : `${finished} of ${state.photos.length} processed`}</span><strong>{waiting ? <LoaderCircle size={13} className="spin" /> : `${percent}%`}</strong></div>
      <div className={`quick-track ${waiting ? 'indeterminate' : ''}`} role="progressbar" aria-label="Photo conversion progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={waiting ? undefined : percent}><div className="quick-fill" style={{ width: `${percent}%` }} /><span className="quick-shimmer" /></div>
      <div className="quick-file"><span title={active?.name || subtitle}>{active?.name || (state.pending && !complete ? 'Another selection is queued' : complete ? 'Your original HEIC files are safe' : 'Full resolution. All on your device.')}</span><span>{elapsed}</span></div>
    </section>
    <footer className="quick-footer"><button className="quick-link" onClick={() => void run(() => api.openApp())}>Show app<ArrowRight size={12} /></button>{complete ? done > 0 ? <button className="quick-action" onClick={() => void run(() => api.reveal())}><FolderOpen size={13} />Open output</button> : <button className="quick-action" onClick={() => api.hide()}>Done<Check size={13} /></button> : <button className="quick-action" disabled={state.phase === 'stopping'} onClick={() => void run(() => api.cancel())}><Square size={10} />{state.phase === 'stopping' ? 'Stopping…' : 'Stop'}</button>}</footer>
  </div>
}
