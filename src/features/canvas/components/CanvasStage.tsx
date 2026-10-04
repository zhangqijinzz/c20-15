import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Move, RotateCw } from 'lucide-react'
import type { DeskItem, LayoutAnalysis, WorkspacePlan } from '../../../shared/models'
import { getDeviceDefinition } from '../../../shared/models'
import { getItemBounds, rectanglesOverlap } from '../../../shared/layoutRules'
import { KEYBOARD_FINE_STEP_MM, KEYBOARD_STEP_MM, nudgeCanvasItem, type NudgeDirection } from '../canvasViewModel'

interface CanvasStageProps {
  plan: WorkspacePlan
  selectedItemId: string | null
  analysis: LayoutAnalysis
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
  /** 预览模式下为只读：不参与 Tab 序列、没有键盘操作，对读屏呈现为一张图片。 */
  interactive?: boolean
  onDelete?: (id: string) => void
}

interface DragState { id: string; offsetX: number; offsetY: number }

const ARROW_KEYS: Record<string, NudgeDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

function describeItemStatus(item: DeskItem, plan: WorkspacePlan): string {
  const bounds = getItemBounds(item)
  if (bounds.left < 0 || bounds.top < 0 || bounds.right > plan.deskWidthMm || bounds.bottom > plan.deskHeightMm) {
    return '已超出桌面边界'
  }
  const overlaps = plan.items.some((other) => other.id !== item.id && rectanglesOverlap(bounds, getItemBounds(other)))
  return overlaps ? '与其他设备重叠' : '没有冲突'
}

export function CanvasStage({ plan, selectedItemId, analysis, onSelect, onMove, interactive = true, onDelete }: CanvasStageProps) {
  const stageRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const pendingFocusIdRef = useRef<string | null>(null)
  const uid = useId().replace(/[:]/g, '')
  const gridId = `desk-grid-${uid}`
  const shadowId = `item-shadow-${uid}`
  const [drag, setDrag] = useState<DragState | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const scaleToMm = useCallback((clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return null
    return { x: ((clientX - rect.left) / rect.width) * plan.deskWidthMm, y: ((clientY - rect.top) / rect.height) * plan.deskHeightMm }
  }, [plan.deskHeightMm, plan.deskWidthMm])

  useEffect(() => {
    if (!drag) return
    const handleMove = (event: PointerEvent) => {
      const point = scaleToMm(event.clientX, event.clientY)
      if (!point) return
      onMove(drag.id, point.x - drag.offsetX, point.y - drag.offsetY)
    }
    const handleUp = () => setDrag(null)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp) }
  }, [drag, onMove, scaleToMm])

  // 删除后把焦点交给相邻设备（或画布容器），避免焦点掉到页面顶层。
  useEffect(() => {
    const focusId = pendingFocusIdRef.current
    if (focusId === null) return
    pendingFocusIdRef.current = null
    if (!plan.items.some((item) => item.id === focusId)) return
    stageRef.current?.querySelector<SVGGElement>(`[data-item-id="${focusId}"]`)?.focus()
  }, [plan.items])

  const startDrag = (event: ReactPointerEvent<SVGGElement>, item: DeskItem) => {
    if (!interactive) return
    event.stopPropagation()
    const point = scaleToMm(event.clientX, event.clientY)
    if (!point) return
    onSelect(item.id)
    setDrag({ id: item.id, offsetX: point.x - item.x, offsetY: point.y - item.y })
  }

  const handleItemKeyDown = (event: ReactKeyboardEvent<SVGGElement>, item: DeskItem) => {
    if (!interactive) return
    const direction = ARROW_KEYS[event.key]
    if (direction) {
      event.preventDefault()
      event.stopPropagation()
      const fine = event.shiftKey
      const movedItems = nudgeCanvasItem(plan.items, item.id, direction, fine)
      const moved = movedItems.find((candidate) => candidate.id === item.id) ?? item
      onMove(item.id, moved.x, moved.y)
      setAnnouncement(`${getDeviceDefinition(item.type).label}已移动到 X ${moved.x}、Y ${moved.y} 毫米，${describeItemStatus(moved, plan)}。按住 Shift 加方向键可每次微调 ${KEYBOARD_FINE_STEP_MM} 毫米`)
      return
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      onSelect(item.id)
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!onDelete) return
      event.preventDefault()
      event.stopPropagation()
      const index = plan.items.findIndex((candidate) => candidate.id === item.id)
      // 视图模型会把选中项挪到相邻设备；没有剩余设备时焦点回到画布容器。
      pendingFocusIdRef.current = plan.items[index + 1]?.id ?? plan.items[index - 1]?.id ?? null
      const remaining = plan.items.length - 1
      setAnnouncement(`${getDeviceDefinition(item.type).label}已删除，画布上还剩${remaining}件设备`)
      onDelete(item.id)
      if (pendingFocusIdRef.current === null) {
        onSelect(null)
        wrapRef.current?.focus()
      }
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onSelect(null)
      wrapRef.current?.focus()
    }
  }

  const issueCount = new Set([...analysis.overlapIds, ...analysis.outOfBoundsIds]).size
  const previewLabel = `桌面布局预览，${plan.deskWidthMm}乘${plan.deskHeightMm}毫米，共${plan.items.length}件设备${issueCount > 0 ? `，检测到${issueCount}个重叠或越界问题` : '，布局检查通过'}`

  return (
    <div
      ref={wrapRef}
      className="canvas-wrap"
      role={interactive ? 'group' : undefined}
      aria-label={interactive ? '桌面布局编辑画布' : undefined}
      aria-describedby={interactive ? 'canvas-keyboard-help' : undefined}
      tabIndex={interactive ? -1 : undefined}
    >
      <div className="canvas-toolbar"><span><Move size={14} /> 拖动设备调整位置</span><span><RotateCw size={14} /> 旋转请在右侧操作</span></div>
      {interactive && (
        <p id="canvas-keyboard-help" className="sr-only">
          Tab 聚焦设备后，方向键每次移动{KEYBOARD_STEP_MM}毫米，按住 Shift 加方向键每次微调{KEYBOARD_FINE_STEP_MM}毫米；Delete 删除当前设备，Esc 取消选中。
        </p>
      )}
      <div aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
      <svg
        ref={stageRef}
        className="desk-canvas"
        viewBox={`0 0 ${plan.deskWidthMm} ${plan.deskHeightMm}`}
        role={interactive ? 'presentation' : 'img'}
        aria-label={interactive ? undefined : previewLabel}
        onPointerDown={() => { if (interactive) onSelect(null) }}
      >
        <defs>
          <pattern id={gridId} width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#d8e1ed" strokeWidth="1" /></pattern>
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#20304a" floodOpacity=".12" /></filter>
        </defs>
        <rect width={plan.deskWidthMm} height={plan.deskHeightMm} rx="22" fill="#f8fafc" />
        <rect width={plan.deskWidthMm} height={plan.deskHeightMm} rx="22" fill={`url(#${gridId})`} />
        <text x="34" y="48" fill="#a0aec0" fontSize="20" letterSpacing="3">FOCUS ZONE / {plan.deskWidthMm} × {plan.deskHeightMm} MM</text>
        {plan.items.map((item) => {
          const definition = getDeviceDefinition(item.type)
          const isSelected = selectedItemId === item.id
          const hasIssue = analysis.overlapIds.includes(item.id) || analysis.outOfBoundsIds.includes(item.id)
          const cx = item.x + item.widthMm / 2
          const cy = item.y + item.heightMm / 2
          const itemLabel = interactive
            ? `${definition.label}，${item.widthMm}乘${item.heightMm}毫米，位置 X ${Math.round(item.x)}、Y ${Math.round(item.y)}，${describeItemStatus(item, plan)}${isSelected ? '，已选中' : ''}`
            : undefined
          return <g
            className={`desk-item ${isSelected ? 'is-selected' : ''} ${hasIssue ? 'has-issue' : ''} ${interactive ? 'is-interactive' : 'is-readonly'}`}
            key={item.id}
            data-item-id={item.id}
            onPointerDown={(event) => startDrag(event, item)}
            onKeyDown={(event) => handleItemKeyDown(event, item)}
            onFocus={() => { if (interactive) onSelect(item.id) }}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : -1}
            aria-pressed={interactive ? isSelected : undefined}
            aria-label={interactive ? itemLabel : undefined}
          >
            <g transform={`translate(${cx} ${cy}) rotate(${item.rotation})`}>
              <rect x={-item.widthMm / 2} y={-item.heightMm / 2} width={item.widthMm} height={item.heightMm} rx={Math.min(24, item.heightMm / 5)} fill={definition.color} filter={`url(#${shadowId})`} />
              <rect className="item-inner-line" x={-item.widthMm / 2 + 12} y={-item.heightMm / 2 + 12} width={Math.max(0, item.widthMm - 24)} height={Math.max(0, item.heightMm - 24)} rx={12} fill="none" />
              <text x="0" y="5" textAnchor="middle" fill="#1f2e44" fontWeight="700" fontSize={Math.max(18, Math.min(32, item.widthMm / 16))}>{definition.shortLabel}</text>
              <text x="0" y="30" textAnchor="middle" fill="#44546b" fontSize="16">{item.widthMm} × {item.heightMm}</text>
            </g>
            {isSelected && interactive && <rect className="selection-box" x={getItemBounds(item).left - 8} y={getItemBounds(item).top - 8} width={getItemBounds(item).width + 16} height={getItemBounds(item).height + 16} rx="12" fill="none" />}
            {hasIssue && <g transform={`translate(${Math.max(18, getItemBounds(item).right - 4)} ${Math.max(18, getItemBounds(item).top - 4)}`}><circle r="18" fill="#ef6a6a" /><text textAnchor="middle" y="7" fill="white" fontSize="22" fontWeight="700">!</text></g>}
          </g>
        })}
        {plan.items.length === 0 && <g><circle cx={plan.deskWidthMm / 2} cy={plan.deskHeightMm / 2 - 12} r="32" fill="#e8eef6" /><text x={plan.deskWidthMm / 2} y={plan.deskHeightMm / 2 + 2} textAnchor="middle" fill="#8493a8" fontSize="22">+</text><text x={plan.deskWidthMm / 2} y={plan.deskHeightMm / 2 + 48} textAnchor="middle" fill="#8493a8" fontSize="22">从左侧添加第一件设备</text></g>}
      </svg>
      <div className="canvas-legend"><span><i className="legend-dot clear-dot" /> 可用空间</span><span><i className="legend-dot issue-dot" /> 冲突 / 越界</span><span className="canvas-scale">网格：50 mm · 方向键移动 50 mm，Shift+方向键 10 mm</span></div>
    </div>
  )
}
