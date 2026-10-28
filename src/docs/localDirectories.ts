import { useEffect, useSyncExternalStore } from 'react'
import ignore from 'ignore'
import { createIndexFromRawDocs, type DocIndex } from './docIndex'
import { deleteDirectory, loadDirectories, saveDirectory, type DirectoryHandle, type SavedDirectory } from './directoryStorage'

export type LocalDirectory = SavedDirectory & { index: DocIndex }
type Snapshot = { directories: LocalDirectory[]; loaded: boolean; error: string | null }
let snapshot: Snapshot = { directories: [], loaded: false, error: null }
let initialization: Promise<void> | undefined
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function publish(update: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...update }
  listeners.forEach((listener) => listener())
}
export function directoryError(error: unknown) {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return '浏览器存储空间不足，请移除不需要的目录后重试。'
  if (error instanceof DOMException && error.name === 'NotAllowedError') return '未获得目录读取权限，请重新选择目录并允许访问。'
  return error instanceof Error ? error.message : '读取目录失败，请重新选择后重试。'
}
function withIndex(directory: SavedDirectory): LocalDirectory {
  return { ...directory, index: createIndexFromRawDocs(directory.docs, { sourceRoot: 'local', routeBase: `/local/${directory.id}` }) }
}
export function initializeDirectories() {
  return initialization ??= loadDirectories().then((directories) => {
    publish({ directories: directories.map(withIndex), loaded: true, error: null })
  }).catch((error: unknown) => {
    initialization = undefined
    publish({ loaded: true, error: directoryError(error) })
  })
}
export function useLocalDirectories() {
  useEffect(() => { void initializeDirectories() }, [])
  return useSyncExternalStore(subscribe, () => snapshot)
}

// Never descend into dependency, version-control or cache trees.
const excluded = new Set(['.git', '.svn', 'node_modules', '.npm-cache', '.cache'])
const isMarkdown = (name: string) => /\.md$/i.test(name)

export async function readDirectoryHandle(handle: DirectoryHandle) {
  const matcher = ignore()
  try {
    matcher.add(await (await handle.getFileHandle('.docsignore')).getFile().then((file) => file.text()))
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error
  }
  const docs: Record<string, string> = {}
  async function walk(directory: DirectoryHandle, prefix: string) {
    for await (const entry of directory.values()) {
      const relative = prefix + entry.name
      if (entry.kind === 'directory') {
        if (!excluded.has(entry.name) && !matcher.ignores(relative + '/')) await walk(entry, relative + '/')
      } else if (isMarkdown(entry.name) && !matcher.ignores(relative)) {
        docs['/local/' + relative] = await (await entry.getFile()).text()
      }
    }
  }
  await walk(handle, '')
  return docs
}

export async function readDirectoryFiles(files: readonly File[]) {
  const first = files[0]?.webkitRelativePath.split('/')
  if (!first || first.length < 2 || !first[0]) throw new Error('请选择一个文件夹。')
  const name = first[0]
  const entries = files.map((file) => {
    const [root, ...parts] = file.webkitRelativePath.split('/')
    if (root !== name || parts.some((part) => !part || part === '.' || part === '..')) throw new Error('目录中的文件路径无效。')
    return { file, relative: parts.join('/'), parts }
  })
  const matcher = ignore()
  const ignoreFile = entries.find((entry) => entry.relative === '.docsignore')
  if (ignoreFile) matcher.add(await ignoreFile.file.text())
  const docs: Record<string, string> = {}
  for (const { file, relative, parts } of entries) {
    if (isMarkdown(file.name) && !parts.slice(0, -1).some((part) => excluded.has(part)) && !matcher.ignores(relative)) {
      docs['/local/' + relative] = await file.text()
    }
  }
  return { name, docs }
}

async function commitDirectory(name: string, docs: Record<string, string>, handle?: DirectoryHandle, id?: string) {
  await initializeDirectories()
  if (!id && !Object.keys(docs).length) throw new Error('所选目录中没有可读取的 Markdown（.md）文档，请选择其他目录。')
  const directory: SavedDirectory = { id: id ?? crypto.randomUUID(), name, docs, updatedAt: Date.now(), ...(handle ? { handle } : {}) }
  await saveDirectory(directory)
  const indexed = withIndex(directory)
  const exists = snapshot.directories.some((item) => item.id === directory.id)
  publish({ directories: exists ? snapshot.directories.map((item) => item.id === directory.id ? indexed : item) : [...snapshot.directories, indexed], error: null })
  return directory.id
}

export async function addDirectoryHandle(handle: DirectoryHandle) {
  await initializeDirectories()
  let existing: LocalDirectory | undefined
  for (const directory of snapshot.directories) {
    if (directory.handle && await handle.isSameEntry?.(directory.handle)) { existing = directory; break }
  }
  return commitDirectory(handle.name, await readDirectoryHandle(handle), handle, existing?.id)
}
export async function addDirectoryFiles(files: readonly File[], replaceId?: string) {
  const { name, docs } = await readDirectoryFiles(files)
  await initializeDirectories()
  const previous = snapshot.directories.find((directory) => directory.id === replaceId)
  if (previous && previous.name !== name) throw new Error(`请选择原目录“${previous.name}”以刷新文档。`)
  return commitDirectory(name, docs, undefined, replaceId)
}
export async function refreshDirectory(directory: LocalDirectory) {
  if (!directory.handle) throw new Error('请重新选择此目录以刷新文档。')
  const handle = directory.handle
  if (await handle.queryPermission?.({ mode: 'read' }) !== 'granted' &&
      await handle.requestPermission?.({ mode: 'read' }) !== 'granted') {
    throw new Error('未获得目录读取权限，请重新添加目录并允许访问。')
  }
  return commitDirectory(handle.name, await readDirectoryHandle(handle), handle, directory.id)
}
export async function removeDirectory(id: string) {
  await initializeDirectories()
  await deleteDirectory(id)
  publish({ directories: snapshot.directories.filter((directory) => directory.id !== id) })
}
