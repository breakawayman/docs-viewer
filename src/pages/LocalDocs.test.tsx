import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import type { DirectoryHandle, SavedDirectory } from '@/docs/directoryStorage'
import { initializeDirectories, removeDirectory } from '@/docs/localDirectories'
import Docs from './Docs'

const storage = vi.hoisted(() => ({ records: new Map<string, SavedDirectory>() }))
vi.mock('@/docs/directoryStorage', () => ({
  loadDirectories: async () => [...storage.records.values()],
  saveDirectory: async (directory: SavedDirectory) => { storage.records.set(directory.id, directory) },
  deleteDirectory: async (id: string) => { storage.records.delete(id) },
}))
vi.mock('@/components/docs/DocContent', () => ({ default: ({ raw }: { raw: string }) => <article>{raw}</article> }))
vi.mock('@/docs/exportHtml', () => ({ createStaticHtmlDocument: vi.fn() }))
vi.mock('@/components/docs/DocTocNav', () => ({ default: () => null }))

function file(name: string, raw: string): File {
  const file = new File([raw], name.split('/').pop()!)
  Object.defineProperty(file, 'webkitRelativePath', { value: name })
  file.text = async () => raw
  return file
}
function Location() {
  const location = useLocation()
  return <output data-testid="route">{location.pathname}</output>
}
function App({ route = '/docs' }: { route?: string }) {
  return <MemoryRouter initialEntries={[route]}><Location /><Routes>
    <Route path="/docs/*" element={<Docs />} />
    <Route path="/local/:directoryId/*" element={<Docs source="local" />} />
  </Routes></MemoryRouter>
}
async function importFiles(files: File[]) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText('选择本地文件夹'), { target: { files } })
  })
  await waitFor(() => expect(screen.getByRole('button', { name: '刷新当前目录' })).toBeEnabled())
}
afterEach(async () => {
  vi.unstubAllGlobals()
  delete (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker
  await act(async () => {
    for (const id of [...storage.records.keys()]) await removeDirectory(id)
  })
})

it('adds, searches, switches, refreshes a renamed document and removes a local directory', async () => {
  render(<App />)
  await waitFor(() => expect(screen.getByRole('button', { name: '添加目录' })).toBeEnabled())
  expect(screen.queryByText(/Laya/)).toBeNull()
  await importFiles([file('本地资料/old.md', '# Local\nUnique content')])
  expect(screen.getByRole('article')).toHaveTextContent('# Local')
  expect(screen.getByTestId('route')).toHaveTextContent('/old')
  const id = [...storage.records.keys()][0]
  fireEvent.change(screen.getByRole('textbox', { name: '搜索文档' }), { target: { value: 'Unique content' } })
  expect(screen.getByRole('link', { name: 'Local' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('combobox', { name: '当前文档目录' }))
  expect(screen.getAllByRole('option')).toHaveLength(2)
  fireEvent.click(screen.getByRole('option', { name: '文档 docs/' }))
  expect(screen.getByTestId('route')).toHaveTextContent('/docs/')
  const directorySelect = screen.getByRole('combobox', { name: '当前文档目录' })
  directorySelect.focus()
  fireEvent.keyDown(directorySelect, { key: 'ArrowDown' })
  fireEvent.keyDown(directorySelect, { key: 'End' })
  fireEvent.keyDown(directorySelect, { key: 'Enter' })
  expect(screen.getByRole('textbox', { name: '搜索文档' })).toHaveValue('')
  fireEvent.click(screen.getByRole('button', { name: '刷新当前目录' }))
  await importFiles([file('本地资料/new.md', '# Local\nUnique content')])
  expect(screen.getByTestId('route')).toHaveTextContent(`/local/${id}/new`)
  fireEvent.click(screen.getByRole('button', { name: '刷新当前目录' }))
  await importFiles([file('本地资料/new.md', '# Changed')])
  expect(screen.getByRole('article')).toHaveTextContent('# Changed')
  fireEvent.click(screen.getByRole('button', { name: '移除当前目录' }))
  await waitFor(() => expect(storage.records.size).toBe(0))
  await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('/docs/'))
})

it('restores a saved directory at a direct document URL and in a fresh view', async () => {
  await initializeDirectories()
  const { addDirectoryFiles } = await import('@/docs/localDirectories')
  const id = await addDirectoryFiles([file('资料/直接访问.md', '# Restored')])
  const route = `/local/${id}/${encodeURIComponent('直接访问')}`
  const view = render(<App route={route} />)
  expect(screen.getByRole('article')).toHaveTextContent('# Restored')
  view.unmount()
  render(<App route={route} />)
  expect(screen.getByRole('article')).toHaveTextContent('# Restored')
})

it('invokes the native picker in read-only mode, refreshes its handle and treats cancellation quietly', async () => {
  let raw = '# Native'
  const handle: DirectoryHandle = {
    name: 'Native', kind: 'directory',
    async *values() { yield { name: 'readme.md', kind: 'file', getFile: async () => file('Native/readme.md', raw) } },
    getFileHandle: async () => { throw new DOMException('Missing', 'NotFoundError') },
    queryPermission: async () => 'granted',
  }
  const picker = vi.fn(async () => handle)
  Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: picker })
  render(<App />)
  await waitFor(() => expect(screen.getByRole('button', { name: '添加目录' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: '添加目录' }))
  await waitFor(() => expect(screen.getByRole('article')).toHaveTextContent('# Native'))
  expect(picker).toHaveBeenCalledWith({ mode: 'read' })
  raw = '# Updated'
  fireEvent.click(screen.getByRole('button', { name: '刷新当前目录' }))
  await waitFor(() => expect(screen.getByRole('article')).toHaveTextContent('# Updated'))
  picker.mockRejectedValueOnce(new DOMException('Canceled', 'AbortError'))
  fireEvent.click(screen.getByRole('button', { name: '添加目录' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '添加目录' })).toBeEnabled())
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole('article')).toHaveTextContent('# Updated')
})

it('shows an actionable missing-directory message and disables exports', async () => {
  render(<App route="/local/missing" />)
  await screen.findByText(/此目录尚未添加或已被移除/)
  expect(screen.getByRole('button', { name: '导出 PDF' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '导出 HTML' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '添加目录' })).toBeEnabled()
})
