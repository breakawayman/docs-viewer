import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DirectoryHandle, SavedDirectory } from './directoryStorage'

const storage = vi.hoisted(() => ({
  records: new Map<string, SavedDirectory>(),
  save: vi.fn(),
}))
vi.mock('./directoryStorage', () => ({
  loadDirectories: async () => [...storage.records.values()],
  saveDirectory: async (directory: SavedDirectory) => {
    storage.save(directory)
    storage.records.set(directory.id, directory)
  },
  deleteDirectory: async (id: string) => { storage.records.delete(id) },
}))

function file(relative: string, text: string): File {
  const file = new File([text], relative.split('/').pop()!)
  Object.defineProperty(file, 'webkitRelativePath', { value: relative })
  file.text = vi.fn(async () => text)
  return file
}
function directory(name: string, entries: Array<DirectoryHandle | File>, rules?: string): DirectoryHandle {
  const children = entries.map((entry) => entry instanceof File
    ? { name: entry.name, kind: 'file' as const, getFile: async () => entry }
    : entry)
  const result: DirectoryHandle = {
    name, kind: 'directory',
    async *values() { yield* children },
    getFileHandle: async () => {
      if (rules === undefined) throw new DOMException('Missing', 'NotFoundError')
      return { getFile: async () => file('.docsignore', rules) }
    },
    queryPermission: vi.fn(async () => 'granted' as const),
    requestPermission: vi.fn(async () => 'denied' as const),
    isSameEntry: async (other) => other === result,
  }
  return result
}

beforeEach(() => {
  vi.resetModules()
  storage.records.clear()
  storage.save.mockReset()
})

describe('local directory reading', () => {
  it('keeps deep paths and uppercase extensions in both picker modes and obeys ignore rules', async () => {
    const { readDirectoryFiles, readDirectoryHandle } = await import('./localDirectories')
    const rules = '草稿/\n归档/*\n!归档/说明.md\n*.draft.md\n'
    const ignored = file('项目/node_modules/secret.md', '# Hidden')
    const files = [
      file('项目/.docsignore', rules),
      file('项目/指南/深入/说明.MD', '# Keep'),
      file('项目/草稿/private.md', '# Hidden'),
      file('项目/归档/说明.md', '# Restored'),
      file('项目/归档/old.md', '# Hidden'),
      file('项目/notes.draft.md', '# Hidden'),
      file('项目/image.png', 'image'), ignored,
    ]
    const fromFiles = await readDirectoryFiles(files)
    const fromHandle = await readDirectoryHandle(directory('项目', [
      directory('指南', [directory('深入', [files[1]])]),
      directory('草稿', [files[2]]), directory('归档', [files[3], files[4]]),
      files[5], files[6], directory('node_modules', [ignored]),
    ], rules))
    expect(fromFiles.name).toBe('项目')
    expect(fromFiles.docs).toEqual({ '/local/指南/深入/说明.MD': '# Keep', '/local/归档/说明.md': '# Restored' })
    expect(fromHandle).toEqual(fromFiles.docs)
    expect(ignored.text).not.toHaveBeenCalled()
  })

  it('rejects mixed and invalid paths and propagates read failures without importing partial results', async () => {
    const { readDirectoryFiles, addDirectoryFiles } = await import('./localDirectories')
    await expect(readDirectoryFiles([])).rejects.toThrow('请选择')
    await expect(readDirectoryFiles([file('a/readme.md', ''), file('b/readme.md', '')])).rejects.toThrow('路径无效')
    await expect(readDirectoryFiles([file('a/../readme.md', '')])).rejects.toThrow('路径无效')
    const broken = file('a/broken.md', '')
    broken.text = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
    await expect(addDirectoryFiles([file('a/good.md', '# Good'), broken])).rejects.toThrow('Denied')
    expect(storage.save).not.toHaveBeenCalled()
  })
})

describe('local directory lifecycle', () => {
  it('saves distinct same-name folders, reloads snapshots, refreshes and removes only the selected record', async () => {
    let api = await import('./localDirectories')
    const firstId = await api.addDirectoryFiles([file('资料/a.md', '# First')])
    const secondId = await api.addDirectoryFiles([file('资料/a.md', '# Second')])
    expect(firstId).not.toBe(secondId)
    expect(storage.records.size).toBe(2)
    vi.resetModules()
    api = await import('./localDirectories')
    await api.initializeDirectories()
    await expect(api.addDirectoryFiles([file('其他/a.md', '# Wrong')], firstId)).rejects.toThrow('原目录')
    await api.addDirectoryFiles([file('资料/new.md', '# Changed')], firstId)
    expect(storage.records.get(firstId)?.docs).toEqual({ '/local/new.md': '# Changed' })
    expect(storage.records.get(secondId)?.docs).toEqual({ '/local/a.md': '# Second' })
    await api.removeDirectory(firstId)
    expect([...storage.records.keys()]).toEqual([secondId])
  })

  it('rejects a new folder with no Markdown but allows an existing folder to become empty', async () => {
    const api = await import('./localDirectories')
    await expect(api.addDirectoryFiles([file('资料/image.png', '')])).rejects.toThrow('没有可读取')
    const id = await api.addDirectoryFiles([file('资料/a.md', '# First')])
    await api.addDirectoryFiles([file('资料/image.png', '')], id)
    expect(storage.records.get(id)?.docs).toEqual({})
  })

  it('reuses a native directory handle and preserves the snapshot when permission is denied', async () => {
    const api = await import('./localDirectories')
    const handle = directory('Native', [file('readme.md', '# Native')])
    const id = await api.addDirectoryHandle(handle)
    expect(await api.addDirectoryHandle(handle)).toBe(id)
    expect(storage.records.size).toBe(1)
    const saved = storage.records.get(id)!
    const local = { ...saved, index: { tree: [], docsByRoutePath: new Map(), defaultRoutePath: '/404' } }
    vi.mocked(handle.queryPermission!).mockResolvedValue('prompt')
    await expect(api.refreshDirectory(local)).rejects.toThrow('未获得目录读取权限')
    expect(storage.records.get(id)).toBe(saved)
    vi.mocked(handle.requestPermission!).mockResolvedValue('granted')
    expect(await api.refreshDirectory(local)).toBe(id)
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'read' })
  })
})
