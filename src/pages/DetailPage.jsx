import { useEffect, useState } from 'react'
import { CircleCheck, TriangleAlert, OctagonAlert, CircleHelp, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import WaterChart from '../WaterChart.jsx'
import { RED_MAX, YELLOW_MAX, WATER_STATUS, ago, clockTime } from '../water.js'
import '../styles/detail.css'

const STATUS_ICON = { safe: CircleCheck, warning: TriangleAlert, danger: OctagonAlert, unknown: CircleHelp }

const TREND = {
  rising: { Icon: TrendingUp, text: 'ระดับน้ำกำลังขึ้น' },
  falling: { Icon: TrendingDown, text: 'ระดับน้ำกำลังลง' },
  stable: { Icon: Minus, text: 'ระดับน้ำคงที่' },
}

function signalWord(rssi) {
  if (rssi === null || rssi === undefined || !Number.isFinite(rssi)) return null
  if (rssi >= -65) return 'ดี'
  if (rssi >= -75) return 'พอใช้'
  return 'อ่อน'
}

const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('th-TH', { maximumFractionDigits: 1 })
const has = (n) => n !== null && n !== undefined && Number.isFinite(n)

// นาฬิกาเดินทุก 30 วิ ให้ "x นาทีก่อน" และแกนเวลาของกราฟไม่ค้าง
function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export default function DetailPage({ model, weatherSlot, salinitySlot }) {
  const now = useNow()
  const m = model || {}
  const status = WATER_STATUS[m.status] ? m.status : 'unknown'
  const conf = WATER_STATUS[status]
  const StatusIcon = STATUS_ICON[status]
  const trend = TREND[m.trend] || TREND.stable
  const signal = signalWord(m.rssi)
  const updated = ago(m.lastDataAt, now)
  const history = m.history || []
  const oldData = m.isStale || m.connected === false

  return (
    <div className="dt">
      <header className="page-head dt-head">
        <div>
          <h1>ข้อมูลละเอียด</h1>
          <p className="dt-head__sub muted">
            สำหรับครูและผู้ดูแลระบบ{m.stationName ? ` · ${m.stationName}` : ''}
          </p>
        </div>
      </header>

      <div className="dt-row dt-row--main">
        <section className="panel dt-sum" data-state={status} aria-labelledby="dt-sum-title">
          <h2 id="dt-sum-title" className="dt-sum__status">
            <StatusIcon aria-hidden="true" />
            <span>{conf.label}</span>
          </h2>

          {has(m.margin) ? (
            <p className="dt-sum__margin">
              {m.margin > 0 ? (
                <>ห่างขีดอันตราย <span className="num">{fmt(m.margin)}</span> ซม.</>
              ) : (
                <>เกินขีดอันตรายแล้ว <span className="num">{fmt(Math.abs(m.margin))}</span> ซม.</>
              )}
            </p>
          ) : (
            <p className="dt-sum__margin dt-sum__margin--none">รอกล่องวัดน้ำส่งค่า</p>
          )}

          <dl className="dt-facts">
            {has(m.distance) && (
              <div>
                <dt>ระยะจากกล่องวัดถึงผิวน้ำ</dt>
                <dd><span className="num">{fmt(m.distance)}</span> ซม.</dd>
              </div>
            )}
            {has(m.waterDepth) && (
              <div>
                <dt>ความลึกน้ำในนา</dt>
                <dd><span className="num">{fmt(m.waterDepth)}</span> ซม.</dd>
              </div>
            )}
            {history.length >= 4 && (
              <div>
                <dt>แนวโน้ม</dt>
                <dd className="dt-trend" data-trend={m.trend || 'stable'}>
                  <trend.Icon aria-hidden="true" />
                  {trend.text}
                </dd>
              </div>
            )}
            {signal && (
              <div>
                <dt>สัญญาณเน็ตที่กล่องวัดน้ำ</dt>
                <dd data-weak={signal === 'อ่อน' || undefined}>{signal}</dd>
              </div>
            )}
            <div>
              <dt>อัปเดตล่าสุด</dt>
              <dd>
                {m.lastDataAt ? (
                  <>{updated} <span className="muted">({clockTime(m.lastDataAt)})</span></>
                ) : 'ยังไม่ได้รับค่า'}
              </dd>
            </div>
          </dl>

          {m.rapidRise && (
            <p className="dt-sum__alert" role="status">
              <TriangleAlert aria-hidden="true" />
              <span>
                น้ำขึ้นเร็วผิดปกติ
                {has(m.riseRate) && <> <span className="num">{fmt(m.riseRate)}</span> ซม./นาที</>}
              </span>
            </p>
          )}

          {oldData && (
            <p className="dt-sum__stale">
              {m.connected === false ? 'ไม่มีเน็ต ตัวเลขนี้อาจไม่ใช่ค่าล่าสุด' : 'กล่องวัดน้ำไม่ได้ส่งค่ามาสักพัก ตัวเลขนี้อาจไม่ใช่ค่าล่าสุด'}
            </p>
          )}
        </section>

        <section className="panel dt-chart" aria-labelledby="dt-chart-title">
          <div className="dt-chart__head">
            <h2 id="dt-chart-title" className="section-title">ห่างขีดอันตรายย้อนหลัง</h2>
            <span className="muted dt-chart__count">{history.length} ค่า</span>
          </div>
          <WaterChart history={history} now={now} />
        </section>
      </div>

      {(salinitySlot || weatherSlot) && (
        <div className="dt-row dt-row--pair">
          {salinitySlot && <div className="dt-slot">{salinitySlot}</div>}
          {weatherSlot && <div className="dt-slot">{weatherSlot}</div>}
        </div>
      )}

      <section className="panel dt-legend" aria-labelledby="dt-legend-title">
        <h2 id="dt-legend-title" className="dt-legend__title">เกณฑ์ระยะจากกล่องวัดถึงผิวน้ำ</h2>
        <dl className="dt-legend__list">
          <div data-state="safe">
            <dt><CircleCheck aria-hidden="true" />ปกติ</dt>
            <dd>มากกว่า <span className="num">{YELLOW_MAX}</span> ซม.</dd>
          </div>
          <div data-state="warning">
            <dt><TriangleAlert aria-hidden="true" />เฝ้าระวัง</dt>
            <dd><span className="num">{RED_MAX}–{YELLOW_MAX}</span> ซม.</dd>
          </div>
          <div data-state="danger">
            <dt><OctagonAlert aria-hidden="true" />อันตราย</dt>
            <dd>ไม่เกิน <span className="num">{RED_MAX}</span> ซม.</dd>
          </div>
        </dl>
        <p className="dt-legend__note muted">ระยะน้อย = น้ำสูง · "ห่างขีดอันตราย" = ระยะที่วัดได้ ลบ {RED_MAX} ซม.</p>
      </section>
    </div>
  )
}
