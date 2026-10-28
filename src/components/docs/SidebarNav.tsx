import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, ListCollapse, ListTree } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocNode } from '@/docs/docIndex'

type Props = {
  tree: DocNode[]
  activeDoc?: Extract<DocNode, { type: 'doc' }> | null
  onNavigate?: (doc: Extract<DocNode, { type: 'doc' }>) => void
  forceExpand?: boolean
  storageKey?: string
}

function readOpenState(storageKey: string) {
  if (typeof localStorage === 'undefined') return {}
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
    )
  } catch {
    return {}
  }
}

export default function SidebarNav({
  tree,
  activeDoc,
  onNavigate,
  forceExpand,
  storageKey = 'docs-viewer:sidebar-open',
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => readOpenState(storageKey))

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(storageKey, JSON.stringify(open))
    } catch {
      // 浏览器禁用或限制本地存储时，目录仍可在当前页面正常使用。
    }
  }, [open, storageKey])

  const { counts, groupKeys, total } = useMemo(() => {
    const counts = new Map<string, number>()
    const groupKeys: string[] = []
    const count = (node: DocNode): number => {
      if (node.type === 'doc') return 1
      groupKeys.push(node.key)
      const value = node.children.reduce((sum, child) => sum + count(child), 0)
      counts.set(node.key, value)
      return value
    }
    return { counts, groupKeys, total: tree.reduce((sum, node) => sum + count(node), 0) }
  }, [tree])

  const renderNode = (node: DocNode) => {
    if (node.type === 'doc') {
      const selected = activeDoc?.key === node.key
      return (
        <li key={node.key}>
          <NavLink end to={node.routePath} onClick={(event) => {
            if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
              onNavigate?.(node)
            }
          }}
            title={node.title + '\n' + node.sourcePath}
            className={cn('group relative my-0.5 flex min-h-10 items-center gap-2 rounded-md py-2 pl-6 pr-2 text-sm leading-5 transition-colors',
              selected
                ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200')}
          >
            {selected && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />}
            <FileText aria-hidden className={cn('h-4 w-4 shrink-0', selected ? 'text-indigo-500 dark:text-indigo-300' : 'text-zinc-400 dark:text-zinc-500')} />
            <span className="truncate">{node.title}</span>
          </NavLink>
        </li>
      )
    }
    const isOpen = forceExpand || (open[node.key] ?? false)
    const Icon = isOpen ? FolderOpen : Folder
    return (
      <li key={node.key} className={node.level === 1 ? 'mt-2 first:mt-0' : ''}>
        <button type="button" aria-expanded={isOpen} title={node.title}
          onClick={() => setOpen((previous) => ({ ...previous, [node.key]: !isOpen }))}
          className="flex min-h-10 w-full items-center gap-2 rounded-md px-1.5 py-2 text-left text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
        >
          {isOpen ? <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-zinc-400" /> : <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
          <Icon aria-hidden className="h-[18px] w-[18px] shrink-0 text-indigo-500/80 dark:text-indigo-400/80" />
          <span className="min-w-0 flex-1 truncate">{node.title}</span>
          <span aria-label={counts.get(node.key) + ' 篇文档'} className="rounded-md border border-zinc-200/70 px-1.5 text-[11px] font-normal tabular-nums leading-4 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">{counts.get(node.key)}</span>
        </button>
        {isOpen && <ul className="ml-3 border-l border-zinc-200/80 pl-2 dark:border-zinc-800">{node.children.map(renderNode)}</ul>}
      </li>
    )
  }

  return (
    <nav aria-label="文档导航" className="pb-4">
      <div className="mb-2 flex items-center justify-between px-1.5 text-xs text-zinc-400 dark:text-zinc-500">
        <span>{forceExpand ? '搜索结果' : '全部文档'}<span className="ml-2 tabular-nums">{total} 篇</span></span>
        <div className="flex gap-0.5">
          <button type="button" title="展开全部" aria-label="展开全部" disabled={forceExpand} onClick={() => setOpen(Object.fromEntries(groupKeys.map((key) => [key, true])))} className="rounded p-1.5 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"><ListTree aria-hidden className="h-4 w-4" /></button>
          <button type="button" title="收起全部" aria-label="收起全部" disabled={forceExpand} onClick={() => setOpen(Object.fromEntries(groupKeys.map((key) => [key, false])))} className="rounded p-1.5 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"><ListCollapse aria-hidden className="h-4 w-4" /></button>
        </div>
      </div>
      {tree.length ? <ul>{tree.map(renderNode)}</ul> : <p className="px-3 py-8 text-center text-xs leading-6 text-zinc-500">{forceExpand ? '未找到匹配文档，试试其他关键词。' : '暂无文档'}</p>}
    </nav>
  )
}

