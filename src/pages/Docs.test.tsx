import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { createIndexFromRawDocs } from '@/docs/docIndex'
import Docs from './Docs'

const state = vi.hoisted(() => ({ index: null as unknown }))
vi.mock('@/docs/docIndex', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/docs/docIndex')>(),
  useDocIndex: () => state.index,
}))
vi.mock('@/components/docs/DocContent', () => ({ default: ({ raw }: { raw: string }) => <article>{raw}</article> }))
vi.mock('@/docs/exportHtml', () => ({ createStaticHtmlDocument: vi.fn() }))
vi.mock('@/components/docs/DocTocNav', () => ({ default: () => null }))

function setDocs(docs: Record<string, string>) {
  state.index = createIndexFromRawDocs(docs, { sourceRoot: 'docs', routeBase: '/docs' })
}
function Page() {
  const location = useLocation()
  return <><output data-testid="route">{location.pathname}{location.search}{location.hash}</output><Docs /></>
}
function App() {
  return <MemoryRouter initialEntries={['/docs/old?keep=1#section']}><Page /></MemoryRouter>
}

beforeEach(() => setDocs({ '/docs/old.md': '# Current', '/docs/other.md': '# Other' }))

it('follows the current document when it is renamed and refreshes its content', async () => {
  const view = render(<App />)
  await act(async () => {
    setDocs({ '/docs/new.md': '# Current', '/docs/other.md': '# Other' })
    view.rerender(<App />)
  })
  expect(screen.getByTestId('route')).toHaveTextContent('/docs/new?keep=1#section')
  await act(async () => {
    setDocs({ '/docs/new.md': '# Changed' })
    view.rerender(<App />)
  })
  expect(screen.getByRole('article')).toHaveTextContent('# Changed')
})

it('selects an available document after deletion', async () => {
  const view = render(<App />)
  await act(async () => {
    setDocs({ '/docs/other.md': '# Other' })
    view.rerender(<App />)
  })
  expect(screen.getByTestId('route')).toHaveTextContent('/docs/other')
  expect(screen.getByRole('article')).toHaveTextContent('# Other')
})

it('keeps an empty directory usable and recovers when the document reappears', async () => {
  const view = render(<App />)
  await act(async () => { setDocs({}); view.rerender(<App />) })
  expect(screen.queryByRole('article')).toBeNull()
  expect(screen.getByTestId('route')).toHaveTextContent('/docs/old')
  await act(async () => { setDocs({ '/docs/new.md': '# Current' }); view.rerender(<App />) })
  expect(screen.getByTestId('route')).toHaveTextContent('/docs/new')
})
