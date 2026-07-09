import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Droplets, AlertTriangle, ShieldCheck, Radio, Home, Bell, Settings, Info, Zap, Sun, Moon, Menu, Power, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import mqtt from 'mqtt'
import { supabase } from './supabase'

// ===== MQTT Config =====
const MQTT_URL = 'wss://c9f0c2cef8584042836e827c368c3c54.s1.eu.hivemq.cloud:8884/mqtt'
const MQTT_USERNAME = 'Data-Dashbord'
const MQTT_PASSWORD = 'PsR12345678'
const MQTT_TOPIC = 'aquasense/sensor/distance'
const MQTT_CONTROL_TOPIC = 'aquasense/sensor/control'

// ===== Status Logic =====
// เกณฑ์ตรงกับ Arduino: > 80 เขียว, 60–80 เหลือง, <= 60 แดง
const DIST_SAFE = 80
const DIST_WARN = 60

function getWaterStatus(distance) {
  if (distance > DIST_SAFE) return 'safe'
  if (distance > DIST_WARN) return 'warning'
  return 'danger'
}

const STATUS_CONFIG = {
  safe: {
    label: 'ปลอดภัย',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.06)',
    border: 'rgba(34,197,94,0.15)',
    evacuate: 'ไม่จำเป็นต้องอพยพ',
    evacuateSub: 'ระดับน้ำปกติ',
    shouldEvacuate: false,
  },
  warning: {
    label: 'เฝ้าระวัง',
    color: '#eab308',
    bg: 'rgba(234,179,8,0.06)',
    border: 'rgba(234,179,8,0.15)',
    evacuate: 'ติดตามสถานการณ์',
    evacuateSub: 'น้ำเริ่มสูงขึ้น',
    shouldEvacuate: false,
  },
  danger: {
    label: 'อันตราย',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    evacuate: 'ควรอพยพทันที',
    evacuateSub: 'น้ำสูงมาก เร่งด่วน!',
    shouldEvacuate: true,
  },
}

// ===== Sound Engine =====
function useAlertSound() {
  const ctxRef = useRef(null)

  const play = useCallback((type) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      if (!ctxRef.current) {
        // Do not create AudioContext before any user interaction.
        if (!navigator.userActivation?.hasBeenActive) return
        ctxRef.current = new AudioCtx()
      }
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') {
        if (navigator.userActivation?.isActive) {
          void ctx.resume().catch(() => {})
        }
        if (ctx.state !== 'running') return
      }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      if (type === 'danger') {
        // โทนสลับสูง-ต่ำ ให้เข้าคู่กับ buzzer ฝั่ง Arduino (1500/600 Hz)
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12)
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.24)
        gain.gain.setValueAtTime(0.25, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.4)
      } else if (type === 'warning') {
        osc.frequency.setValueAtTime(440, ctx.currentTime)
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.2)
      }
    } catch {
      return
    }
  }, [])

  return play
}

// ===== Click Sound =====
function useClickSound() {
  const ctxRef = useRef(null)
  return useCallback((type = 'default') => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      if (!ctxRef.current) {
        // Skip hover sound until audio is unlocked by a real user gesture.
        if (!navigator.userActivation?.hasBeenActive) return
        ctxRef.current = new AudioCtx()
      }
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') {
        if (navigator.userActivation?.isActive) {
          void ctx.resume().catch(() => {})
        }
        if (ctx.state !== 'running') return
      }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      if (type === 'hover') {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(1200, ctx.currentTime)
        gain.gain.setValueAtTime(0.025, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.04)
      } else if (type === 'toggle-on') {
        osc.frequency.setValueAtTime(600, ctx.currentTime)
        osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.08)
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.12)
      } else if (type === 'toggle-off') {
        osc.frequency.setValueAtTime(500, ctx.currentTime)
        osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.08)
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.12)
      } else {
        osc.frequency.setValueAtTime(700, ctx.currentTime)
        gain.gain.setValueAtTime(0.06, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.07)
      }
    } catch { return }
  }, [])
}

// ===== WiFi Bars =====
function WifiBars({ rssi }) {
  // rssi: -30 (excellent) to -90 (poor)
  const bars = rssi >= -55 ? 4 : rssi >= -65 ? 3 : rssi >= -75 ? 2 : 1
  const color = rssi >= -55 ? '#22c55e' : rssi >= -65 ? '#eab308' : rssi >= -75 ? '#f97316' : '#ef4444'
  return (
    <span className="flex items-end gap-[2px]" title={`WiFi: ${rssi} dBm`}>
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          style={{
            display: 'inline-block',
            width: '3px',
            height: `${b * 4}px`,
            borderRadius: '1px',
            backgroundColor: b <= bars ? color : '#d1d5db',
          }}
        />
      ))}
    </span>
  )
}

// ===== Status Card =====
function StatusCard({ icon: Icon, label, range, desc, color, isActive, theme }) {
  const inactiveBg = theme === 'dark' ? '#111827' : '#ffffff'
  const inactiveBorder = theme === 'dark' ? '#374151' : 'rgba(0,0,0,0.08)'

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="p-4 rounded-lg border transition-all duration-300"
      style={{
        backgroundColor: isActive ? color + '10' : inactiveBg,
        borderColor: isActive ? color : inactiveBorder,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5" style={{ color }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
      </div>
      <p className="text-sm font-bold text-gray-900">{range}</p>
      <p className="text-xs text-gray-500">{desc}</p>
    </motion.div>
  )
}

// ===== Main App =====
function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
    return 'light'
  })
  const [distance, setDistance] = useState(null)
  const [connected, setConnected] = useState(false)
  const [mqttStatus, setMqttStatus] = useState('connecting')
  const [lastUpdated, setLastUpdated] = useState('')
  const [soundOn, setSoundOn] = useState(true)
  const [history, setHistory] = useState([])
  const [currentPage, setCurrentPage] = useState('home')
  const [chartHoverPoint, setChartHoverPoint] = useState(null)
  const [chartMousePos, setChartMousePos] = useState({ x: 0, y: 0 })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sensorOn, setSensorOn] = useState(true)
  const [rssi, setRssi] = useState(null)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [audioUnlockTick, setAudioUnlockTick] = useState(0)
  const [alertLog, setAlertLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem('alertLog') || '[]') } catch { return [] }
  })
  const prevStatusRef = useRef(null)

  const alertIntervalRef = useRef(null)
  const mqttClientRef = useRef(null)
  const lastDbSaveRef = useRef(null)
  const playSound = useAlertSound()
  const playClick = useClickSound()

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    if (!sidebarOpen) {
      document.body.style.overflow = ''
      return
    }

    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  const status = distance !== null ? getWaterStatus(distance) : 'safe'
  const config = STATUS_CONFIG[status]
  const isAlert = status === 'danger'

  // Browser audio is blocked until the first real user gesture.
  // If the page opens directly into an alert state, retry the alert sound as soon as audio is unlocked.
  useEffect(() => {
    const unlockAudio = () => {
      setAudioUnlockTick((tick) => tick + 1)
      if (isAlert && soundOn && connected) {
        playSound(status)
      }
    }

    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })
    window.addEventListener('touchstart', unlockAudio, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
    }
  }, [isAlert, soundOn, connected, status, playSound])

  // Continuous beeping while in danger
  useEffect(() => {
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current)
      alertIntervalRef.current = null
    }

    if (isAlert && soundOn && connected) {
      playSound(status)
      alertIntervalRef.current = setInterval(() => {
        playSound(status)
      }, 6000)
    }

    return () => {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current)
      }
    }
  }, [status, isAlert, soundOn, connected, audioUnlockTick, playSound])

  // ===== MQTT =====
  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      clientId: 'AquaSenseWeb_' + Math.random().toString(16).substr(2, 8),
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 5000,
    })

    client.on('connect', () => {
      setMqttStatus('connected')
      client.subscribe(MQTT_TOPIC)
      client.publish(MQTT_CONTROL_TOPIC, 'ON', { retain: true })
    })

    mqttClientRef.current = client

    client.on('error', () => setMqttStatus('error'))
    client.on('close', () => setMqttStatus('connecting'))
    client.on('reconnect', () => setMqttStatus('connecting'))

    client.on('message', (_topic, message) => {
      const payload = message.toString().trim()
      const { d, rssi: incomingRssi } = (() => {
        try {
          const obj = JSON.parse(payload)
          if (obj !== null && typeof obj === 'object' && typeof obj.distance === 'number') {
            return { d: obj.distance, rssi: typeof obj.rssi === 'number' ? obj.rssi : null }
          }
        } catch { /* plain number */ }
        return { d: parseFloat(payload), rssi: null }
      })()
      if (incomingRssi !== null) setRssi(incomingRssi)
      if (!isNaN(d) && d >= 0) {
        const rounded = Math.round(d)
        setDistance(rounded)
        setConnected(true)
        setLastUpdated(
          new Date().toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        )
        setHistory((prev) => [...prev.slice(-29), rounded])

        // ===== Save to Supabase (throttle: ทุก 10 วิ) =====
        const now = Date.now()
        if (supabase && (!lastDbSaveRef.current || now - lastDbSaveRef.current >= 10000)) {
          lastDbSaveRef.current = now
          supabase.from('water_readings').insert({
            distance: rounded,
            status: getWaterStatus(rounded),
            rssi: incomingRssi ?? null,
            location: 'วัดต้นสน เพชรบุรี',
          }).then(({ error }) => { if (error) console.warn('Supabase insert error:', error.message) })
        }
      }
    })

    return () => {
      client.end()
      if (alertIntervalRef.current) clearInterval(alertIntervalRef.current)
    }
  }, [])

  // ===== Alert log on status change =====
  useEffect(() => {
    if (distance === null) return
    if (prevStatusRef.current === null) {
      prevStatusRef.current = status
      return
    }
    if (prevStatusRef.current !== status) {
      const entry = {
        id: Date.now(),
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        distance,
        status,
        prevStatus: prevStatusRef.current,
      }
      setAlertLog((prev) => {
        const updated = [entry, ...prev].slice(0, 100)
        localStorage.setItem('alertLog', JSON.stringify(updated))
        return updated
      })
      // Save alert to Supabase
      if (supabase) {
        supabase.from('alert_history').insert({
          distance,
          status,
          prev_status: prevStatusRef.current,
          location: 'วัดต้นสน เพชรบุรี',
        }).then(({ error }) => { if (error) console.warn('Supabase alert insert error:', error.message) })
      }
      prevStatusRef.current = status
    }
  }, [status, distance])

  // display status: ถ้ามีข้อมูลจริงให้ถือว่า connected
  const displayConnected = connected || mqttStatus === 'connected'
  const mqttColor = displayConnected ? '#22c55e' : mqttStatus === 'error' ? '#ef4444' : '#eab308'
  const mqttText = displayConnected ? 'CONNECTED' : mqttStatus === 'error' ? 'ERROR' : 'CONNECTING'
  const toggleTheme = () => { playClick('toggle-on'); setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')) }

  const toggleSensor = () => {
    const next = !sensorOn
    setSensorOn(next)
    playClick(next ? 'toggle-on' : 'toggle-off')
    if (mqttClientRef.current) {
      mqttClientRef.current.publish(MQTT_CONTROL_TOPIC, next ? 'ON' : 'OFF', { retain: true })
    }
  }
  const handlePageChange = (page) => {
    playClick()
    setCurrentPage(page)
    setSidebarOpen(false)
  }

  // Chart calculations
  const chartMaxValue = Math.max(...history, 200)
  const sparklinePoints = history.length > 1
    ? history.map((v, i) => {
        const x = (i / (history.length - 1)) * 100
        const y = (v / chartMaxValue) * 200
        return { x, y, value: v }
      })
    : []

  // ===== Trend =====
  // distance = ระยะจากเซ็นเซอร์ถึงผิวน้ำ
  // distance ลด = น้ำขึ้น | distance เพิ่ม = น้ำลง
  const trend = (() => {
    if (history.length < 4) return 'stable'
    const recent = history.slice(-4)
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
    const diff = avg(recent.slice(2)) - avg(recent.slice(0, 2))
    if (diff < -1) return 'rising'   // distance ลด = น้ำขึ้น
    if (diff > 1) return 'falling'   // distance เพิ่ม = น้ำลง
    return 'stable'
  })()

  return (
    <div className="flex min-h-screen bg-gray-50">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="ปิดเมนู"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      {/* ===== Sidebar ===== */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-full sm:w-72 max-w-full bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 lg:static lg:w-64 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Droplets className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-gray-900">AquaSense</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <motion.button
            whileHover={{ x: 4 }}
            onMouseEnter={() => playClick('hover')}
            onClick={() => handlePageChange('home')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all ${
              currentPage === 'home' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Home className="w-4 h-4" />
            <span className="text-sm">หน้าหลัก</span>
          </motion.button>
          <motion.button
            whileHover={{ x: 4 }}
            onMouseEnter={() => playClick('hover')}
            onClick={() => handlePageChange('alerts')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all ${
              currentPage === 'alerts' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span className="text-sm">ประวัติการแจ้งเตือน</span>
          </motion.button>
          <motion.button
            whileHover={{ x: 4 }}
            onMouseEnter={() => playClick('hover')}
            onClick={() => handlePageChange('settings')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all ${
              currentPage === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">ตั้งค่า</span>
          </motion.button>
          <motion.button
            whileHover={{ x: 4 }}
            onMouseEnter={() => playClick('hover')}
            onClick={() => handlePageChange('about')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all ${
              currentPage === 'about' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Info className="w-4 h-4" />
            <span className="text-sm">เกี่ยวกับระบบ</span>
          </motion.button>
        </nav>

        {/* Water illustration */}
        <div className="p-4 border-t border-gray-200">
          <div className="bg-gradient-to-b from-blue-400 to-blue-200 rounded-lg h-20 flex items-end justify-center overflow-hidden relative">
            <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
              <path d="M0,40 Q50,30 100,40 T200,40 L200,60 L0,60 Z" fill="rgba(255,255,255,0.3)" />
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">ระบบตรวจวัดระดับน้ำอัจฉริยะ</p>
        </div>

        <div className="p-4 border-t border-gray-200 text-xs text-gray-400 text-center">
          PSR AquaSense © 2026
        </div>
      </div>

      {/* ===== Main Content ===== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="เปิดเมนู"
              onMouseEnter={() => playClick('hover')}
              onClick={() => { playClick(); setSidebarOpen(true) }}
              className="lg:hidden text-gray-600 hover:text-gray-900 transition-all p-1.5 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {mqttStatus === 'connected' && (
                  <motion.span animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inline-flex h-full w-full rounded-full" style={{ backgroundColor: mqttColor }} />
                )}
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: mqttColor }} />
              </span>
              <span className="text-xs font-bold" style={{ color: mqttColor }}>
                {mqttText}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onMouseEnter={() => playClick('hover')}
              onClick={toggleTheme}
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-all px-2 sm:px-3 py-1.5 rounded-lg hover:bg-gray-100"
              aria-label="สลับธีม"
              title="สลับโหมดกลางวัน/กลางคืน"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="hidden sm:inline text-xs font-medium">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onMouseEnter={() => playClick('hover')}
              onClick={toggleSensor}
              className={`flex items-center gap-1.5 transition-all px-2 sm:px-3 py-1.5 rounded-lg ${
                sensorOn ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
              }`}
              title="เปิด/ปิดเซ็นเซอร์ ESP32"
            >
              <Power className="w-4 h-4" strokeWidth={2.5} />
              <span className="hidden sm:inline text-xs font-medium">{sensorOn ? 'Sensor On' : 'Sensor Off'}</span>
            </motion.button>

            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onMouseEnter={() => playClick('hover')} onClick={() => { playClick(soundOn ? 'toggle-off' : 'toggle-on'); setSoundOn(!soundOn) }} className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-all px-2 sm:px-3 py-1.5 rounded-lg hover:bg-gray-100">
              <Radio className="w-4 h-4" strokeWidth={soundOn ? 2.5 : 2} />
              <span className="hidden sm:inline text-xs font-medium">{soundOn ? 'On' : 'Off'}</span>
            </motion.button>

            {installPrompt && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={() => playClick('hover')}
                onClick={() => {
                  playClick('toggle-on')
                  installPrompt.prompt()
                  installPrompt.userChoice.then(() => setInstallPrompt(null))
                }}
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-all px-2 sm:px-3 py-1.5 rounded-lg hover:bg-blue-50"
                title="ติดตั้งแอป"
              >
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-medium">ติดตั้งแอป</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Content Scroll */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 sm:p-8">
            {/* Home Page */}
            {currentPage === 'home' && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {/* Main Sensor Card */}
              <motion.div layout className="lg:col-span-1 rounded-lg border bg-white p-4 sm:p-6" style={{ borderColor: config.border, boxShadow: `0 0 20px ${config.bg}` }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                    <span className="text-xs font-medium text-gray-600">วัดต้นสน เพชรบุรี</span>
                  </div>
                  <motion.span animate={{ backgroundColor: [config.bg, config.bg + '80', config.bg] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-[11px] font-bold px-2 py-1 rounded" style={{ color: config.color, backgroundColor: config.bg }}>
                    {config.label}
                  </motion.span>
                </div>

                <div className="mb-4 flex items-end gap-2">
                  <div className="relative overflow-hidden h-[4.5rem] sm:h-[5rem] flex items-center">
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={distance}
                        initial={{ y: 24, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -24, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="text-5xl sm:text-6xl font-black tracking-tight"
                        style={{ color: config.color }}
                      >
                        {distance ?? '--'}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  <span className="text-sm font-medium text-gray-500 mb-2">ซม.</span>
                </div>

                <h3 className="text-sm font-bold text-gray-900 mb-1">แม่น้ำ</h3>
                <p className="text-xs text-gray-500 mb-4">{connected ? config.evacuate : 'รอข้อมูล'}</p>

                {/* WiFi RSSI */}
                {rssi !== null && (
                  <div className="flex items-center gap-1.5 mb-2 text-xs">
                    <WifiBars rssi={rssi} />
                    <span className="text-gray-400">{rssi} dBm</span>
                  </div>
                )}

                {/* Trend indicator */}
                {history.length >= 4 && !(trend === 'stable' && isAlert) && (
                  <div className="flex items-center gap-1.5 mb-4 text-xs font-medium">
                    {trend === 'rising' && <><TrendingUp className="w-4 h-4 text-red-500" /><span className="text-red-500">ระดับน้ำกำลังขึ้น</span></>}
                    {trend === 'falling' && <><TrendingDown className="w-4 h-4 text-green-500" /><span className="text-green-500">ระดับน้ำกำลังลง</span></>}
                    {trend === 'stable' && <><Minus className="w-4 h-4 text-gray-400" /><span className="text-gray-400">ระดับน้ำคงที่</span></>}
                  </div>
                )}

                <div className="text-xs text-gray-400 flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-1.5">
                    {connected && (
                      <motion.span
                        animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="w-1.5 h-1.5 rounded-full inline-block"
                        style={{ backgroundColor: config.color }}
                      />
                    )}
                    <span>อัปเดตล่าสุด</span>
                  </div>
                  <span>{lastUpdated}</span>
                </div>
              </motion.div>

              {/* Chart Card */}
              {history.length > 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="lg:col-span-2 rounded-lg border bg-white p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-gray-900">กราฟระดับน้ำ(24 ชม.)</h3>
                  </div>

                  <div className="relative">
                    <svg
                      viewBox="0 0 500 280"
                      className="w-full cursor-crosshair"
                      onMouseMove={(e) => {
                        const svg = e.currentTarget
                        const rect = svg.getBoundingClientRect()
                        const x = ((e.clientX - rect.left) / rect.width) * 500

                        if (x >= 50 && x <= 480) {
                          const normalizedX = (x - 50) / 430
                          const closestIndex = Math.round(normalizedX * (history.length - 1))
                          if (closestIndex >= 0 && closestIndex < history.length) {
                            setChartHoverPoint(closestIndex)
                          }
                        }

                        const container = svg.closest('.relative')
                        const containerRect = container.getBoundingClientRect()
                        setChartMousePos({
                          x: e.clientX - containerRect.left,
                          y: e.clientY - containerRect.top,
                        })
                      }}
                      onMouseLeave={() => setChartHoverPoint(null)}
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))' }}
                    >
                      <defs>
                        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>

                      {/* Grid lines */}
                      {[0, 1, 2, 3, 4].map((i) => (
                        <line key={i} x1="50" y1={240 - i * 50} x2="480" y2={240 - i * 50} stroke="#e5e7eb" strokeWidth="1" />
                      ))}

                      {/* Y-axis labels */}
                      {[0, 1, 2, 3, 4].map((i) => {
                        const value = Math.round((chartMaxValue / 4) * i)
                        return (
                          <text key={i} x="30" y={245 - i * 50} fontSize="12" fill="#9ca3af" textAnchor="end">
                            {value}
                          </text>
                        )
                      })}

                      {/* Area and line */}
                      {sparklinePoints.length > 0 && (
                        <>
                          <polygon
                            points={`50,240 ${sparklinePoints.map((p) => `${p.x * 4.3 + 50},${240 - p.y}`).join(' ')} 480,240`}
                            fill="url(#chartGradient)"
                          />
                          <polyline
                            points={sparklinePoints.map((p) => `${p.x * 4.3 + 50},${240 - p.y}`).join(' ')}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {/* Data point indicator */}
                          {sparklinePoints.length > 0 && (
                            <circle
                              cx={sparklinePoints[sparklinePoints.length - 1].x * 4.3 + 50}
                              cy={240 - sparklinePoints[sparklinePoints.length - 1].y}
                              r="4"
                              fill="#3b82f6"
                              stroke="white"
                              strokeWidth="2"
                            />
                          )}
                        </>
                      )}

                      {/* X-axis labels */}
                    </svg>

                    {/* Data tooltip */}
                    {chartHoverPoint !== null && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute pointer-events-none z-10 bg-white rounded-lg border border-gray-200 p-2 sm:p-3 shadow-md"
                        style={{
                          left: chartMousePos.x + 14,
                          top: chartMousePos.y - 48,
                          transform: chartMousePos.x > 300 ? 'translateX(-110%)' : 'translateX(0)',
                        }}
                      >
                        <div className="text-xs text-gray-600 font-medium whitespace-nowrap">
                          {new Date(new Date().getTime() - (history.length - 1 - chartHoverPoint) * 60000).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                        <div className="text-sm font-bold text-gray-900">{history[chartHoverPoint]} ซม.</div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Status Cards */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-gray-900 mb-4">เกณฑ์ระดับน้ำ</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                <StatusCard icon={ShieldCheck} label="ปลอดภัย" range="> 80 ซม." desc="ไม่ต้องอพยพ" color="#22c55e" isActive={status === 'safe' && connected} theme={theme} />
                <StatusCard icon={Zap} label="เฝ้าระวัง" range="60–80 ซม." desc="ติดตามใกล้ชิด" color="#eab308" isActive={status === 'warning' && connected} theme={theme} />
                <StatusCard icon={AlertTriangle} label="อันตราย" range="≤ 60 ซม." desc="อพยพทันที" color="#ef4444" isActive={status === 'danger' && connected} theme={theme} />
              </div>
            </div>

            {/* Activity Table */}
            <div className="rounded-lg border bg-white overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-900">ประวัติการแจ้งเตือน</h3>
              </div>
              <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '300px' }}>
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">เวลา</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">สถานที่</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">จุดตรวจวัด</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">ระดับน้ำ</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-3 text-gray-600 whitespace-nowrap">{lastUpdated}</td>
                      <td className="px-3 sm:px-6 py-3 text-gray-900 font-medium whitespace-nowrap">วัดต้นสน เพชรบุรี</td>
                      <td className="px-3 sm:px-6 py-3 text-gray-600 whitespace-nowrap">แม่น้ำ</td>
                      <td className="px-3 sm:px-6 py-3 text-gray-900 font-medium whitespace-nowrap">{distance ?? '--'} ซม.</td>
                      <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                        <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: config.bg, color: config.color }}>
                          {config.label}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
              </>
            )}

            {/* Alert History Page */}
            {currentPage === 'alerts' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">ประวัติการแจ้งเตือน</h2>
                  {alertLog.length > 0 && (
                    <button
                      onClick={() => {
                        if (window.confirm('ลบประวัติทั้งหมด?')) {
                          setAlertLog([])
                          localStorage.removeItem('alertLog')
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all"
                    >
                      ลบทั้งหมด
                    </button>
                  )}
                </div>
                <div className="rounded-lg border bg-white overflow-hidden">
                  {alertLog.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">ยังไม่มีการแจ้งเตือน</p>
                      <p className="text-xs mt-1">ระบบจะบันทึกทุกครั้งที่สถานะเปลี่ยน</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '520px' }}>
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">วันที่</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">เวลา</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">ระดับน้ำ</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">เปลี่ยนจาก</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">สถานะใหม่</th>
                          </tr>
                        </thead>
                        <tbody>
                          {alertLog.map((entry) => {
                            const prev = STATUS_CONFIG[entry.prevStatus]
                            const curr = STATUS_CONFIG[entry.status]
                            return (
                              <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-3 sm:px-6 py-3 text-gray-600 whitespace-nowrap">{entry.date}</td>
                                <td className="px-3 sm:px-6 py-3 text-gray-600 whitespace-nowrap">{entry.time}</td>
                                <td className="px-3 sm:px-6 py-3 text-gray-900 font-medium whitespace-nowrap">{entry.distance} ซม.</td>
                                <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                                  <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: prev.bg, color: prev.color }}>{prev.label}</span>
                                </td>
                                <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                                  <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: curr.bg, color: curr.color }}>{curr.label}</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Settings Page */}
            {currentPage === 'settings' && (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">ตั้งค่า</h2>
                <div className="rounded-lg border bg-white p-4 sm:p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">เซ็นเซอร์วัดระยะ ESP32</p>
                        <p className="text-sm text-gray-500">เปิด/ปิดการทำงานของเซ็นเซอร์ผ่าน MQTT</p>
                      </div>
                      <button
                        onClick={toggleSensor}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          sensorOn
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                        {sensorOn ? 'เปิดอยู่' : 'ปิดอยู่'}
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">ธีมหน้าจอ</p>
                        <p className="text-sm text-gray-500">สลับโหมดกลางวัน / กลางคืน</p>
                      </div>
                      <button
                        onClick={toggleTheme}
                        className="px-4 py-2 rounded-lg font-medium text-sm transition-all bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        {theme === 'dark' ? 'กลางคืน' : 'กลางวัน'}
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">เสียงเตือน</p>
                        <p className="text-sm text-gray-500">เล่นเสียงเตือนเมื่อระดับน้ำอันตราย</p>
                      </div>
                      <button
                        onClick={() => setSoundOn(!soundOn)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          soundOn
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {soundOn ? 'เปิด' : 'ปิด'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* About Page */}
            {currentPage === 'about' && (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">เกี่ยวกับระบบ</h2>
                <div className="rounded-lg border bg-white p-4 sm:p-6 space-y-4">
                  <div>
                    <p className="font-medium text-gray-900">AquaSense</p>
                    <p className="text-sm text-gray-600 mt-1">ระบบตรวจวัดระดับน้ำอัจฉริยะ</p>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      ระบบนี้ใช้เซ็นเซอร์อัลตราโซนิกเพื่อวัดระดับน้ำในแม่น้ำอย่างแม่นยำและเรียลไทม์
                      เพื่อให้ข้อมูลการเตือนสัญญาณที่ทันท่วงที
                    </p>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">เวอร์ชัน 1.0.0</p>
                    <p className="text-xs text-gray-500 mt-1">PSR AquaSense © 2026</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
