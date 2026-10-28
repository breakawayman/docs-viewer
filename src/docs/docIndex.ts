import rawDocs from 'virtual:live-docs'
import { useSyncExternalStore } from 'react'

const ORDER_RE = /^(\d+)[-_ ]+/

export type DocNode =
  | {
      type: 'group'
      key: string
      title: string
      level: number
      order: number
      children: DocNode[]
    }
  | {
      type: 'doc'
      key: string
      title: string
      level: number
      order: number
      routePath: string
      sourcePath: string
      ancestorKeys: string[]
      raw: string
      ancestors: Array<{ title: string; level: number }>
    }

export function stripOrderPrefix(input: string) {
  return input.replace(ORDER_RE, '')
}

function getOrder(input: string) {
  const match = ORDER_RE.exec(input)
  if (!match) return Number.MAX_SAFE_INTEGER
  const n = Number(match[1])
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

function extractTitleFromMarkdown(raw: string) {
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('# ')) return trimmed.slice(2).trim()
  }
  return null
}

function sortNodes(nodes: DocNode[]) {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'group' ? -1 : 1
    const orderDelta = a.order - b.order
    if (orderDelta !== 0) return orderDelta
    return a.title.localeCompare(b.title, 'zh-Hans-CN')
  })
}

function collectFirstDocRoute(nodes: DocNode[]): string | null {
  for (const node of sortNodes(nodes)) {
    if (node.type === 'doc') return node.routePath
    if (node.type === 'group') {
      const inner = collectFirstDocRoute(node.children)
      if (inner) return inner
    }
  }
  return null
}

export type DocIndex = {
  tree: DocNode[]
  docsByRoutePath: Map<string, Extract<DocNode, { type: 'doc' }>>
  defaultRoutePath: string
}

export type CreateIndexOptions = {
  sourceRoot: string
  routeBase: string
}

export function createIndexFromRawDocs(
  rawDocs: Record<string, string>,
  { sourceRoot, routeBase }: CreateIndexOptions,
): DocIndex {
  const sourcePrefix = `/${sourceRoot}/`

  const tree: DocNode[] = []
  const groups = new Map<string, Extract<DocNode, { type: 'group' }>>()
  const docsByRoutePath = new Map<string, Extract<DocNode, { type: 'doc' }>>()
  for (const [sourcePath, raw] of Object.entries(rawDocs)) {
    if (!sourcePath.startsWith(sourcePrefix)) continue
    const relative = sourcePath.slice(sourcePrefix.length)
    const parts = relative.split('/').filter(Boolean)
    const fileName = parts.pop()
    if (!fileName || !/\.md$/i.test(fileName)) continue
    const docName = fileName.slice(0, -3)
    let children = tree
    const ancestorKeys: string[] = []
    const ancestors: Array<{ title: string; level: number }> = []
    parts.forEach((segment, depth) => {
      const key = `group:${parts.slice(0, depth + 1).join('/')}`
      let group = groups.get(key)
      if (!group) {
        group = { type: 'group', key, title: stripOrderPrefix(segment), level: depth + 1,
          order: getOrder(segment), children: [] }
        groups.set(key, group)
        children.push(group)
      }
      children = group.children
      ancestorKeys.push(key)
      ancestors.push({ title: group.title, level: group.level })
    })
    const routePath = `${routeBase}/${[...parts, docName].map(encodeURIComponent).join('/')}`
    const doc: Extract<DocNode, { type: 'doc' }> = {
      type: 'doc', key: `doc:${relative}`, title: extractTitleFromMarkdown(raw) ?? stripOrderPrefix(docName),
      level: parts.length + 1, order: getOrder(docName), routePath, sourcePath, raw, ancestorKeys, ancestors,
    }
    children.push(doc)
    docsByRoutePath.set(routePath, doc)
  }
  function sortTree(nodes: DocNode[]) {
    nodes.splice(0, nodes.length, ...sortNodes(nodes))
    nodes.forEach((node) => { if (node.type === 'group') sortTree(node.children) })
  }
  sortTree(tree)

  const defaultRoutePath = collectFirstDocRoute(tree) ?? '/404'

  return { tree, docsByRoutePath, defaultRoutePath }
}

export function createDocIndex(): DocIndex {
  return index
}

function buildIndex(raw: Record<string, string>) {
  return createIndexFromRawDocs(raw, { sourceRoot: 'docs', routeBase: '/docs' })
}

let index = buildIndex(rawDocs)
const listeners = new Set<() => void>()
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useDocIndex() {
  return useSyncExternalStore(subscribe, () => index)
}

if (import.meta.hot) {
  import.meta.hot.accept('virtual:live-docs', (module) => {
    if (!module) return
    index = buildIndex(module.default)
    listeners.forEach((listener) => listener())
  })
}

export function filterDocTree(tree: DocNode[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return tree

  const filter = (node: DocNode): DocNode | null => {
    if (node.type === 'doc') {
      const hit = node.title.toLowerCase().includes(q) || node.sourcePath.toLowerCase().includes(q) || node.raw.toLowerCase().includes(q)
      return hit ? node : null
    }

    const hitSelf = node.title.toLowerCase().includes(q)
    if (hitSelf) return node
    const nextChildren = node.children.map(filter).filter(Boolean) as DocNode[]
    if (hitSelf || nextChildren.length > 0) {
      return { ...node, children: nextChildren }
    }
    return null
  }

  return tree.map(filter).filter(Boolean) as DocNode[]
}
