import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Move, RotateCw } from 'lucide-react'
import type { DeskItem, LayoutAnalysis, WorkspacePlan } from '../../../shared/models'
import { getDeviceDefinition } from '../../../shared/models'
import { getItemBounds } from '../../../shared/layoutRules'
import { describeItemPlacement, getFocusTargetAfterRemoval, getKeyboardMoveStep } from '../canvasViewModel'

interface CanvasStageProps {
  plan: WorkspacePlan
  selectedItemId: string | null
  analysis: LayoutAnalysis
  interactive?: boolean
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
  onDelete: (id: string) => void
}

interface DragState { id: string; offsetX: number; offsetY: number }

const ARROW_DELTAS: Record<string, { dx: number; dy: number }> = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
}

export function CanvasStage({ plan, selectedItemId, analysis, interactive = true, onSelect, onMove, onDelete }: CanvasStageProps) {
  const stageRef = useRef<SVGSVGElement>(null)
  const itemRefs = useRef(new Map<string, SVGGElement>())
  const pendingFocusRef = useRef<string | null>(null)
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

  useEffect(() => {
    const pendingId = pendingFocusRef.current
    if (pendingId === null) return
    pendingFocusRef.current = null
    const target = pendingId === 'stage' ? stageRef.current : itemRefs.current.get(pendingId)
    target?.focus()
  }, [plan.items])

  const startDrag = (event: ReactPointerEvent<SVGGElement>, item: DeskItem) => {
    event.stopPropagation()
    const point = scaleToMm(event.clientX, event.clientY)
    if (!point) return
    onSelect(item.id)
    setDrag({ id: item.id, offsetX: point.x - item.x, offsetY: point.y - item.y })
  }

  const handleItemKeyDown = (event: ReactKeyboardEvent<SVGGElement>, item: DeskItem) => {
    const definition = getDeviceDefinition(item.type)
    const arrow = ARROW_DELTAS[event.key]
    if (arrow) {
      event.preventDefault()
      const step = getKeyboardMoveStep(event.shiftKey)
      const nextX = item.x + arrow.dx * step
      const nextY = item.y + arrow.dy * step
      onSelect(item.id)
      onMove(item.id, nextX, nextY)
      setAnnouncement(describeItemPlacement(plan, { ...item, x: nextX, y: nextY }))
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      pendingFocusRef.current = getFocusTargetAfterRemoval(plan.items, item.id) ?? 'stage'
      onDelete(item.id)
      setAnnouncement(`${definition.label}已删除`)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onSelect(null)
      setAnnouncement(`已取消选中${definition.label}`)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(item.id)
    }
  }

  const registerItemRef = (id: string) => (node: SVGGElement | null) => {
    if (node) itemRefs.current.set(id, node)
    else itemRefs.current.delete(id)
  }

  return (
    <div className="canvas-wrap">
      {interactive && <div className="canvas-toolbar"><span><Move size={14} /> 拖动或方向键移动，Shift+方向键微调</span><span><RotateCw size={14} /> Delete 删除 · Esc 取消选中 · 旋转请在右侧操作</span></div>}
      <svg
        ref={stageRef}
        id={interactive ? 'focusdesk-canvas' : undefined}
        className="desk-canvas"
        viewBox={`0 0 ${plan.deskWidthMm} ${plan.deskHeightMm}`}
        role={interactive ? 'group' : 'img'}
        tabIndex={interactive ? -1 : undefined}
        aria-label={interactive ? `桌面布局画布，${plan.deskWidthMm}乘${plan.deskHeightMm}毫米，已放置${plan.items.length}件设备` : `桌面布局预览，${plan.deskWidthMm}乘${plan.deskHeightMm}毫米，已放置${plan.items.length}件设备`}
        onPointerDown={interactive ? () => onSelect(null) : undefined}
      >
        <defs>
          <pattern id="desk-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#d8e1ed" strokeWidth="1" /></pattern>
          <filter id="item-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#20304a" floodOpacity=".12" /></filter>
        </defs>
        <rect width={plan.deskWidthMm} height={plan.deskHeightMm} rx="22" fill="#f8fafc" />
        <rect width={plan.deskWidthMm} height={plan.deskHeightMm} rx="22" fill="url(#desk-grid)" />
        <text x="34" y="48" fill="#a0aec0" fontSize="20" letterSpacing="3">FOCUS ZONE / {plan.deskWidthMm} × {plan.deskHeightMm} MM</text>
        {plan.items.map((item) => {
          const definition = getDeviceDefinition(item.type)
          const isSelected = selectedItemId === item.id
          const hasIssue = analysis.overlapIds.includes(item.id) || analysis.outOfBoundsIds.includes(item.id)
          const cx = item.x + item.widthMm / 2
          const cy = item.y + item.heightMm / 2
          return <g className={`desk-item ${isSelected ? 'is-selected' : ''} ${hasIssue ? 'has-issue' : ''} ${interactive ? '' : 'is-static'}`} key={item.id} ref={interactive ? registerItemRef(item.id) : undefined} onPointerDown={interactive ? (event) => startDrag(event, item) : undefined} onFocus={interactive ? () => onSelect(item.id) : undefined} onKeyDown={interactive ? (event) => handleItemKeyDown(event, item) : undefined} role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} aria-label={interactive ? `${definition.label}，${item.widthMm}乘${item.heightMm}毫米` : undefined} aria-pressed={interactive ? isSelected : undefined}>
            <g transform={`translate(${cx} ${cy}) rotate(${item.rotation})`}>
              <rect x={-item.widthMm / 2} y={-item.heightMm / 2} width={item.widthMm} height={item.heightMm} rx={Math.min(24, item.heightMm / 5)} fill={definition.color} filter="url(#item-shadow)" />
              <rect className="item-inner-line" x={-item.widthMm / 2 + 12} y={-item.heightMm / 2 + 12} width={Math.max(0, item.widthMm - 24)} height={Math.max(0, item.heightMm - 24)} rx={12} fill="none" />
              <text x="0" y="5" textAnchor="middle" fill="#1f2e44" fontWeight="700" fontSize={Math.max(18, Math.min(32, item.widthMm / 16))}>{definition.shortLabel}</text>
              <text x="0" y="30" textAnchor="middle" fill="#44546b" fontSize="16">{item.widthMm} × {item.heightMm}</text>
            </g>
            {isSelected && <rect className="selection-box" x={getItemBounds(item).left - 8} y={getItemBounds(item).top - 8} width={getItemBounds(item).width + 16} height={getItemBounds(item).height + 16} rx="12" fill="none" />}
            {hasIssue && <g transform={`translate(${Math.max(18, getItemBounds(item).right - 4)} ${Math.max(18, getItemBounds(item).top - 4)}`}><circle r="18" fill="#ef6a6a" /><text textAnchor="middle" y="7" fill="white" fontSize="22" fontWeight="700">!</text></g>}
          </g>
        })}
        {plan.items.length === 0 && <g><circle cx={plan.deskWidthMm / 2} cy={plan.deskHeightMm / 2 - 12} r="32" fill="#e8eef6" /><text x={plan.deskWidthMm / 2} y={plan.deskHeightMm / 2 + 2} textAnchor="middle" fill="#8493a8" fontSize="22">+</text><text x={plan.deskWidthMm / 2} y={plan.deskHeightMm / 2 + 48} textAnchor="middle" fill="#8493a8" fontSize="22">从左侧添加第一件设备</text></g>}
      </svg>
      {interactive && <p className="sr-only" role="status">{announcement}</p>}
      <div className="canvas-legend"><span><i className="legend-dot clear-dot" /> 可用空间</span><span><i className="legend-dot issue-dot" /> 冲突 / 越界</span><span className="canvas-scale">网格：50 mm</span></div>
    </div>
  )
}
