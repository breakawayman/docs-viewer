import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Minus, Plus, X } from 'lucide-react'
import { fitDiagram, zoomDiagram, type DiagramView } from '@/docs/diagramViewport'
import type { MermaidDiagram } from '@/docs/mermaidRenderer'

type Props = { diagram: MermaidDiagram | null; error: string | null; onClose: () => void }
const buttonClass = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-800'

export default function MermaidPreview({ diagram, error, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<DiagramView>({ scale: 1, x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const fitted = useRef<DiagramView>({ scale: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const minScale = () => Math.min(0.1, fitted.current.scale)
  const zoom = (factor: number) => setView((old) => zoomDiagram(old, Math.min(8, Math.max(minScale(), old.scale * factor))))

  useEffect(() => {
    const dialog = dialogRef.current!
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current!
    const fit = () => {
      if (!diagram) return
      fitted.current = fitDiagram(diagram.width, diagram.height, stage.clientWidth, stage.clientHeight)
      setView(fitted.current)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [diagram])

  useEffect(() => {
    const stage = stageRef.current!
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = stage.getBoundingClientRect()
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1)
      const factor = Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.003)
      setView((old) => zoomDiagram(old, Math.min(8, Math.max(minScale(), old.scale * factor)),
        event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2))
    }
    stage.addEventListener('wheel', wheel, { passive: false })
    return () => stage.removeEventListener('wheel', wheel)
  }, [])

  return createPortal(
    <dialog ref={dialogRef} aria-label="图表放大预览" onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        if (event.key === '0') { event.preventDefault(); setView(fitted.current) }
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.2) }
        if (event.key === '-') { event.preventDefault(); zoom(1 / 1.2) }
      }}
      className="not-prose m-auto h-[94dvh] max-h-none w-[96vw] max-w-none overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/70 backdrop:backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <span className="text-sm font-medium">图表预览</span>
          <div className="flex flex-wrap items-center gap-0.5">
            <button type="button" aria-label="缩小" className={buttonClass} onClick={() => zoom(1 / 1.2)} disabled={!diagram || view.scale <= minScale()}><Minus className="h-4 w-4" /></button>
            <output aria-label="缩放比例" className="w-14 text-center text-xs tabular-nums">{Math.round(view.scale * 100)}%</output>
            <button type="button" aria-label="放大" className={buttonClass} onClick={() => zoom(1.2)} disabled={!diagram || view.scale >= 8}><Plus className="h-4 w-4" /></button>
            <button type="button" className={buttonClass} onClick={() => setView({ scale: 1, x: 0, y: 0 })} disabled={!diagram}>原始大小</button>
            <button type="button" className={buttonClass} onClick={() => setView(fitted.current)} disabled={!diagram}><Maximize2 className="h-3.5 w-3.5" />适应窗口</button>
            <button type="button" aria-label="关闭图表预览" autoFocus className={buttonClass} onClick={onClose}><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div ref={stageRef} onDoubleClick={() => setView(fitted.current)}
          onPointerDown={(event) => {
            if (event.button !== 0 || !diagram) return
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
            setDragging(true)
          }}
          onPointerMove={(event) => {
            const before = [...pointers.current.values()]
            if (!pointers.current.has(event.pointerId)) return
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
            const after = [...pointers.current.values()]
            const center = (points: typeof before) => ({ x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length })
            const a = center(before), b = center(after)
            const distance = (points: typeof before) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
            const ratio = before.length === 2 && distance(before) > 0 ? distance(after) / distance(before) : 1
            const rect = event.currentTarget.getBoundingClientRect()
            setView((old) => {
              const next = zoomDiagram(old, Math.min(8, Math.max(minScale(), old.scale * ratio)), a.x - rect.left - rect.width / 2, a.y - rect.top - rect.height / 2)
              return { ...next, x: next.x + b.x - a.x, y: next.y + b.y - a.y }
            })
          }}
          onLostPointerCapture={(event) => { pointers.current.delete(event.pointerId); setDragging(pointers.current.size > 0) }}
          onPointerUp={(event) => { pointers.current.delete(event.pointerId); setDragging(pointers.current.size > 0) }}
          onPointerCancel={(event) => { pointers.current.delete(event.pointerId); setDragging(pointers.current.size > 0) }}
          className={`relative min-h-0 flex-1 touch-none select-none overflow-hidden bg-[radial-gradient(circle,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:20px_20px] ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
          {diagram ? <div className="pointer-events-none absolute left-1/2 top-1/2" style={{ width: diagram.width, height: diagram.height, transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: 'center' }}>
            <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: diagram.svg }} />
          </div> : <div role="status" className="flex h-full items-center justify-center px-6 text-sm text-zinc-500">{error ? '图表渲染失败，请关闭预览查看错误详情。' : '正在生成图表…'}</div>}
        </div>
        <div className="border-t border-zinc-200 px-4 py-2 text-center text-[11px] text-zinc-500 dark:border-zinc-800">滚轮 / 双指缩放 · 拖动平移 · 双击 / 0 适应窗口 · Esc 关闭</div>
      </div>
    </dialog>, document.body,
  )
}
