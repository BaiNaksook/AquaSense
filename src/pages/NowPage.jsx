import { Cloud, CloudFog, CloudLightning, CloudSun, Share2, Square, ChevronRight } from 'lucide-react'
import WaterPan from '../WaterPan'
import SaltMeter from '../SaltMeter'
import { SensorOff, RainOnPan, SunDry, SaltReady, SaltForming, BitterWater, Listen } from '../icons/SaltIcons'
import { PAN_ICON } from '../icons/panIcon'
import { ADVICE_TONE, getDayAdvice } from '../weather'
import { SALINITY_STAGES, salinityForecastText } from '../salinity'
import { WATER_STATUS, ago, clockTime } from '../water'
import { useThaiSpeech } from '../speech'
import { line, numberClips, dayClip, timeClip, CLIP_TEXT } from '../voiceClips'

// "เมื่อสักครู่" มีคำว่าเมื่ออยู่แล้ว ส่วน "5 นาทีก่อน" ต้องเติม
const agoPhrase = (t, now) => {
  const a = ago(t, now)
  return a.startsWith('เมื่อ') ? a : `เมื่อ ${a}`
}

const WEATHER_ICON = { storm: CloudLightning, rain: RainOnPan, fog: CloudFog, cloud: Cloud, partly: CloudSun, sun: SunDry }

// ===== สถานะน้ำที่ผู้ใช้เห็น (รวมกรณีกล่องวัดน้ำเงียบ) =====
// กล่องเงียบตอนน้ำอันตราย = ยังถืออันตราย (ข้อมูลใช้ไม่ได้ก็เป็นเหตุเตือนอย่างหนึ่ง)
function describeWater({ status, connected, isStale, lastStatus, rainComing }) {
  if (isStale) {
    if (lastStatus === 'danger') {
      return { state: 'danger', icon: SensorOff, title: 'กล่องวัดน้ำเงียบไป', todo: 'ครั้งล่าสุดน้ำขึ้นสูง ไปดูที่นาเดี๋ยวนี้' }
    }
    return { state: 'unknown', icon: SensorOff, title: 'กล่องวัดน้ำเงียบไป', todo: 'ไปดูว่าไฟกับเน็ตที่กล่องยังติดอยู่ไหม' }
  }
  if (!connected) {
    return { state: 'unknown', icon: SensorOff, title: 'รอสักครู่', todo: 'กำลังถามกล่องวัดน้ำอยู่' }
  }
  const s = WATER_STATUS[status]
  let todo = s.todo
  if (status === 'danger' && rainComing) todo = 'รีบไขน้ำออก ฝนใกล้มาแล้ว'
  if (status === 'warning' && rainComing) todo = 'ไขน้ำออกบ้าง ก่อนฝนมา'
  return { state: status, icon: PAN_ICON[status], title: s.label, todo }
}

export default function NowPage({
  model, weather, rainComing, salinity, salinityStage, salinityPrediction, todayStr,
  acked, onAck, installCard, now,
}) {
  const speech = useThaiSpeech()
  const p = speech.polite
  const na = p === 'ค่ะ' ? 'คะ' : 'ครับ'
  const { status, connected, isStale, distance, margin, lastDataAt, lastStatus, stationName } = model

  const water = describeWater({ status, connected, isStale, lastStatus, rainComing })
  const HeroIcon = water.icon
  const unacked = water.state === 'danger' && !acked

  // ---- ความเค็ม ----
  const salt = SALINITY_STAGES[salinityStage]
  const SaltIcon = salt.ready ? SaltReady : salinityStage === 'bitter' ? BitterWater : SaltForming
  const saltTitle = salt.ready ? 'เกลือได้ที่แล้ว' : salinityStage === 'bitter' ? 'น้ำขมแล้ว' : 'เกลือยังไม่ได้ที่'
  const saltBe = Math.round(salinity.value)
  const saltForecast = salinityForecastText(salinityStage, salinityPrediction, todayStr)

  // ---- อากาศวันนี้ ----
  const today = weather.today
  const advice = weather.todayAdvice
  const tomorrow = weather.days[1]
  const tomorrowAdvice = tomorrow ? getDayAdvice(tomorrow) : null
  const adviceTone = advice ? ADVICE_TONE[advice.level].color : 'var(--muted)'
  const loud = advice && (advice.level === 'danger' || advice.level === 'warning')
  const TodayIcon = today ? WEATHER_ICON[today.icon] ?? Cloud : Cloud

  // ---- เสียงพูด (ประโยคละ 1 เรื่อง, ใช้เสียงอัดจริงถ้ามี) ----
  const say = []
  if (water.state === 'unknown' && isStale) {
    say.push(line(`กล่องวัดน้ำเงียบไปสักพักแล้ว${p}`, ['w-stale-1']))
    say.push(line(`ลองไปดูปลั๊กไฟกับเน็ตที่กล่องวัดน้ำหน่อยนะ${na}`, ['w-stale-2']))
  } else if (water.state === 'unknown') {
    say.push(line(`กำลังต่อกับกล่องวัดน้ำ รอสักครู่นะ${na}`, ['w-wait']))
  } else if (water.state === 'danger') {
    say.push(line(`ตอนนี้น้ำในนาสูงมาก${p}`, ['w-danger']))
    say.push(rainComing
      ? line(`แล้วฝนก็กำลังจะมา รีบปล่อยน้ำออกเลย${p}`, ['w-danger-rain'])
      : line(`รีบปล่อยน้ำออกเลย${p}`, ['w-danger-drain']))
  } else if (water.state === 'warning') {
    say.push(line(`น้ำในนาเริ่มสูงขึ้นแล้ว${p}`, ['w-warning']))
    say.push(rainComing
      ? line(`ถ้าพร่องน้ำออกก่อนฝนตกได้จะดี${p}`, ['w-warning-rain'])
      : line(`คอยดูระดับน้ำไว้หน่อยนะ${na}`, ['w-warning-watch']))
  } else {
    say.push(line(`ตอนนี้ระดับน้ำปกติดี${p}`, ['w-safe']))
  }
  if (connected && margin !== null && margin > 0 && status !== 'safe') {
    say.push(line(`อีกประมาณ ${Math.round(margin)} เซน น้ำจะถึงขีดอันตราย${p}`, ['w-margin-pre', ...numberClips(margin), 'u-cm', 'w-margin-post']))
  }
  const beClips = numberClips(saltBe)
  if (salinityStage === 'ready') {
    say.push(line(`ความเค็มตอนนี้ ${saltBe} ดีกรี กำลังพอดี เก็บเกลือได้แล้ว${p}`, ['s-now', ...beClips, 'u-degree', 's-ready-post']))
  } else if (salinityStage === 'high') {
    say.push(line(`ความเค็มขึ้นไปถึง ${saltBe} ดีกรี ควรรีบเก็บเกลือ${p}`, ['s-high-pre', ...beClips, 'u-degree', 's-high-post']))
  } else if (salinityStage === 'bitter') {
    say.push(line(`ความเค็มสูงเกินไปแล้ว${p} น้ำเริ่มขม ปล่อยน้ำขมทิ้งได้เลย${p}`, ['s-bitter']))
  } else {
    say.push(line(`ความเค็มตอนนี้ ${saltBe} ดีกรี ยังไม่พร้อมเก็บ${p}`, ['s-now', ...beClips, 'u-degree', 's-notready-post']))
    const ready = salinityPrediction?.readyDay
    if (ready) {
      const day = dayClip(ready.date, todayStr)
      say.push(line(`น่าจะพร้อมเก็บ${CLIP_TEXT[day]}${p}`, ['s-ready-when', day, 'p-krub']))
    }
  }
  if (advice && today) {
    if (loud) {
      say.push(line(`วันนี้มีโอกาสฝนตก ${today.rainProb} เปอร์เซ็นต์${p}`, ['r-today-pre', ...numberClips(today.rainProb), 'u-percent', 'p-krub']))
      if (weather.nextRain) {
        const t = timeClip(weather.nextRain.time)
        say.push(line(`ฝนน่าจะเริ่มราว${CLIP_TEXT[t]}`, ['r-start', t]))
      }
      say.push(line(`รื้อเกลือขึ้นกอง แล้วคลุมผ้าใบไว้ก่อน${p}`, ['r-cover']))
    } else if (advice.level === 'good') {
      say.push(line(`วันนี้แดดดี เหมาะกับการตากเกลือ${p}`, ['r-good']))
    } else {
      say.push(line(`วันนี้อากาศปกติ ฝนไม่น่าตก${p}`, ['r-normal']))
    }
  }
  if (tomorrowAdvice && (tomorrowAdvice.level === 'danger' || tomorrowAdvice.level === 'warning')) {
    say.push(line(`ส่วนพรุ่งนี้ก็อาจมีฝนด้วย${p}`, ['r-tomorrow']))
  }

  // ---- ส่งสถานะให้ลูกหลานทาง LINE ----
  const share = async () => {
    const when = lastDataAt ? clockTime(lastDataAt) : ''
    const parts = [
      `${stationName} ${when}${isStale ? ' (ค่าเก่า)' : ''}`,
      `${water.title} — ${water.todo}`,
      margin !== null && !isStale ? (margin > 0 ? `อีก ${margin} ซม. ถึงขีดอันตราย` : 'น้ำเกินขีดอันตรายแล้ว') : null,
      `เกลือ: ${saltTitle} (${saltBe} ดีกรี)`,
      advice ? `อากาศวันนี้: ${advice.title}` : null,
      window.location.origin,
    ].filter(Boolean)
    const text = parts.join('\n')
    try {
      if (navigator.share) { await navigator.share({ text }); return }
    } catch { return }
    window.open(`https://line.me/R/share?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  const marginBlock = distance === null ? null : margin <= 0
    ? <p className="hero__margin"><strong>น้ำเกินขีดอันตรายแล้ว</strong></p>
    : (
      <p className="hero__margin">
        อีก <span className="num">{margin}</span> เซน น้ำจะถึงขีดอันตราย
      </p>
    )

  return (
    <div className="now">
      {/* 1. น้ำในนาตอนนี้ */}
      <section
        className={`panel hero${unacked ? ' is-unacked' : ''}`}
        data-state={water.state}
        role={water.state === 'danger' ? 'alert' : undefined}
        aria-live="polite"
      >
        <div className="hero__head">
          <HeroIcon className="hero__icon" />
          <div>
            <h2 className="hero__title">{water.title}</h2>
            <p className="hero__todo">{water.todo}</p>
          </div>
        </div>

        <WaterPan distance={distance} status={status} stale={isStale} onDark={water.state === 'danger'} />
        {marginBlock}
        {isStale && distance !== null && <p className="hero__stale">ตัวเลขนี้เป็นของเก่า ไม่ใช่ตอนนี้</p>}
        <p className="hero__meta">
          {lastDataAt ? `ข้อมูล${agoPhrase(lastDataAt, now)} (${clockTime(lastDataAt)})` : 'ยังไม่ได้ค่าจากกล่องวัดน้ำ'}
        </p>

        {unacked && (
          <button type="button" className="btn btn-block" onClick={onAck}>
            รู้แล้ว กำลังไปไขน้ำ
          </button>
        )}
        <div className="hero__actions">
          {speech.supported && (
            <button type="button" className="btn" aria-pressed={speech.speaking} onClick={() => (speech.speaking ? speech.stop() : speech.speak(say))}>
              {speech.speaking ? <Square className="w-5 h-5" aria-hidden="true" /> : <Listen className="w-6 h-6" />}
              {speech.speaking ? 'หยุดอ่าน' : 'อ่านให้ฟัง'}
            </button>
          )}
          <button type="button" className="btn" onClick={share}>
            <Share2 className="w-5 h-5" aria-hidden="true" />
            ส่งให้ลูกหลาน
          </button>
        </div>
      </section>

      {/* 2. อากาศวันนี้ = สิ่งที่ต้องทำวันนี้ */}
      <section className="panel today" data-level={advice?.level} style={{ '--tone': loud ? adviceTone : 'var(--fg)' }}>
        <div className="today__head">
          <TodayIcon className="w-10 h-10" aria-hidden="true" />
          <div>
            <p className="today__label">ฟ้าฝนวันนี้ แถว {weather.place.name}{today ? ` · ฝน ${today.rainProb}%` : ''}</p>
            <h2 className="today__title">{advice ? advice.title : weather.loading ? 'กำลังโหลด…' : 'ยังไม่มีข้อมูลอากาศ'}</h2>
          </div>
        </div>
        {advice && <p className="today__text">{advice.advice}</p>}
        {weather.nextRain && <p className="today__text today__next">ฝนน่าจะมาราว {weather.nextRain.time} น.</p>}
        {tomorrowAdvice && (
          <p className="today__foot">พรุ่งนี้: {tomorrowAdvice.title} · ฝน {tomorrow.rainProb}%</p>
        )}
      </section>

      {/* 3. เกลือพร้อมเก็บหรือยัง */}
      <section className="panel saltnow" style={{ '--tone': salt.ready || salinityStage === 'bitter' ? salt.color : 'var(--fg)' }}>
        <div className="saltnow__row">
          <SaltIcon />
          <div>
            <p className="today__label">เกลือได้ที่หรือยัง</p>
            <h2 className="saltnow__title">{saltTitle}</h2>
          </div>
          <span className="saltnow__value num">{saltBe}<small>ดีกรี</small></span>
        </div>
        <SaltMeter value={salinity.value} compact />
        <p className="saltnow__text">{salt.advice}</p>
        {saltForecast && <p className="saltnow__text">{saltForecast}</p>}
        {salinity.simulated && <p className="saltnow__demo">ความเค็มนี้เป็นตัวเลขตัวอย่าง ยังไม่ได้วัดจริง</p>}
      </section>

      {installCard}

      <div className="now__more">
        <a className="btn btn-quiet" href="#/week">ดูล่วงหน้า 7 วัน วันไหนรื้อเกลือได้ <ChevronRight className="w-5 h-5" aria-hidden="true" /></a>
        <a className="btn btn-quiet" href="#/detail">ข้อมูลละเอียด (สำหรับครู) <ChevronRight className="w-5 h-5" aria-hidden="true" /></a>
      </div>
    </div>
  )
}
