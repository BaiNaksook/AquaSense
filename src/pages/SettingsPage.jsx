import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { RED_MAX, YELLOW_MAX } from '../water'
import { BE_READY_MIN, BE_BITTER } from '../salinity'
import { SALT_PLACES, gpsPlace, isValidPlace } from '../places'

// เลือกพื้นที่พยากรณ์: จากรายการแหล่งนาเกลือ หรือ GPS ของมือถือ
function PlacePicker({ place, onPlace }) {
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
          <button key={p.id} type="button" aria-pressed={place.id === p.id} onClick={() => onPlace(p)}>
            {p.name}
          </button>
        ))}
        {!SALT_PLACES.some((p) => p.id === place.id) && (
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

function Choice({ id, value, options, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label} id={id}>
      {options.map(([key, text]) => (
        <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>
          {text}
        </button>
      ))}
    </div>
  )
}

export default function SettingsPage({ theme, onTheme, soundOn, onSound, place, onPlace, stationName, version }) {
  return (
    <div className="settings">
      <section className="panel setting">
        <h2>พื้นที่พยากรณ์อากาศ</h2>
        <p>เลือกที่ตั้งนาเกลือของคุณ ฟ้าฝนและวันเก็บเกลือจะคิดจากพื้นที่นี้ (ละเอียดระดับตำบล)</p>
        <PlacePicker place={place} onPlace={onPlace} />
      </section>

      <section className="panel setting">
        <h2>เสียงเตือนตอนน้ำอันตราย</h2>
        <p>ถ้าปิด จะไม่มีเสียงดังตอนน้ำสูง (ยังเห็นสีแดงบนจอ)</p>
        <Choice id="set-sound" label="เสียงเตือน" value={soundOn ? 'on' : 'off'} onChange={(v) => onSound(v === 'on')}
          options={[['on', 'เปิด'], ['off', 'ปิด']]} />
      </section>

      <section className="panel setting">
        <h2>สีหน้าจอ</h2>
        <p>กลางแดดจ้าแนะนำ "กลางวัน" · อัตโนมัติ = ตามที่ตั้งไว้ในมือถือ</p>
        <Choice id="set-theme" label="สีหน้าจอ" value={theme} onChange={onTheme}
          options={[['auto', 'อัตโนมัติ'], ['light', 'กลางวัน'], ['dark', 'กลางคืน']]} />
      </section>

      <section className="panel setting about">
        <h2>เกี่ยวกับ SaltSense</h2>
        <p>แอปดูน้ำและความเค็มในนาเกลือ กล่องวัดน้ำ (ESP32) ส่งค่ามาทุก 2 วินาที พร้อมพยากรณ์อากาศสำหรับชาวนาเกลือ</p>
        <dl>
          <dt>นาเกลือ</dt><dd>{stationName}</dd>
          <dt>น้ำปกติ</dt><dd>กล่องวัดห่างผิวน้ำเกิน {YELLOW_MAX} ซม.</dd>
          <dt>น้ำเริ่มสูง</dt><dd>{RED_MAX}–{YELLOW_MAX} ซม.</dd>
          <dt>น้ำสูง อันตราย</dt><dd>{RED_MAX} ซม. หรือน้อยกว่า</dd>
          <dt>เกลือพร้อมเก็บ</dt><dd>{BE_READY_MIN}–{BE_BITTER} ดีกรี (°Bé)</dd>
          <dt>ฟ้าฝน</dt><dd>Open-Meteo / กรมอุตุนิยมวิทยา · {place.name} ({place.lat}, {place.lon})</dd>
          <dt>รุ่น</dt><dd>{version}</dd>
        </dl>
        <p>PSR · SaltSense © 2026</p>
      </section>
    </div>
  )
}
