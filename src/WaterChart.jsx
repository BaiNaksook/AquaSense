import { useMemo, useState } from 'react'
import './styles/detail.css'
import {
  WARN_BAND, toMarginPoints, yDomain, xDomain, splitSegments, niceTicks, nearestIndex, hhmm, fmt1,
} from './waterChartMath.js'

const W = 640
const H = 260
const PAD = { l: 44, r: 92, t: 16, b: 34 }
const PW = W - PAD.l - PAD.r
const PH = H - PAD.t - PAD.b
const MAX_TAIL_MS = 5 * 60_000 // ต่อแกนเวลาไปถึง "ตอนนี้" ไม่เกิน 5 นาที

export default function WaterChart({ history, now }) {
  const [hover, setHover] = useState(-1)

  const points = useMemo(() => toMarginPoints(history), [history])

  const geo = useMemo(() => {
    if (points.length < 2) return null
    const [y0, y1] = yDomain(points)
    let [x0, x1] = xDomain(points)
    if (Number.isFinite(now) && now > x1) x1 = Math.min(now, x1 + MAX_TAIL_MS)
    const sx = (t) => PAD.l + ((t - x0) / (x1 - x0)) * PW
    const sy = (m) => PAD.t + ((y1 - m) / (y1 - y0)) * PH
    const segs = splitSegments(points).map((seg) =>
      seg.map((p, i) => `${i ? 'L' : 'M'}${sx(p.t).toFixed(1)},${sy(p.m).toFixed(1)}`).join(''),
    )
    return { x0, x1, sx, sy, segs, ticks: niceTicks(y0, y1, 6) }
  }, [points, now])

  if (!geo) {
    return (
      <div className="wc wc--empty">
        <p>กำลังเก็บข้อมูล กราฟจะขึ้นเมื่อได้ค่าอย่างน้อย 2 ค่า</p>
      </div>
    )
  }

  const { x0, x1, sx, sy, segs, ticks } = geo
  const last = points[points.length - 1]
  const first = points[0]
  const yDanger = sy(0)
  const yWarn = sy(WARN_BAND)
  const plotBottom = PAD.t + PH
  const plotRight = PAD.l + PW
  const minM = Math.min(...points.map((p) => p.m))

  const label = `กราฟระยะห่างจากขีดอันตราย ${points.length} ค่า ตั้งแต่ ${hhmm(first.t)} ถึง ${hhmm(last.t)} น. `
    + `ค่าล่าสุดห่างขีดอันตราย ${fmt1(last.m)} ซม. `
    + (minM <= 0 ? 'ช่วงนี้มีบางช่วงที่น้ำถึงขีดอันตราย' : `ช่วงนี้ใกล้ขีดอันตรายที่สุด ${fmt1(minM)} ซม.`)

  function pick(e) {
    const svg = e.currentTarget
    const r = svg.getBoundingClientRect()
    if (!r.width) return
    const vx = ((e.clientX - r.left) / r.width) * W
    const t = x0 + ((vx - PAD.l) / PW) * (x1 - x0)
    setHover(nearestIndex(points, t))
  }

  const hp = hover >= 0 && hover < points.length ? points[hover] : null
  const hx = hp ? sx(hp.t) : 0
  const hy = hp ? sy(hp.m) : 0
  const tipLeft = hp ? Math.min(Math.max((hx / W) * 100, 18), 82) : 0
  const tipBelow = hp ? hy < H * 0.4 : false

  return (
    <div className="wc">
      <svg
        className="wc__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(-1)}
        onPointerCancel={() => setHover(-1)}
      >
        {/* แถบพื้น: ใต้ 0 = เกินขีดอันตราย, 0..WARN_BAND = เฝ้าระวัง */}
        {yDanger < plotBottom && (
          <rect className="wc__band wc__band--danger" x={PAD.l} y={Math.max(yDanger, PAD.t)} width={PW} height={plotBottom - Math.max(yDanger, PAD.t)} />
        )}
        <rect className="wc__band wc__band--warning" x={PAD.l} y={yWarn} width={PW} height={yDanger - yWarn} />

        {ticks.map((v) => (
          <g key={v}>
            <line className="wc__grid" x1={PAD.l} x2={plotRight} y1={sy(v)} y2={sy(v)} />
            <text className="wc__tick" x={PAD.l - 8} y={sy(v)} dy="0.35em" textAnchor="end">{fmt1(v)}</text>
          </g>
        ))}

        <line className="wc__rule wc__rule--danger" x1={PAD.l} x2={plotRight} y1={yDanger} y2={yDanger} />
        <line className="wc__rule wc__rule--warning" x1={PAD.l} x2={plotRight} y1={yWarn} y2={yWarn} />
        <text className="wc__rulelabel wc__rulelabel--danger" x={plotRight + 6} y={yDanger} dy="0.35em">ขีดอันตราย</text>
        <text className="wc__rulelabel wc__rulelabel--warning" x={plotRight + 6} y={(yDanger + yWarn) / 2} dy="0.35em">เฝ้าระวัง</text>

        <line className="wc__axis" x1={PAD.l} x2={plotRight} y1={plotBottom} y2={plotBottom} />
        {[x0, (x0 + x1) / 2, x1].map((t, i) => (
          <text
            key={i}
            className="wc__tick"
            x={sx(t)}
            y={plotBottom + 22}
            textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
          >
            {hhmm(t)}
          </text>
        ))}

        {segs.map((d, i) => <path key={i} className="wc__line" d={d} />)}

        <circle className="wc__last" cx={sx(last.t)} cy={sy(last.m)} r="6" />
        <text
          className="wc__lastlabel"
          x={sx(last.t) - 10}
          y={sy(last.m) - 12}
          textAnchor="end"
        >
          {fmt1(last.m)} ซม.
        </text>

        {hp && (
          <g className="wc__cursor">
            <line x1={hx} x2={hx} y1={PAD.t} y2={plotBottom} />
            <circle cx={hx} cy={hy} r="5" />
          </g>
        )}
      </svg>

      {hp && (
        <div
          className={`wc__tip${tipBelow ? ' wc__tip--below' : ''}`}
          style={{ left: `${tipLeft}%`, top: `${(hy / H) * 100}%` }}
          aria-hidden="true"
        >
          <span className="num">{hhmm(hp.t)} น.</span>
          <strong>ห่างขีดอันตราย <span className="num">{fmt1(hp.m)}</span> ซม.</strong>
        </div>
      )}

      <p className="wc__caption muted">แกนตั้ง: ห่างขีดอันตราย (ซม.) · เส้นต่ำลง = น้ำสูงขึ้น ใกล้อันตรายขึ้น · แตะหรือชี้ที่กราฟเพื่อดูค่า</p>
    </div>
  )
}
