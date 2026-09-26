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
  // กล่องเงียบ = หน้าตาคนละแบบกับ "น้ำสูง" (พื้นเทาเข้ม ขอบลายเหลือง) ไม่ให้เข้าใจผิดว่าน้ำล้น
  if (isStale) {
    if (lastStatus === 'danger') {
      return { state: 'stale', icon: SensorOff, title: 'กล่องวัดน้ำเงียบ', todo: 'ครั้งล่าสุดน้ำในนาสูงเกินขีด ไปดูที่นาเองเลย' }
    }
    return { state: 'stale', icon: SensorOff, title: 'กล่องวัดน้ำเงียบ', todo: 'ไปดูว่าไฟกับเน็ตที่กล่องยังติดอยู่ไหม' }
  }
  if (!connected) {
    return { state: 'unknown', icon: SensorOff, title: 'รอสักครู่', todo: 'กำลังถามกล่องวัดน้ำอยู่' }
  }
  const s = WATER_STATUS[status]
  let todo = s.todo
  if (status === 'danger' && rainComing) todo = 'รีบปล่อยน้ำออก ฝนใกล้มาแล้ว'
  if (status === 'warning' && rainComing) todo = 'ปล่อยน้ำออกหน่อย ก่อนฝนมา'
  return { state: status, icon: PAN_ICON[status], title: s.label, todo }
}

export default function NowPage({
  model, weather, rainComing, salinity, salinityStage, salinityPrediction, todayStr,
  acked, onAck, installCard, placeCard, soundOn, now,
}) {
  const speech = useThaiSpeech()
  const p = speech.polite
  const na = p === 'ค่ะ' ? 'คะ' : 'ครับ'
  const { status, connected, isStale, distance, margin, lastDataAt, lastStatus, stationName } = model

  const water = describeWater({ status, connected, isStale, lastStatus, rainComing })
  const HeroIcon = water.icon
  // เตือนจนกว่าจะกดรับรู้: น้ำสูงจริง หรือกล่องเงียบตอนที่ค่าล่าสุดน้ำสูง
  const alarming = water.state === 'danger' || (water.state === 'stale' && lastStatus === 'danger')
  const unacked = alarming && !acked

  // ---- ความเค็ม ----
  const salt = SALINITY_STAGES[salinityStage]
  const SaltIcon = salt.ready ? SaltReady : salinityStage === 'bitter' ? BitterWater : SaltForming
  const saltTitle = salt.ready ? 'ได้ดีกรีแล้ว รื้อได้' : salinityStage === 'bitter' ? 'น้ำขมแล้ว' : 'ยังไม่ได้ดีกรี'
  const saltBe = Math.round(salinity.value)
  const marginCm = margin === null ? null : Math.round(Math.abs(margin))
  const saltForecast = salinityForecastText(salinityStage, salinityPrediction, todayStr)

  // ---- อากาศวันนี้ ----
  const today = weather.today
  const advice = weather.todayAdvice
  const tomorrow = weather.days[1]
  const tomorrowAdvice = tomorrow ? getDayAdvice(tomorrow) : null
  const adviceTone = advice ? ADVICE_TONE[advice.level].color : 'var(--muted)'
  const loud = advice && (advice.level === 'danger' || advice.level === 'warning')
  const TodayIcon = today ? WEATHER_ICON[today.icon] ?? Cloud : Cloud

  // ---- เสียงพูด: เรื่องที่ต้องรีบทำขึ้นก่อน (ใช้เสียงอัดจริงถ้ามี) ----
  const waterSay = []
  if (water.state === 'stale') {
    if (lastStatus === 'danger') waterSay.push(line(`ครั้งล่าสุดน้ำในนาสูงเกินขีด ไปดูที่นาเองเลย${p}`, ['w-stale-danger']))
    waterSay.push(line(`กล่องวัดน้ำเงียบไปสักพักแล้ว${p}`, ['w-stale-1']))
    waterSay.push(line(`ลองไปดูปลั๊กไฟกับเน็ตที่กล่องวัดน้ำหน่อยนะ${na}`, ['w-stale-2']))
  } else if (water.state === 'unknown') {
    waterSay.push(line(`กำลังต่อกับกล่องวัดน้ำ รอสักครู่นะ${na}`, ['w-wait']))
  } else if (water.state === 'danger') {
    waterSay.push(line(`ตอนนี้น้ำในนาสูงเกินขีดแล้ว${p}`, ['w-danger']))
    waterSay.push(rainComing
      ? line(`แล้วฝนก็กำลังจะมา รีบปล่อยน้ำออกเลย${p}`, ['w-danger-rain'])
      : line(`รีบปล่อยน้ำออกเลย${p}`, ['w-danger-drain']))
  } else {
    waterSay.push(water.state === 'warning'
      ? line(`น้ำในนาเริ่มสูงขึ้นแล้ว${p}`, ['w-warning'])
      : line(`ตอนนี้ระดับน้ำปกติดี${p}`, ['w-safe']))
    if (margin !== null && margin > 0) {
      waterSay.push(line(`น้ำยังต่ำกว่าขีดอันตรายอีก ${marginCm} เซน${p}`, ['w-margin-pre', ...numberClips(marginCm), 'u-cm', 'w-margin-post']))
    }
    if (water.state === 'warning') {
      waterSay.push(rainComing
        ? line(`ปล่อยน้ำออกหน่อยก่อนฝนมา${p}`, ['w-warning-rain'])
        : line(`คอยดูระดับน้ำไว้หน่อยนะ${na}`, ['w-warning-watch']))
    }
  }

  const rainSay = []
  if (advice && today) {
    if (loud) {
      rainSay.push(line(`วันนี้ฝนน่าจะตก${p}`, ['r-today-pre']))
      if (weather.nextRain) {
        const t = timeClip(weather.nextRain.time)
        rainSay.push(line(`ฝนน่าจะเริ่มราว${CLIP_TEXT[t]}`, ['r-start', t]))
      }
      rainSay.push(line(`ถ้าเกลือได้เม็ดแล้ว รื้อขึ้นกองคลุมผ้าใบไว้ก่อน${p}`, ['r-cover']))
    } else if (advice.level === 'good') {
      rainSay.push(line(`วันนี้แดดดี เกลือขึ้นดี${p}`, ['r-good']))
    } else {
      rainSay.push(line(`วันนี้อากาศปกติ ฝนไม่น่าตก${p}`, ['r-normal']))
    }
  }

  const saltSay = []
  const beClips = numberClips(saltBe)
  if (salinityStage === 'ready') {
    saltSay.push(line(`ดีกรีน้ำตอนนี้ ${saltBe} ดีกรี ได้ดีกรีแล้ว รื้อเกลือได้${p}`, ['s-now', ...beClips, 'u-degree', 's-ready-post']))
  } else if (salinityStage === 'high') {
    saltSay.push(line(`ความเค็มขึ้นไปถึง ${saltBe} ดีกรี ควรรีบเก็บเกลือ${p}`, ['s-high-pre', ...beClips, 'u-degree', 's-high-post']))
  } else if (salinityStage === 'bitter') {
    saltSay.push(line(`ความเค็มสูงเกินไปแล้ว${p} น้ำเริ่มขม ปล่อยน้ำขมทิ้งได้เลย${p}`, ['s-bitter']))
  } else {
    saltSay.push(line(`ดีกรีน้ำตอนนี้ ${saltBe} ดีกรี ยังไม่ได้ดีกรี${p}`, ['s-now', ...beClips, 'u-degree', 's-notready-post']))
    const ready = salinityPrediction?.readyDay
    if (ready) {
      const day = dayClip(ready.date, todayStr)
      saltSay.push(line(`น่าจะได้ดีกรี${CLIP_TEXT[day]}${p}`, ['s-ready-when', day, 'p-krub']))
    }
  }
  const tomorrowSay = tomorrowAdvice && (tomorrowAdvice.level === 'danger' || tomorrowAdvice.level === 'warning')
    ? [line(`ส่วนพรุ่งนี้ก็อาจมีฝนด้วย${p}`, ['r-tomorrow'])]
    : []
  const urgentWater = water.state === 'danger' || water.state === 'stale'
  const say = urgentWater || !loud
    ? [...waterSay, ...rainSay, ...saltSay, ...tomorrowSay]
    : [...rainSay, ...waterSay, ...saltSay, ...tomorrowSay]

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

  // ตัวเลขเต็ม ไม่มีทศนิยม และบอกทิศชัดๆ (ต่ำกว่า / เกิน) — "อีก 9.7" ทำให้คนแก่เข้าใจกลับด้าน
  const marginBlock = distance === null ? null : margin > 0
    ? <p className="hero__margin">น้ำยังต่ำกว่าขีดอันตราย <span className="nowrap"><span className="num">{marginCm}</span> ซม.</span></p>
    : <p className="hero__margin">น้ำเกินขีดอันตรายมาแล้ว <span className="nowrap"><span className="num">{marginCm}</span> ซม.</span></p>

  const silentFor = water.state === 'stale' && lastDataAt ? Math.max(1, Math.round((now - lastDataAt) / 60000)) : null

  return (
    <div className="now">
      {placeCard}
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

        {unacked && (
          <button type="button" className="btn btn-block hero__ack" onClick={onAck}>
            {water.state === 'stale' ? 'รู้แล้ว กำลังไปดูที่นา' : 'รู้แล้ว กำลังไปปล่อยน้ำ'}
          </button>
        )}
        {speech.supported && (
          <button type="button" className="btn btn-primary btn-block hero__listen" aria-pressed={speech.speaking} onClick={() => (speech.speaking ? speech.stop() : speech.speak(say))}>
            {speech.speaking ? <Square className="w-6 h-6" aria-hidden="true" /> : <Listen className="w-8 h-8" />}
            {speech.speaking ? 'หยุดอ่าน' : 'อ่านให้ฟัง'}
          </button>
        )}

        {water.state === 'stale' && (
          <p className="hero__stale">ไม่ได้ค่ามา {silentFor} นาทีแล้ว · ตัวเลขข้างล่างเป็นของเก่า</p>
        )}
        <WaterPan distance={distance} status={status} stale={isStale} onDark={water.state === 'danger' || water.state === 'stale'} />
        {marginBlock}
        <p className="hero__meta">
          {lastDataAt
            ? water.state === 'stale'
              ? `ค่าล่าสุดเมื่อ ${clockTime(lastDataAt)}`
              : `ข้อมูล${agoPhrase(lastDataAt, now)} (${clockTime(lastDataAt)})`
            : 'ยังไม่ได้ค่าจากกล่องวัดน้ำ'}
        </p>
      </section>

      {!soundOn && (
        <p className="now__note">เสียงเตือนปิดอยู่ · <a href="#/settings">เปิดที่ ตั้งค่า</a></p>
      )}

      {/* 2. อากาศวันนี้ = สิ่งที่ต้องทำวันนี้ */}
      <section className="panel today" data-level={advice?.level} style={{ '--tone': loud ? adviceTone : 'var(--fg)' }}>
        <div className="today__head">
          <TodayIcon className="w-10 h-10" aria-hidden="true" />
          <div>
            <p className="today__label">ฟ้าฝนวันนี้ แถว {weather.place.name}</p>
            <h2 className="today__title">{advice ? advice.title : weather.loading ? 'กำลังโหลด…' : 'ยังไม่มีข้อมูลอากาศ'}</h2>
          </div>
        </div>
        {advice && <p className="today__text">{advice.advice}</p>}
        {weather.nextRain && <p className="today__text today__next">ฝนน่าจะมาราว {weather.nextRain.time} น.</p>}
        {tomorrowAdvice && (
          <p className="today__foot">พรุ่งนี้: {tomorrowAdvice.title}</p>
        )}
      </section>

      {/* 3. เกลือพร้อมเก็บหรือยัง */}
      <section className="panel saltnow" style={{ '--tone': salt.ready || salinityStage === 'bitter' ? salt.color : 'var(--fg)' }}>
        <div className="saltnow__row">
          <SaltIcon />
          <div>
            <p className="today__label">ดีกรีน้ำในนาปลง</p>
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
        <a className="btn btn-block" href="#/week">ดูล่วงหน้า 7 วัน วันไหนรื้อเกลือได้ <ChevronRight className="w-5 h-5" aria-hidden="true" /></a>
        {/* แยกปุ่มส่งให้ลูกหลานไว้ห่างจาก "อ่านให้ฟัง" กันนิ้วกดพลาด */}
        <button type="button" className="btn btn-block" onClick={share}>
          <Share2 className="w-5 h-5" aria-hidden="true" />
          ส่งสถานะให้ลูกหลานทางไลน์
        </button>
        <a className="btn btn-quiet" href="#/detail">ดูตัวเลขละเอียด <ChevronRight className="w-5 h-5" aria-hidden="true" /></a>
      </div>
    </div>
  )
}
