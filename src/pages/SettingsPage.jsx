import { RED_MAX, YELLOW_MAX } from '../water'
import { BE_READY_MIN, BE_BITTER } from '../salinity'
import PlacePicker from '../PlacePicker'

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
        <p>ดูน้ำในนา ดีกรีน้ำ และฟ้าฝน สำหรับชาวนาเกลือ</p>
        <details>
          <summary>สำหรับช่างและครู</summary>
        <p>กล่องวัดน้ำ (ESP32) วัดระยะจากกล่องลงไปถึงผิวน้ำ ส่งค่ามาทุก 2 วินาที</p>
        <dl>
          <dt>นาเกลือ</dt><dd>{stationName}</dd>
          <dt>น้ำปกติ</dt><dd>กล่องวัดห่างผิวน้ำเกิน {YELLOW_MAX} ซม.</dd>
          <dt>น้ำเริ่มสูง</dt><dd>{RED_MAX}–{YELLOW_MAX} ซม.</dd>
          <dt>น้ำสูง อันตราย</dt><dd>{RED_MAX} ซม. หรือน้อยกว่า</dd>
          <dt>เกลือพร้อมเก็บ</dt><dd>{BE_READY_MIN}–{BE_BITTER} ดีกรี (°Bé)</dd>
          <dt>ฟ้าฝน</dt><dd>Open-Meteo / กรมอุตุนิยมวิทยา · {place.name} ({place.lat}, {place.lon})</dd>
          <dt>รุ่น</dt><dd>{version}</dd>
        </dl>
        </details>
        <p>PSR · SaltSense © 2026</p>
      </section>
    </div>
  )
}
