import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it } from 'vitest'
import { createIndexFromRawDocs } from '@/docs/docIndex'
import SidebarNav from './SidebarNav'

const storageKey = 'test:sidebar-open'
const tree = createIndexFromRawDocs(
  { '/docs/指南/开始.md': '# 开始' },
  { sourceRoot: 'docs', routeBase: '/docs' },
).tree

function renderNav() {
  return render(
    <MemoryRouter>
      <SidebarNav tree={tree} storageKey={storageKey} />
    </MemoryRouter>,
  )
}

beforeEach(() => localStorage.clear())

it('starts collapsed and restores the saved directory state', () => {
  const first = renderNav()
  const folder = screen.getByRole('button', { name: /指南/ })

  expect(folder).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(folder)
  expect(folder).toHaveAttribute('aria-expanded', 'true')
  expect(JSON.parse(localStorage.getItem(storageKey) ?? '{}')).toEqual({ 'group:指南': true })

  first.unmount()
  renderNav()
  expect(screen.getByRole('button', { name: /指南/ })).toHaveAttribute('aria-expanded', 'true')
})
