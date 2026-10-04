import { describe, expect, it } from 'vitest'
import { createItem, createPlan } from '../../../shared/models'
import {
  describeItemPlacement,
  getFocusTargetAfterRemoval,
  getKeyboardMoveStep,
  moveCanvasItem,
  rotateCanvasItem,
} from '../canvasViewModel'

describe('canvas module', () => {
  it('moves and rotates the requested item without changing other items', () => {
    const first = createItem('monitor')
    const second = createItem('keyboard')
    const moved = moveCanvasItem([first, second], first.id, 320, 180)
    const rotated = rotateCanvasItem(moved, first.id, -15)
    expect(rotated[0]).toMatchObject({ x: 320, y: 180, rotation: 345 })
    expect(rotated[1]).toEqual(second)
  })
})

describe('getKeyboardMoveStep', () => {
  it('uses a 10 mm step by default and 1 mm when fine-tuning', () => {
    expect(getKeyboardMoveStep(false)).toBe(10)
    expect(getKeyboardMoveStep(true)).toBe(1)
  })
})

describe('getFocusTargetAfterRemoval', () => {
  it('focuses the next item, falling back to the previous one at the end of the list', () => {
    const first = createItem('monitor')
    const second = createItem('keyboard')
    const third = createItem('lamp')
    const items = [first, second, third]
    expect(getFocusTargetAfterRemoval(items, first.id)).toBe(second.id)
    expect(getFocusTargetAfterRemoval(items, second.id)).toBe(third.id)
    expect(getFocusTargetAfterRemoval(items, third.id)).toBe(second.id)
  })

  it('returns null when nothing remains or the id is unknown', () => {
    const only = createItem('monitor')
    expect(getFocusTargetAfterRemoval([only], only.id)).toBeNull()
    expect(getFocusTargetAfterRemoval([only], 'missing')).toBeNull()
  })
})

describe('describeItemPlacement', () => {
  it('reports the position when the item sits clear of everything', () => {
    const item = { ...createItem('monitor'), x: 100, y: 200 }
    const plan = { ...createPlan('测试', false), items: [item] }
    expect(describeItemPlacement(plan, item)).toBe('显示器现在位于横向 100 毫米、纵向 200 毫米，没有与其他设备重叠')
  })

  it('names the devices the moved item collides with', () => {
    const item = { ...createItem('monitor'), x: 100, y: 100 }
    const other = { ...createItem('keyboard'), x: 120, y: 120 }
    const plan = { ...createPlan('测试', false), items: [item, other] }
    expect(describeItemPlacement(plan, item)).toBe('显示器现在位于横向 100 毫米、纵向 100 毫米，与键盘重叠')
  })

  it('warns when the item leaves the desk area', () => {
    const item = { ...createItem('lamp'), x: -50, y: 100 }
    const plan = { ...createPlan('测试', false), items: [item] }
    expect(describeItemPlacement(plan, item)).toBe('桌面灯现在位于横向 -50 毫米、纵向 100 毫米，已超出桌面边界')
  })
})
