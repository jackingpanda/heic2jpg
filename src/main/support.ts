import type { AppInfo, SupportReport } from '../shared/types'
import { product } from '../shared/product'

export function validateReport(input: unknown): SupportReport {
  if (!input || typeof input !== 'object') throw new Error('Complete the report before continuing.')
  const v = input as Record<string, unknown>
  const categories = ['bug', 'conversion', 'installation', 'updates', 'security', 'feedback']
  if (!categories.includes(String(v.category))) throw new Error('Select a report category.')
  const text = (key: string, max: number) => typeof v[key] === 'string' ? (v[key] as string).trim().replace(/\x00/g, '').slice(0, max) : ''
  const summary = text('summary', 120), description = text('description', 3500)
  if (summary.length < 5) throw new Error('Enter a summary of at least 5 characters.')
  if (description.length < 20) throw new Error('Describe the issue in at least 20 characters.')
  return { category: v.category as SupportReport['category'], summary, description, steps: text('steps', 1800), includeDiagnostics: v.includeDiagnostics === true }
}
export function formatReport(report: SupportReport, info: AppInfo): string {
  const lines = [`Category: ${report.category}`, '', 'Description', report.description]
  if (report.steps) lines.push('', 'Steps to reproduce', report.steps)
  if (report.includeDiagnostics) lines.push('', 'Application diagnostics', `HEIC2JPG: ${info.version}`, `Platform: ${info.platform}`, `Architecture: ${info.architecture}`, `Electron: ${info.electron}`, `Build: ${info.packaged ? 'Packaged' : 'Development'}`)
  lines.push('', 'No photos, photo metadata, file paths, settings, or conversion logs were attached automatically.')
  return lines.join('\n')
}
export function reportDestination(report: SupportReport, body: string, target: 'email' | 'github'): string {
  if (target === 'github' && report.category === 'security') throw new Error('Report security issues privately by email.')
  const subject = `[HEIC2JPG] ${report.summary.replace(/[\r\n]/g, ' ')}`
  if (target === 'email') return `mailto:${product.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  const url = new URL(`${product.repository}/issues/new`)
  url.searchParams.set('title', subject); url.searchParams.set('body', body)
  return url.toString()
}
