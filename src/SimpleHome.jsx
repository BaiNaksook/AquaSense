import { Volume2, Square, ChevronRight, WifiOff, CloudRain, Sun, Cloud, CloudLightning, CloudSun, CloudFog, Umbrella, Beaker, CheckCircle2, AlertTriangle } from 'lucide-react'
import { ADVICE_TONE, getDayAdvice } from './weather'
import { SALINITY_STAGES, salinityForecastText } from './salinity'
import { useThaiSpeech } from './speech'
import { line, numberClips, dayClip, timeClip, CLIP_TEXT } from './voiceClips'

const WEATHER_ICONS = { storm: CloudLightning, rain: CloudRain, fog: CloudFog, cloud: Cloud, partly: CloudSun, sun: Sun }

// หน้าแรกแบบง่าย: ตอบแค่ 4 คำถาม — น้ำเป็นยังไง / ต้องทำอะไร / เกลือพร้อมเก็บหรือยัง / วันนี้ฝนจะตกไหม
export default function SimpleHome({
  status, config, connected, isStale, distance, redMax, lastUpdated, weather, rainComing,
  salinity, salinityStage, salinityPrediction, todayStr, onShowDetail,
}) {
  const speech = useThaiSpeech()
  const p = speech.polite
  const na = p === 'ค่ะ' ? 'คะ' : 'ครับ'

  let title
  let todo
  let say
  if (!connected) {
    title = isStale ? 'เซ็นเซอร์ไม่ส่งข้อมูล' : 'กำลังรอข้อมูล'
    todo = isStale ? 'ให้ตรวจไฟและ WiFi ที่กล่องเซ็นเซอร์' : 'รอสักครู่ ระบบกำลังเชื่อมต่อเซ็นเซอร์'
    say = isStale
      ? [
          line(`ตอนนี้เซ็นเซอร์ไม่ส่งข้อมูลมาสักพักแล้ว${p}`, ['w-stale-1']),
          line(`ลองไปดูไฟกับไวไฟที่กล่องเซ็นเซอร์หน่อยนะ${na}`, ['w-stale-2']),
        ]
      : [line(`ระบบกำลังเชื่อมต่อเซ็นเซอร์ รอสักครู่นะ${na}`, ['w-wait'])]
  } else if (status === 'danger') {
    title = 'น้ำสูง อันตราย'
    todo = rainComing ? 'ระบายน้ำออกทันที ฝนกำลังจะมา' : 'ระบายน้ำออกทันที'
    say = [
      line(`ตอนนี้น้ำในแปลงสูงมาก${p}`, ['w-danger']),
      rainComing
        ? line(`แล้วฝนก็กำลังจะมา ควรรีบระบายน้ำออกเลย${p}`, ['w-danger-rain'])
        : line(`ควรรีบระบายน้ำออกเลย${p}`, ['w-danger-drain']),
    ]
  } else if (status === 'warning') {
    title = 'น้ำเริ่มสูง'
    todo = rainComing ? 'พร่องน้ำออกบางส่วน ก่อนฝนตก' : 'คอยดูระดับน้ำใกล้ๆ'
    say = [
      line(`น้ำในแปลงเริ่มสูงขึ้นแล้ว${p}`, ['w-warning']),
      rainComing
        ? line(`ถ้าพร่องน้ำออกก่อนฝนตกได้จะดี${p}`, ['w-warning-rain'])
        : line(`คอยดูระดับน้ำไว้หน่อยนะ${na}`, ['w-warning-watch']),
    ]
  } else {
    title = 'น้ำปกติ'
    todo = 'ทำงานได้ตามปกติ'
    say = [line(`ตอนนี้ระดับน้ำปกติดี${p}`, ['w-safe'])]
  }

  // บอกเป็น "เหลืออีกกี่ ซม. ถึงขีดอันตราย" เข้าใจง่ายกว่าระยะจากเซ็นเซอร์
  const margin = distance === null ? null : Math.round((distance - redMax) * 10) / 10
  const marginText = !connected || margin === null
    ? null
    : margin <= 0
      ? 'น้ำเกินขีดอันตรายแล้ว'
      : `อีก ${margin} ซม. น้ำจะถึงขีดอันตราย`
  if (connected && margin !== null && margin > 0 && status !== 'safe') {
    say.push(line(
      `อีกประมาณ ${Math.round(margin)} เซน น้ำจะถึงขีดอันตราย${p}`,
      ['w-margin-pre', ...numberClips(margin), 'u-cm', 'w-margin-post'],
    ))
  }

  // ความเค็ม
  const salt = SALINITY_STAGES[salinityStage]
  const SaltIcon = salt.ready ? CheckCircle2 : salinityStage === 'bitter' ? AlertTriangle : Beaker
  const saltForecast = salinityForecastText(salinityStage, salinityPrediction, todayStr)
  const saltBe = Math.round(salinity.value)
  const beClips = numberClips(saltBe)
  if (salinityStage === 'ready') {
    say.push(line(`ความเค็มตอนนี้ ${saltBe} ดีกรี กำลังพอดี เก็บเกลือได้แล้ว${p}`, ['s-now', ...beClips, 'u-degree', 's-ready-post']))
  } else if (salinityStage === 'high') {
    say.push(line(`ความเค็มขึ้นไปถึง ${saltBe} ดีกรี ควรรีบเก็บเกลือ${p}`, ['s-high-pre', ...beClips, 'u-degree', 's-high-post']))
  } else if (salinityStage === 'bitter') {
    say.push(line(`ความเค็มสูงเกินไปแล้ว${p} น้ำเริ่มขม ควรระบายน้ำขมออก${p}`, ['s-bitter']))
  } else {
    const ready = salinityPrediction?.readyDay
    say.push(line(`ความเค็มตอนนี้ ${saltBe} ดีกรี ยังไม่พร้อมเก็บ${p}`, ['s-now', ...beClips, 'u-degree', 's-notready-post']))
    if (ready) {
      const day = dayClip(ready.date, todayStr)
      say.push(line(`น่าจะพร้อมเก็บ${CLIP_TEXT[day]}${p}`, ['s-ready-when', day, 'p-krub']))
    }
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
      say.push(line(`วันนี้มีโอกาสฝนตก ${today.rainProb} เปอร์เซ็นต์${p}`, ['r-today-pre', ...numberClips(today.rainProb), 'u-percent', 'p-krub']))
      if (weather.nextRain) {
        const t = timeClip(weather.nextRain.time)
        say.push(line(`ฝนน่าจะเริ่มราว${CLIP_TEXT[t]}`, ['r-start', t]))
      }
      say.push(line(`ควรเก็บเกลือขึ้นกอง แล้วคลุมผ้าใบไว้ก่อน${p}`, ['r-cover']))
    } else if (advice.level === 'good') {
      say.push(line(`วันนี้แดดดี เหมาะกับการตากเกลือ${p}`, ['r-good']))
    } else {
      say.push(line(`วันนี้อากาศปกติ ฝนไม่น่าตก${p}`, ['r-normal']))
    }
  }
  if (tomorrow && tomorrowAdvice && (tomorrowAdvice.level === 'danger' || tomorrowAdvice.level === 'warning')) {
    say.push(line(`ส่วนพรุ่งนี้ก็อาจมีฝนด้วย${p}`, ['r-tomorrow']))
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
