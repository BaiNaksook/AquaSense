// ===== ระดับน้ำในนา =====
// ESP32 วัด "ระยะจากกล่องวัดน้ำลงไปถึงผิวน้ำ" — ระยะน้อย = น้ำสูง
// เกณฑ์ตรงกับ ESP32 (esp-prs.ino): <= 32.4 อันตราย, <= 45 เฝ้าระวัง, > 45 ปกติ
export const RED_MAX = 32.4
export const YELLOW_MAX = 45

export function getWaterStatus(distance) {
  if (distance <= RED_MAX) return 'danger'
  if (distance <= YELLOW_MAX) return 'warning'
  return 'safe'
}

// "อีกกี่ ซม. น้ำจะถึงขีดอันตราย" — ตัวเลขที่ชาวนาใช้ตัดสินใจได้ทันที (ติดลบ = เกินขีดแล้ว)
export function marginToDanger(distance) {
  return distance === null ? null : Math.round((distance - RED_MAX) * 10) / 10
}

// ป้ายและสีของแต่ละสถานะ — สีดึงจาก token ใน index.css
export const WATER_STATUS = {
  safe: { label: 'น้ำยังดีอยู่', level: 1, tone: 'var(--safe)', todo: 'ทำนาตามปกติได้เลย' },
  warning: { label: 'น้ำเริ่มขึ้นแล้ว', level: 2, tone: 'var(--warning)', todo: 'แวะมาดูน้ำบ่อยๆ หน่อย' },
  danger: { label: 'น้ำขึ้นสูงแล้ว!', level: 3, tone: 'var(--danger)', todo: 'รีบไขน้ำออกเลย' },
  unknown: { label: 'ยังไม่รู้ระดับน้ำ', level: 0, tone: 'var(--muted)', todo: 'รอกล่องวัดน้ำส่งค่ามาก่อน' },
}

// เวลาที่ผ่านมาแบบคนพูด: "เมื่อสักครู่" / "5 นาทีก่อน" / "2 ชั่วโมงก่อน"
export function ago(t, now = Date.now()) {
  if (!t) return null
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 30) return 'เมื่อสักครู่'
  if (s < 90) return '1 นาทีก่อน'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} นาทีก่อน`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} ชั่วโมงก่อน`
  return `${Math.round(h / 24)} วันก่อน`
}

export function clockTime(t) {
  return new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
}
