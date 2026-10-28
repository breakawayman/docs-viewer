import { describe, expect, it } from 'vitest'
import { createDocIndex, createIndexFromRawDocs, filterDocTree, stripOrderPrefix } from './docIndex'

function findFirstDocTitle(nodes: any[]): string | null {
  for (const n of nodes) {
    if (n?.type === 'doc') return n.title
    if (n?.type === 'group' && Array.isArray(n.children)) {
      const inner = findFirstDocTitle(n.children)
      if (inner) return inner
    }
  }
  return null
}

describe('docIndex', () => {
  it('preserves deep folders and distinct routes for identically named files', () => {
    const index = createIndexFromRawDocs({
      '/docs/project/api/v1/readme.md': '# Version 1',
      '/docs/project/api/v2/readme.md': '# Version 2',
    }, { sourceRoot: 'docs', routeBase: '/docs' })
    expect(index.docsByRoutePath.size).toBe(2)
    const doc = index.docsByRoutePath.get('/docs/project/api/v1/readme')!
    expect(doc.ancestors.map((node) => node.title)).toEqual(['project', 'api', 'v1'])
    expect(doc.ancestorKeys).toHaveLength(3)
    expect(index.tree[0].type).toBe('group')
  })

  it('searches readable paths and body text, and retains matching folder contents', () => {
    const index = createIndexFromRawDocs({
      '/docs/项目/接口.md': '# Overview\nUnique body keyword',
      '/docs/项目/说明.md': '# Intro',
    }, { sourceRoot: 'docs', routeBase: '/docs' })
    expect(findFirstDocTitle(filterDocTree(index.tree, '接口'))).toBe('Overview')
    expect(findFirstDocTitle(filterDocTree(index.tree, 'unique body'))).toBe('Overview')
    expect(filterDocTree(index.tree, '项目')).toEqual(index.tree)
    expect(filterDocTree(index.tree, 'not found')).toEqual([])
  })

  it('stripOrderPrefix works', () => {
    expect(stripOrderPrefix('01-概览')).toBe('概览')
    expect(stripOrderPrefix('2_用户')).toBe('用户')
    expect(stripOrderPrefix('无前缀')).toBe('无前缀')
  })

  it('createDocIndex builds tree and default route', () => {
    const idx = createDocIndex()
    expect(idx.tree.length).toBeGreaterThan(0)
    expect(idx.docsByRoutePath.size).toBeGreaterThan(0)
    expect(idx.defaultRoutePath.startsWith('/docs/')).toBe(true)
  })

  it('filterDocTree filters by query', () => {
    const idx = createDocIndex()
    const title = findFirstDocTitle(idx.tree)
    expect(title).not.toBeNull()
    const q = String(title).slice(0, 2)
    const filtered = filterDocTree(idx.tree, q)
    expect(filtered.length).toBeGreaterThan(0)
  })
})
