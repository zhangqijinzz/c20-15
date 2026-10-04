import { describe, expect, it } from 'vitest'
import { createItem } from '../../../shared/models'
import { KEYBOARD_FINE_STEP_MM, KEYBOARD_STEP_MM, moveCanvasItem, nudgeCanvasItem, rotateCanvasItem } from '../canvasViewModel'

describe('canvas module', () => {
  it('moves and rotates the requested item without changing other items', () => {
    const first = createItem('monitor')
    const second = createItem('keyboard')
    const moved = moveCanvasItem([first, second], first.id, 320, 180)
    const rotated = rotateCanvasItem(moved, first.id, -15)
    expect(rotated[0]).toMatchObject({ x: 320, y: 180, rotation: 345 })
    expect(rotated[1]).toEqual(second)
  })

  it('nudges the focused item one grid step per arrow key', () => {
    const item = createItem('lamp')
    item.x = 200
    item.y = 200
    expect(nudgeCanvasItem([item], item.id, 'right')[0]).toMatchObject({ x: 200 + KEYBOARD_STEP_MM, y: 200 })
    expect(nudgeCanvasItem([item], item.id, 'down')[0]).toMatchObject({ x: 200, y: 200 + KEYBOARD_STEP_MM })
    expect(nudgeCanvasItem([item], item.id, 'left')[0]).toMatchObject({ x: 200 - KEYBOARD_STEP_MM, y: 200 })
    expect(nudgeCanvasItem([item], item.id, 'up')[0]).toMatchObject({ x: 200, y: 200 - KEYBOARD_STEP_MM })
  })

  it('uses the fine step with a modifier and leaves other items untouched', () => {
    const first = createItem('monitor')
    first.x = 100
    first.y = 100
    const second = createItem('keyboard')
    const nudged = nudgeCanvasItem([first, second], first.id, 'right', true)
    expect(nudged[0]).toMatchObject({ x: 100 + KEYBOARD_FINE_STEP_MM, y: 100 })
    expect(nudged[1]).toEqual(second)
  })
})
