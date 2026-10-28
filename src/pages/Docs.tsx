import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileDown, Menu, Moon, Search, Sun } from 'lucide-react'
import SidebarNav from '@/components/docs/SidebarNav'
import DocContent from '@/components/docs/DocContent'
import DocTocNav from '@/components/docs/DocTocNav'
import DirectoryManager from '@/components/docs/DirectoryManager'
import SidebarSwitchBar, { type SidebarMode } from '@/components/docs/SidebarSwitchBar'
import { useDocIndex, filterDocTree, type DocIndex, type DocNode } from '@/docs/docIndex'
import { useLocalDirectories } from '@/docs/localDirectories'
import { buildTocFromMarkdown } from '@/docs/toc'
import { createStaticHtmlDocument } from '@/docs/exportHtml'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'

export type DocsSource = 'docs' | 'local'
const emptyIndex: DocIndex = { tree: [], docsByRoutePath: new Map(), defaultRoutePath: '/404' }

export default function Docs({ source = 'docs' }: { source?: DocsSource }) {
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const isPrintMode = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return sp.get('print') === '1'
  }, [location.search])

  const { directoryId } = useParams<{ directoryId: string }>()
  const { directories, loaded } = useLocalDirectories()
  const localDirectory = directories.find((directory) => directory.id === directoryId)
  const builtInIndex = useDocIndex()
  const index = source === 'local' ? localDirectory?.index ?? emptyIndex : builtInIndex
  const basePath = source === 'local' ? `/local/${directoryId}` : `/${source}`
  const directoryValue = source === 'local' ? directoryId ?? '' : source
  const directoryTitle = source === 'local' ? localDirectory?.name ?? '本地目录' : '文档查看'

  const [query, setQuery] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('files')

  const docsByAnyPath = useMemo(() => {
    const map = new Map<string, Extract<DocNode, { type: 'doc' }>>()
    const push = (nodes: DocNode[]) => {
      for (const n of nodes) {
        if (n.type === 'doc') {
          map.set(n.routePath, n)
          const afterBase = n.routePath.slice(basePath.length + 1)
          const segments = afterBase.split('/')
          const docName = segments[segments.length - 1]

          // 根文档 /<base>/<docName> -> 兼容旧 /<base>/文档/默认/<docName> 与 /<base>/文档/<docName>
          if (segments.length === 1) {
            map.set(
              `${basePath}/${encodeURIComponent('文档')}/${encodeURIComponent('默认')}/${docName}`,
              n,
            )
            map.set(`${basePath}/${encodeURIComponent('文档')}/${docName}`, n)
            continue
          }

          const level1 = segments[0]
          // 历史带「默认」的 3 段 URL 兼容：/<base>/<L1>/默认/<docName> 或 /<base>/文档/默认/<docName>
          if (segments.length === 2) {
            map.set(`${basePath}/${level1}/${encodeURIComponent('默认')}/${docName}`, n)
            if (level1 !== encodeURIComponent('文档')) {
              map.set(
                `${basePath}/${encodeURIComponent('文档')}/${encodeURIComponent('默认')}/${docName}`,
                n,
              )
            }
          } else if (segments.length === 3) {
            map.set(`${basePath}/${segments[0]}/${segments[2]}`, n)
            map.set(
              `${basePath}/${segments[0]}/${encodeURIComponent('默认')}/${segments[2]}`,
              n,
            )
          }
        } else {
          push(n.children)
        }
      }
    }
    push(index.tree)
    index.docsByRoutePath.forEach((v, k) => map.set(k, v))
    return map
  }, [basePath, index])

  const activeDoc = docsByAnyPath.get(location.pathname) ?? null
  const previousDoc = useRef(activeDoc)

  useEffect(() => {
    const previous = previousDoc.current
    if (!activeDoc && previous && location.pathname === previous.routePath) {
      const matches = [...index.docsByRoutePath.values()].filter((doc) => doc.raw === previous.raw)
      const route = matches.length === 1 ? matches[0].routePath : index.defaultRoutePath
      if (route !== '/404') {
        navigate({ pathname: route, search: location.search, hash: location.hash }, { replace: true })
      }
    }
    previousDoc.current = activeDoc ?? previous
  }, [activeDoc, index, location.pathname, location.search, location.hash, navigate])

  useEffect(() => {
    if (location.pathname === basePath || location.pathname === `${basePath}/`) {
      if (index.defaultRoutePath !== '/404') navigate(index.defaultRoutePath, { replace: true })
    }
  }, [location.pathname, navigate, basePath, index.defaultRoutePath])

  useEffect(() => {
    setMobileNavOpen(false)
    setQuery('')
    setSidebarMode('files')
  }, [basePath])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  const tree = useMemo(() => filterDocTree(index.tree, query), [index.tree, query])
  const forceExpand = query.trim().length > 0
  const toc = useMemo(() => (activeDoc ? buildTocFromMarkdown(activeDoc.raw) : []), [activeDoc])
  const showToc = toc.length > 0
  const showFiles = true

  const onSelectDoc = (doc: Extract<DocNode, { type: 'doc' }>) => {
    setSidebarMode(buildTocFromMarkdown(doc.raw).length > 0 ? 'toc' : 'files')
    setMobileNavOpen(false)
  }

  const onExportPdf = () => {
    const url = `${location.pathname}?print=1`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const onExportHtml = async () => {
    if (!activeDoc) return
    const docToc = buildTocFromMarkdown(activeDoc.raw)
    const { html, fileName } = await createStaticHtmlDocument({
      title: activeDoc.title,
      raw: activeDoc.raw,
      toc: docToc,
      theme: isDark ? 'dark' : 'light',
    })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 500)
  }


  useEffect(() => {
    if (sidebarMode === 'toc' && !showToc) setSidebarMode('files')
    if (sidebarMode === 'files' && !showFiles && showToc) setSidebarMode('toc')
  }, [showFiles, showToc, sidebarMode])

  useEffect(() => {
    if (!activeDoc) return
    if (!isPrintMode) return
    document.title = activeDoc.title
    const t = window.setTimeout(() => {
      window.print()
    }, 150)

    const onAfterPrint = () => {
      if (window.opener) window.close()
    }

    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [activeDoc, isPrintMode])

  const iconButtonClass =
    'inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-all duration-200 ' +
    'border border-zinc-200/70 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 hover:text-zinc-900 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] ' +
    'dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:text-zinc-50 dark:hover:shadow-[0_0_0_1px_rgba(99,102,241,0.12),0_1px_2px_rgba(0,0,0,0.35)]'

  const actionButtonClass =
    'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition-all duration-200 ' +
    'border border-zinc-200/70 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 hover:text-zinc-900 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] ' +
    'dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:text-zinc-50 dark:hover:shadow-[0_0_0_1px_rgba(99,102,241,0.12),0_1px_2px_rgba(0,0,0,0.35)]'

  if (isPrintMode) {
    return (
      <div className="min-h-dvh w-full bg-white text-zinc-950">
        <div id="doc-print-toolbar" className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-[980px] items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </button>
            <div className="min-w-0 flex-1 truncate text-center text-xs text-zinc-500">
              如需导出无页眉页脚：在打印设置中关闭“页眉和页脚”
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors hover:bg-zinc-100"
            >
              <Download className="h-4 w-4" />
              导出 PDF
            </button>
          </div>
        </div>
        <main className="px-4 py-8">
          <div className="mx-auto max-w-[980px]">
            {activeDoc ? (
              <DocContent raw={activeDoc.raw} />
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
                未找到对应文档。
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="h-dvh w-full bg-[radial-gradient(1200px_600px_at_-10%_-20%,rgba(99,102,241,0.08),transparent_60%),linear-gradient(180deg,#fafafa,#ffffff)] text-zinc-950 dark:bg-[radial-gradient(1200px_600px_at_-10%_-20%,rgba(99,102,241,0.10),transparent_60%),radial-gradient(900px_500px_at_110%_-10%,rgba(217,70,239,0.07),transparent_60%),linear-gradient(180deg,#09090b,#030712)] dark:text-zinc-50">
      <div className="mx-auto flex h-full max-w-[1400px]">
        <aside
          className={cn(
            'hidden w-[370px] shrink-0 lg:flex lg:flex-col',
            'border-r border-zinc-200/70 bg-gradient-to-b from-white to-zinc-50/80 px-4 py-4',
            'dark:border-r dark:border-zinc-800/80 dark:from-[#05060a] dark:to-[#030712] dark:bg-zinc-950 dark:shadow-[1px_0_0_0_rgba(0,0,0,0.08)]',
          )}
          style={{ backgroundBlendMode: 'normal' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="min-w-0">
              <div className="truncate font-semibold tracking-tight">
                {directoryTitle}
              </div>
              <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                Markdown 驱动
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={iconButtonClass}
              aria-label="切换主题"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <DirectoryManager value={directoryValue} />
          <div className="space-y-3">
            <SidebarSwitchBar
              mode={sidebarMode}
              onChange={setSidebarMode}
              showFiles={showFiles}
              showToc={showToc}
            />

            <div
              className={cn(
                'grid transition-all duration-200 ease-out will-change-[grid-template-rows,opacity]',
                sidebarMode === 'files'
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200',
                    'border border-zinc-200/70 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)] focus-within:border-zinc-300 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.08)]',
                    'dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:focus-within:border-indigo-500/40 dark:focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.14)]',
                  )}
                >
                  <Search className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索标题、路径或正文…" aria-label="搜索文档"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="relative mt-3 min-h-0 flex-1 overflow-hidden sidebar-panel-root">
            <div
              className={cn(
                'sidebar-panel in-left',
                sidebarMode === 'files' ? 'is-active' : '',
              )}
              aria-hidden={sidebarMode !== 'files'}
            >
              <SidebarNav
                key={basePath}
                tree={tree}
                activeDoc={activeDoc}
                onNavigate={onSelectDoc}
                forceExpand={forceExpand}
                storageKey={`docs-viewer:${directoryValue}:sidebar-open`}
              />
            </div>
            {showToc ? (
              <div
                className={cn(
                  'sidebar-panel in-right',
                  sidebarMode === 'toc' ? 'is-active' : '',
                )}
                aria-hidden={sidebarMode !== 'toc'}
              >
                <DocTocNav toc={toc} contentRootId="doc-scroll" />
              </div>
            ) : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={cn(
              'sticky top-0 z-10 border-b px-4 py-3 backdrop-blur lg:px-8',
              'border-zinc-200/70 bg-white/70',
              'dark:border-b dark:border-zinc-800/80 dark:bg-zinc-950/60 dark:shadow-[0_1px_0_0_rgba(0,0,0,0.25)]',
            )}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className={cn(iconButtonClass, 'lg:hidden')}
                aria-label="打开菜单"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                  {activeDoc
                    ? [...activeDoc.ancestors.map((a) => a.title), activeDoc.title].join(' / ')
                    : directoryTitle}
                </div>
                <div className="truncate text-lg font-semibold tracking-tight">
                  {activeDoc?.title ?? (source === 'local' && !loaded ? '正在恢复目录…' : index.docsByRoutePath.size === 0 ? '暂无文档' : '未找到文档')}
                </div>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className={cn(iconButtonClass, 'lg:hidden')}
                aria-label="切换主题"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <button type="button" disabled={!activeDoc} onClick={onExportPdf} className={cn(actionButtonClass, 'disabled:opacity-40')}>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">导出 PDF</span>
              </button>

              <button type="button" disabled={!activeDoc} onClick={onExportHtml} className={cn(actionButtonClass, 'disabled:opacity-40')}>
                <FileDown className="h-4 w-4" />
                <span className="hidden sm:inline">导出 HTML</span>
              </button>
            </div>
          </header>

          <main id="doc-scroll" className="min-w-0 flex-1 overflow-y-auto px-3 py-4 lg:px-6 lg:py-6">
            {activeDoc ? (
              <div className="mx-auto max-w-[1280px]">
                <DocContent raw={activeDoc.raw} />
              </div>
            ) : (
              <div className="mx-auto max-w-[1280px]">
                <div
                  className={cn(
                    'rounded-2xl border p-6 text-sm',
                    'border-zinc-200/70 bg-white text-zinc-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
                    'dark:border-zinc-800/80 dark:bg-zinc-950/60 dark:text-zinc-300 dark:shadow-[0_0_0_1px_rgba(63,63,70,0.2)]',
                  )}
                >
                  {source === 'local' && !loaded ? '正在恢复本地目录，请稍候…' : source === 'local' && !localDirectory ? '此目录尚未添加或已被移除，请通过“添加目录”选择计算机上的文件夹。' : index.docsByRoutePath.size === 0 ? '当前目录中没有 Markdown 文档，可以通过“添加目录”选择其他文件夹。' : '未找到对应文档。请在文档目录中选择一篇文档。'}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
            aria-label="关闭菜单遮罩"
          />
          <div
            className={cn(
              'absolute left-0 top-0 flex h-full w-[86%] max-w-[380px] flex-col px-4 py-4 shadow-2xl',
              'border-r border-zinc-200/70 bg-white',
              'dark:border-r dark:border-zinc-800/80 dark:bg-zinc-950',
            )}
          >
            <DirectoryManager value={directoryValue} onSelect={() => setMobileNavOpen(false)} />
            <div className="space-y-3">
              <SidebarSwitchBar
                mode={sidebarMode}
                onChange={setSidebarMode}
                showFiles={showFiles}
                showToc={showToc}
              />

              {sidebarMode === 'files' ? (
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2',
                    'border border-zinc-200/70 bg-white',
                    'dark:border-zinc-800/80 dark:bg-zinc-900/60',
                  )}
                >
                  <Search className="h-4 w-4 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索标题、路径或正文…" aria-label="搜索文档"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-500"
                  />
                </div>
              ) : null}
            </div>
            <div className={cn('mt-3 min-h-0 flex-1 overflow-y-auto pr-1')}>
              {sidebarMode === 'toc' && showToc ? (
                <DocTocNav toc={toc} contentRootId="doc-scroll" />
              ) : (
                <SidebarNav
                  key={basePath}
                  tree={tree}
                  activeDoc={activeDoc}
                  onNavigate={onSelectDoc}
                  forceExpand={forceExpand}
                  storageKey={`docs-viewer:${directoryValue}:sidebar-open`}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

