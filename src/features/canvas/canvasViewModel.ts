import { normalizeRotation } from '../../shared/layoutRules'
import type { DeskItem } from '../../shared/models'

function updateCanvasItem(items: DeskItem[], id: string, updater: (item: DeskItem) => DeskItem): DeskItem[] {
  return items.map((item) => item.id === id ? updater(item) : item)
}

export function moveCanvasItem(items: DeskItem[], id: string, x: number, y: number): DeskItem[] {
  return updateCanvasItem(items, id, (item) => ({ ...item, x, y }))
}

export function rotateCanvasItem(items: DeskItem[], id: string, delta: number): DeskItem[] {
  return updateCanvasItem(items, id, (item) => ({ ...item, rotation: normalizeRotation(item.rotation + delta) }))
}

/** 方向键默认步进：与画布 50 mm 网格对齐。 */
export const KEYBOARD_STEP_MM = 50
/** 按住修饰键（Shift / Alt / Ctrl / Meta）时的微调步进。 */
export const KEYBOARD_FINE_STEP_MM = 10

export type NudgeDirection = 'up' | 'down' | 'left' | 'right'

const DIRECTION_DELTA: Record<NudgeDirection, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
}

function roundToGrid(value: number): number {
  return Math.round(value)
}

/** 键盘步进移动：默认一格（50 mm），fine 为真时微调（10 mm）。 */
export function nudgeCanvasItem(items: DeskItem[], id: string, direction: NudgeDirection, fine = false): DeskItem[] {
  const step = fine ? KEYBOARD_FINE_STEP_MM : KEYBOARD_STEP_MM
  const { dx, dy } = DIRECTION_DELTA[direction]
  return updateCanvasItem(items, id, (item) => ({
    ...item,
    x: roundToGrid(item.x + dx * step),
    y: roundToGrid(item.y + dy * step),
  }))
}
