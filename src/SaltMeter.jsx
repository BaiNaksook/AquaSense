import { BE_CONCENTRATING, BE_READY_MIN, BE_BITTER, BE_SCALE_MAX } from './salinity.js'
import './styles/viz.css'

// มาตรวัดความเค็ม (ดีกรี) 3 ช่วง: ยังไม่พร้อม · พร้อมเก็บ · น้ำขม
// สเกลไม่เป็นเส้นตรง เพื่อขยายช่วงที่ใช้ตัดสินใจจริง (ช่วงพร้อมเก็บกว้างที่สุด)
const ZONES = [
  { key: 'low', label: 'ยังไม่พร้อม', from: BE_CONCENTRATING, to: BE_READY_MIN, width: 35 },
  { key: 'ready', label: 'พร้อมเก็บ', from: BE_READY_MIN, to: BE_BITTER, width: 45 },
  { key: 'bitter', label: 'น้ำขม', from: BE_BITTER, to: BE_SCALE_MAX, width: 20 },
]

function toPct(v) {
  let start = 0
  for (const z of ZONES) {
    if (v < z.to || z === ZONES[ZONES.length - 1]) {
      const t = Math.min(1, Math.max(0, (v - z.from) / (z.to - z.from)))
      return start + t * z.width
    }
    start += z.width
  }
  return 100
}

const zoneOf = (v) => (v >= BE_BITTER ? ZONES[2] : v >= BE_READY_MIN ? ZONES[1] : ZONES[0])
const fmt = (v) => String(Math.round(v * 10) / 10)

export default function SaltMeter({ value, compact = false }) {
  const has = typeof value === 'number' && Number.isFinite(value)
  const pct = has ? toPct(value) : null
  const zone = has ? zoneOf(value) : null
  const label = has
    ? `ความเค็ม ${fmt(value)} ดีกรี อยู่ในช่วง${zone.label}`
    : 'ยังไม่มีค่าความเค็ม'
  // ป้ายตัวเลขชิดขอบเมื่อเข็มอยู่ใกล้ปลายมาตร เพื่อไม่ให้ล้นออกนอกกรอบ
  const align = pct === null ? '' : pct < 12 ? ' sm-pointer--start' : pct > 88 ? ' sm-pointer--end' : ''

  return (
    <div className={`sm${compact ? ' sm--compact' : ''}`} role="img" aria-label={label}>
      <div className="sm-head" aria-hidden="true">
        {has && (
          <div className={`sm-pointer${align}`} style={{ left: `${pct}%` }}>
            <span className="sm-pointer__value num">{fmt(value)} ดีกรี</span>
            <span className="sm-pointer__tri" />
          </div>
        )}
      </div>
      <div className="sm-track" aria-hidden="true">
        {ZONES.map((z) => (
          <div
            key={z.key}
            className={`sm-zone sm-zone--${z.key}${zone === z ? ' is-current' : ''}`}
            style={{ flexBasis: `${z.width}%` }}
          />
        ))}
      </div>
      {!compact && (
        <div className="sm-labels" aria-hidden="true">
          {ZONES.map((z) => (
            <span
              key={z.key}
              className={`sm-label sm-label--${z.key}${zone === z ? ' is-current' : ''}`}
              style={{ flexBasis: `${z.width}%` }}
            >
              {z.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
