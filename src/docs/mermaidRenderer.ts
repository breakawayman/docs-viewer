import mermaid from 'mermaid'

export type MermaidDiagram = { svg: string; width: number; height: number }

// Mermaid has global configuration. Keep initialization and rendering in the
// same queue so page rendering and HTML export cannot change each other's theme.
let queue: Promise<unknown> = Promise.resolve()
let sequence = 0

export function renderMermaid(chart: string, dark: boolean, signal?: AbortSignal): Promise<MermaidDiagram> {
  const task = queue.then(async () => {
    signal?.throwIfAborted()
    await document.fonts?.ready
    signal?.throwIfAborted()
    const host = document.createElement('div')
    host.className = 'not-prose'
    host.style.cssText = 'position:fixed;left:-100000px;top:0;width:1200px;visibility:hidden;pointer-events:none;'
    document.body.appendChild(host)
    try {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        suppressErrorRendering: true,
        theme: dark ? 'dark' : 'default',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif',
      })
      const { svg } = await mermaid.render(`mmd-${Date.now()}-${++sequence}`, chart, host)
      signal?.throwIfAborted()
      const documentSvg = new DOMParser().parseFromString(svg, 'image/svg+xml')
      const element = documentSvg.documentElement
      const box = element.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
      const width = box?.[2] || Number.parseFloat(element.getAttribute('width') ?? '')
      const height = box?.[3] || Number.parseFloat(element.getAttribute('height') ?? '')
      if (element.localName !== 'svg' || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error('无法读取图表尺寸')
      }
      if (!box) element.setAttribute('viewBox', `0 0 ${width} ${height}`)
      element.setAttribute('width', String(width))
      element.setAttribute('height', String(height))
      // Mermaid adds max-width inline; remove it so the viewport owns sizing.
      const style = (element as unknown as SVGSVGElement).style
      style.removeProperty('max-width')
      style.removeProperty('width')
      style.removeProperty('height')
      return { svg: new XMLSerializer().serializeToString(element), width, height }
    } finally {
      host.remove()
    }
  })
  queue = task.catch(() => {})
  return task
}
