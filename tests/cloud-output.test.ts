import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const { linkMock } = vi.hoisted(() => ({ linkMock: vi.fn() }))
vi.mock('node:fs/promises', async importOriginal => ({ ...await importOriginal<typeof import('node:fs/promises')>(), link: linkMock }))
import { commitOutput } from '../src/main/conversion/converter'

async function fixture() {
  const root = resolve('.test-output'); await mkdir(root, { recursive: true })
  const folder = await mkdtemp(join(root, 'cloud-output-'))
  const source = join(folder, 'temporary.jpg'), destination = join(folder, 'saved.jpg')
  await writeFile(source, 'verified JPEG bytes')
  return { folder, source, destination }
}
beforeEach(() => { linkMock.mockReset(); linkMock.mockRejectedValue(Object.assign(new Error('Cloud filesystem does not support link'), { code: 'EISDIR' })) })
describe('cloud filesystem output', () => {
  it('falls back from EISDIR to an exclusive byte-preserving copy', async () => {
    const { source, destination } = await fixture()
    expect(await commitOutput(source, destination, 'skip')).toBe(destination)
    expect(await readFile(destination)).toEqual(await readFile(source))
  })
  it('preserves an existing destination when skip is selected', async () => {
    const { source, destination } = await fixture(); await writeFile(destination, 'existing photo')
    expect(await commitOutput(source, destination, 'skip')).toBeNull()
    expect(await readFile(destination, 'utf8')).toBe('existing photo')
    expect(await readFile(source, 'utf8')).toBe('verified JPEG bytes')
  })
  it('keeps competing copies separate when cloud rename mode races', async () => {
    const { folder, source, destination } = await fixture(); const second = join(folder, 'second.jpg'); await writeFile(second, 'second photo')
    const outputs = await Promise.all([commitOutput(source, destination, 'rename'), commitOutput(second, destination, 'rename')])
    expect(new Set(outputs).size).toBe(2)
    expect(new Set(await Promise.all(outputs.map(file => readFile(file!, 'utf8'))))).toEqual(new Set(['verified JPEG bytes', 'second photo']))
  })
  it('does not treat a permission failure as unsupported hard links', async () => {
    const { source, destination } = await fixture()
    linkMock.mockRejectedValueOnce(Object.assign(new Error('Access denied'), { code: 'EACCES' }))
    await expect(commitOutput(source, destination, 'skip')).rejects.toMatchObject({ code: 'EACCES' })
    await expect(readFile(destination)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
