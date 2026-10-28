import { expect, it } from 'vitest'
import { fitDiagram, zoomDiagram } from './diagramViewport'

it('fits tall and wide diagrams inside the viewport without enlarging small diagrams', () => {
  for (const [width, height] of [[2000, 200], [200, 3000], [80, 40]]) {
    const view = fitDiagram(width, height, 1000, 700)
    expect(width * view.scale).toBeLessThanOrEqual(936)
    expect(height * view.scale).toBeLessThanOrEqual(636)
    expect(view.scale).toBeLessThanOrEqual(1)
  }
})

it('keeps the same diagram point under the cursor after panning and repeated zooming', () => {
  const initial = { scale: 0.5, x: 120, y: -70 }
  const cursor = { x: -80, y: 180 }
  const world = { x: (cursor.x - initial.x) / initial.scale, y: (cursor.y - initial.y) / initial.scale }
  let view = initial
  for (const scale of [2, 0.2, 8, 0.5]) {
    view = zoomDiagram(view, scale, cursor.x, cursor.y)
    expect(world.x * view.scale + view.x).toBeCloseTo(cursor.x)
    expect(world.y * view.scale + view.y).toBeCloseTo(cursor.y)
  }
  expect(view).toEqual(initial)
})
