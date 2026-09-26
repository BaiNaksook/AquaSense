import { useEffect, useState } from 'react'
import { Volume2, Square, ChevronRight, WifiOff, CloudRain, Sun, Cloud, CloudLightning, CloudSun, CloudFog, Umbrella } from 'lucide-react'
import { ADVICE_TONE, getDayAdvice } from './weather'

const WEATHER_ICONS = { storm: CloudLightning, rain: CloudRain, fog: CloudFog, cloud: Cloud, partly: CloudSun, sun: Sun }

// เสียงอ่านภาษาไทย — ช่วยคนที่อ่านตัวหนังสือบนจอไม่ถนัด หรือสายตาไม่ดีกลางแดด
function useThaiSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel() }, [supported])

  const speak = (text) => {
    if (!supported) return
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'th-TH'
    u.rate = 0.9
    const thai = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('th'))
    if (thai) u.voice = thai
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    synth.speak(u)
  }
  const stop = () => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }
  return { supported, speaking, speak, stop }
}

// หน้าแรกแบบง่าย: ตอบแค่ 3 คำถาม — น้ำเป็นยังไง / ต้องทำอะไร / วันนี้ฝนจะตกไหม
export default function SimpleHome({ status, config, connected, isStale, distance, redMax, lastUpdated, weather, rainComing, onShowDetail }) {
  const speech = useThaiSpeech()

  let title
  let todo
  if (!connected) {
    title = isStale ? 'เซ็นเซอร์ไม่ส่งข้อมูล' : 'กำลังรอข้อมูล'
    todo = isStale ? 'ให้ตรวจไฟและ WiFi ที่กล่องเซ็นเซอร์' : 'รอสักครู่ ระบบกำลังเชื่อมต่อเซ็นเซอร์'
  } else if (status === 'danger') {
    title = 'น้ำสูง อันตราย'
    todo = rainComing ? 'ระบายน้ำออกทันที ฝนกำลังจะมา' : 'ระบายน้ำออกทันที'
  } else if (status === 'warning') {
    title = 'น้ำเริ่มสูง'
    todo = rainComing ? 'พร่องน้ำออกบางส่วน ก่อนฝนตก' : 'คอยดูระดับน้ำใกล้ๆ'
  } else {
    title = 'น้ำปกติ'
    todo = 'ทำงานได้ตามปกติ'
  }

  // บอกเป็น "เหลืออีกกี่ ซม. ถึงขีดอันตราย" เข้าใจง่ายกว่าระยะจากเซ็นเซอร์
  const margin = distance === null ? null : Math.round((distance - redMax) * 10) / 10
  const marginText = !connected || margin === null
    ? null
    : margin <= 0
      ? 'น้ำเกินขีดอันตรายแล้ว'
      : `อีก ${margin} ซม. น้ำจะถึงขีดอันตราย`

  const today = weather.today
  const advice = weather.todayAdvice
  const tomorrow = weather.days[1]
  const tomorrowAdvice = tomorrow ? getDayAdvice(tomorrow) : null
  const tone = advice ? ADVICE_TONE[advice.level] : null
  const TodayIcon = today ? WEATHER_ICONS[today.icon] ?? Cloud : Cloud
  const StatusIcon = connected ? config.icon : WifiOff

  const spoken = [
    title, todo, marginText,
    advice ? `วันนี้ ${advice.title} ${advice.advice}` : null,
    weather.nextRain ? `ฝนอาจเริ่มราว ${weather.nextRain.time.replace(':', ' นาฬิกา ')} นาที` : null,
    tomorrowAdvice ? `พรุ่งนี้ ${tomorrowAdvice.title}` : null,
  ].filter(Boolean).join(' . ')

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
          onClick={() => (speech.speaking ? speech.stop() : speech.speak(spoken))}
          aria-pressed={speech.speaking}
        >
          {speech.speaking ? <Square className="w-6 h-6" aria-hidden="true" /> : <Volume2 className="w-6 h-6" aria-hidden="true" />}
          {speech.speaking ? 'หยุดอ่าน' : 'กดฟังเสียง'}
        </button>
      )}

      {/* 3. อากาศวันนี้ */}
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
        ดูข้อมูลละเอียด (กราฟ · พยากรณ์ 7 วัน)
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  )
}
