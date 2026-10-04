import { getItemBounds, normalizeRotation, rectanglesOverlap } from '../../shared/layoutRules'
import { getDeviceDefinition, type DeskItem, type WorkspacePlan } from '../../shared/models'

export const KEYBOARD_MOVE_STEP_MM = 10
export const KEYBOARD_FINE_STEP_MM = 1

function updateCanvasItem(items: DeskItem[], id: string, updater: (item: DeskItem) => DeskItem): DeskItem[] {
  return items.map((item) => item.id === id ? updater(item) : item)
}

export function moveCanvasItem(items: DeskItem[], id: string, x: number, y: number): DeskItem[] {
  return updateCanvasItem(items, id, (item) => ({ ...item, x, y }))
}

export function rotateCanvasItem(items: DeskItem[], id: string, delta: number): DeskItem[] {
  return updateCanvasItem(items, id, (item) => ({ ...item, rotation: normalizeRotation(item.rotation + delta) }))
}

export function getKeyboardMoveStep(fineTune: boolean): number {
  return fineTune ? KEYBOARD_FINE_STEP_MM : KEYBOARD_MOVE_STEP_MM
}

export function getFocusTargetAfterRemoval(items: DeskItem[], removedId: string): string | null {
  const removedIndex = items.findIndex((item) => item.id === removedId)
  if (removedIndex === -1) return null
  const remaining = items.filter((item) => item.id !== removedId)
  if (remaining.length === 0) return null
  return remaining[Math.min(removedIndex, remaining.length - 1)].id
}

export function describeItemPlacement(plan: WorkspacePlan, movedItem: DeskItem): string {
  const label = getDeviceDefinition(movedItem.type).label
  const position = `${label}现在位于横向 ${Math.round(movedItem.x)} 毫米、纵向 ${Math.round(movedItem.y)} 毫米`
  const bounds = getItemBounds(movedItem)
  if (bounds.left < 0 || bounds.top < 0 || bounds.right > plan.deskWidthMm || bounds.bottom > plan.deskHeightMm) {
    return `${position}，已超出桌面边界`
  }
  const overlapping = plan.items.filter((item) => item.id !== movedItem.id && rectanglesOverlap(getItemBounds(item), bounds))
  if (overlapping.length > 0) {
    const names = overlapping.map((item) => getDeviceDefinition(item.type).label).join('、')
    return `${position}，与${names}重叠`
  }
  return `${position}，没有与其他设备重叠`
}
