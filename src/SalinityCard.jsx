import { CalendarClock } from 'lucide-react'
import { SALINITY_STAGES, salinityForecastText } from './salinity'
import { SaltReady, SaltForming, BitterWater, Hydrometer } from './icons/SaltIcons'
import { farmerWords } from './harvest'
import SaltMeter from './SaltMeter'
import './styles/forecast.css'

const STAGE_ICONS = {
  low: Hydrometer,
  rising: SaltForming,
  ready: SaltReady,
  high: SaltReady,
  bitter: BitterWater,
}

// มีสีเฉพาะช่วงที่ต้องลงมือ: พร้อมเก็บ (ชมพูนาเกลือ) · ควรเร่งเก็บ/น้ำขม (อำพัน)
const STAGE_TONE = { low: 'neutral', rising: 'neutral', ready: 'accent', high: 'warning', bitter: 'warning' }

export default function SalinityCard({ salinity, stageKey, prediction, todayStr }) {
  if (!salinity || salinity.value === null || salinity.value === undefined) {
    return (
      <section className="panel sc" aria-labelledby="sc-title">
        <h2 id="sc-title" className="section-title">ความเค็มในนาปลง</h2>
        <p className="sc-text muted">ยังไม่มีค่าความเค็ม</p>
      </section>
    )
  }

  const stage = SALINITY_STAGES[stageKey] ?? SALINITY_STAGES.low
  const StageIcon = STAGE_ICONS[stageKey] ?? Hydrometer
  const forecast = salinityForecastText(stageKey, prediction, todayStr)

  return (
    <section className="panel sc" data-tone={STAGE_TONE[stageKey] ?? 'neutral'} aria-labelledby="sc-title">
      <h2 id="sc-title" className="section-title">ความเค็มในนาปลง</h2>

      <div className="sc-main">
        <p className="sc-value">
          <span className="num">{salinity.value.toFixed(1)}</span>
          <span className="sc-value__unit">ดีกรี</span>
        </p>
        <p className="sc-stage">
          <StageIcon className="sc-stage__icon" aria-hidden="true" />
          {stage.label}
        </p>
      </div>

      <p className="sc-text">{farmerWords(stage.advice)}</p>

      <SaltMeter value={salinity.value} />

      {forecast && (
        <p className="sc-forecast">
          <CalendarClock className="sc-forecast__icon" aria-hidden="true" />
          <span>{forecast}</span>
        </p>
      )}

      {salinity.simulated && (
        <p className="sc-demo muted">ค่าตัวอย่าง ยังไม่ได้วัดจริง</p>
      )}
    </section>
  )
}
