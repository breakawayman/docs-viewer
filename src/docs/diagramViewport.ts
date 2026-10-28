export type DiagramView = { scale: number; x: number; y: number }

export function fitDiagram(width: number, height: number, viewportWidth: number, viewportHeight: number): DiagramView {
  return { scale: Math.min(1, Math.max(1, viewportWidth - 64) / width, Math.max(1, viewportHeight - 64) / height), x: 0, y: 0 }
}

// Coordinates are relative to the viewport center. Preserve the point under
// the cursor when zooming, even after the diagram has been panned.
export function zoomDiagram(view: DiagramView, scale: number, x = 0, y = 0): DiagramView {
  const ratio = scale / view.scale
  return { scale, x: x - (x - view.x) * ratio, y: y - (y - view.y) * ratio }
}
