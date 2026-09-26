import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { SALT_PLACES, gpsPlace, isValidPlace } from './places'

// เลือกพื้นที่พยากรณ์: จากรายการแหล่งนาเกลือ หรือ GPS ของมือถือ
export default function PlacePicker({ place, onPlace, highlight = true }) {
  const [gps, setGps] = useState(null) // null | 'finding' | ข้อความผิดพลาด
  const useMyLocation = () => {
    if (!navigator.geolocation) { setGps('มือถือเครื่องนี้หาตำแหน่งไม่ได้ เลือกจากรายการแทน'); return }
    setGps('finding')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = gpsPlace(pos.coords.latitude, pos.coords.longitude)
        if (!isValidPlace(p)) { setGps('ตำแหน่งที่ได้อยู่นอกประเทศไทย เลือกจากรายการแทน'); return }
        setGps(null)
        onPlace(p)
      },
      (err) => setGps(err.code === 1
        ? 'ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง กด "อนุญาต" เมื่อมือถือถาม หรือเลือกจากรายการแทน'
        : 'หาตำแหน่งไม่สำเร็จ ลองออกไปที่โล่งแล้วกดใหม่'),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    )
  }
  return (
    <>
      <div className="places" role="group" aria-label="พื้นที่พยากรณ์อากาศ">
        {SALT_PLACES.map((p) => (
          <button key={p.id} type="button" aria-pressed={highlight && place.id === p.id} onClick={() => onPlace(p)}>
            {p.name}
          </button>
        ))}
        {highlight && !SALT_PLACES.some((p) => p.id === place.id) && (
          <button type="button" aria-pressed="true">{place.name}</button>
        )}
      </div>
      <button type="button" className="btn" onClick={useMyLocation} disabled={gps === 'finding'}>
        <MapPin className="w-5 h-5" aria-hidden="true" />
        {gps === 'finding' ? 'กำลังหาตำแหน่ง…' : 'ใช้ตำแหน่งของฉันตอนนี้ (ยืนอยู่ที่นา)'}
      </button>
      {gps && gps !== 'finding' && <p className="gps-status" role="status">{gps}</p>}
    </>
  )
}

