import { Sun, CloudSun, Cloud, CloudFog, CloudRain, CloudLightning, HelpCircle } from 'lucide-react'
import { getDayAdvice } from '../weather'
import { RainOnPan, SunDry, CoverPile, SaltReady, BitterWater } from '../icons/SaltIcons'
import { buildHarvestCalendar, harvestSummary, rainWord, dayName, VERDICTS } from '../harvest'
import SalinityCard from '../SalinityCard'
import WeatherPanel from '../WeatherPanel'
import '../styles/forecast.css'

const WEATHER_ICONS = { storm: CloudLightning, rain: CloudRain, fog: CloudFog, cloud: Cloud, partly: CloudSun, sun: Sun }

const VERDICT_ICONS = {
  harvest: SaltReady,
  sunny: SunDry,
  afterRain: RainOnPan,
  cover: CoverPile,
  watch: RainOnPan,
  dry: SunDry,
  bitter: BitterWater,
  unknown: HelpCircle,
}

function clock(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function CalendarRow({ row, todayStr }) {
  const { day, be, verdict } = row
  const v = VERDICTS[verdict]
  const WxIcon = WEATHER_ICONS[day.icon] ?? Cloud
  const VIcon = VERDICT_ICONS[verdict] ?? HelpCircle
  const name = dayName(day.date, todayStr)
  const rainProb = Math.round(day.rainProb ?? 0)
  return (
    <li className="wk-row" data-tone={v.tone}>
      <span className="wk-row__day">{name}</span>
      <span className="wk-row__wx">
        <WxIcon className="wk-row__wxicon" aria-hidden="true" />
        <span>
          {rainWord(rainProb)} <span className="num">{rainProb}%</span>
          <span className="wk-row__wxtext">{day.tmdText ?? day.text}</span>
        </span>
      </span>
      <span className="wk-row__be">
        {be === null ? <span className="muted">–</span> : <><span className="num">{be.toFixed(1)}</span> ดีกรี</>}
      </span>
      <span className="wk-row__verdict">
        <VIcon className="wk-row__vicon" aria-hidden="true" />
        {v.word}
      </span>
    </li>
  )
}

export default function WeekPage({ weather, salinity, salinityStage, salinityPrediction, todayStr }) {
  const rows = buildHarvestCalendar(weather?.days, salinityPrediction, getDayAdvice, { simulated: !!salinity?.simulated })
  // นอกฤดูทำเกลือ ไม่ควรบอก "วันรื้อเกลือที่ดีที่สุด"
  const summary = weather?.seasonNote ? { text: weather.seasonNote, tone: 'neutral' } : harvestSummary(rows, todayStr)
  const time = clock(weather?.fetchedAt)

  return (
    <div className="wk">
      <section className="panel wk-summary" data-tone={summary.tone} aria-live="polite">
        <p className="wk-summary__label">วันไหนรื้อเกลือได้</p>
        <p className="wk-summary__text">{summary.text}</p>
      </section>

      <section className="panel wk-cal" aria-labelledby="wk-cal-title">
        <h2 id="wk-cal-title" className="section-title">ปฏิทินรื้อเกลือ 7 วัน</h2>
        {rows.length ? (
          <>
            <div className="wk-cal__head" aria-hidden="true">
              <span>วัน</span><span>ฝน</span><span>ความเค็ม</span><span>ควรทำ</span>
            </div>
            <ol className="wk-cal__list">
              {rows.map((row) => <CalendarRow key={row.date} row={row} todayStr={todayStr} />)}
            </ol>
          </>
        ) : (
          <p className="muted wk-cal__empty">
            {weather?.loading ? 'กำลังโหลดพยากรณ์อากาศ…' : 'ยังไม่มีพยากรณ์อากาศ ต่อเน็ตแล้วกดอัปเดต'}
          </p>
        )}
        <p className="wk-cal__note muted">ความเค็มล่วงหน้าคำนวณจากแดดและฝน เป็นค่าคร่าวๆ ควรวัดด้วยกล่องวัดน้ำก่อนรื้อเกลือ</p>
      </section>

      <div className="wk-detail">
        <SalinityCard salinity={salinity} stageKey={salinityStage} prediction={salinityPrediction} todayStr={todayStr} />
        <WeatherPanel weather={weather} />
      </div>

      <p className="wk-foot muted">
        {time ? `ข้อมูลอากาศเมื่อ ${time} น.` : 'ยังไม่มีข้อมูลอากาศ'}
        {weather?.source ? ` · ${weather.source}` : ''}
        {salinity?.simulated ? ' · ความเค็มเป็นค่าตัวอย่าง' : ''}
      </p>
    </div>
  )
}
