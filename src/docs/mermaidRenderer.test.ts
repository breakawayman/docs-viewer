import { expect, it, vi } from 'vitest'
import mermaid from 'mermaid'
import { renderMermaid } from './mermaidRenderer'

vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), render: vi.fn() } }))

it('serializes theme changes, preserves SVG dimensions, and cleans failed render hosts', async () => {
  let finish!: (result: Awaited<ReturnType<typeof mermaid.render>>) => void
  vi.mocked(mermaid.render).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
  vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Invalid diagram'))
  const first = renderMermaid('first', false)
  const second = renderMermaid('second', true).catch((error: Error) => error)
  await vi.waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(1))
  expect(mermaid.initialize).toHaveBeenCalledTimes(1)
  finish({ svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -20 1200 800" width="100%" style="max-width:1200px;background:red"></svg>', diagramType: 'flowchart' })
  const result = await first
  expect(result.width).toBe(1200)
  expect(result.height).toBe(800)
  expect(result.svg).toContain('viewBox="-10 -20 1200 800"')
  expect(result.svg).not.toContain('max-width')
  expect(await second).toEqual(new Error('Invalid diagram'))
  expect(document.querySelector('.not-prose')).toBeNull()
  expect(mermaid.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark' }))
  vi.mocked(mermaid.render).mockResolvedValueOnce({ svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20" />', diagramType: 'flowchart' })
  expect((await renderMermaid('valid', false)).width).toBe(10)
})

it('skips cancelled queued renders', async () => {
  const controller = new AbortController()
  controller.abort()
  const previousCalls = vi.mocked(mermaid.render).mock.calls.length
  await expect(renderMermaid('cancelled', false, controller.signal)).rejects.toThrow()
  expect(mermaid.render).toHaveBeenCalledTimes(previousCalls)
})
