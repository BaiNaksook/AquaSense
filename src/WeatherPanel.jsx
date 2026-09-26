import { Sun, CloudSun, Cloud, CloudFog, CloudRain, CloudLightning, RefreshCw, WifiOff, Umbrella } from 'lucide-react'
import { ADVICE_TONE } from './weather'
import { rainWord, dryingWord, windWord, humidityWord, farmerWords } from './harvest'
import './styles/forecast.css'

const WEATHER_ICONS = { storm: CloudLightning, rain: CloudRain, fog: CloudFog, cloud: Cloud, partly: CloudSun, sun: Sun }

function Fact({ label, word, value }) {
  return (
    <div className="wx-fact">
      <dt>{label}</dt>
      <dd>
        <span className="wx-fact__word">{word ?? 'ไม่ทราบ'}</span>
        {value && <span className="wx-fact__value num">{value}</span>}
      </dd>
    </div>
  )
}

function RefreshButton({ loading, onClick, label = 'อัปเดต' }) {
  return (
    <button type="button" className="btn btn-quiet wx-refresh" onClick={onClick} disabled={loading}>
      <RefreshCw className={`wx-refresh__icon${loading ? ' is-spinning' : ''}`} aria-hidden="true" />
      {loading ? 'กำลังโหลด…' : label}
    </button>
  )
}

export default function WeatherPanel({ weather }) {
  const { today, todayAdvice, nextRain, seasonNote, loading, error, reload } = weather ?? {}

  if (!today) {
    return (
      <section className="panel wx" aria-labelledby="wx-title">
        <div className="wx-head">
          <h2 id="wx-title" className="section-title">อากาศวันนี้</h2>
          <RefreshButton loading={loading} onClick={reload} label="ลองใหม่" />
        </div>
        {loading ? (
          <p className="wx-text muted">กำลังโหลดพยากรณ์อากาศ…</p>
        ) : (
          <div className="wx-offline">
            <WifiOff className="wx-offline__icon" aria-hidden="true" />
            <p className="wx-text">โหลดพยากรณ์อากาศไม่ได้ ตรวจดูเน็ตแล้วกด "ลองใหม่"</p>
          </div>
        )}
      </section>
    )
  }

  const level = todayAdvice?.level ?? 'normal'
  const alert = level === 'danger' || level === 'warning'
  const ToneIcon = ADVICE_TONE[level]?.icon ?? Cloud
  const WxIcon = WEATHER_ICONS[today.icon] ?? Cloud
  const rainProb = Math.round(today.rainProb ?? 0)
  const wind = Math.round(Math.max(today.windMax ?? 0, today.gustMax ?? 0))

  return (
    <section className="panel wx" data-level={alert ? level : undefined} aria-labelledby="wx-title">
      <div className="wx-head">
        <h2 id="wx-title" className="section-title">อากาศวันนี้</h2>
        <RefreshButton loading={loading} onClick={reload} />
      </div>

      {error && (
        <p className="wx-stale">
          <WifiOff className="wx-stale__icon" aria-hidden="true" />
          ไม่มีเน็ต กำลังแสดงข้อมูลล่าสุดที่เคยโหลดไว้
        </p>
      )}

      <div className="wx-advice" role={level === 'danger' ? 'alert' : undefined}>
        {alert && <ToneIcon className="wx-advice__icon" aria-hidden="true" />}
        <div>
          <p className="wx-advice__title">{todayAdvice?.title}</p>
          <p className="wx-text">{farmerWords(todayAdvice?.advice)}</p>
        </div>
      </div>

      {nextRain && (
        <p className="wx-next">
          <Umbrella className="wx-next__icon" aria-hidden="true" />
          <span>ฝนอาจเริ่มราว <strong className="num">{nextRain.time}</strong> น. คลุมกองเกลือก่อนเวลานั้น</span>
        </p>
      )}

      <p className="wx-sky">
        <WxIcon className="wx-sky__icon" aria-hidden="true" />
        <span>{today.tmdText ?? today.text} · ร้อน <span className="num">{Math.round(today.tMin)}–{Math.round(today.tMax)}</span> องศา</span>
      </p>

      <dl className="wx-facts">
        <Fact label="ฝน" word={rainWord(rainProb)} value={`${rainProb}%`} />
        <Fact label="แดด" word={dryingWord(today.et0)} />
        <Fact label="ลม" word={windWord(wind)} value={`${wind} กม./ชม.`} />
        <Fact label="อากาศชื้น" word={humidityWord(today.humidity)} value={today.humidity !== null && today.humidity !== undefined ? `${today.humidity}%` : null} />
      </dl>

      {seasonNote && <p className="wx-season muted">{seasonNote}</p>}
    </section>
  )
}
