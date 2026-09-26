// ===== ความเข้มข้นน้ำเกลือ (องศาโบเม่ °Bé) =====
// ค่าอ้างอิงนาเกลือสมุทร: น้ำทะเล ~2.5–3.5 °Bé · นาเชื้อ ~15–24 °Bé
// เกลือ (NaCl) ตกผลึกดีที่ 25–27 °Bé · เกิน ~29.5 °Bé เป็น "น้ำขม" (แมกนีเซียมสูง) ทำให้เกลือขม
// ค่าทั้งหมดเป็นค่าประมาณเชิงปฏิบัติ ควรปรับตามคำแนะนำชาวนาเกลือจริง
export const BE_CONCENTRATING = 15
export const BE_READY_MIN = 25
export const BE_HIGH = 28
export const BE_BITTER = 29.5
export const BE_SCALE_MAX = 32

// น้ำเกลือเข้มข้นระเหยช้ากว่าน้ำจืด จึงใช้ ET0 × 0.7 เป็นอัตราระเหยโดยประมาณ
const BRINE_EVAP_FACTOR = 0.7
// ความลึกน้ำในนาปลงโดยประมาณ (มม.) — ตั้งผ่าน VITE_BRINE_DEPTH_MM ได้
const env = import.meta.env ?? {}
export const BRINE_DEPTH_MM = Number(env.VITE_BRINE_DEPTH_MM) || 100

export const SALINITY_STAGES = {
  low: {
    label: 'ยังไม่ได้ดีกรี', ready: false, color: 'var(--muted)',
    advice: 'ตากน้ำต่อไป ยังรื้อไม่ได้',
  },
  rising: {
    label: 'อีกนิดเดียว', ready: false, color: 'var(--primary)',
    advice: 'ตากต่ออีก 1–2 แดด ยังรื้อไม่ได้',
  },
  ready: {
    label: 'ได้ดีกรีแล้ว', ready: true, color: 'var(--accent)',
    advice: 'เกลือกำลังขึ้น เม็ดหนาเมื่อไหร่ก็รื้อได้เลย',
  },
  high: {
    label: 'รีบเก็บ', ready: true, color: 'var(--warning)',
    advice: 'รีบรื้อเกลือ ก่อนน้ำกลายเป็นน้ำขม',
  },
  bitter: {
    label: 'น้ำขมแล้ว', ready: false, color: 'var(--danger)',
    advice: 'ปล่อยน้ำขมทิ้ง ไม่งั้นเกลือจะขม',
  },
}

export function getSalinityStage(be) {
  if (be >= BE_BITTER) return 'bitter'
  if (be >= BE_HIGH) return 'high'
  if (be >= BE_READY_MIN) return 'ready'
  if (be >= BE_CONCENTRATING) return 'rising'
  return 'low'
}

// ===== พยากรณ์ความเค็มล่วงหน้าจากพยากรณ์อากาศ =====
// แบบจำลองสมดุลน้ำอย่างง่าย: เกลือในแปลงเท่าเดิม น้ำหายไปเพราะระเหย และเพิ่มขึ้นเพราะฝน
//   c(วันถัดไป) = c × h / (h − ระเหย + ฝน)   โดยถือว่าความลึก h ถูกเติมกลับทุกวัน
// ใช้บอกแนวโน้มคร่าวๆ ไม่ใช่ค่าที่วัดได้จริง
export function predictSalinity(current, days, depthMm = BRINE_DEPTH_MM) {
  if (current === null || !days?.length) return null
  let c = current
  const series = []
  for (const day of days) {
    const evap = (day.et0 ?? 4) * BRINE_EVAP_FACTOR
    const rain = Math.max(day.rainMm ?? 0, day.tmdRainMm ?? 0)
    const after = Math.max(depthMm * 0.3, depthMm - evap + rain)
    c = Math.min(BE_SCALE_MAX, (c * depthMm) / after)
    series.push({ date: day.date, be: Math.round(c * 10) / 10, rainy: day.rainProb >= 60 || rain >= 2 })
  }

  const stage = getSalinityStage(current)
  const readyDay = stage === 'low' || stage === 'rising' ? series.find((d) => d.be >= BE_READY_MIN) ?? null : null
  const bitterDay = stage !== 'bitter' ? series.find((d) => d.be >= BE_BITTER) ?? null : null
  // ฝนที่มาก่อนถึงระดับเหมาะสม (หรือก่อนเก็บเสร็จ) จะทำให้ความเค็มลดลง
  const horizon = readyDay ?? bitterDay ?? series[series.length - 1]
  const rainDay = series.find((d) => d.rainy && d.date <= horizon.date) ?? null
  return { series, readyDay, bitterDay, rainDay }
}

// ===== ข้อความพยากรณ์ =====
const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์']

export function formatDay(dateStr, todayStr) {
  if (dateStr === todayStr) return 'วันนี้'
  const d = new Date(`${dateStr}T00:00:00`)
  const t = new Date(`${todayStr}T00:00:00`)
  if (Math.round((d - t) / 864e5) === 1) return 'พรุ่งนี้'
  return `${THAI_DAYS[d.getDay()]} ${d.getDate()}`
}

// ประโยคพยากรณ์สั้นๆ ใช้ทั้งการ์ดละเอียดและโหมดง่าย
export function salinityForecastText(stageKey, prediction, todayStr) {
  if (!prediction) return null
  const { readyDay, bitterDay, rainDay } = prediction
  const parts = []
  if (stageKey === 'low' || stageKey === 'rising') {
    parts.push(readyDay
      ? `น่าจะได้ดีกรี${formatDay(readyDay.date, todayStr) === 'วันนี้' ? 'ภายในวันนี้' : `วัน${formatDay(readyDay.date, todayStr)}`}`
      : 'อีก 7 วันก็ยังไม่ได้ดีกรี')
  } else if (stageKey === 'ready' || stageKey === 'high') {
    parts.push(bitterDay ? `รื้อให้เสร็จก่อนวัน${formatDay(bitterDay.date, todayStr)}` : 'ดีกรีจะพอดีไปอีกหลายวัน')
  }
  if (rainDay) parts.push(`ฝน${formatDay(rainDay.date, todayStr).replace(/^(?!วันนี้|พรุ่งนี้)/, 'วัน')}จะทำให้น้ำจืดลง ดีกรีตก`)
  return parts.join(' · ')
}

// ===== ค่าจำลอง (ใช้จนกว่าจะติดเซนเซอร์ความเค็ม) =====
// ค่อยๆ ขึ้นช่วงบ่ายที่แดดจัด และลดลงเล็กน้อยช่วงกลางคืน
export function simulateSalinity(now = new Date()) {
  const hour = now.getHours() + now.getMinutes() / 60
  const daily = 0.8 * Math.sin(((hour - 9) / 24) * 2 * Math.PI)
  const jitter = (Math.random() - 0.5) * 0.1
  return Math.round((23.2 + daily + jitter) * 10) / 10
}
