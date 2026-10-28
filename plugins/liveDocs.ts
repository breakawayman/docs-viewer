import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import ignore from 'ignore'

const moduleId = 'virtual:live-docs'
const resolvedId = '\0' + moduleId
const ignoreFile = '.docsignore'

// Read a fresh snapshot instead of importing files that can disappear during a rename.
export async function readDocs(root: string) {
  const docs: Record<string, string> = {}
  const matcher = ignore()
  try {
    matcher.add(await readFile(path.join(root, ignoreFile), 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  async function walk(directory: string) {
    const relativeDirectory = path.relative(root, directory).split(path.sep).join('/')
    if (matcher.ignores(relativeDirectory + '/')) return
    try {
      const entries = await readdir(directory, { withFileTypes: true })
      await Promise.all(entries.map(async (entry) => {
        const file = path.join(directory, entry.name)
        const relative = path.relative(root, file).split(path.sep).join('/')
        if (entry.isDirectory()) await walk(file)
        else if (entry.isFile() && /\.md$/i.test(entry.name) && !matcher.ignores(relative)) {
          try {
            docs['/' + relative] = await readFile(file, 'utf8')
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          }
        }
      }))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  await walk(path.join(root, 'docs'))
  return docs
}

export function liveDocs(): Plugin {
  let root: string
  return {
    name: 'live-docs',
    configResolved(config) { root = config.root },
    resolveId(id) { if (id === moduleId) return resolvedId },
    async load(id) {
      if (id === resolvedId) return `export default ${JSON.stringify(await readDocs(root))}`
    },
    configureServer(server) {
      let timer: ReturnType<typeof setTimeout> | undefined
      const onChange = (_event: string, file: string) => {
        const relative = path.relative(root, file).split(path.sep).join('/')
        if (relative !== ignoreFile && !/^docs(\/|$)/.test(relative)) return
        clearTimeout(timer)
        // Combine unlink/add events from renames and editor atomic saves.
        timer = setTimeout(() => {
          const mod = server.moduleGraph.getModuleById(resolvedId)
          if (mod) void server.reloadModule(mod).catch((error: unknown) => {
            server.config.logger.error(String(error))
          })
        }, 150)
      }
      // Watch the parent so creating a previously missing .docsignore is detected on Windows.
      server.watcher.add(root)
      server.watcher.on('all', onChange)
      server.httpServer?.once('close', () => {
        clearTimeout(timer)
        server.watcher.off('all', onChange)
      })
    },
  }
}
