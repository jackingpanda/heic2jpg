import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { loadArtifacts, publishRelease } = require('../scripts/publish-release.cjs')
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const artifacts = ['HEIC2JPG-Setup-1.2.0.exe', 'HEIC2JPG-Setup-1.2.0.exe.blockmap', 'latest.yml'].map(name => {
  const bytes = Buffer.from(`test bytes for ${name}`)
  return { name, bytes, sha256: sha(bytes) }
})

function github(failUpload = '', published = false, wrongHash = false) {
  const events: string[] = []
  const assets: any[] = published ? artifacts.map((artifact, index) => ({ id: index + 1, name: artifact.name, state: 'uploaded', size: artifact.bytes.length, digest: `sha256:${wrongHash ? 'invalid' : artifact.sha256}` })) : []
  const release = () => ({ id: 10, tag_name: 'v1.2.0', draft: !published, prerelease: false, assets: [...assets], html_url: 'https://github.com/jackingpanda/heic2jpg/releases/tag/v1.2.0' })
  const request = async (route: string, options: any = {}) => {
    if (route === '/releases?per_page=100') return published ? [release()] : []
    if (route === '/releases' && options.method === 'POST') { expect(options.json.draft).toBe(true); events.push('create draft'); return release() }
    if (route.startsWith('https://uploads.github.com/')) {
      const name = new URL(route).searchParams.get('name')!
      events.push(`upload ${name}`)
      if (name === failUpload) throw new Error('Simulated interrupted upload')
      const asset = { id: assets.length + 1, name, state: 'uploaded', size: options.bytes.length, digest: `sha256:${sha(options.bytes)}` }
      assets.push(asset); return asset
    }
    if (route === '/releases/10' && options.method === 'PATCH') { expect(assets).toHaveLength(3); expect(options.json.draft).toBe(false); events.push('publish'); return release() }
    if (route === '/releases/10') return release()
    throw new Error(`Unexpected request: ${route}`)
  }
  return { events, request }
}

describe('release delivery', () => {
  it('uploads every asset to one draft before making it public', async () => {
    const api = github()
    await publishRelease({ version: '1.2.0', notes: 'Release notes', artifacts, request: api.request })
    expect(api.events).toEqual(['create draft', ...artifacts.map(artifact => `upload ${artifact.name}`), 'publish'])
  })
  it('never publishes when an upload is interrupted', async () => {
    const api = github(artifacts[1].name)
    await expect(publishRelease({ version: '1.2.0', notes: 'Notes', artifacts, request: api.request })).rejects.toThrow('interrupted')
    expect(api.events).not.toContain('publish')
    expect(api.events).not.toContain('upload latest.yml')
  })
  it('preserves published assets instead of replacing a different installer', async () => {
    const api = github('', true, true)
    await expect(publishRelease({ version: '1.2.0', notes: 'Notes', artifacts, request: api.request })).rejects.toThrow('checksum mismatch')
    expect(api.events).toEqual([])
  })
  it('rejects a manifest that does not describe the installer bytes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'heic2jpg-release-'))
    try {
      for (const artifact of artifacts) await writeFile(join(directory, artifact.name), artifact.bytes)
      await writeFile(join(directory, 'latest.yml'), JSON.stringify({ version: '1.2.0', files: [{ url: artifacts[0].name, size: 1, sha512: 'incorrect' }] }))
      await expect(loadArtifacts(directory, '1.2.0')).rejects.toThrow('does not match')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})
