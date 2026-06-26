import { useState, useEffect, useRef, useCallback } from 'react'
import mqtt from 'mqtt'

// ===== MQTT Config =====
const MQTT_URL = 'wss://c9f0c2cef8584042836e827c368c3c54.s1.eu.hivemq.cloud:8884/mqtt'
const MQTT_USERNAME = 'Data-Dashbord'
const MQTT_PASSWORD = 'PsR12345678'
const MQTT_TOPIC = 'aquasense/sensor/distance'

// ===== ตั้งค่าเซ็นเซอร์ =====
const sensorConfig = [
  { id: 'W-001', name: 'บ่อน้ำหน้าอาคาร A', location: 'อาคาร A ชั้น 1', type: 'บ่อเก็บน้ำ' },
]

const initialSensors = sensorConfig.map(s => ({
  ...s,
  level: 0,
  lastUpdated: '-',
  connected: false,
}))

// เซ็นเซอร์วัดระยะจากผิวน้ำ → เลขน้อย = น้ำสูง = อันตราย
// critical: < 10 ซม. | danger: 10–30 ซม. | warning: 30–60 ซม. | safe: > 60 ซม.
function getWaterStatus(distance) {
  if (distance < 10) return 'critical'
  if (distance < 30) return 'danger'
  if (distance < 60) return 'warning'
  return 'safe'
}

function getStatusConfig(status) {
  switch (status) {
    case 'critical':
      return {
        label: 'อันตรายสูงสุด',
        sublabel: 'น้ำสูงมาก',
        color: '#ef4444',
        colorMuted: '#991b1b',
        colorBg: 'rgba(239,68,68,0.08)',
        colorBorder: 'rgba(239,68,68,0.2)',
        shouldEvacuate: true,
        evacuateText: 'ควรอพยพทันที',
        dot: 'bg-red-500',
      }
    case 'danger':
      return {
        label: 'อันตราย',
        sublabel: 'น้ำสูง',
        color: '#f97316',
        colorMuted: '#c2410c',
        colorBg: 'rgba(249,115,22,0.08)',
        colorBorder: 'rgba(249,115,22,0.2)',
        shouldEvacuate: true,
        evacuateText: 'เตรียมพร้อมอพยพ',
        dot: 'bg-orange-500',
      }
    case 'warning':
      return {
        label: 'เฝ้าระวัง',
        sublabel: 'น้ำเริ่มสูง',
        color: '#eab308',
        colorMuted: '#a16207',
        colorBg: 'rgba(234,179,8,0.08)',
        colorBorder: 'rgba(234,179,8,0.2)',
        shouldEvacuate: false,
        evacuateText: '',
        dot: 'bg-yellow-500',
      }
    case 'safe':
    default:
      return {
        label: 'ปลอดภัย',
        sublabel: 'ระดับปกติ',
        color: '#22c55e',
        colorMuted: '#15803d',
        colorBg: 'rgba(34,197,94,0.06)',
        colorBorder: 'rgba(34,197,94,0.15)',
        shouldEvacuate: false,
        evacuateText: '',
        dot: 'bg-green-500',
      }
  }
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
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3)
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.5)
      } else if (type === 'danger') {
        osc.frequency.setValueAtTime(660, ctx.currentTime)
        osc.frequency.setValueAtTime(520, ctx.currentTime + 0.2)
        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.4)
      } else {
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

// ===== Sensor Card =====
function SensorCard({ sensor }) {
  const status = getWaterStatus(sensor.level)
  const config = getStatusConfig(status)
  const isAlert = status === 'critical' || status === 'danger'

  return (
    <div
      className={`relative rounded-2xl border p-5 sm:p-6 transition-all duration-300 ${
        isAlert ? 'animate-subtle-pulse' : ''
      }`}
      style={{
        backgroundColor: isAlert ? config.colorBg : '#ffffff',
        borderColor: isAlert ? config.colorBorder : 'rgba(0,0,0,0.06)',
      }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${sensor.connected ? config.dot : 'bg-gray-300'}`} />
          <span className="text-sm font-medium text-gray-500">{sensor.location}</span>
        </div>
        <span
          className="text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-md whitespace-nowrap"
          style={{ backgroundColor: config.colorBg, color: config.color, border: `1px solid ${config.colorBorder}` }}
        >
          {sensor.connected ? config.label : 'รอข้อมูล'}
        </span>
      </div>

      {/* Big number */}
      <div className="mb-6">
        <span
          className="text-6xl sm:text-7xl font-extrabold tracking-tighter leading-none"
          style={{ color: sensor.connected ? config.color : '#e5e7eb' }}
        >
          {sensor.connected ? sensor.level : '--'}
        </span>
        <span className="text-sm font-medium text-gray-400 ml-2">ซม.</span>
      </div>

      {/* Name */}
      <h3 className="text-base font-semibold text-gray-900 mb-4">{sensor.name}</h3>

      {/* Evacuate */}
      {sensor.connected && config.shouldEvacuate && (
        <div
          className="rounded-lg px-3 py-2 mb-4 text-sm font-semibold whitespace-nowrap"
          style={{ backgroundColor: config.colorBg, color: config.color }}
        >
          {status === 'critical' ? '🚨' : '⚠️'} {config.evacuateText}
        </div>
      )}

      {sensor.connected && !config.shouldEvacuate && (
        <div className="rounded-lg px-3 py-2 mb-4 text-sm font-medium text-gray-400">
          ไม่จำเป็นต้องอพยพ
        </div>
      )}

      {!sensor.connected && (
        <div className="rounded-lg px-3 py-2 mb-4 text-sm font-medium text-gray-300">
          รอเชื่อมต่อเซ็นเซอร์...
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        <span className="text-xs text-gray-400">{sensor.type}</span>
        <span className="text-xs text-gray-400">{sensor.lastUpdated}</span>
      </div>
    </div>
  )
}

// ===== Stat Card =====
function StatCard({ label, count, color, icon, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 sm:p-5 text-left transition-all duration-200 w-full ${
        isActive ? 'ring-2' : ''
      }`}
      style={{
        backgroundColor: isActive ? color + '08' : '#ffffff',
        borderColor: isActive ? color + '30' : 'rgba(0,0,0,0.06)',
        boxShadow: isActive ? `0 0 0 1px ${color}20` : 'none',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-3xl font-bold" style={{ color }}>{count}</span>
    </button>
  )
}

// ===== Alert Banner =====
function AlertBanner({ sensors }) {
  const active = sensors.filter(s => s.connected)
  const critical = active.filter(s => getWaterStatus(s.level) === 'critical')
  const danger = active.filter(s => getWaterStatus(s.level) === 'danger')
  const total = critical.length + danger.length

  if (total === 0) return null

  const isCritical = critical.length > 0
  const color = isCritical ? '#ef4444' : '#f97316'

  return (
    <div
      className="rounded-xl border p-4 sm:p-5 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-3"
      style={{
        backgroundColor: isCritical ? 'rgba(239,68,68,0.06)' : 'rgba(249,115,22,0.06)',
        borderColor: isCritical ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.15)',
      }}
    >
      <div className="flex items-center gap-3 flex-1">
        <span className="text-2xl">{isCritical ? '🚨' : '⚠️'}</span>
        <div>
          <h3 className="font-semibold text-gray-900">
            พบ {total} จุด{isCritical ? 'อันตรายสูงสุด' : 'ที่อันตราย'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 whitespace-nowrap">
            {isCritical ? 'น้ำสูงถึงขั้นต้องอพยพ ดำเนินการทันที' : 'น้ำเริ่มสูง เตรียมพร้อมอพยพ'}
          </p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {critical.map(s => (
          <span key={s.id} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color }}>
            {s.name} ({s.level} ซม.)
          </span>
        ))}
        {danger.map(s => (
          <span key={s.id} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'rgba(249,115,22,0.1)', color }}>
            {s.name} ({s.level} ซม.)
          </span>
        ))}
      </div>
    </div>
  )
}

// ===== Main App =====
function App() {
  const [sensors, setSensors] = useState(initialSensors)
  const [filter, setFilter] = useState('all')
  const [mqttStatus, setMqttStatus] = useState('connecting')
  const prevStatusRef = useRef({})
  const playSound = useAlertSound()
  const clientRef = useRef(null)

  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      clientId: 'AquaSenseWeb_' + Math.random().toString(16).substr(2, 8),
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 5000,
    })
    clientRef.current = client

    client.on('connect', () => {
      setMqttStatus('connected')
      client.subscribe(MQTT_TOPIC)
    })

    client.on('error', () => setMqttStatus('error'))
    client.on('close', () => setMqttStatus('disconnected'))
    client.on('reconnect', () => setMqttStatus('connecting'))

    client.on('message', (topic, message) => {
      const payload = message.toString().trim()
      const distance = parseFloat(payload)

      if (!isNaN(distance) && distance >= 0) {
        const now = new Date()
        const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

        setSensors(prev => prev.map(sensor => {
          const newStatus = getWaterStatus(Math.round(distance))
          const prevStatus = prevStatusRef.current[sensor.id]

          // Play sound on status change
          if (prevStatus && prevStatus !== newStatus) {
            if (newStatus === 'critical') playSound('critical')
            else if (newStatus === 'danger') playSound('danger')
            else if (newStatus === 'warning') playSound('warning')
            else playSound('safe')
          }

          prevStatusRef.current[sensor.id] = newStatus
          return {
            ...sensor,
            level: Math.round(distance),
            lastUpdated: timeStr,
            connected: true,
          }
        }))
      }
    })

    return () => client.end()
  }, [playSound])

  const stats = {
    total: sensors.length,
    safe: sensors.filter(s => s.connected && getWaterStatus(s.level) === 'safe').length,
    warning: sensors.filter(s => s.connected && getWaterStatus(s.level) === 'warning').length,
    danger: sensors.filter(s => s.connected && getWaterStatus(s.level) === 'danger').length,
    critical: sensors.filter(s => s.connected && getWaterStatus(s.level) === 'critical').length,
  }

  const dangerCount = stats.danger + stats.critical

  const filteredSensors = sensors.filter(sensor => {
    if (filter === 'all') return true
    if (!sensor.connected) return filter === 'all'
    if (filter === 'danger') return getWaterStatus(sensor.level) === 'danger' || getWaterStatus(sensor.level) === 'critical'
    return getWaterStatus(sensor.level) === filter
  })

  const statusColor = mqttStatus === 'connected' ? '#22c55e' : mqttStatus === 'error' ? '#ef4444' : '#eab308'
  const statusLabel = mqttStatus === 'connected' ? 'Live' : mqttStatus === 'error' ? 'Error' : 'Connecting'

  const filterButtons = [
    { key: 'all', label: 'All', count: stats.total, color: '#0f172a' },
    { key: 'safe', label: 'Safe', count: stats.safe, color: '#22c55e' },
    { key: 'warning', label: 'Warning', count: stats.warning, color: '#eab308' },
    { key: 'danger', label: 'Danger', count: dangerCount, color: '#ef4444' },
  ]

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-900 tracking-tight">AquaSense</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              {mqttStatus === 'connected' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ backgroundColor: statusColor }}></span>}
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: statusColor }}></span>
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: statusColor }}>{statusLabel}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Alert Banner */}
        <AlertBanner sensors={sensors} />

        {/* Filter Tabs — Linear style */}
        <div className="flex items-center gap-1 mb-8 p-1 bg-gray-100 rounded-lg w-fit">
          {filterButtons.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                filter === f.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                filter === f.key ? 'bg-gray-100 text-gray-600' : 'text-gray-400'
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Sensor Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-12">
          {filteredSensors.map(sensor => (
            <SensorCard key={sensor.id} sensor={sensor} />
          ))}
        </div>

        {filteredSensors.length === 0 && (
          <div className="text-center py-20">
            <p className="text-sm text-gray-400">No sensors found</p>
          </div>
        )}

        {/* Legend — minimal */}
        <div className="border-t border-gray-200/60 pt-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">เกณฑ์ระดับน้ำ</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-1 h-8 rounded-full bg-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">ปลอดภัย</p>
                <p className="text-xs text-gray-400">&gt; 60 ซม. — ไม่ต้องอพยพ</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1 h-8 rounded-full bg-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">เฝ้าระวัง</p>
                <p className="text-xs text-gray-400">30–60 ซม. — ติดตามใกล้ชิด</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1 h-8 rounded-full bg-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">อันตราย</p>
                <p className="text-xs text-gray-400">10–30 ซม. — เตรียมอพยพ</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1 h-8 rounded-full bg-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">อันตรายสูงสุด</p>
                <p className="text-xs text-gray-400">&lt; 10 ซม. — อพยพทันที</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200/60 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <span className="text-xs text-gray-400">AquaSense © 2026</span>
          <span className="text-xs text-gray-400">ระบบตรวจวัดระดับน้ำอัจฉริยะ</span>
        </div>
      </footer>
    </div>
  )
}

export default App
