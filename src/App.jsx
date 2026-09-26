import { useState, useEffect, useRef, useCallback } from 'react'
import mqtt from 'mqtt'
import { supabase } from './supabase'
import NowPage from './pages/NowPage'
import WeekPage from './pages/WeekPage'
import HistoryPage from './pages/HistoryPage'
import DetailPage from './pages/DetailPage'
import SettingsPage from './pages/SettingsPage'
import WeatherPanel from './WeatherPanel'
import SalinityCard from './SalinityCard'
import { TabNow, TabWeek, TabHistory, TabSettings, SensorOn, SensorOff } from './icons/SaltIcons'
import { BarChart3 } from 'lucide-react'
import { getSalinityStage, predictSalinity, simulateSalinity } from './salinity'
import { useWeather } from './weather'
import { RED_MAX, getWaterStatus, marginToDanger } from './water'
import { DEFAULT_PLACE, isValidPlace } from './places'

// ===== MQTT Config =====
// ตั้งค่าผ่าน .env (VITE_MQTT_*) — ค่า fallback คือบัญชีเดิม ควรเปลี่ยนเป็นบัญชีที่ subscribe ได้อย่างเดียว
// เพราะทุกอย่างที่อยู่ในเว็บฝั่งเบราว์เซอร์ ผู้ใช้เปิดดูได้เสมอ
const env = import.meta.env
const MQTT_URL = env.VITE_MQTT_URL || 'wss://c9f0c2cef8584042836e827c368c3c54.s1.eu.hivemq.cloud:8884/mqtt'
const MQTT_USERNAME = env.VITE_MQTT_USERNAME || 'Data-Dashbord'
const MQTT_PASSWORD = env.VITE_MQTT_PASSWORD || 'PsR12345678'
const MQTT_TOPIC = env.VITE_MQTT_TOPIC || 'aquasense/sensor/distance'
const STATION_NAME = env.VITE_STATION_NAME || 'นาเกลือ แปลงที่ 1'
const VERSION = '2.0.0'

// ESP32 ส่งค่าทุก 2 วิ — เงียบเกิน 20 วิ ถือว่ากล่องวัดน้ำขาดการติดต่อ
const STALE_MS = 20000
// กราฟเก็บค่าในหน่วยความจำ — 180 ค่า ≈ 6 นาทีล่าสุด
const HISTORY_MAX = 180
// กด "รับทราบ" แล้วเงียบเสียงกี่นาที ก่อนเตือนซ้ำถ้าน้ำยังอันตราย
const ACK_SILENCE_MS = 10 * 60 * 1000
// เสียงเตือนตอนยังไม่รับทราบ ดังถี่พอให้ได้ยินกลางนา
const ALARM_REPEAT_MS = 4000

// localStorage อาจใช้ไม่ได้ (โหมดส่วนตัว / ถูกบล็อก) — ห้ามทำให้หน้าเว็บพัง
function storageGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}
function storageRemove(key) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}
function storageJSON(key, fallback) {
  try { return JSON.parse(storageGet(key) ?? 'null') ?? fallback } catch { return fallback }
}

// ===== เสียงเตือน =====
function useAlertSound() {
  const ctxRef = useRef(null)
  return useCallback((type) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      if (!ctxRef.current) {
        // เบราว์เซอร์ไม่ให้เปิดเสียงก่อนผู้ใช้แตะจอครั้งแรก
        if (!navigator.userActivation?.hasBeenActive) return
        ctxRef.current = new AudioCtx()
      }
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') {
        if (navigator.userActivation?.isActive) void ctx.resume().catch(() => {})
        if (ctx.state !== 'running') return
      }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime
      if (type === 'danger') {
        // โทนสลับสูง-ต่ำ ให้เข้าคู่กับ buzzer ฝั่ง ESP32
        osc.frequency.setValueAtTime(880, t)
        osc.frequency.setValueAtTime(660, t + 0.12)
        osc.frequency.setValueAtTime(880, t + 0.24)
        gain.gain.setValueAtTime(0.25, t)
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4)
        osc.start(t)
        osc.stop(t + 0.4)
      } else {
        // เสียงเดียวสั้นๆ ตอนเข้าสถานะเฝ้าระวัง
        osc.frequency.setValueAtTime(440, t)
        gain.gain.setValueAtTime(0.1, t)
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2)
        osc.start(t)
        osc.stop(t + 0.2)
      }
    } catch { /* เสียงเป็นส่วนเสริม ห้ามทำให้หน้าเว็บพัง */ }
  }, [])
}

// ===== หน้าเว็บผูกกับ URL (#/week) — ปุ่มย้อนกลับของมือถือใช้ได้ และแชร์ลิงก์หน้าได้ =====
const PAGES = ['now', 'week', 'history', 'detail', 'settings']
function readRoute() {
  const page = window.location.hash.replace(/^#\/?/, '')
  return PAGES.includes(page) ? page : 'now'
}
function useHashRoute() {
  const [page, setPage] = useState(readRoute)
  useEffect(() => {
    const onHash = () => { setPage(readRoute()); window.scrollTo?.(0, 0) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return page
}

const NAV = [
  { id: 'now', label: 'ตอนนี้', icon: TabNow },
  { id: 'week', label: '7 วัน', icon: TabWeek },
  { id: 'history', label: 'ประวัติ', icon: TabHistory },
  { id: 'detail', label: 'ข้อมูลละเอียด', icon: BarChart3, desktopOnly: true },
  { id: 'settings', label: 'ตั้งค่า', icon: TabSettings },
]
// หน้า history / detail มีหัวเรื่องของตัวเอง
const TITLES = { week: 'ฟ้าฝนและวันเก็บเกลือ', settings: 'ตั้งค่า' }

// ===== ชวนติดตั้งแอปไว้หน้าจอ (ไม่ใช่ป๊อปอัป — การ์ดในหน้า กดปิดได้ 7 วัน) =====
function InstallCard({ installPrompt, onInstalled }) {
  const [hidden, setHidden] = useState(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone
    return standalone || Date.now() < (Number(storageGet('installHiddenUntil')) || 0)
  })
  if (hidden) return null
  const ua = navigator.userAgent
  const inLine = / Line\//i.test(ua)
  const ios = /iPhone|iPad|iPod/i.test(ua)
  const later = () => {
    storageSet('installHiddenUntil', String(Date.now() + 7 * 864e5))
    setHidden(true)
  }
  return (
    <section className="panel install" aria-labelledby="install-title">
      <p id="install-title"><strong>วางแอปไว้หน้าจอมือถือ</strong> กดครั้งเดียวก็เปิดดูน้ำได้เลย</p>
      {inLine ? (
        <ol><li>กด ⋯ มุมขวาบน</li><li>เลือก "เปิดในเบราว์เซอร์"</li><li>แล้วกลับมาที่หน้านี้อีกครั้ง</li></ol>
      ) : installPrompt ? null : ios ? (
        <ol><li>กดปุ่มแชร์ □↑ ด้านล่าง</li><li>เลือก "เพิ่มไปยังหน้าจอโฮม"</li><li>กด "เพิ่ม"</li></ol>
      ) : (
        <ol><li>กด ⋮ มุมขวาบน</li><li>เลือก "เพิ่มลงในหน้าจอหลัก"</li><li>กด "เพิ่ม"</li></ol>
      )}
      <div className="install__row">
        {installPrompt && !inLine && (
          <button type="button" className="btn btn-primary" onClick={() => {
            installPrompt.prompt()
            installPrompt.userChoice.then(onInstalled)
          }}>เพิ่มไว้หน้าจอ</button>
        )}
        <button type="button" className="btn btn-quiet" onClick={later}>ไว้ทีหลัง</button>
      </div>
    </section>
  )
}

// ===== Main App =====
function App() {
  const page = useHashRoute()
  // พื้นที่พยากรณ์อากาศ — เลือกได้ในหน้าตั้งค่า (จำไว้ในเครื่อง)
  const [place, setPlace] = useState(() => {
    const saved = storageJSON('weatherPlace', null)
    return isValidPlace(saved) ? saved : DEFAULT_PLACE
  })
  const changePlace = (p) => {
    setPlace(p)
    storageSet('weatherPlace', JSON.stringify(p))
  }
  const weather = useWeather(place)
  const playSound = useAlertSound()

  // ---- ตั้งค่า (จำไว้ในเครื่อง) ----
  const [theme, setTheme] = useState(() => {
    const saved = storageGet('theme')
    return saved === 'light' || saved === 'dark' ? saved : 'auto'
  })
  const [soundOn, setSoundOn] = useState(() => storageGet('soundOn') !== 'off')

  // ---- ข้อมูลกล่องวัดน้ำ — เปิดแอปตอนไม่มีเน็ตก็ยังเห็นค่าล่าสุด (ติดป้ายค่าเก่า) ----
  const [saved] = useState(() => storageJSON('lastReading', null))
  const [distance, setDistance] = useState(saved?.distance ?? null)
  const [lastDataAt, setLastDataAt] = useState(saved?.t ?? null)
  const [isStale, setIsStale] = useState(() => saved ? Date.now() - saved.t > STALE_MS : false)
  const [waterDepth, setWaterDepth] = useState(null)
  const [riseRate, setRiseRate] = useState(0)
  const [rapidRise, setRapidRise] = useState(false)
  const [rssi, setRssi] = useState(null)
  const [history, setHistory] = useState([])
  const [salinity, setSalinity] = useState(() => ({ value: simulateSalinity(), simulated: true }))
  const [alertLog, setAlertLog] = useState(() => storageJSON('alertLog', []))
  const [ackUntil, setAckUntil] = useState(0)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [online, setOnline] = useState(() => navigator.onLine !== false)
  const [now, setNow] = useState(() => Date.now())

  const lastDataAtRef = useRef(saved?.t ?? null)
  const lastRealSalinityRef = useRef(null)
  const lastDbSaveRef = useRef(null)
  const prevStatusRef = useRef(null)
  const soundOnRef = useRef(soundOn)
  useEffect(() => { soundOnRef.current = soundOn }, [soundOn])

  // ---- สีหน้าจอ: อัตโนมัติตามมือถือ / กลางวัน / กลางคืน ----
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && media?.matches)
      document.documentElement.classList.toggle('dark', !!dark)
    }
    apply()
    if (theme === 'auto') storageRemove('theme')
    else storageSet('theme', theme)
    media?.addEventListener?.('change', apply)
    return () => media?.removeEventListener?.('change', apply)
  }, [theme])

  useEffect(() => { storageSet('soundOn', soundOn ? 'on' : 'off') }, [soundOn])

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallPrompt(e) }
    const onNet = () => setOnline(navigator.onLine !== false)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('online', onNet)
    window.addEventListener('offline', onNet)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('online', onNet)
      window.removeEventListener('offline', onNet)
    }
  }, [])

  // ---- นาฬิกา: ตรวจข้อมูลค้าง + อัปเดตข้อความ "กี่นาทีก่อน" ----
  useEffect(() => {
    const id = setInterval(() => {
      const t = lastDataAtRef.current
      setNow(Date.now())
      if (t !== null) setIsStale(Date.now() - t > STALE_MS)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ---- ความเค็มจำลอง — หยุดเองเมื่อมีค่าจริงจากกล่องวัดภายใน 1 นาที ----
  useEffect(() => {
    const id = setInterval(() => {
      const real = lastRealSalinityRef.current
      if (real !== null && Date.now() - real < 60000) return
      setSalinity({ value: simulateSalinity(), simulated: true })
    }, 10000)
    return () => clearInterval(id)
  }, [])

  // ===== MQTT (อ่านอย่างเดียว) =====
  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      clientId: 'SaltSenseWeb_' + Math.random().toString(16).slice(2, 10),
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 5000,
    })
    client.on('connect', () => client.subscribe(MQTT_TOPIC))

    client.on('message', (_topic, message) => {
      const payload = message.toString().trim()
      const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null)
      const { d, rssi: incomingRssi, water, rise, rapid, salt } = (() => {
        try {
          const obj = JSON.parse(payload)
          if (obj !== null && typeof obj === 'object' && typeof obj.distance === 'number') {
            return {
              d: obj.distance,
              rssi: num(obj.rssi),
              water: num(obj.water),          // ระดับน้ำจริง (ถ้า ESP32 ตั้ง HEIGHT ไว้)
              rise: num(obj.rise),            // อัตราน้ำขึ้น ซม./นาที
              rapid: obj.rapid === 1 || obj.rapid === true,
              salt: num(obj.salinity),        // ความเค็ม °Bé (เมื่อติดเซนเซอร์แล้ว)
            }
          }
        } catch { /* ค่าเป็นตัวเลขล้วน */ }
        return { d: parseFloat(payload), rssi: null, water: null, rise: null, rapid: false, salt: null }
      })()

      if (incomingRssi !== null) setRssi(incomingRssi)
      if (salt !== null && salt >= 0) {
        lastRealSalinityRef.current = Date.now()
        setSalinity({ value: Math.round(salt * 10) / 10, simulated: false })
      }
      if (isNaN(d) || d < 0) return

      // เก็บทศนิยม 1 ตำแหน่ง — เกณฑ์ละเอียดระดับ 0.5 ซม.
      const rounded = Math.round(d * 10) / 10
      const t = Date.now()
      lastDataAtRef.current = t
      setDistance(rounded)
      setLastDataAt(t)
      setIsStale(false)
      setWaterDepth(water === null ? null : Math.round(water * 10) / 10)
      setRiseRate(rise === null ? 0 : Math.round(rise * 10) / 10)
      setRapidRise(rapid)
      setHistory((prev) => [...prev.slice(-(HISTORY_MAX - 1)), { t, v: rounded }])
      storageSet('lastReading', JSON.stringify({ distance: rounded, t }))

      // ---- เปลี่ยนสถานะ: บันทึกประวัติ + สั่น/เสียงสั้นตอนเข้าสถานะใหม่ ----
      const next = getWaterStatus(rounded)
      const prev = prevStatusRef.current
      prevStatusRef.current = next
      if (prev !== null && prev !== next) {
        if (next === 'danger' && soundOnRef.current) navigator.vibrate?.([400, 200, 400])
        if (next === 'warning' && soundOnRef.current) playSound('warning')
        if (next !== 'danger') setAckUntil(0)
        const at = new Date(t)
        const entry = {
          id: t,
          time: at.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          date: at.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
          distance: rounded,
          status: next,
          prevStatus: prev,
        }
        setAlertLog((log) => {
          const updated = [entry, ...log].slice(0, 100)
          storageSet('alertLog', JSON.stringify(updated))
          return updated
        })
        if (supabase) {
          supabase.from('alert_history').insert({ distance: rounded, status: next, prev_status: prev, location: STATION_NAME })
            .then(({ error }) => { if (error) console.warn('Supabase alert insert error:', error.message) })
        }
      }

      // ===== บันทึกลง Supabase (ทุก 10 วิ) =====
      if (supabase && (!lastDbSaveRef.current || t - lastDbSaveRef.current >= 10000)) {
        lastDbSaveRef.current = t
        supabase.from('water_readings').insert({
          distance: rounded,
          status: getWaterStatus(rounded),
          rssi: incomingRssi ?? null,
          location: STATION_NAME,
        }).then(({ error }) => { if (error) console.warn('Supabase insert error:', error.message) })
      }
    })

    return () => client.end()
  }, [playSound])

  // ===== สถานะ =====
  const hasData = distance !== null
  const connected = hasData && !isStale
  const lastStatus = hasData ? getWaterStatus(distance) : 'unknown'
  const status = connected ? lastStatus : 'unknown'
  const margin = marginToDanger(distance)
  // น้ำอันตราย หรือกล่องเงียบไปตอนที่ค่าล่าสุดอันตราย = ยังต้องเตือน
  const dangerNow = lastStatus === 'danger' && (connected || isStale)
  const acked = now < ackUntil

  const weatherLevel = weather.todayAdvice?.level
  const rainComing = weatherLevel === 'danger' || weatherLevel === 'warning' || weather.nextRain !== null
  const salinityStage = getSalinityStage(salinity.value)
  const salinityPrediction = predictSalinity(salinity.value, weather.days)
  const todayStr = weather.days[0]?.date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

  // ---- เสียงเตือนอันตราย: ดังซ้ำจนกว่าจะกด "รับทราบ" แล้วเงียบ 10 นาที ----
  useEffect(() => {
    if (!dangerNow || !soundOn || acked) return
    playSound('danger')
    const id = setInterval(() => playSound('danger'), ALARM_REPEAT_MS)
    return () => clearInterval(id)
  }, [dangerNow, soundOn, acked, playSound])

  // เบราว์เซอร์บล็อกเสียงจนกว่าจะแตะจอครั้งแรก — แตะแล้วเล่นทันทีถ้ากำลังอันตราย
  useEffect(() => {
    const unlock = () => { if (dangerNow && soundOn && !acked) playSound('danger') }
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [dangerNow, soundOn, acked, playSound])

  // ---- แนวโน้มน้ำ (ระยะลด = น้ำขึ้น) ----
  const trend = (() => {
    if (history.length < 4) return 'stable'
    const r = history.slice(-4).map((p) => p.v)
    const diff = (r[2] + r[3]) / 2 - (r[0] + r[1]) / 2
    return diff < -1 ? 'rising' : diff > 1 ? 'falling' : 'stable'
  })()

  // ---- ป้ายความสดของข้อมูลบนแถบบน ----
  const fresh = connected
    ? { tone: 'var(--safe)', icon: SensorOn, text: 'ข้อมูลสด' }
    : isStale
      ? { tone: lastStatus === 'danger' ? 'var(--danger)' : 'var(--warning)', icon: SensorOff, text: 'กล่องวัดน้ำเงียบ' }
      : { tone: 'var(--muted)', icon: SensorOff, text: 'กำลังต่อ…' }
  const FreshIcon = fresh.icon

  const model = {
    status, connected, isStale, distance, margin, lastDataAt, lastStatus, history, rssi,
    riseRate, rapidRise, waterDepth, stationName: STATION_NAME, trend, redMax: RED_MAX,
  }

  let content
  if (page === 'week') {
    content = <WeekPage weather={weather} salinity={salinity} salinityStage={salinityStage} salinityPrediction={salinityPrediction} todayStr={todayStr} />
  } else if (page === 'history') {
    content = <HistoryPage alertLog={alertLog} onClear={() => { setAlertLog([]); storageRemove('alertLog') }} />
  } else if (page === 'detail') {
    content = (
      <DetailPage
        model={model}
        weatherSlot={<WeatherPanel weather={weather} />}
        salinitySlot={<SalinityCard salinity={salinity} stageKey={salinityStage} prediction={salinityPrediction} todayStr={todayStr} />}
      />
    )
  } else if (page === 'settings') {
    content = <SettingsPage theme={theme} onTheme={setTheme} soundOn={soundOn} onSound={setSoundOn} place={place} onPlace={changePlace} stationName={STATION_NAME} version={VERSION} />
  } else {
    content = (
      <NowPage
        model={model}
        weather={weather}
        rainComing={rainComing}
        salinity={salinity}
        salinityStage={salinityStage}
        salinityPrediction={salinityPrediction}
        todayStr={todayStr}
        acked={acked}
        onAck={() => setAckUntil(Date.now() + ACK_SILENCE_MS)}
        now={now}
        installCard={<InstallCard installPrompt={installPrompt} onInstalled={() => setInstallPrompt(null)} />}
      />
    )
  }

  return (
    <div className="shell">
      <aside className="side" aria-label="เมนู">
        <div className="side__brand">
          <img src="/pwa-icon.png" alt="" />
          <div>
            <div className="side__name">SaltSense</div>
            <div className="side__sub">ดูน้ำและความเค็มในนาเกลือ</div>
          </div>
        </div>
        <nav>
          {NAV.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#/${id}`} aria-current={page === id ? 'page' : undefined}>
              <Icon className="w-6 h-6" aria-hidden="true" />{label}
            </a>
          ))}
        </nav>
        <div className="side__foot">PSR · SaltSense © 2026</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar__brand">
            <img src="/pwa-icon.png" alt="" />
            <span className="topbar__station">{STATION_NAME}</span>
          </div>
          <span className="fresh" style={{ '--tone': fresh.tone }}>
            <FreshIcon />{fresh.text}
          </span>
        </header>

        <main className={`page${page === 'detail' ? ' page--wide' : ''}`}>
          {!online && (
            <div className="notice" role="status" style={{ '--tone': 'var(--muted)' }}>
              <SensorOff />
              <div>
                <strong>ตอนนี้ไม่มีสัญญาณเน็ต</strong>
                <p>ตัวเลขที่เห็นเป็นค่าล่าสุดที่เก็บไว้ พอมีสัญญาณแอปจะอัปเดตเอง ไม่ต้องกดอะไร</p>
              </div>
            </div>
          )}
          {TITLES[page] && (
            <div className="page-head">
              <h1>{TITLES[page]}</h1>
              {page === 'week' && <a className="page-head__sub" href="#/settings">ที่ {place.name} · เปลี่ยน</a>}
            </div>
          )}
          {content}
        </main>
      </div>

      <nav className="tabbar" aria-label="เมนูหลัก">
        {NAV.filter((n) => !n.desktopOnly).map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#/${id}`} aria-current={page === id ? 'page' : undefined}>
            <Icon />{label}
          </a>
        ))}
      </nav>
    </div>
  )
}

export default App
