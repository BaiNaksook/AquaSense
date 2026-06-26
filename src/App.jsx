import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Droplets, AlertTriangle, ShieldCheck, Radio, Home, Map, Bell, BarChart3, Settings, Info, Zap, Sun, Moon } from 'lucide-react'
import mqtt from 'mqtt'

// ===== MQTT Config =====
const MQTT_URL = 'wss://c9f0c2cef8584042836e827c368c3c54.s1.eu.hivemq.cloud:8884/mqtt'
const MQTT_USERNAME = 'Data-Dashbord'
const MQTT_PASSWORD = 'PsR12345678'
const MQTT_TOPIC = 'aquasense/sensor/distance'

// ===== Status Logic =====
function getWaterStatus(distance) {
  if (distance < 10) return 'critical'
  if (distance < 30) return 'danger'
  if (distance < 60) return 'warning'
  return 'safe'
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
    color: '#f97316',
    bg: 'rgba(249,115,22,0.06)',
    border: 'rgba(249,115,22,0.2)',
    evacuate: 'เตรียมพร้อมอพยพ',
    evacuateSub: 'น้ำสูง ควรเตรียมตัว',
    shouldEvacuate: true,
  },
  critical: {
    label: 'อันตรายสูงสุด',
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
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = ctxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      if (type === 'critical') {
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12)
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.24)
        gain.gain.setValueAtTime(0.25, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.4)
      } else if (type === 'danger') {
        osc.frequency.setValueAtTime(660, ctx.currentTime)
        osc.frequency.setValueAtTime(520, ctx.currentTime + 0.15)
        gain.gain.setValueAtTime(0.18, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.35)
      } else if (type === 'warning') {
        osc.frequency.setValueAtTime(440, ctx.currentTime)
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.2)
      }
    } catch (_) {}
  }, [])

  return play
}

// ===== Status Card =====
function StatusCard({ icon: Icon, label, range, desc, color, isActive }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="p-4 rounded-lg border transition-all duration-300"
      style={{
        backgroundColor: isActive ? color + '10' : '#ffffff',
        borderColor: isActive ? color : 'rgba(0,0,0,0.08)',
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
  const [filter, setFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState('home')
  const [chartHoverPoint, setChartHoverPoint] = useState(null)

  const alertIntervalRef = useRef(null)
  const playSound = useAlertSound()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const status = distance !== null ? getWaterStatus(distance) : 'safe'
  const config = STATUS_CONFIG[status]
  const isAlert = status === 'danger' || status === 'critical'

  // Continuous beeping while in danger/critical
  useEffect(() => {
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current)
      alertIntervalRef.current = null
    }

    if (isAlert && soundOn && connected) {
      playSound(status)
      const interval = status === 'critical' ? 6000 : 8000
      alertIntervalRef.current = setInterval(() => {
        playSound(status)
      }, interval)
    }

    return () => {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current)
      }
    }
  }, [status, isAlert, soundOn, connected, playSound])

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
    })

    client.on('error', () => setMqttStatus('error'))
    client.on('close', () => setMqttStatus('connecting'))
    client.on('reconnect', () => setMqttStatus('connecting'))

    client.on('message', (_topic, message) => {
      const payload = message.toString().trim()
      const d = parseFloat(payload)
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
      }
    })

    return () => {
      client.end()
      if (alertIntervalRef.current) clearInterval(alertIntervalRef.current)
    }
  }, [])

  const mqttColor = mqttStatus === 'connected' ? '#22c55e' : mqttStatus === 'error' ? '#ef4444' : '#eab308'
  const mqttText = mqttStatus === 'connected' ? 'CONNECTED' : mqttStatus === 'error' ? 'ERROR' : 'CONNECTING'
  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))

  // Chart calculations
  const chartMinValue = 0
  const chartMaxValue = Math.max(...history, 200)
  const sparklinePoints = history.length > 1
    ? history.map((v, i) => {
        const x = (i / (history.length - 1)) * 100
        const y = (v / chartMaxValue) * 200
        return { x, y, value: v }
      })
    : []

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ===== Sidebar ===== */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
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
            onClick={() => setCurrentPage('home')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all ${
              currentPage === 'home' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Home className="w-4 h-4" />
            <span className="text-sm">หน้าหลัก</span>
          </motion.button>
          <motion.button
            whileHover={{ x: 4 }}
            onClick={() => setCurrentPage('alerts')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all ${
              currentPage === 'alerts' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span className="text-sm">ประวัติการแจ้งเตือน</span>
          </motion.button>
          <motion.button
            whileHover={{ x: 4 }}
            onClick={() => setCurrentPage('settings')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all ${
              currentPage === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">ตั้งค่า</span>
          </motion.button>
          <motion.button
            whileHover={{ x: 4 }}
            onClick={() => setCurrentPage('about')}
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
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
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

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-all px-3 py-1.5 rounded-lg hover:bg-gray-100"
              aria-label="สลับธีม"
              title="สลับโหมดกลางวัน/กลางคืน"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="text-xs font-medium">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </motion.button>

            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setSoundOn(!soundOn)} className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-all px-3 py-1.5 rounded-lg hover:bg-gray-100">
              <Radio className="w-4 h-4" strokeWidth={soundOn ? 2.5 : 2} />
              <span className="text-xs font-medium">{soundOn ? 'On' : 'Off'}</span>
            </motion.button>
          </div>
        </div>

        {/* Content Scroll */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            {/* Home Page */}
            {currentPage === 'home' && (
              <>
                <div className="grid grid-cols-3 gap-6 mb-8">
              {/* Main Sensor Card */}
              <motion.div layout className="col-span-1 rounded-lg border bg-white p-6" style={{ borderColor: config.border, boxShadow: `0 0 20px ${config.bg}` }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                    <span className="text-xs font-medium text-gray-600">วัดต้นสน เพชรบุรี</span>
                  </div>
                  <motion.span animate={{ backgroundColor: [config.bg, config.bg + '80', config.bg] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-[11px] font-bold px-2 py-1 rounded" style={{ color: config.color, backgroundColor: config.bg }}>
                    {config.label}
                  </motion.span>
                </div>

                <div className="mb-4">
                  <motion.span className="text-6xl font-black tracking-tight" style={{ color: config.color }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                    {distance ?? '--'}
                  </motion.span>
                  <span className="text-sm font-medium text-gray-500 ml-2">ซม.</span>
                </div>

                <h3 className="text-sm font-bold text-gray-900 mb-1">แม่น้ำ</h3>
                <p className="text-xs text-gray-500 mb-4">{connected ? config.evacuate : 'รอข้อมูล'}</p>

                <div className="text-xs text-gray-400 flex items-center justify-between pt-4 border-t border-gray-100">
                  <span>อัปเดตล่าสุด</span>
                  <span>{lastUpdated}</span>
                </div>
              </motion.div>

              {/* Chart Card */}
              {history.length > 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="col-span-2 rounded-lg border bg-white p-6">
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
                        className="absolute top-2 right-2 bg-white rounded-lg border border-gray-200 p-3 shadow-sm"
                      >
                        <div className="text-xs text-gray-600 font-medium">
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
              <div className="grid grid-cols-4 gap-4">
                <StatusCard icon={ShieldCheck} label="ปลอดภัย" range="> 60 ซม." desc="ไม่ต้องอพยพ" color="#22c55e" isActive={status === 'safe' && connected} />
                <StatusCard icon={Zap} label="เฝ้าระวัง" range="30–60 ซม." desc="ติดตามใกล้ชิด" color="#eab308" isActive={status === 'warning' && connected} />
                <StatusCard icon={AlertTriangle} label="อันตราย" range="10–30 ซม." desc="เตรียมอพยพ" color="#f97316" isActive={status === 'danger' && connected} />
                <StatusCard icon={AlertTriangle} label="อันตรายสูงสุด" range="< 10 ซม." desc="อพยพทันที" color="#ef4444" isActive={status === 'critical' && connected} />
              </div>
            </div>

            {/* Activity Table */}
            <div className="rounded-lg border bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-900">ประวัติการแจ้เตือน</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">เวลา</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">สถานที่</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">จุดตรวจวัด</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">ระดับน้ำ</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-600">{lastUpdated}</td>
                      <td className="px-6 py-3 text-gray-900 font-medium">วัดต้นสน เพชรบุรี</td>
                      <td className="px-6 py-3 text-gray-600">แม่น้ำ</td>
                      <td className="px-6 py-3 text-gray-900 font-medium">{distance ?? '--'} ซม.</td>
                      <td className="px-6 py-3">
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
                <h2 className="text-2xl font-bold text-gray-900 mb-6">ประวตัิการเเจ้เตือน</h2>
                <div className="rounded-lg border bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-200 bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">เวลา</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">สถานที่</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">จุดตรวจวัด</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">ระดับน้ำ</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-6 py-3 text-gray-600">{lastUpdated}</td>
                          <td className="px-6 py-3 text-gray-900 font-medium">วัดต้นสน เพชรบุรี</td>
                          <td className="px-6 py-3 text-gray-600">แม่น้ำ</td>
                          <td className="px-6 py-3 text-gray-900 font-medium">{distance ?? '--'} ซม.</td>
                          <td className="px-6 py-3">
                            <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: config.bg, color: config.color }}>
                              {config.label}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Settings Page */}
            {currentPage === 'settings' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">ตั้งค่า</h2>
                <div className="rounded-lg border bg-white p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-4 border-b border-gray-200">
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

                    <div className="flex items-center justify-between pb-4 border-b border-gray-200">
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
                <h2 className="text-2xl font-bold text-gray-900 mb-6">เกี่ยวกับระบบ</h2>
                <div className="rounded-lg border bg-white p-6 space-y-4">
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
