import { useId } from 'react'
import { RED_MAX, YELLOW_MAX, marginToDanger } from './water.js'
import './styles/viz.css'

// ภาพตัดขวางนาเกลือ: ตอบคำถามเดียว "น้ำอยู่ห่างขีดอันตรายเท่าไร"
// ระยะน้อย = น้ำสูง · margin = ระยะ − RED_MAX (ติดลบ = น้ำเกินขีดแล้ว)
const W = 320
const H = 170
const FLOOR_Y = 150
const BUND_TOP_Y = 30
const DANGER_Y = Math.round(H * 0.28) // 48
const SCALE_CM = 40 // ช่วงระยะใต้ขีดอันตรายที่แสดงในภาพ
const SPAN = FLOOR_Y - DANGER_Y - 10 // ความสูงภาพสำหรับ 40 ซม.
const MIN_MARGIN = -8 // น้ำเกินขีดได้สูงสุดถึงราวสันคันนา
const PAN_LEFT = 36
const PAN_RIGHT = W - 36

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const yForMargin = (m) => DANGER_Y + (clamp(m, MIN_MARGIN, SCALE_CM) / SCALE_CM) * SPAN
const WARN_Y = yForMargin(YELLOW_MAX - RED_MAX)
const TOP_MIN = yForMargin(MIN_MARGIN) // น้ำสูงสุดที่วาดได้

// ช่องในนาระหว่างคันนาสองข้าง (ขอบด้านในของคันนาเป็นเส้นลาด)
const L_OUT = 2
const L_IN = PAN_LEFT + 8
const R_OUT = W - 2
const R_IN = PAN_RIGHT - 8
const innerTopX = (outer, inner) => outer + (inner - outer) * 0.75
const PAN_CLIP = `M${innerTopX(L_OUT, L_IN)} 0L${innerTopX(R_OUT, R_IN)} 0L${R_IN} ${FLOOR_Y}L${L_IN} ${FLOOR_Y}z`

const fmt = (n) => String(Math.round(Math.abs(n) * 10) / 10)

function describe(margin, stale) {
  let s
  if (margin === null) s = 'ยังไม่มีข้อมูล'
  else if (margin > 0) s = `น้ำอยู่ต่ำกว่าขีดอันตราย ${fmt(margin)} ซม.`
  else if (margin === 0) s = 'น้ำถึงขีดอันตรายพอดี'
  else s = `น้ำเกินขีดอันตราย ${fmt(margin)} ซม.`
  return margin !== null && stale ? `${s} (ค่าเก่า)` : s
}

// ลานคันนาทรงคางหมู
const bund = (outer, inner) =>
  `M${outer} ${FLOOR_Y}L${outer + (inner - outer) * 0.3} ${BUND_TOP_Y}L${outer + (inner - outer) * 0.75} ${BUND_TOP_Y}L${inner} ${FLOOR_Y}z`

export default function WaterPan({ distance, status, stale = false, onDark = false }) {
  const uid = useId().replace(/:/g, '')
  const hatchId = `wp-hatch-${uid}`
  const clipId = `wp-clip-${uid}`
  const d = distance ?? null
  const margin = d === null ? null : marginToDanger(d)
  const waterY = margin === null ? null : yForMargin(margin)

  const cls = ['wp', onDark && 'wp--dark', stale && 'wp--stale', status && `wp--${status}`]
    .filter(Boolean)
    .join(' ')

  return (
    <svg className={cls} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(margin, stale)}>
      <defs>
        <pattern id={hatchId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" className="wp-hatch-bg" />
          <path d="M0 0v8" className="wp-hatch-line" />
        </pattern>
        <clipPath id={clipId}>
          <path d={PAN_CLIP} />
        </clipPath>
      </defs>

      {waterY !== null && (
        <g clipPath={`url(#${clipId})`}>
          {/* น้ำ: วาดครั้งเดียวที่ระดับสูงสุด แล้วเลื่อนลงด้วย transform เพื่อให้ขยับนุ่มนวลทุกเบราว์เซอร์ */}
          <g className="wp-water" style={{ transform: `translateY(${waterY - TOP_MIN}px)` }}>
            <rect
              className="wp-water__body"
              x={PAN_LEFT - 6}
              y={TOP_MIN}
              width={PAN_RIGHT - PAN_LEFT + 12}
              height={FLOOR_Y - TOP_MIN}
              fill={stale ? `url(#${hatchId})` : undefined}
            />
            <path className="wp-water__surface" d={`M${PAN_LEFT - 6} ${TOP_MIN}H${PAN_RIGHT + 6}`} />
          </g>
        </g>
      )}

      <path className="wp-bund" d={bund(L_OUT, L_IN)} />
      <path className="wp-bund" d={bund(R_OUT, R_IN)} />
      <path className="wp-floor" d={`M0 ${FLOOR_Y}H${W}`} />

      <path className="wp-line wp-line--warn" d={`M${PAN_LEFT} ${WARN_Y}H${PAN_RIGHT}`} />
      <path className="wp-line wp-line--danger" d={`M${PAN_LEFT} ${DANGER_Y}H${PAN_RIGHT}`} />
      <text className="wp-label wp-label--warn" x={PAN_RIGHT - 4} y={WARN_Y - 7} textAnchor="end">
        เริ่มขึ้น
      </text>
      <text className="wp-label wp-label--danger" x={PAN_RIGHT - 4} y={DANGER_Y - 7} textAnchor="end">
        ขีดอันตราย
      </text>

      {waterY === null && (
        <text className="wp-empty" x={W / 2} y={(WARN_Y + FLOOR_Y) / 2 + 12} textAnchor="middle">
          ยังไม่มีข้อมูล
        </text>
      )}
      {waterY !== null && stale && (
        <text className="wp-label wp-label--stale" x={PAN_LEFT + 6} y={FLOOR_Y - 10}>
          ค่าเก่า
        </text>
      )}
    </svg>
  )
}
