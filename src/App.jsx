import { useState, useEffect } from 'react'

const initialSensors = [
  { id: 'W-001', name: 'บ่อน้ำหน้าอาคาร A', location: 'อาคาร A ชั้น 1', level: 45, type: 'บ่อเก็บน้ำ', lastUpdated: '2 นาทีที่แล้ว' },
  { id: 'W-002', name: 'ท่อระบายน้ำหลังอาคาร', location: 'อาคาร A หลัง', level: 178, type: 'ท่อระบายน้ำ', lastUpdated: '5 นาทีที่แล้ว' },
  { id: 'W-003', name: 'ถังเก็บน้ำชั้นใต้ดิน', location: 'ใต้ดินอาคาร B', level: 85, type: 'ถังเก็บน้ำ', lastUpdated: '1 นาทีที่แล้ว' },
  { id: 'W-004', name: 'บ่อน้ำโรงอาหาร', location: 'โรงอาหารชั้น 2', level: 152, type: 'บ่อเก็บน้ำ', lastUpdated: '3 นาทีที่แล้ว' },
  { id: 'W-005', name: 'ท่อระบายน้ำห้องพัก A1', location: 'อาคาร A ชั้น 1', level: 30, type: 'ท่อระบายน้ำ', lastUpdated: '10 นาทีที่แล้ว' },
  { id: 'W-006', name: 'ถังเก็บน้ำห้องพัก A2', location: 'อาคาร A ชั้น 2', level: 15, type: 'ถังเก็บน้ำ', lastUpdated: '8 นาทีที่แล้ว' },
  { id: 'W-007', name: 'บ่อน้ำล็อบบี้', location: 'ล็อบบี้อาคาร B', level: 110, type: 'บ่อเก็บน้ำ', lastUpdated: '4 นาทีที่แล้ว' },
  { id: 'W-008', name: 'ท่อระบายน้ำโซนจัดส่ง', location: 'โซนจัดส่ง', level: 62, type: 'ท่อระบายน้ำ', lastUpdated: '15 นาทีที่แล้ว' },
]

// เกณฑ์ตัดสินจากระดับน้ำ (ซม.) ตรงๆ
// safe: < 50 ซม., warning: 50-100 ซม., danger: 100-150 ซม., critical: > 150 ซม.
function getWaterStatus(level) {
  if (level > 150) return 'critical'
  if (level > 100) return 'danger'
  if (level > 50) return 'warning'
  return 'safe'
}

function getStatusConfig(status) {
  switch (status) {
    case 'critical':
      return {
        label: 'อันตรายสูงสุด',
        color: '#dc2626',
        colorLight: '#fef2f2',
        ring: 'ring-red-500/50',
        shouldEvacuate: true,
        evacuateText: '🚨 ควรอพยพทันที!',
        icon: '🔴',
      }
    case 'danger':
      return {
        label: 'อันตราย',
        color: '#f97316',
        colorLight: '#fff7ed',
        ring: 'ring-orange-400/40',
        shouldEvacuate: true,
        evacuateText: '⚠️ เตรียมพร้อมอพยพ',
        icon: '🟠',
      }
    case 'warning':
      return {
        label: 'เฝ้าระวัง',
        color: '#eab308',
        colorLight: '#fefce8',
        ring: 'ring-yellow-400/40',
        shouldEvacuate: false,
        evacuateText: '',
        icon: '🟡',
      }
    case 'safe':
    default:
      return {
        label: 'ปลอดภัย',
        color: '#10b981',
        colorLight: '#ecfdf5',
        ring: 'ring-emerald-400/30',
        shouldEvacuate: false,
        evacuateText: '',
        icon: '🟢',
      }
  }
}

function SensorCard({ sensor }) {
  const status = getWaterStatus(sensor.level)
  const config = getStatusConfig(status)
  const isAlert = status === 'critical' || status === 'danger'

  return (
    <div
      className={`group relative bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${isAlert ? `ring-2 ${config.ring}` : ''}`}
    >
      {isAlert && (
        <div className="absolute -top-2 -right-2 z-10">
          <span className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: config.color }}></span>
            <span className="relative inline-flex rounded-full h-4 w-4" style={{ backgroundColor: config.color }}></span>
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base flex-shrink-0">💧</span>
            <h3 className="font-semibold text-gray-800 text-sm truncate">{sensor.name}</h3>
          </div>
          <p className="text-xs text-gray-500 truncate">{sensor.location}</p>
        </div>
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ml-2 flex-shrink-0"
          style={{ backgroundColor: config.colorLight, color: config.color }}
        >
          {config.icon} {config.label}
        </span>
      </div>

      {/* ระดับน้ำ ตัวเลขใหญ่ */}
      <div className="text-center py-4 mb-3 rounded-xl" style={{ backgroundColor: config.colorLight }}>
        <div className="text-4xl sm:text-5xl font-extrabold tracking-tight" style={{ color: config.color }}>
          {sensor.level}
        </div>
        <div className="text-sm font-medium mt-1" style={{ color: config.color }}>
          เซนติเมตร (ซม.)
        </div>
      </div>

      {/* สถานะ + อพยพ */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">สถานะ:</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: config.colorLight, color: config.color }}>
            {config.icon} {config.label}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">อพยพ:</span>
          {config.shouldEvacuate ? (
            <span className="text-xs font-bold whitespace-nowrap" style={{ color: config.color }}>
              {config.evacuateText}
            </span>
          ) : (
            <span className="text-xs text-emerald-600 font-medium">✅ ไม่จำเป็น</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md font-medium">{sensor.type}</span>
        <span className="text-xs text-gray-400">อัปเดต {sensor.lastUpdated}</span>
      </div>
    </div>
  )
}

function StatCard({ label, count, color, icon, total }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col items-center w-full">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: `${color}15` }}>
        <span className="text-2xl">{icon}</span>
      </div>
      <span className="text-3xl font-bold" style={{ color }}>{count}</span>
      <div className="mt-1 text-center">
        <span className="text-xs sm:text-sm text-gray-600 font-medium">{label}</span>
      </div>
      <div className="w-full mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        ></div>
      </div>
      <span className="text-[10px] text-gray-400 mt-1">{percentage}% ของทั้งหมด</span>
    </div>
  )
}

function DangerAlertBanner({ sensors }) {
  const criticalSensors = sensors.filter(s => getWaterStatus(s.level) === 'critical')
  const dangerSensors = sensors.filter(s => getWaterStatus(s.level) === 'danger')
  const totalDanger = criticalSensors.length + dangerSensors.length

  if (totalDanger === 0) return null

  return (
    <div className={`rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8 border-2 ${criticalSensors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-3xl">{criticalSensors.length > 0 ? '🚨' : '⚠️'}</span>
          <div>
            <h3 className={`font-bold text-base sm:text-lg ${criticalSensors.length > 0 ? 'text-red-700' : 'text-orange-700'}`}>
              {criticalSensors.length > 0
                ? `พบ ${totalDanger} จุดที่อยู่ในระดับอันตราย!`
                : `พบ ${totalDanger} จุดที่ต้องเฝ้าระวัง`}
            </h3>
            <p className={`text-xs sm:text-sm mt-0.5 whitespace-nowrap ${criticalSensors.length > 0 ? 'text-red-600' : 'text-orange-600'}`}>
              {criticalSensors.length > 0
                ? 'มีพื้นที่ที่ระดับน้ำสูงถึงขั้นต้องอพยพ กรุณาดำเนินการทันที'
                : 'มีพื้นที่ที่ระดับน้ำเริ่มสูงขึ้น ควรเตรียมพร้อมอพยพ'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {criticalSensors.map(s => (
            <span key={s.id} className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">
              🔴 {s.name} ({s.level} ซม.)
            </span>
          ))}
          {dangerSensors.map(s => (
            <span key={s.id} className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium">
              🟠 {s.name} ({s.level} ซม.)
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function App() {
  const [sensors, setSensors] = useState(initialSensors)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const interval = setInterval(() => {
      setSensors(prev => prev.map(sensor => {
        const change = Math.floor(Math.random() * 11) - 3
        const newLevel = Math.max(0, sensor.level + change)
        return { ...sensor, level: newLevel }
      }))
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const stats = {
    total: sensors.length,
    safe: sensors.filter(s => getWaterStatus(s.level) === 'safe').length,
    warning: sensors.filter(s => getWaterStatus(s.level) === 'warning').length,
    danger: sensors.filter(s => getWaterStatus(s.level) === 'danger').length,
    critical: sensors.filter(s => getWaterStatus(s.level) === 'critical').length,
  }

  const dangerCount = stats.danger + stats.critical

  const filteredSensors = sensors.filter(sensor => {
    if (filter === 'all') return true
    if (filter === 'danger') return getWaterStatus(sensor.level) === 'danger' || getWaterStatus(sensor.level) === 'critical'
    return getWaterStatus(sensor.level) === filter
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30 flex-shrink-0">
                <span className="text-lg sm:text-xl">💧</span>
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-gray-800">AquaSense</h1>
                <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">ระบบตรวจวัดระดับน้ำอัจฉริยะ</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="hidden xs:inline sm:inline">อัปเดตแบบเรียลไทม์</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Danger Alert Banner */}
        <DangerAlertBanner sensors={sensors} />

        {/* สรุปสถานะ */}
        <section className="mb-8 sm:mb-10">
          <h2 className="text-base sm:text-lg font-bold text-gray-700 mb-4 sm:mb-5 flex items-center gap-2">
            <span className="w-1 h-5 sm:h-6 bg-cyan-500 rounded-full"></span>
            สรุปสถานะระดับน้ำ
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5">
            <StatCard label="เซ็นเซอร์ทั้งหมด" count={stats.total} color="#6366f1" icon="📡" total={stats.total} />
            <StatCard label="ปลอดภัย" count={stats.safe} color="#10b981" icon="✅" total={stats.total} />
            <StatCard label="เฝ้าระวัง" count={stats.warning} color="#eab308" icon="⚡" total={stats.total} />
            <StatCard label="อันตราย" count={dangerCount} color="#ef4444" icon="🚨" total={stats.total} />
          </div>
        </section>

        {/* รายละเอียดเซ็นเซอร์ */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-5 gap-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-700 flex items-center gap-2">
              <span className="w-1 h-5 sm:h-6 bg-cyan-500 rounded-full"></span>
              รายละเอียดระดับน้ำ
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'all', label: 'ทั้งหมด', count: stats.total, color: '#6366f1' },
                { key: 'safe', label: '✅ ปลอดภัย', count: stats.safe, color: '#10b981' },
                { key: 'warning', label: '⚡ เฝ้าระวัง', count: stats.warning, color: '#eab308' },
                { key: 'danger', label: '🚨 อันตราย', count: dangerCount, color: '#ef4444' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    filter === f.key
                      ? 'text-white shadow-md'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                  style={filter === f.key ? { backgroundColor: f.color, boxShadow: `0 4px 14px ${f.color}40` } : {}}
                >
                  {f.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === f.key ? 'bg-white/20' : 'bg-gray-100'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filteredSensors.map(sensor => (
              <SensorCard key={sensor.id} sensor={sensor} />
            ))}
          </div>

          {filteredSensors.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <div className="text-5xl mb-3">🔍</div>
              <p className="text-gray-500">ไม่พบเซ็นเซอร์ในสถานะที่เลือก</p>
            </div>
          )}
        </section>

        {/* เกณฑ์ระดับน้ำ */}
        <section className="mt-8 sm:mt-10">
          <h2 className="text-base sm:text-lg font-bold text-gray-700 mb-4 sm:mb-5 flex items-center gap-2">
            <span className="w-1 h-5 sm:h-6 bg-cyan-500 rounded-full"></span>
            เกณฑ์ระดับน้ำ
          </h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span className="font-semibold text-sm text-gray-700">🟢 ปลอดภัย</span>
                </div>
                <p className="text-xs text-gray-500">น้ำ ≤ 50 ซม.</p>
                <p className="text-xs text-emerald-600 font-medium mt-1">ไม่จำเป็นต้องอพยพ</p>
              </div>
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span className="font-semibold text-sm text-gray-700">🟡 เฝ้าระวัง</span>
                </div>
                <p className="text-xs text-gray-500">น้ำ 50–100 ซม.</p>
                <p className="text-xs text-yellow-600 font-medium mt-1">ติดตามสถานะอย่างใกล้ชิด</p>
              </div>
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                  <span className="font-semibold text-sm text-gray-700">🟠 อันตราย</span>
                </div>
                <p className="text-xs text-gray-500">น้ำ 100–150 ซม.</p>
                <p className="text-xs text-orange-600 font-medium mt-1">⚠️ เตรียมพร้อมอพยพ</p>
              </div>
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="font-semibold text-sm text-gray-700">🔴 อันตรายสูงสุด</span>
                </div>
                <p className="text-xs text-gray-500">น้ำ {'>'} 150 ซม.</p>
                <p className="text-xs text-red-600 font-medium mt-1 whitespace-nowrap">🚨 ควรอพยพทันที!</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white/50 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-gray-400">
          AquaSense © 2026 — ระบบตรวจวัดระดับน้ำอัจฉริยะ
        </div>
      </footer>
    </div>
  )
}

export default App
