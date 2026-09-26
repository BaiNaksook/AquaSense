import { Volume2, Square, ChevronRight, WifiOff, CloudRain, Sun, Cloud, CloudLightning, CloudSun, CloudFog, Umbrella, Beaker, CheckCircle2, AlertTriangle } from 'lucide-react'
import { ADVICE_TONE, getDayAdvice } from './weather'
import { SALINITY_STAGES, salinityForecastText, formatDay } from './salinity'
import { useThaiSpeech, spokenTime } from './speech'

const WEATHER_ICONS = { storm: CloudLightning, rain: CloudRain, fog: CloudFog, cloud: Cloud, partly: CloudSun, sun: Sun }

// หน้าแรกแบบง่าย: ตอบแค่ 4 คำถาม — น้ำเป็นยังไง / ต้องทำอะไร / เกลือพร้อมเก็บหรือยัง / วันนี้ฝนจะตกไหม
export default function SimpleHome({
  status, config, connected, isStale, distance, redMax, lastUpdated, weather, rainComing,
  salinity, salinityStage, salinityPrediction, todayStr, onShowDetail,
}) {
  const speech = useThaiSpeech()
  const p = speech.polite

  let title
  let todo
  let say
  if (!connected) {
    title = isStale ? 'เซ็นเซอร์ไม่ส่งข้อมูล' : 'กำลังรอข้อมูล'
    todo = isStale ? 'ให้ตรวจไฟและ WiFi ที่กล่องเซ็นเซอร์' : 'รอสักครู่ ระบบกำลังเชื่อมต่อเซ็นเซอร์'
    say = isStale
      ? [`ตอนนี้เซ็นเซอร์ไม่ส่งข้อมูลมาสักพักแล้ว${p}`, `ลองไปดูไฟกับไวไฟที่กล่องเซ็นเซอร์หน่อยนะ${p === 'ค่ะ' ? 'คะ' : 'ครับ'}`]
      : [`ระบบกำลังเชื่อมต่อเซ็นเซอร์ รอสักครู่นะ${p === 'ค่ะ' ? 'คะ' : 'ครับ'}`]
  } else if (status === 'danger') {
    title = 'น้ำสูง อันตราย'
    todo = rainComing ? 'ระบายน้ำออกทันที ฝนกำลังจะมา' : 'ระบายน้ำออกทันที'
    say = [`ตอนนี้น้ำในแปลงสูงมาก${p}`, rainComing ? `แล้วฝนก็กำลังจะมา ควรรีบระบายน้ำออกเลย${p}` : `ควรรีบระบายน้ำออกเลย${p}`]
  } else if (status === 'warning') {
    title = 'น้ำเริ่มสูง'
    todo = rainComing ? 'พร่องน้ำออกบางส่วน ก่อนฝนตก' : 'คอยดูระดับน้ำใกล้ๆ'
    say = [`น้ำในแปลงเริ่มสูงขึ้นแล้ว${p}`, rainComing ? `ถ้าพร่องน้ำออกก่อนฝนตกได้จะดี${p}` : `คอยดูระดับน้ำไว้หน่อยนะ${p === 'ค่ะ' ? 'คะ' : 'ครับ'}`]
  } else {
    title = 'น้ำปกติ'
    todo = 'ทำงานได้ตามปกติ'
    say = [`ตอนนี้ระดับน้ำปกติดี${p}`]
  }

  // บอกเป็น "เหลืออีกกี่ ซม. ถึงขีดอันตราย" เข้าใจง่ายกว่าระยะจากเซ็นเซอร์
  const margin = distance === null ? null : Math.round((distance - redMax) * 10) / 10
  const marginText = !connected || margin === null
    ? null
    : margin <= 0
      ? 'น้ำเกินขีดอันตรายแล้ว'
      : `อีก ${margin} ซม. น้ำจะถึงขีดอันตราย`
  if (connected && margin !== null && margin > 0 && status !== 'safe') {
    say.push(`อีกประมาณ ${Math.round(margin)} เซน น้ำจะถึงขีดอันตราย${p}`)
  }

  // ความเค็ม
  const salt = SALINITY_STAGES[salinityStage]
  const SaltIcon = salt.ready ? CheckCircle2 : salinityStage === 'bitter' ? AlertTriangle : Beaker
  const saltForecast = salinityForecastText(salinityStage, salinityPrediction, todayStr)
  const saltBe = Math.round(salinity.value)
  if (salinityStage === 'ready') say.push(`ความเค็มตอนนี้ ${saltBe} ดีกรี กำลังพอดี เก็บเกลือได้แล้ว${p}`)
  else if (salinityStage === 'high') say.push(`ความเค็มขึ้นไปถึง ${saltBe} ดีกรีแล้ว ควรรีบเก็บเกลือ${p}`)
  else if (salinityStage === 'bitter') say.push(`ความเค็มสูงเกินไปแล้ว${p} น้ำเริ่มขม ควรระบายน้ำขมออก${p}`)
  else {
    const ready = salinityPrediction?.readyDay
    say.push(`ความเค็มตอนนี้ ${saltBe} ดีกรี ยังไม่พร้อมเก็บ${p}`)
    if (ready) say.push(`น่าจะพร้อมเก็บ${formatDay(ready.date, todayStr)}${p}`)
  }

  // อากาศ
  const today = weather.today
  const advice = weather.todayAdvice
  const tomorrow = weather.days[1]
  const tomorrowAdvice = tomorrow ? getDayAdvice(tomorrow) : null
  const tone = advice ? ADVICE_TONE[advice.level] : null
  const TodayIcon = today ? WEATHER_ICONS[today.icon] ?? Cloud : Cloud
  const StatusIcon = connected ? config.icon : WifiOff
  if (advice && today) {
    if (advice.level === 'danger' || advice.level === 'warning') {
      say.push(`วันนี้มีโอกาสฝนตก ${today.rainProb} เปอร์เซ็นต์${p}`)
      if (weather.nextRain) say.push(`ฝนน่าจะเริ่มราว${spokenTime(weather.nextRain.time)}`)
      say.push(`ควรเก็บเกลือขึ้นกอง แล้วคลุมผ้าใบไว้ก่อน${p}`)
    } else if (advice.level === 'good') {
      say.push(`วันนี้แดดดี เหมาะกับการตากเกลือ${p}`)
    } else {
      say.push(`วันนี้อากาศปกติ ฝนไม่น่าตก${p}`)
    }
  }
  if (tomorrow && tomorrowAdvice && (tomorrowAdvice.level === 'danger' || tomorrowAdvice.level === 'warning')) {
    say.push(`ส่วนพรุ่งนี้ก็อาจมีฝนด้วย${p}`)
  }

  return (
    <div className="simple-home">
      {/* 1. น้ำตอนนี้ + ต้องทำอะไร */}
      <section
        className={`simple-status${connected && status === 'danger' ? ' is-alert' : ''}`}
        style={{ '--tone': connected ? config.color : 'var(--muted)' }}
        role={connected && status === 'danger' ? 'alert' : undefined}
        aria-live="polite"
      >
        <StatusIcon className="simple-status__icon" aria-hidden="true" />
        <p className="simple-status__title">{title}</p>
        <p className="simple-status__todo">{todo}</p>
        {marginText && <p className="simple-status__margin">{marginText}</p>}
        <p className="simple-status__meta">
          {connected ? `ระยะน้ำ ${distance} ซม. · อัปเดต ${lastUpdated}` : lastUpdated ? `ข้อมูลล่าสุด ${lastUpdated}` : ''}
        </p>
      </section>

      {/* 2. ฟังเสียง */}
      {speech.supported && (
        <button
          type="button"
          className="simple-speak"
          onClick={() => (speech.speaking ? speech.stop() : speech.speak(say))}
          aria-pressed={speech.speaking}
        >
          {speech.speaking ? <Square className="w-6 h-6" aria-hidden="true" /> : <Volume2 className="w-6 h-6" aria-hidden="true" />}
          {speech.speaking ? 'หยุดพูด' : 'กดฟังเสียง'}
        </button>
      )}

      {/* 3. เกลือพร้อมเก็บหรือยัง */}
      <section className="simple-salt" style={{ '--tone': salt.color }}>
        <div className="simple-salt__head">
          <SaltIcon className="w-9 h-9 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="simple-weather__label">เกลือพร้อมเก็บหรือยัง</p>
            <p className="simple-salt__title">{salt.ready ? 'พร้อมเก็บ' : salinityStage === 'bitter' ? 'น้ำขม ระบายออก' : 'ยังไม่พร้อม'}</p>
          </div>
          <span className="simple-weather__rain">{salinity.value.toFixed(1)} °Bé</span>
        </div>
        <p className="simple-weather__text">{salt.advice}</p>
        {saltForecast && <p className="simple-weather__text simple-weather__next">{saltForecast}</p>}
        {salinity.simulated && <p className="simple-salt__demo">ความเค็มเป็นข้อมูลจำลอง (ยังไม่มีเซนเซอร์)</p>}
      </section>

      {/* 4. อากาศวันนี้ */}
      <section className="simple-weather" style={{ '--tone': tone?.color ?? 'var(--muted)' }}>
        <div className="simple-weather__head">
          <TodayIcon className="w-9 h-9 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="simple-weather__label">อากาศวันนี้</p>
            <p className="simple-weather__title">
              {advice ? advice.title : weather.loading ? 'กำลังโหลด…' : 'ยังไม่มีข้อมูลอากาศ'}
            </p>
          </div>
          {today && <span className="simple-weather__rain">ฝน {today.rainProb}%</span>}
        </div>
        {advice && <p className="simple-weather__text">{advice.advice}</p>}
        {weather.nextRain && (
          <p className="simple-weather__text simple-weather__next">
            <Umbrella className="w-5 h-5 inline -mt-1 mr-1" aria-hidden="true" />
            ฝนอาจเริ่มราว {weather.nextRain.time} น.
          </p>
        )}
        {tomorrowAdvice && (
          <p className="simple-weather__tomorrow">
            พรุ่งนี้: <strong style={{ color: ADVICE_TONE[tomorrowAdvice.level].color }}>{tomorrowAdvice.title}</strong> · ฝน {tomorrow.rainProb}%
          </p>
        )}
      </section>

      <button type="button" className="simple-more" onClick={onShowDetail}>
        ดูข้อมูลละเอียด (กราฟ · ความเค็ม · พยากรณ์ 7 วัน)
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  )
}
