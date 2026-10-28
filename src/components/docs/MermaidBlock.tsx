import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { renderMermaid, type MermaidDiagram } from '@/docs/mermaidRenderer'
import MermaidPreview from './MermaidPreview'

type Props = { chart: string; className?: string }

export default function MermaidBlock({ chart, className }: Props) {
  const { isDark } = useTheme()
  const source = chart.trim()
  const [result, setResult] = useState<{ source: string; dark: boolean; diagram: MermaidDiagram | null; error: string | null } | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const inlineRef = useRef<HTMLDivElement>(null)
  const [inlineHeight, setInlineHeight] = useState(160)
  const current = result?.source === source && result.dark === isDark ? result : null
  const diagram = current?.diagram ?? null
  const error = current?.error ?? null
  const rendering = !current

  useEffect(() => {
    const controller = new AbortController()
    renderMermaid(source, isDark, controller.signal).then(
      (diagram) => {
        if (!controller.signal.aborted) setResult({ source, dark: isDark, diagram, error: null })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({ source, dark: isDark, diagram: null, error: error instanceof Error ? error.message : String(error) })
      },
    )
    return () => controller.abort()
  }, [source, isDark])

  return (
    <div className={cn('not-prose my-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Mermaid 图表</span>
        <button type="button" disabled={!diagram} onClick={() => { setInlineHeight(inlineRef.current?.getBoundingClientRect().height ?? 160); setFullscreen(true) }} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200/60 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-700">
          <Maximize2 className="h-3.5 w-3.5" />放大查看
        </button>
      </div>
      <div className="overflow-x-auto p-4 sm:p-5">
        {diagram && !fullscreen && <div ref={inlineRef} className="mermaid-svg mx-auto" style={{ width: diagram.width, maxWidth: '100%' }} dangerouslySetInnerHTML={{ __html: diagram.svg }} />}
        {diagram && fullscreen && <div style={{ height: inlineHeight }} className="flex items-center justify-center text-xs text-zinc-500">图表已在放大窗口中打开</div>}
        {rendering && <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />正在生成图表…</div>}
        {error && <div role="alert" className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400"><AlertTriangle className="h-4 w-4" />图表渲染失败</div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">{error}</pre>
          <details className="text-xs text-zinc-500"><summary className="cursor-pointer">查看图表源码</summary><pre className="mt-2 overflow-auto whitespace-pre">{source}</pre></details>
        </div>}
      </div>
      {fullscreen && <MermaidPreview diagram={diagram} error={error} onClose={() => setFullscreen(false)} />}
    </div>
  )
}
