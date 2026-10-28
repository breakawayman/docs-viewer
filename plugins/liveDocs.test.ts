// @vitest-environment node
import { mkdtemp, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { liveDocs, readDocs } from './liveDocs'

it('refreshes the virtual module after additions, renames, edits and deletions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'live-docs-'))
  let watcherReady = Promise.resolve()
  const server = await createServer({
    configFile: false,
    root,
    plugins: [liveDocs(), {
      name: 'wait-for-docs-watcher',
      configureServer(server) {
        watcherReady = new Promise<void>((resolve) => { server.watcher.once('ready', resolve) })
      },
    }],
    server: { port: 0, host: '127.0.0.1' },
  })
  try {
    await mkdir(path.join(root, 'docs'))
    await writeFile(path.join(root, 'docs', 'old.md'), '# Original')
    await writeFile(path.join(root, 'entry.js'),
      "import docs from 'virtual:live-docs'; console.log(docs); import.meta.hot.accept('virtual:live-docs', () => {});")
    await server.listen()
    // Initial scans ignore existing files. Wait before testing newly created ignore files.
    await watcherReady
    await server.transformRequest('/entry.js')
    const load = async () => (await server.transformRequest('virtual:live-docs'))?.code ?? ''
    expect(await load()).toContain('/docs/old.md')
    const send = vi.spyOn(server.ws, 'send')
    const update = async (action: () => Promise<unknown>, expected: string, removed?: string) => {
      send.mockClear()
      await action()
      await vi.waitFor(() => {
        expect(send.mock.calls.some(([message]) => typeof message === 'object' && message.type === 'update'), `Expected update containing ${expected}, removing ${removed ?? '(none)'}: ${JSON.stringify(send.mock.calls)}`).toBe(true)
      }, { timeout: 5000 })
      const code = await load()
      expect(code).toContain(expected)
      if (removed) expect(code).not.toContain(removed)
    }
    await update(() => rename(path.join(root, 'docs', 'old.md'), path.join(root, 'docs', 'new.MD')), '/docs/new.MD', '/docs/old.md')
    await update(() => writeFile(path.join(root, 'docs', 'new.MD'), '# Updated'), '# Updated', '# Original')
    await update(() => writeFile(path.join(root, 'docs', 'added.md'), '# Added'), '/docs/added.md')
    await update(() => writeFile(path.join(root, '.docsignore'), '/docs/new.MD\n'), '/docs/added.md', '/docs/new.MD')
    await update(() => writeFile(path.join(root, '.docsignore'), '/docs/added.md\n'), '/docs/new.MD', '/docs/added.md')
    await update(() => rm(path.join(root, '.docsignore')), '/docs/added.md')
    expect(await load()).toContain('/docs/new.MD')
    await update(() => rm(path.join(root, 'docs', 'new.MD')), '/docs/added.md', '/docs/new.MD')
    await update(() => rm(path.join(root, 'docs', 'added.md')), 'export default {}')
    expect(await readDocs(root)).toEqual({})
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
}, 20000)

it('applies gitignore patterns to docs, including negation and ignored parents', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'live-docs-ignore-'))
  try {
    const files = [
      'docs/.agent/hidden.md', 'docs/nested/.agent/hidden.md',
      'docs/草稿/private.md', 'docs/nested/草稿/public.md',
      'docs/notes.draft.md', 'docs/nested/notes.draft.md',
      'docs/归档/说明.md', 'docs/归档/old.md',
      'docs/blocked/keep.md', 'docs/visible.md',
    ]
    for (const file of files) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), '# Document')
    }
    expect(Object.keys(await readDocs(root))).toHaveLength(files.length)
    await writeFile(path.join(root, '.docsignore'), [
      '# Comment', '', '.agent/', '/docs/草稿/', '*.draft.md',
      '/docs/归档/*', '!/docs/归档/说明.md',
      '/docs/blocked/', '!/docs/blocked/keep.md',
    ].join('\r\n'))
    expect(Object.keys(await readDocs(root)).sort()).toEqual([
      '/docs/visible.md', '/docs/归档/说明.md', '/docs/nested/草稿/public.md',
    ].sort())
    await writeFile(path.join(root, '.docsignore'), '**/.agent/\n')
    expect(Object.keys(await readDocs(root)).every((file) => file.startsWith('/docs/') && !file.includes('.agent/'))).toBe(true)
    await writeFile(path.join(root, '.docsignore'), '')
    expect(Object.keys(await readDocs(root))).toHaveLength(files.length)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('only loads the docs directory, excluding show and other project directories', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'live-docs-roots-'))
  try {
    for (const directory of ['docs', 'show', 'other']) {
      await mkdir(path.join(root, directory))
      await writeFile(path.join(root, directory, 'readme.md'), `# ${directory}`)
    }
    expect(await readDocs(root)).toEqual({ '/docs/readme.md': '# docs' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
