// ===== ปฏิทินเก็บเกลือ: ตรรกะล้วน (ไม่มี React) ทดสอบด้วย node ได้ =====
// เกณฑ์ความเค็มตรงกับ src/salinity.js (BE_READY_MIN = 25, BE_BITTER = 29.5)
// เกณฑ์ฝนตรงกับ src/weather.js (RAIN_WATCH_PROB = 40, RAIN_ALERT_PROB = 60)
// ตั้งค่าคงที่ซ้ำไว้ที่นี่ เพื่อให้ import ได้จาก node โดยไม่ต้องผ่าน Vite (weather.js ใช้ lucide/React)

export const HARVEST_BE_MIN = 25
export const HARVEST_BE_BITTER = 29.5
export const HARVEST_MAX_RAIN = 40
export const COVER_RAIN = 60

const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

// เหมือน formatDay ใน salinity.js (ทำซ้ำไว้เพื่อให้ไฟล์นี้ไม่ต้องพึ่ง import.meta.env)
export function dayName(dateStr, todayStr) {
  if (dateStr === todayStr) return 'วันนี้'
  const d = new Date(`${dateStr}T00:00:00`)
  const t = new Date(`${todayStr}T00:00:00`)
  if (Math.round((d - t) / 864e5) === 1) return 'พรุ่งนี้'
  return `${THAI_DAYS[d.getDay()]} ${d.getDate()}`
}

// คำตัดสินรายวัน — key ใช้เลือกไอคอน/สีในคอมโพเนนต์
export const VERDICTS = {
  harvest: { word: 'เก็บเกลือได้', tone: 'accent', note: 'ความเค็มพอดี ฟ้าเปิด' },
  cover: { word: 'คลุมกองเกลือ', tone: 'danger', note: 'ฝนมา เก็บเกลือขึ้นกองแล้วคลุม' },
  watch: { word: 'รอดูฝน', tone: 'warning', note: 'เค็มพอแล้ว แต่อาจมีฝน เตรียมผ้าใบไว้' },
  dry: { word: 'ตากน้ำต่อ', tone: 'neutral', note: 'น้ำยังเค็มไม่พอ' },
  bitter: { word: 'ปล่อยน้ำขม', tone: 'warning', note: 'เค็มเกินไป ระบายน้ำขมออก' },
  unknown: { word: 'ยังบอกไม่ได้', tone: 'neutral', note: 'ไม่มีค่าความเค็ม' },
}

/**
 * ตัดสินหนึ่งวัน
 * @param {{rainProb:number}} day   วันจาก useWeather().days
 * @param {number|null} be          ความเค็มที่คาด (ดีกรี) ของวันนั้น
 * @param {string} [adviceLevel]    getDayAdvice(day).level
 */
export function dayVerdict(day, be, adviceLevel) {
  const rain = day?.rainProb ?? 0
  if (rain >= COVER_RAIN || adviceLevel === 'danger') return 'cover'
  if (be === null || be === undefined || Number.isNaN(be)) return 'unknown'
  if (be >= HARVEST_BE_BITTER) return 'bitter'
  if (be >= HARVEST_BE_MIN) return rain < HARVEST_MAX_RAIN ? 'harvest' : 'watch'
  return 'dry'
}

// โอกาสฝนเป็นคำ
export function rainWord(prob) {
  const p = prob ?? 0
  if (p >= COVER_RAIN) return 'ฝนแน่'
  if (p >= 30) return 'อาจมีฝน'
  return 'ฝนน้อย'
}

/**
 * สร้างปฏิทิน 7 วัน
 * @param {Array} days                 useWeather().days
 * @param {{series:Array}|null} prediction  predictSalinity(...)
 * @param {(day:object)=>{level:string}} [adviceFn]  getDayAdvice
 */
export function buildHarvestCalendar(days, prediction, adviceFn) {
  const beByDate = Object.fromEntries((prediction?.series ?? []).map((s) => [s.date, s.be]))
  return (days ?? []).slice(0, 7).map((day) => {
    const be = beByDate[day.date] ?? null
    const level = adviceFn ? adviceFn(day)?.level : undefined
    return { day, date: day.date, be, level, verdict: dayVerdict(day, be, level) }
  })
}

function joinThai(names) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} และ ${names[names.length - 1]}`
}

/**
 * ประโยคสรุปบนสุด: "วันไหนรื้อเกลือได้"
 * @returns {{text:string, tone:'accent'|'danger'|'warning'|'neutral'}}
 */
export function harvestSummary(rows, todayStr) {
  if (!rows?.length) return { text: 'ยังไม่มีพยากรณ์อากาศ บอกวันเก็บเกลือไม่ได้', tone: 'neutral' }

  const good = rows.filter((r) => r.verdict === 'harvest')
  if (good.length) {
    // เลือกไม่เกิน 2 วันที่ฝนน้อยที่สุด แล้วเรียงตามวัน
    const best = [...good]
      .sort((a, b) => (a.day.rainProb ?? 0) - (b.day.rainProb ?? 0) || a.date.localeCompare(b.date))
      .slice(0, 2)
      .sort((a, b) => a.date.localeCompare(b.date))
    return { text: `วันเก็บเกลือที่ดีที่สุด: ${joinThai(best.map((r) => dayName(r.date, todayStr)))}`, tone: 'accent' }
  }

  const known = rows.filter((r) => r.be !== null)
  if (!known.length) {
    const covers = rows.filter((r) => r.verdict === 'cover')
    return covers.length
      ? { text: `ยังไม่มีค่าความเค็ม แต่ ${dayName(covers[0].date, todayStr)} ฝนมา ควรคลุมกองเกลือ`, tone: 'danger' }
      : { text: 'ยังไม่มีค่าความเค็ม บอกวันเก็บเกลือไม่ได้', tone: 'neutral' }
  }

  const bitter = rows.find((r) => r.verdict === 'bitter')
  if (bitter) {
    return { text: `7 วันนี้ยังเก็บเกลือไม่ได้ เพราะน้ำเค็มเกินจนเป็นน้ำขม ควรปล่อยน้ำขมออกก่อน`, tone: 'warning' }
  }
  const saltyEnough = rows.some((r) => r.be !== null && r.be >= HARVEST_BE_MIN)
  if (saltyEnough) {
    return { text: '7 วันนี้ยังเก็บเกลือไม่ได้ เพราะวันที่น้ำเค็มพอมีโอกาสฝน ให้คลุมกองเกลือไว้ก่อน', tone: 'warning' }
  }
  const maxBe = Math.max(...known.map((r) => r.be))
  return {
    text: `7 วันนี้ยังเก็บเกลือไม่ได้ เพราะน้ำยังเค็มไม่พอ (สูงสุดราว ${maxBe.toFixed(1)} ดีกรี ต้องถึง ${HARVEST_BE_MIN})`,
    tone: 'neutral',
  }
}

// ===== คำอธิบายอากาศเป็นคำชาวนา =====
export function dryingWord(et0) {
  if (et0 === null || et0 === undefined) return null
  if (et0 >= 4.5) return 'แดดจัด น้ำแห้งเร็ว'
  if (et0 >= 3) return 'น้ำแห้งพอใช้'
  return 'แดดน้อย น้ำแห้งช้า'
}

export function windWord(kmh) {
  if (kmh === null || kmh === undefined) return null
  if (kmh >= 40) return 'ลมแรง'
  if (kmh >= 25) return 'ลมค่อนข้างแรง'
  if (kmh >= 10) return 'ลมพอดี'
  return 'ลมเบา'
}

export function humidityWord(rh) {
  if (rh === null || rh === undefined) return null
  if (rh >= 85) return 'ชื้นมาก'
  if (rh >= 70) return 'ค่อนข้างชื้น'
  return 'อากาศแห้ง'
}

// ข้อความจาก weather.js / salinity.js ยังมีคำทางวิชาการ — แปลงเป็นคำชาวนาตอนแสดงผล
const FARMER_WORDS = [
  [/น้ำระเหยช้า/g, 'น้ำแห้งช้า'],
  [/น้ำระเหยปานกลาง/g, 'น้ำแห้งพอใช้'],
  [/ระเหยได้ประมาณ/g, 'น้ำแห้งได้ราว'],
  [/ปล่อยให้น้ำระเหยต่อ/g, 'ตากน้ำต่อ'],
  [/การระเหย/g, 'น้ำแห้ง'],
  [/ระเหย/g, 'แห้ง'],
  [/ที่ตกผลึกแล้ว/g, 'ที่จับตัวแล้ว'],
  [/กำลังตกผลึก/g, 'กำลังจับตัว'],
  [/ตกผลึก/g, 'จับตัว'],
  [/°Bé/g, 'ดีกรี'],
]
export function farmerWords(text) {
  if (!text) return text
  return FARMER_WORDS.reduce((s, [re, to]) => s.replace(re, to), text)
}
