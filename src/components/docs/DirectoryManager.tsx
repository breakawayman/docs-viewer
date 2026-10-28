import { useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderPlus, RefreshCw, X } from 'lucide-react'
import { addDirectoryFiles, addDirectoryHandle, directoryError, refreshDirectory, removeDirectory, useLocalDirectories } from '@/docs/localDirectories'
import type { DirectoryHandle } from '@/docs/directoryStorage'
import DirectorySelect from './DirectorySelect'

type Props = { value: string; onSelect?: () => void }
type PickerWindow = Window & { showDirectoryPicker?: (options: { mode: 'read' }) => Promise<DirectoryHandle> }

export default function DirectoryManager({ value, onSelect }: Props) {
  const navigate = useNavigate()
  const selectId = useId()
  const { directories, loaded, error: storageError } = useLocalDirectories()
  const input = useRef<HTMLInputElement>(null)
  const replaceId = useRef<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selected = directories.find((directory) => directory.id === value)

  function select(id: string) {
    navigate(id === 'docs' ? '/docs' : `/local/${id}`)
    onSelect?.()
  }
  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try { await action() } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setError(directoryError(error))
    } finally { setBusy(false) }
  }
  function chooseFiles(id?: string) {
    replaceId.current = id
    if (input.current) { input.current.value = ''; input.current.click() }
  }
  function add() {
    const picker = (window as PickerWindow).showDirectoryPicker
    if (!picker) { chooseFiles(); return }
    void run(async () => {
      try {
        const handle = await picker.call(window, { mode: 'read' })
        select(await addDirectoryHandle(handle))
      } catch (error) {
        // Some browsers expose the API but disallow it in this browsing context.
        if (error instanceof DOMException && error.name === 'SecurityError') { chooseFiles(); return }
        throw error
      }
    })
  }

  return (
    <section aria-label="目录管理" className="mb-4 space-y-2 rounded-xl border border-zinc-200/70 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={selectId} className="text-xs font-medium text-zinc-600 dark:text-zinc-300">文档位置</label>
        <button type="button" onClick={add} disabled={busy || !loaded} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10">
          <FolderPlus className="h-3.5 w-3.5" />添加目录
        </button>
      </div>
      <div className="flex items-center gap-1">
        <DirectorySelect id={selectId} value={value} disabled={busy} onChange={select} placeholder={loaded ? '目录不存在' : '正在恢复目录…'} options={[
          { value: 'docs', label: '文档', description: 'docs/', group: '项目目录' },
          ...directories.map((directory) => ({ value: directory.id, label: directory.name, count: directory.index.docsByRoutePath.size, group: '本地目录' })),
        ]} />
        {selected && <>
          <button type="button" aria-label="刷新当前目录" title="重新读取目录中的文档" disabled={busy} onClick={() => {
            if (!selected.handle) { chooseFiles(selected.id); return }
            void run(async () => { await refreshDirectory(selected) })
          }} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" aria-label="移除当前目录" title="移除目录记录，保留计算机上的文件" disabled={busy} onClick={() => {
            void run(async () => { await removeDirectory(selected.id); select('docs') })
          }} className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10"><X className="h-4 w-4" /></button>
        </>}
      </div>
      <input ref={input} type="file" aria-label="选择本地文件夹" className="hidden" multiple {...{ webkitdirectory: '', directory: '' }} onChange={(event) => {
        const files = Array.from(event.target.files ?? [])
        if (!files.length) return
        const id = replaceId.current
        void run(async () => {
          const savedId = await addDirectoryFiles(files, id)
          if (!id) select(savedId)
        })
      }} />
      <p role="status" className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">{busy ? '正在读取目录，请稍候…' : selected ? `${selected.name} · 保存在此浏览器 · 点击刷新同步文件变化` : '选择计算机上的文件夹，读取其中的 Markdown 文档。'}</p>
      {(error || storageError) && <p role="alert" className="break-words text-xs leading-5 text-red-600 dark:text-red-400">{error || storageError}</p>}
    </section>
  )
}
