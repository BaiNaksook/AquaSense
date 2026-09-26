import { RED_MAX, YELLOW_MAX } from '../water'
import { BE_READY_MIN, BE_BITTER } from '../salinity'

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

export default function SettingsPage({ theme, onTheme, soundOn, onSound, stationName, version }) {
  return (
    <div className="settings">
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
          <dt>ฟ้าฝน</dt><dd>Open-Meteo / กรมอุตุนิยมวิทยา</dd>
          <dt>รุ่น</dt><dd>{version}</dd>
        </dl>
        <p>PSR · SaltSense © 2026</p>
      </section>
    </div>
  )
}
