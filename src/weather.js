import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, ShieldCheck, OctagonAlert, Info, Cloud } from 'lucide-react'

// ===== Weather Config =====
// พิกัดแปลงนาเกลือ — ค่าเริ่มต้น: นาเกลือ ต.นาโคก อ.เมืองสมุทรสาคร (ตั้งผ่าน VITE_STATION_LAT / VITE_STATION_LON)
const env = import.meta.env ?? {}
export const STATION_LAT = Number(env.VITE_STATION_LAT) || 13.47
export const STATION_LON = Number(env.VITE_STATION_LON) || 100.2
// token กรมอุตุนิยมวิทยา (data.tmd.go.th NWP API) — ไม่ใส่ก็ได้ ระบบจะใช้ Open-Meteo อย่างเดียว
const TMD_TOKEN = env.VITE_TMD_TOKEN || ''

const REFRESH_MS = 30 * 60 * 1000
const CACHE_KEY = 'weatherCache'

// ===== เกณฑ์คำแนะนำสำหรับนาเกลือ =====
// ฝนแม้ไม่กี่ มม. ก็ทำให้น้ำในนาปลง (ลึก 5–10 ซม.) เจือจาง ความเค็มตกต่ำกว่าจุดตกผลึก
// และละลายเกลือที่กองไว้ — ค่าทั้งหมดเป็นค่าประมาณเชิงปฏิบัติ ควรปรับตามคำแนะนำชาวนาเกลือจริง
export const RAIN_WATCH_PROB = 40    // % → เฝ้าระวังฝน
export const RAIN_WATCH_MM = 1       // มม./วัน
export const RAIN_ALERT_PROB = 60    // % → ควรเก็บ/คลุมเกลือ
export const RAIN_ALERT_MM = 2       // มม./วัน
export const RAIN_HEAVY_MM = 10      // มม./วัน → ฝนหนัก (TMD: > 10 มม. = ปานกลางขึ้นไป)
export const WIND_STRONG_KMH = 40    // ลมสูงสุด กม./ชม.
export const GUST_STRONG_KMH = 50    // ลมกระโชก กม./ชม.
export const GOOD_ET0_MM = 4.5       // การระเหยอ้างอิง มม./วัน (ดัชนีเทียบ ไม่ใช่อัตราระเหยน้ำเกลือจริง)
export const GOOD_MAX_PROB = 20      // % โอกาสฝนสูงสุดของวันตากดี
export const GOOD_MAX_HUMIDITY = 70  // % ความชื้นเฉลี่ย
export const POOR_ET0_MM = 3
export const POOR_HUMIDITY = 85
const HOURLY_RAIN_PROB = 50          // % ต่อชั่วโมง ใช้หาเวลาที่ฝนอาจเริ่ม

// ระดับคำแนะนำ → สี + ไอคอน (สี + รูปทรง + คำ เพื่อให้คนตาบอดสีแยกได้)
export const ADVICE_TONE = {
  danger: { color: 'var(--danger)', icon: OctagonAlert },
  warning: { color: 'var(--warning)', icon: AlertTriangle },
  good: { color: 'var(--safe)', icon: ShieldCheck },
  normal: { color: 'var(--primary)', icon: Info },
  poor: { color: 'var(--muted)', icon: Cloud },
}

// ===== WMO weather code → ข้อความไทย =====
const WMO_TEXT = {
  0: 'ท้องฟ้าแจ่มใส', 1: 'มีเมฆบางส่วน', 2: 'มีเมฆบางส่วน', 3: 'มีเมฆมาก',
  45: 'มีหมอก', 48: 'มีหมอก',
  51: 'ฝนละออง', 53: 'ฝนละออง', 55: 'ฝนละออง', 56: 'ฝนละออง', 57: 'ฝนละออง',
  61: 'ฝนเล็กน้อย', 63: 'ฝนปานกลาง', 65: 'ฝนหนัก', 66: 'ฝนเล็กน้อย', 67: 'ฝนหนัก',
  80: 'ฝนตกเป็นช่วงๆ', 81: 'ฝนตกเป็นช่วงๆ', 82: 'ฝนตกหนักเป็นช่วงๆ',
  95: 'ฝนฟ้าคะนอง', 96: 'ฝนฟ้าคะนอง ลูกเห็บ', 99: 'ฝนฟ้าคะนอง ลูกเห็บ',
}

// icon key ใช้เลือกไอคอนใน WeatherPanel
export function wmoIcon(code) {
  if (code >= 95) return 'storm'
  if (code >= 51) return 'rain'
  if (code === 45 || code === 48) return 'fog'
  if (code === 3) return 'cloud'
  if (code === 1 || code === 2) return 'partly'
  return 'sun'
}

// ===== TMD condition code (cond) → ข้อความไทย =====
const TMD_COND = {
  1: 'ท้องฟ้าแจ่มใส', 2: 'มีเมฆบางส่วน', 3: 'เมฆเป็นส่วนมาก', 4: 'มีเมฆมาก',
  5: 'ฝนตกเล็กน้อย', 6: 'ฝนปานกลาง', 7: 'ฝนตกหนัก', 8: 'ฝนฟ้าคะนอง',
  9: 'อากาศหนาวจัด', 10: 'อากาศหนาว', 11: 'อากาศเย็น', 12: 'อากาศร้อนจัด',
}

// ===== Fetchers =====
async function fetchOpenMeteo() {
  const params = new URLSearchParams({
    latitude: String(STATION_LAT),
    longitude: String(STATION_LON),
    daily: [
      'weather_code', 'precipitation_probability_max', 'precipitation_sum',
      'temperature_2m_max', 'temperature_2m_min', 'wind_speed_10m_max',
      'wind_gusts_10m_max', 'et0_fao_evapotranspiration',
    ].join(','),
    hourly: 'precipitation_probability,precipitation,relative_humidity_2m',
    forecast_days: '7',
    timezone: 'Asia/Bangkok',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  return parseOpenMeteo(await res.json())
}

// แยกออกมาเพื่อทดสอบได้โดยไม่ต้องต่อเน็ต
export function parseOpenMeteo(json) {
  const d = json.daily
  const h = json.hourly
  const humidityByDate = {}
  h.time.forEach((t, i) => {
    const date = t.slice(0, 10)
    const rh = h.relative_humidity_2m?.[i]
    if (typeof rh !== 'number') return
    ;(humidityByDate[date] ??= []).push(rh)
  })
  const avg = (arr) => (arr?.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null)

  const days = d.time.map((date, i) => ({
    date,
    code: d.weather_code[i],
    text: WMO_TEXT[d.weather_code[i]] ?? 'ไม่ทราบ',
    icon: wmoIcon(d.weather_code[i]),
    rainProb: d.precipitation_probability_max[i] ?? 0,
    rainMm: d.precipitation_sum[i] ?? 0,
    tMax: d.temperature_2m_max[i],
    tMin: d.temperature_2m_min[i],
    windMax: d.wind_speed_10m_max[i],
    gustMax: d.wind_gusts_10m_max?.[i] ?? null,
    et0: d.et0_fao_evapotranspiration?.[i] ?? null,
    humidity: avg(humidityByDate[date]),
    tmdText: null,
    tmdRainMm: null,
  }))
  const hours = h.time.map((t, i) => ({
    time: t,
    rainProb: h.precipitation_probability[i] ?? 0,
    rainMm: h.precipitation[i] ?? 0,
  }))
  return { days, hours }
}

async function fetchTmd() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const params = new URLSearchParams({
    lat: String(STATION_LAT),
    lon: String(STATION_LON),
    fields: 'tc_max,tc_min,rh,rain,ws10m,cond',
    date: today,
    duration: '7',
  })
  const res = await fetch(`https://data.tmd.go.th/nwpapi/v1/forecast/location/daily/at?${params}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${TMD_TOKEN}` },
  })
  if (!res.ok) throw new Error(`TMD ${res.status}`)
  const json = await res.json()
  const forecasts = json.WeatherForecasts?.[0]?.forecasts ?? []
  return forecasts.map((f) => ({
    date: f.time.slice(0, 10),
    text: TMD_COND[f.data.cond] ?? null,
    rainMm: f.data.rain ?? null,
  }))
}

// รวมคำพยากรณ์กรมอุตุฯ เข้ากับ Open-Meteo (กรมอุตุฯ ไม่มี % โอกาสฝน จึงใช้เป็นข้อมูลเสริม)
export function mergeTmd(days, tmd) {
  const byDate = Object.fromEntries(tmd.map((t) => [t.date, t]))
  return days.map((day) => {
    const t = byDate[day.date]
    return t ? { ...day, tmdText: t.text, tmdRainMm: t.rainMm } : day
  })
}

// ===== คำแนะนำสำหรับเกษตรกรนาเกลือ =====
// level: danger | warning | good | normal | poor
export function getDayAdvice(day) {
  const rainMm = Math.max(day.rainMm ?? 0, day.tmdRainMm ?? 0)
  const tmd = day.tmdText ?? ''
  const tmdRain = /ฝน/.test(tmd)
  const tmdHeavy = /หนัก|คะนอง/.test(tmd)
  const thunder = day.code >= 95 || /คะนอง/.test(tmd)
  const strongWind = (day.windMax ?? 0) >= WIND_STRONG_KMH || (day.gustMax ?? 0) >= GUST_STRONG_KMH
  const windText = Math.round(Math.max(day.windMax ?? 0, day.gustMax ?? 0))

  if (thunder || (strongWind && (day.rainProb >= RAIN_WATCH_PROB || rainMm >= RAIN_WATCH_MM))) {
    return {
      level: 'danger',
      title: 'ระวังพายุฝนฟ้าคะนอง',
      advice: `รื้อเกลือขึ้นกอง มัดผ้าใบให้แน่น ฟ้าร้องให้หลบเข้าที่ร่ม (ลมแรง ${windText} กม./ชม.)`,
    }
  }
  if (rainMm >= RAIN_HEAVY_MM || tmdHeavy) {
    return {
      level: 'danger',
      title: 'คาดว่าฝนตกหนัก',
      advice: `คลุมกองเกลือให้มิด อย่าเพิ่งไขน้ำเชื้อเข้านาปลง ดูคันนากับท่อ (ฝน ${Math.round(rainMm)} มม.)`,
    }
  }
  if (day.rainProb >= RAIN_ALERT_PROB || rainMm >= RAIN_ALERT_MM) {
    return {
      level: 'danger',
      title: 'ฝนน่าจะตก',
      advice: `รื้อเกลือขึ้นกองแล้วคลุมไว้ก่อน (ฝน ${day.rainProb}%)`,
    }
  }
  if (day.rainProb >= RAIN_WATCH_PROB || rainMm >= RAIN_WATCH_MM || tmdRain) {
    return {
      level: 'warning',
      title: 'อาจมีฝนตก',
      advice: `เตรียมผ้าใบไว้ใกล้มือ คอยดูฟ้า (${tmdRain && day.rainProb < RAIN_WATCH_PROB ? `กรมอุตุฯ คาดว่า${tmd}` : `ฝน ${day.rainProb}%`})`,
    }
  }
  if (strongWind) {
    return {
      level: 'warning',
      title: 'ลมแรง',
      advice: `มัดผ้าใบคลุมกองให้แน่น ระวังคลื่นกัดคันนา (ลม ${windText} กม./ชม.)`,
    }
  }
  if (
    (day.et0 ?? 0) >= GOOD_ET0_MM &&
    day.rainProb < GOOD_MAX_PROB &&
    rainMm < 0.5 &&
    (day.humidity === null || day.humidity < GOOD_MAX_HUMIDITY)
  ) {
    return {
      level: 'good',
      title: 'แดดดี ตากเกลือได้',
      advice: 'แดดดีลมดี ไขน้ำเชื้อเข้านาปลงได้ รื้อเกลือได้',
    }
  }
  if ((day.et0 !== null && day.et0 < POOR_ET0_MM) || (day.humidity ?? 0) > POOR_HUMIDITY) {
    return {
      level: 'poor',
      title: 'แดดน้อย น้ำแห้งช้า',
      advice: 'เกลือจะขึ้นช้ากว่าปกติหน่อย',
    }
  }
  return {
    level: 'normal',
    title: 'อากาศปกติ',
    advice: 'ทำนาได้ตามปกติ',
  }
}

// ฤดูทำเกลือประมาณ ธ.ค.–เม.ย. / เตรียมนา ต.ค.–พ.ย. / นอกฤดู พ.ค.–ก.ย.
export function getSeasonNote(date = new Date()) {
  const m = date.getMonth() + 1
  if (m >= 5 && m <= 9) return 'ขณะนี้อยู่นอกฤดูทำเกลือ ช่วงนี้เหมาะซ่อมคันนา เตรียมพื้นนา และเก็บรักษาเกลือในยุ้งให้แห้ง'
  if (m === 10 || m === 11) return 'ใกล้ฤดูทำเกลือ ใช้ฝนปลายฤดูช่วยละเลงและบดอัดพื้นนาได้'
  return null
}

// หาเวลาแรกใน 12 ชม. ข้างหน้าที่โอกาสฝนถึงเกณฑ์
export function findNextRain(hours, now = new Date()) {
  const nowKey = now.toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).slice(0, 13).replace(' ', 'T')
  const upcoming = hours.filter((h) => h.time.slice(0, 13) >= nowKey).slice(0, 12)
  const hit = upcoming.find((h) => h.rainProb >= HOURLY_RAIN_PROB || h.rainMm >= 0.5)
  if (!hit) return null
  return { time: hit.time.slice(11, 16), prob: hit.rainProb }
}

// ===== Hook =====
function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch { return null }
}
function writeCache(value) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)) } catch { /* ignore */ }
}

export function useWeather() {
  const [state, setState] = useState(() => {
    const cached = readCache()
    return {
      days: cached?.days ?? [],
      hours: cached?.hours ?? [],
      fetchedAt: cached?.fetchedAt ?? null,
      source: cached?.source ?? null,
      loading: true,
      error: null,
    }
  })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    try {
      const { days, hours } = await fetchOpenMeteo()
      let merged = days
      let source = 'Open-Meteo'
      if (TMD_TOKEN) {
        try {
          merged = mergeTmd(days, await fetchTmd())
          source = 'กรมอุตุนิยมวิทยา + Open-Meteo'
        } catch (err) {
          console.warn('TMD forecast unavailable:', err.message)
        }
      }
      const value = { days: merged, hours, fetchedAt: Date.now(), source }
      writeCache(value)
      setState({ ...value, loading: false, error: null })
    } catch (err) {
      // ออฟไลน์ / API ล่ม → ใช้ข้อมูลล่าสุดที่เคยโหลด พร้อมบอกผู้ใช้ว่าเป็นข้อมูลเก่า
      setState((s) => ({ ...s, loading: false, error: err.message || 'โหลดพยากรณ์อากาศไม่สำเร็จ' }))
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const today = state.days[0] ?? null
  return {
    ...state,
    today,
    todayAdvice: today ? getDayAdvice(today) : null,
    nextRain: findNextRain(state.hours),
    seasonNote: getSeasonNote(),
    reload: load,
  }
}
