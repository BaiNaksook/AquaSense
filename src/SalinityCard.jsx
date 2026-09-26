import { Beaker, CheckCircle2, CloudRain, CalendarClock, AlertTriangle } from 'lucide-react'
import { SALINITY_STAGES, BE_CONCENTRATING, BE_READY_MIN, BE_HIGH, BE_BITTER, BE_SCALE_MAX, formatDay, salinityForecastText } from './salinity'

// แถบสเกล 0–32 °Bé แบ่งช่วงสี ให้เห็นทันทีว่าค่าอยู่ช่วงไหน
function SalinityScale({ value }) {
  const pct = (v) => `${(v / BE_SCALE_MAX) * 100}%`
  const bands = [
    { from: 0, to: BE_CONCENTRATING, color: 'var(--border-strong)' },
    { from: BE_CONCENTRATING, to: BE_READY_MIN, color: 'color-mix(in srgb, var(--primary) 55%, transparent)' },
    { from: BE_READY_MIN, to: BE_HIGH, color: 'var(--safe)' },
    { from: BE_HIGH, to: BE_BITTER, color: 'var(--warning)' },
    { from: BE_BITTER, to: BE_SCALE_MAX, color: 'var(--danger)' },
  ]
  return (
    <div className="salt-scale" aria-hidden="true">
      <div className="salt-scale__track">
        {bands.map((b) => (
          <span key={b.from} style={{ left: pct(b.from), width: pct(b.to - b.from), background: b.color }} />
        ))}
        <i className="salt-scale__marker" style={{ left: pct(Math.min(value, BE_SCALE_MAX)) }} />
      </div>
      <div className="salt-scale__labels">
        <span style={{ left: pct(BE_CONCENTRATING) }}>{BE_CONCENTRATING}</span>
        <span style={{ left: pct(BE_READY_MIN) }}>{BE_READY_MIN}</span>
        <span style={{ left: pct(BE_BITTER) }}>{BE_BITTER}</span>
      </div>
    </div>
  )
}

export default function SalinityCard({ salinity, stageKey, prediction, todayStr }) {
  if (!salinity) {
    return (
      <section className="rounded-lg border bg-white p-4 sm:p-6">
        <h3 className="text-base font-bold text-gray-900">ความเข้มข้นน้ำเกลือ</h3>
        <p className="text-sm text-gray-500 mt-2">รอข้อมูลความเค็ม…</p>
      </section>
    )
  }
  const stage = SALINITY_STAGES[stageKey]
  const StageIcon = stage.ready ? CheckCircle2 : stageKey === 'bitter' ? AlertTriangle : Beaker
  const forecast = salinityForecastText(stageKey, prediction, todayStr)

  return (
    <section className="rounded-lg border bg-white p-4 sm:p-6" style={{ '--tone': stage.color }} aria-labelledby="salt-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="salt-title" className="text-base font-bold text-gray-900">ความเข้มข้นน้ำเกลือ (นาปลง)</h3>
          <p className="text-sm text-gray-500 mt-0.5">วัดเป็นองศาโบเม่ (°Bé) · เกลือตกผลึกดีที่ 25–27 °Bé</p>
        </div>
        {salinity.simulated && <span className="salt-demo-badge">ข้อมูลจำลอง</span>}
      </div>

      <div className="salt-main">
        <div className="salt-value">
          <span className="salt-value__num">{salinity.value.toFixed(1)}</span>
          <span className="salt-value__unit">°Bé</span>
        </div>
        <div className="salt-stage">
          <p className="salt-stage__label"><StageIcon className="w-5 h-5" aria-hidden="true" />{stage.label}</p>
          <p className="salt-stage__advice">{stage.advice}</p>
        </div>
      </div>

      <SalinityScale value={salinity.value} />

      {forecast && (
        <p className="salt-forecast">
          <CalendarClock className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span>{forecast}</span>
        </p>
      )}

      {prediction && (
        <ul className="salt-days" aria-label="พยากรณ์ความเค็ม 7 วัน">
          {prediction.series.map((d) => (
            <li key={d.date} className={d.be >= BE_READY_MIN && d.be < BE_BITTER ? 'is-ready' : d.be >= BE_BITTER ? 'is-bitter' : ''}>
              <span className="salt-days__name">{formatDay(d.date, todayStr)}</span>
              <span className="salt-days__be">{d.be.toFixed(1)}</span>
              {d.rainy && <CloudRain className="w-4 h-4" aria-label="มีฝน" />}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-500 mt-3">
        พยากรณ์คำนวณจากการระเหยและฝนในพยากรณ์อากาศ (ค่าโดยประมาณ){salinity.simulated ? ' · ยังไม่มีเซนเซอร์ความเค็ม ค่าปัจจุบันเป็นข้อมูลจำลอง' : ''}
      </p>
    </section>
  )
}
