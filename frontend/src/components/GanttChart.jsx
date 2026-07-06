import { useEffect, useMemo, useRef, useState } from 'react'

const ROW_H = 32
const HEADER_H = 44
const DAY_MS = 24 * 60 * 60 * 1000
const DAY_WIDTH = { day: 28, week: 9, month: 3 }

const STATUS_COLOR = {
  未着手: '#94a3b8',
  対応中: '#3b82f6',
  問題発生中: '#ef4444',
  完了: '#22c55e',
}

export function parseDate(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function fmtDate(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

function diffDays(a, b) {
  return Math.round((b - a) / DAY_MS)
}

// 親子関係(parent_id)を深さ優先で並べ、depthを付与する
export function buildTaskTree(tasks) {
  const byParent = new Map()
  const ids = new Set(tasks.map((t) => t.id))
  for (const t of tasks) {
    const key = t.parent_id && ids.has(t.parent_id) ? t.parent_id : null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(t)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.sort_order - b.sort_order)
      || String(a.planned_start_date || '').localeCompare(String(b.planned_start_date || '')))
  }
  const result = []
  const walk = (parentId, depth) => {
    for (const t of byParent.get(parentId) || []) {
      result.push({ ...t, depth })
      walk(t.id, depth + 1)
    }
  }
  walk(null, 1)
  return result
}

export default function GanttChart({
  tasks,
  dependencies = [],
  scale = 'day',
  maxLevel = 99,
  searchText = '',
  lightningDate = null,
  onTaskOpen,
  onTaskMove,
}) {
  const dayWidth = DAY_WIDTH[scale]
  const timelineRef = useRef(null)
  const [drag, setDrag] = useState(null) // { taskId, mode, startX, deltaDays }

  const rows = useMemo(() => {
    const tree = buildTaskTree(tasks)
    return tree.filter((t) => t.depth <= maxLevel)
  }, [tasks, maxLevel])

  const [rangeStart, rangeEnd] = useMemo(() => {
    const today = new Date()
    let min = null
    let max = null
    for (const t of rows) {
      const s = parseDate(t.planned_start_date)
      const e = parseDate(t.planned_end_date)
      if (s && (!min || s < min)) min = s
      if (e && (!max || e > max)) max = e
    }
    if (!min) min = today
    if (!max) max = addDays(today, 30)
    return [addDays(min, -3), addDays(max, 8)]
  }, [rows])

  const totalDays = diffDays(rangeStart, rangeEnd) + 1
  const width = totalDays * dayWidth
  const height = rows.length * ROW_H

  const x = (date) => diffDays(rangeStart, date) * dayWidth

  // ドラッグ中のタスクの日付（プレビュー用に差分を適用）
  const effectiveDates = (task) => {
    let s = parseDate(task.planned_start_date)
    let e = parseDate(task.planned_end_date)
    if (drag && drag.taskId === task.id && s && e) {
      if (drag.mode === 'move') {
        s = addDays(s, drag.deltaDays)
        e = addDays(e, drag.deltaDays)
      } else if (drag.mode === 'resize-end') {
        e = addDays(e, drag.deltaDays)
        if (e < s) e = s
      } else if (drag.mode === 'resize-start') {
        s = addDays(s, drag.deltaDays)
        if (s > e) s = e
      }
    }
    return [s, e]
  }

  useEffect(() => {
    if (!drag) return
    const onMove = (ev) => {
      setDrag((d) => d && { ...d, deltaDays: Math.round((ev.clientX - d.startX) / dayWidth) })
    }
    const onUp = () => {
      setDrag((d) => {
        if (d && d.deltaDays !== 0 && onTaskMove) {
          const task = rows.find((t) => t.id === d.taskId)
          if (task) {
            const [s, e] = [parseDate(task.planned_start_date), parseDate(task.planned_end_date)]
            if (s && e) {
              let ns = s
              let ne = e
              if (d.mode === 'move') { ns = addDays(s, d.deltaDays); ne = addDays(e, d.deltaDays) }
              if (d.mode === 'resize-end') { ne = addDays(e, d.deltaDays); if (ne < ns) ne = ns }
              if (d.mode === 'resize-start') { ns = addDays(s, d.deltaDays); if (ns > ne) ns = ne }
              onTaskMove(task, fmtDate(ns), fmtDate(ne))
            }
          }
        }
        return null
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag !== null, dayWidth, rows, onTaskMove])

  const startDrag = (ev, task, mode) => {
    if (!task.planned_start_date || !task.planned_end_date) return
    ev.preventDefault()
    setDrag({ taskId: task.id, mode, startX: ev.clientX, deltaDays: 0 })
  }

  // ---------- ヘッダー（月・日/週の2段） ----------
  const headerCells = useMemo(() => {
    const top = [] // 月または年
    const bottom = [] // 日・週開始日・月
    let cursor = new Date(rangeStart)
    if (scale === 'month') {
      while (cursor <= rangeEnd) {
        const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
        const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
        const from = monthStart < rangeStart ? rangeStart : monthStart
        const to = next > rangeEnd ? addDays(rangeEnd, 1) : next
        bottom.push({ x: x(from), w: diffDays(from, to) * dayWidth, label: `${cursor.getMonth() + 1}月` })
        if (cursor.getMonth() === 0 || top.length === 0) {
          top.push({ x: x(from), label: `${cursor.getFullYear()}年` })
        }
        cursor = next
      }
    } else {
      // 上段: 月（幅が狭い月はラベルを省略して重なりを防ぐ）
      let mcursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
      while (mcursor <= rangeEnd) {
        const next = new Date(mcursor.getFullYear(), mcursor.getMonth() + 1, 1)
        const from = mcursor < rangeStart ? rangeStart : mcursor
        const to = next > rangeEnd ? addDays(rangeEnd, 1) : next
        const segWidth = diffDays(from, to) * dayWidth
        if (segWidth >= 48) {
          top.push({ x: x(from), label: `${mcursor.getFullYear()}/${mcursor.getMonth() + 1}` })
        }
        mcursor = next
      }
      if (scale === 'day') {
        for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 1)) {
          bottom.push({ x: x(d), w: dayWidth, label: String(d.getDate()), weekend: d.getDay() === 0 || d.getDay() === 6 })
        }
      } else {
        // week: 月曜はじまり
        let d = new Date(rangeStart)
        while (d.getDay() !== 1) d = addDays(d, -1)
        for (; d <= rangeEnd; d = addDays(d, 7)) {
          const from = d < rangeStart ? rangeStart : d
          bottom.push({ x: x(from), w: 7 * dayWidth, label: `${d.getMonth() + 1}/${d.getDate()}` })
        }
      }
    }
    return { top, bottom }
  }, [rangeStart.getTime(), rangeEnd.getTime(), scale, dayWidth])

  // ---------- いなずま線 ----------
  const lightningPoints = useMemo(() => {
    if (!lightningDate) return null
    const L = parseDate(lightningDate)
    if (!L) return null
    const baseX = x(addDays(L, 1))
    const pts = [[baseX, 0]]
    rows.forEach((task, i) => {
      const yCenter = i * ROW_H + ROW_H / 2
      const s = parseDate(task.planned_start_date)
      const e = parseDate(task.planned_end_date)
      let px = baseX
      if (s && e && !task.is_milestone) {
        if (task.status === '完了') {
          px = baseX
        } else if (s <= L) {
          const duration = diffDays(s, e) + 1
          const achieved = addDays(s, Math.floor(duration * (task.progress_rate || 0) / 100))
          px = Math.min(x(achieved), baseX)
          px = Math.max(px, x(s))
        }
      }
      pts.push([px, yCenter])
    })
    pts.push([baseX, height])
    return pts
  }, [lightningDate, rows, dayWidth, rangeStart.getTime()])

  const today = new Date()
  const todayX = x(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const rowIndex = new Map(rows.map((t, i) => [t.id, i]))
  const search = searchText.trim().toLowerCase()

  return (
    <div className="gantt-wrap">
      <div className="gantt-table">
        <table>
          <thead>
            <tr style={{ height: HEADER_H }}>
              <th style={{ width: 230, textAlign: 'left' }}>タスク名</th>
              <th style={{ width: 90 }}>担当</th>
              <th style={{ width: 82 }}>状態</th>
              <th style={{ width: 46 }}>進捗</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => {
              const hit = search && task.name.toLowerCase().includes(search)
              return (
                <tr key={task.id} style={{ height: ROW_H, background: hit ? '#fef9c3' : undefined }}>
                  <td className="task-name" style={{ paddingLeft: 8 + (task.depth - 1) * 16 }}
                      onClick={() => onTaskOpen && onTaskOpen(task)}>
                    {task.is_milestone ? '◆ ' : ''}{task.name}
                  </td>
                  <td>{task.assignee ? task.assignee.name : '-'}</td>
                  <td><span className={`badge status-${task.status}`}>{task.status}</span></td>
                  <td style={{ textAlign: 'right' }}>{task.progress_rate}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="gantt-timeline" ref={timelineRef}>
        <svg width={width} height={HEADER_H + height} style={{ display: 'block' }}>
          {/* ヘッダー背景 */}
          <rect x={0} y={0} width={width} height={HEADER_H} fill="#f8fafc" />
          {headerCells.top.map((c, i) => (
            <text key={`t${i}`} x={c.x + 4} y={15} fontSize={11} fill="#64748b">{c.label}</text>
          ))}
          {headerCells.bottom.map((c, i) => (
            <g key={`b${i}`}>
              {c.weekend && (
                <rect x={c.x} y={HEADER_H} width={c.w} height={height} fill="#f8fafc" />
              )}
              <line x1={c.x} y1={22} x2={c.x} y2={HEADER_H + height} stroke="#e2e8f0" />
              {dayWidth >= 9 && (
                <text x={c.x + c.w / 2} y={37} fontSize={10} fill="#64748b" textAnchor="middle">{c.label}</text>
              )}
            </g>
          ))}
          <line x1={0} y1={HEADER_H} x2={width} y2={HEADER_H} stroke="#cbd5e1" />

          {/* 行の区切りと検索ハイライト */}
          {rows.map((task, i) => {
            const hit = search && task.name.toLowerCase().includes(search)
            return (
              <g key={task.id}>
                {hit && <rect x={0} y={HEADER_H + i * ROW_H} width={width} height={ROW_H} fill="#fef9c3" />}
                <line x1={0} y1={HEADER_H + (i + 1) * ROW_H} x2={width} y2={HEADER_H + (i + 1) * ROW_H} stroke="#f1f5f9" />
              </g>
            )
          })}

          {/* 今日の線 */}
          {todayX >= 0 && todayX <= width && (
            <line x1={todayX} y1={22} x2={todayX} y2={HEADER_H + height} stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="4 3" />
          )}

          {/* 依存関係の関連線 */}
          <defs>
            <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" fill="#f59e0b" />
            </marker>
          </defs>
          {dependencies.map((dep) => {
            const pi = rowIndex.get(dep.predecessor_id)
            const si = rowIndex.get(dep.successor_id)
            if (pi === undefined || si === undefined) return null
            const pred = rows[pi]
            const succ = rows[si]
            const [ps, pe] = effectiveDates(pred)
            const [ss] = effectiveDates(succ)
            if (!pe || !ss) return null
            const x1 = x(addDays(pe, 1))
            const y1 = HEADER_H + pi * ROW_H + ROW_H / 2
            const x2 = x(ss)
            const y2 = HEADER_H + si * ROW_H + ROW_H / 2
            const midX = Math.max(x1 + 8, x2 - 8)
            const d = `M ${x1} ${y1} L ${x1 + 8} ${y1} L ${x1 + 8} ${y2 > y1 ? y2 - ROW_H / 2 : y2 + ROW_H / 2} L ${x2 - 8} ${y2 > y1 ? y2 - ROW_H / 2 : y2 + ROW_H / 2} L ${x2 - 8} ${y2} L ${x2} ${y2}`
            return <path key={dep.id} d={d} fill="none" stroke="#f59e0b" strokeWidth={1.5} markerEnd="url(#arrow)" />
          })}

          {/* タスクバー */}
          {rows.map((task, i) => {
            const [s, e] = effectiveDates(task)
            const yTop = HEADER_H + i * ROW_H + 7
            const barH = ROW_H - 14
            if (task.is_milestone) {
              const d = e || s
              if (!d) return null
              const cx = x(d) + dayWidth / 2
              const cy = HEADER_H + i * ROW_H + ROW_H / 2
              return (
                <g key={task.id} onDoubleClick={() => onTaskOpen && onTaskOpen(task)} style={{ cursor: 'pointer' }}>
                  <path d={`M ${cx} ${cy - 8} L ${cx + 8} ${cy} L ${cx} ${cy + 8} L ${cx - 8} ${cy} z`} fill="#9333ea" />
                  <text x={cx + 12} y={cy + 4} fontSize={11} fill="#9333ea">{task.name}</text>
                </g>
              )
            }
            if (!s || !e) return null
            const bx = x(s)
            const bw = Math.max((diffDays(s, e) + 1) * dayWidth, 4)
            const color = STATUS_COLOR[task.status] || '#94a3b8'
            const isParent = tasks.some((t) => t.parent_id === task.id)
            return (
              <g key={task.id}
                 onDoubleClick={() => onTaskOpen && onTaskOpen(task)}
                 onMouseDown={(ev) => startDrag(ev, task, 'move')}
                 style={{ cursor: 'grab' }}>
                <rect x={bx} y={yTop} width={bw} height={barH} rx={4}
                      fill={color} opacity={isParent ? 0.45 : 0.35} />
                <rect x={bx} y={yTop} width={bw * (task.progress_rate || 0) / 100} height={barH} rx={4} fill={color} />
                {/* リサイズハンドル */}
                <rect x={bx - 3} y={yTop} width={6} height={barH} fill="transparent"
                      style={{ cursor: 'ew-resize' }}
                      onMouseDown={(ev) => { ev.stopPropagation(); startDrag(ev, task, 'resize-start') }} />
                <rect x={bx + bw - 3} y={yTop} width={6} height={barH} fill="transparent"
                      style={{ cursor: 'ew-resize' }}
                      onMouseDown={(ev) => { ev.stopPropagation(); startDrag(ev, task, 'resize-end') }} />
                {dayWidth >= 9 && (
                  <text x={bx + bw + 6} y={yTop + barH - 3} fontSize={11} fill="#64748b">
                    {task.progress_rate}%
                  </text>
                )}
              </g>
            )
          })}

          {/* いなずま線 */}
          {lightningPoints && (
            <polyline
              points={lightningPoints.map(([px, py]) => `${px},${HEADER_H + py}`).join(' ')}
              fill="none" stroke="#dc2626" strokeWidth={2} opacity={0.85}
            />
          )}
        </svg>
      </div>
    </div>
  )
}
