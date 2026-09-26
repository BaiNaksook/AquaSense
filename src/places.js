// ===== พื้นที่สำหรับพยากรณ์อากาศ =====
// พยากรณ์ของ Open-Meteo ละเอียดราว 9–13 กม. ต่อจุด — พิกัดระดับตำบลก็พอ
// พิกัดในรายการเป็นค่าประมาณของแหล่งนาเกลือหลัก ถ้าต้องการตรงแปลงให้ใช้ "ตำแหน่งของฉัน" (GPS)
const env = import.meta.env ?? {}

export const SALT_PLACES = [
  { id: 'nakhok', name: 'ต.นาโคก สมุทรสาคร', lat: 13.47, lon: 100.2 },
  { id: 'khokkham', name: 'ต.โคกขาม สมุทรสาคร', lat: 13.5, lon: 100.28 },
  { id: 'samutsongkhram', name: 'อ.เมืองสมุทรสงคราม', lat: 13.36, lon: 99.98 },
  { id: 'banlaem', name: 'อ.บ้านแหลม เพชรบุรี', lat: 13.2, lon: 99.98 },
  { id: 'sakhla', name: 'บ้านสาขลา สมุทรปราการ', lat: 13.54, lon: 100.52 },
  { id: 'bangpakong', name: 'อ.บางปะกง ฉะเชิงเทรา', lat: 13.48, lon: 100.97 },
]

// ค่าเริ่มต้น: ตั้งผ่าน .env ได้ (VITE_STATION_LAT / VITE_STATION_LON / VITE_PLACE_NAME)
export const DEFAULT_PLACE = Number(env.VITE_STATION_LAT) && Number(env.VITE_STATION_LON)
  ? {
      id: 'station',
      name: env.VITE_PLACE_NAME || 'ที่ตั้งกล่องวัดน้ำ',
      lat: Number(env.VITE_STATION_LAT),
      lon: Number(env.VITE_STATION_LON),
    }
  : SALT_PLACES[0]

export function placeKey(place) {
  return `${place.lat.toFixed(2)},${place.lon.toFixed(2)}`
}

// พิกัดต้องอยู่ในประเทศไทยคร่าวๆ — กันค่าผิดจาก GPS หรือ localStorage เสีย
export function isValidPlace(p) {
  return p && typeof p.lat === 'number' && typeof p.lon === 'number' &&
    p.lat > 5 && p.lat < 21 && p.lon > 97 && p.lon < 106 && typeof p.name === 'string'
}

export function gpsPlace(lat, lon) {
  const r = (v) => Math.round(v * 100) / 100
  return { id: 'gps', name: `ตำแหน่งของฉัน (${r(lat)}, ${r(lon)})`, lat: r(lat), lon: r(lon) }
}
