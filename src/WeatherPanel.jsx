import { CloudRain, CloudSun, Cloud, CloudLightning, CloudFog, Sun, Wind, Droplets, Thermometer, RefreshCw, Umbrella, CalendarDays } from 'lucide-react'
import { getDayAdvice, ADVICE_TONE } from './weather'

const WEATHER_ICONS = { storm: CloudLightning, rain: CloudRain, fog: CloudFog, cloud: Cloud, partly: CloudSun, sun: Sun }

const DAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

function dayLabel(dateStr, index) {
  if (index === 0) return 'วันนี้'
  if (index === 1) return 'พรุ่งนี้'
  const d = new Date(`${dateStr}T00:00:00`)
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()}`
}

function Stat({ icon: Icon, label, value, unit, note }) {
  return (
    <div className="weather-stat">
      <span className="weather-stat__label"><Icon className="w-4 h-4" aria-hidden="true" />{label}</span>
      <span className="weather-stat__value">{value ?? '--'}<small>{unit}</small></span>
      {note && <span className="weather-stat__note">{note}</span>}
    </div>
  )
}

export default function WeatherPanel({ weather }) {
  const { days, today, todayAdvice, nextRain, seasonNote, fetchedAt, source, loading, error, reload } = weather

  if (!today) {
    return (
      <section className="rounded-lg border bg-white p-4 sm:p-6" aria-labelledby="weather-title">
        <h3 id="weather-title" className="text-base font-bold text-gray-900 mb-2">พยากรณ์อากาศสำหรับนาเกลือ</h3>
        <p className="text-sm text-gray-500">
          {loading ? 'กำลังโหลดพยากรณ์อากาศ…' : 'โหลดพยากรณ์อากาศไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'}
        </p>
        {!loading && (
          <button type="button" onClick={reload} className="weather-refresh mt-3">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />ลองใหม่
          </button>
        )}
      </section>
    )
  }

  const tone = ADVICE_TONE[todayAdvice.level]
  const ToneIcon = tone.icon
  const TodayIcon = WEATHER_ICONS[today.icon] ?? Cloud
  const updated = fetchedAt
    ? new Date(fetchedAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '-'

  return (
    <section className="rounded-lg border bg-white p-4 sm:p-6" aria-labelledby="weather-title">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 id="weather-title" className="text-base font-bold text-gray-900">พยากรณ์อากาศสำหรับนาเกลือ</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            <TodayIcon className="w-4 h-4 inline -mt-0.5 mr-1" aria-hidden="true" />
            วันนี้ {today.tmdText ?? today.text} · {Math.round(today.tMin)}–{Math.round(today.tMax)}°C
          </p>
        </div>
        <button type="button" onClick={reload} disabled={loading} className="weather-refresh" aria-label="โหลดพยากรณ์ใหม่">
          <RefreshCw className={`w-4 h-4${loading ? ' animate-spin' : ''}`} aria-hidden="true" />
          <span className="hidden sm:inline">อัปเดต</span>
        </button>
      </div>

      {/* คำแนะนำวันนี้ — สิ่งแรกที่ต้องเห็น */}
      <div className="weather-advice" style={{ '--tone': tone.color }} role={todayAdvice.level === 'danger' ? 'alert' : undefined}>
        <ToneIcon className="w-7 h-7 flex-shrink-0" aria-hidden="true" />
        <div>
          <p className="weather-advice__title">{todayAdvice.title}</p>
          <p className="weather-advice__text">{todayAdvice.advice}</p>
          {nextRain && (
            <p className="weather-advice__text mt-1 font-semibold">
              <Umbrella className="w-4 h-4 inline -mt-0.5 mr-1" aria-hidden="true" />
              คาดว่าฝนอาจเริ่มราว {nextRain.time} น. (โอกาส {nextRain.prob}%) ควรเก็บและคลุมกองเกลือก่อน
            </p>
          )}
        </div>
      </div>

      {seasonNote && (
        <p className="text-sm text-gray-500 mt-3 flex gap-2">
          <CalendarDays className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />{seasonNote}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4">
        <Stat icon={CloudRain} label="โอกาสฝน" value={today.rainProb} unit="%" note={`${today.rainMm.toFixed(1)} มม.`} />
        <Stat icon={Sun} label="การระเหย" value={today.et0?.toFixed(1)} unit=" มม." note={today.et0 >= 4.5 ? 'ระเหยดี' : today.et0 >= 3 ? 'ปานกลาง' : 'ระเหยช้า'} />
        <Stat icon={Wind} label="ลมสูงสุด" value={Math.round(today.windMax)} unit=" กม./ชม." note={today.windMax >= 40 ? 'ลมแรง' : today.windMax >= 10 ? 'ลมดี' : 'ลมอ่อน'} />
        <Stat icon={Droplets} label="ความชื้น" value={today.humidity} unit="%" note={<><Thermometer className="w-3.5 h-3.5 inline -mt-0.5" aria-hidden="true" /> สูงสุด {Math.round(today.tMax)}°C</>} />
      </div>

      {/* พยากรณ์ 7 วัน — วางแผนรื้อเกลือ */}
      <h4 className="text-sm font-bold text-gray-900 mt-5 mb-2">7 วันข้างหน้า</h4>
      <ul className="weather-days" aria-label="พยากรณ์ 7 วัน">
        {days.map((day, i) => {
          const advice = getDayAdvice(day)
          const t = ADVICE_TONE[advice.level]
          const Icon = WEATHER_ICONS[day.icon] ?? Cloud
          return (
            <li key={day.date} className="weather-day" style={{ '--tone': t.color }}>
              <span className="weather-day__name">{dayLabel(day.date, i)}</span>
              <Icon className="w-6 h-6" aria-hidden="true" />
              <span className="weather-day__rain">
                <span className="weather-day__bar"><span style={{ width: `${day.rainProb}%` }} /></span>
                ฝน {day.rainProb}%
              </span>
              <span className="weather-day__tag">{advice.title}</span>
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-gray-500 mt-4">
        ข้อมูลเมื่อ {updated} · ที่มา {source}
        {error && <span style={{ color: 'var(--warning)' }}> · ออฟไลน์ แสดงข้อมูลล่าสุดที่บันทึกไว้</span>}
      </p>
    </section>
  )
}
