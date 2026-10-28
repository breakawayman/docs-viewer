import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderMermaid } from '@/docs/mermaidRenderer'
import MermaidBlock from './MermaidBlock'

vi.mock('@/docs/mermaidRenderer', () => ({ renderMermaid: vi.fn() }))
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ isDark: false }) }))

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open') } })
})
afterEach(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('updates an open preview without duplicating SVG IDs and restores the inline diagram on close', async () => {
  vi.mocked(renderMermaid).mockImplementation(async (source) => ({
    svg: `<svg id="diagram-${source}" viewBox="0 0 400 800"><text>${source}</text></svg>`, width: 400, height: 800,
  }))
  const view = render(<MermaidBlock chart="first" />)
  const open = screen.getByRole('button', { name: '放大查看' })
  await waitFor(() => expect(open).toBeEnabled())
  fireEvent.click(open)
  expect(screen.getByRole('dialog', { name: '图表放大预览' })).toBeInTheDocument()
  expect(document.querySelectorAll('#diagram-first')).toHaveLength(1)
  await act(async () => view.rerender(<MermaidBlock chart="updated" />))
  expect(document.querySelector('#diagram-first')).toBeNull()
  expect(document.querySelectorAll('#diagram-updated')).toHaveLength(1)
  expect(screen.getByRole('dialog')).toContainElement(document.querySelector('#diagram-updated') as HTMLElement)
  fireEvent.click(screen.getByRole('button', { name: '关闭图表预览' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.querySelectorAll('#diagram-updated')).toHaveLength(1)
  expect(document.body.style.overflow).toBe('')
})
