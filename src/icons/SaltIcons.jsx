// ไอคอนเฉพาะนาเกลือ — เส้นหนา อ่านง่ายกลางแดด ใช้สีจาก currentColor
// props เหมือน lucide: className และ props อื่นส่งต่อให้ <svg>

function Svg({ className, children, ...rest }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function PanSafe(props) {
  return (
    <Svg {...props}>
      <path d="M3 14h7v26h28V14h7" />
      <path d="M10 33h28v7H10z" fill="currentColor" opacity=".25" stroke="none" />
      <path d="M10 33q3.5-2 7 0t7 0 7 0 7 0" />
    </Svg>
  )
}

export function PanWarning(props) {
  return (
    <Svg {...props}>
      <path d="M3 14h7v26h28V14h7" />
      <path d="M10 20h28v20H10z" fill="currentColor" opacity=".25" stroke="none" />
      <path d="M10 20q3.5-2 7 0t7 0 7 0 7 0" />
      <path d="M10 14h28" strokeDasharray="3 4" />
    </Svg>
  )
}

export function PanDanger(props) {
  return (
    <Svg {...props}>
      <path d="M3 18h7v22h28V18h7" />
      <path d="M10 12h28v28H10z" fill="currentColor" opacity=".25" stroke="none" />
      <path d="M4 14q3-4 7-2t7 0 7 0 7 0 7 0 7 2" />
      <path d="M5 24v4M43 24v4" />
    </Svg>
  )
}

export function SaltForming(props) {
  return (
    <Svg {...props}>
      <path d="M3 14h7v26h28V14h7" />
      <path d="M10 30h28v10H10z" fill="currentColor" opacity=".25" stroke="none" />
      <path d="M10 30h28" />
      <rect x="14" y="25" width="5" height="5" />
      <rect x="22" y="24" width="6" height="6" />
      <rect x="31" y="26" width="4" height="4" />
    </Svg>
  )
}

export function SaltReady(props) {
  return (
    <Svg {...props}>
      <path d="M24 10l11 6v12l-11 6-11-6V16z" />
      <path d="M13 16l11 6 11-6M24 22v12" />
      <path d="M6 40h36" />
      <path d="M40 6v6M37 9h6M8 12v4M6 14h4" />
    </Svg>
  )
}

export function BitterWater(props) {
  return (
    <Svg {...props}>
      <path d="M24 5C18 15 11 22 11 30a13 13 0 0 0 26 0c0-8-7-15-13-25z" />
      <path d="M18 29h.01M30 29h.01" strokeWidth="4" />
      <path d="M18 37q6-5 12 0" />
    </Svg>
  )
}

export function CoverPile(props) {
  return (
    <Svg {...props}>
      <path d="M5 40Q24 8 43 40z" />
      <path d="M10 36q3.5 3 7 0t7 0 7 0 7 0" />
      <path d="M18 21l-8 19M30 21l8 19" />
      <path d="M14 4l-2 5M24 3l-2 5M34 4l-2 5" />
    </Svg>
  )
}

export function RainOnPan(props) {
  return (
    <Svg {...props}>
      <path d="M14 22a7 7 0 0 1 1-14 9 9 0 0 1 17 2 6 6 0 0 1 1 12z" />
      <path d="M17 27l-2 5M25 27l-2 5M33 27l-2 5" />
      <path d="M4 36h6v6h28v-6h6" />
    </Svg>
  )
}

export function SunDry(props) {
  return (
    <Svg {...props}>
      <circle cx="14" cy="14" r="6" />
      <path d="M14 3v2M3 14h2M6 6l1.5 1.5M22 6l-1.5 1.5" />
      <path d="M26 16h12a4 4 0 1 0-4-4M24 24h16" />
      <path d="M4 34h6v6h28v-6h6" />
    </Svg>
  )
}

export function SensorOn(props) {
  return (
    <Svg {...props}>
      <rect x="17" y="16" width="14" height="10" rx="2" />
      <path d="M24 26v16M14 42h20" />
      <path d="M16 10a11 11 0 0 1 16 0M20 13a5 5 0 0 1 8 0" />
    </Svg>
  )
}

export function SensorOff(props) {
  return (
    <Svg {...props}>
      <rect x="17" y="16" width="14" height="10" rx="2" />
      <path d="M24 26v16M14 42h20" />
      <path d="M16 10a11 11 0 0 1 16 0M20 13a5 5 0 0 1 8 0" />
      <path d="M8 6l32 36" />
    </Svg>
  )
}

export function Listen(props) {
  return (
    <Svg {...props}>
      <path d="M6 18h8l12-10v32L14 30H6z" fill="currentColor" fillOpacity=".2" />
      <path d="M32 17a9 9 0 0 1 0 14M37 12a16 16 0 0 1 0 24" />
    </Svg>
  )
}

export function Hydrometer(props) {
  return (
    <Svg {...props}>
      <path d="M21 4h6v22a6 6 0 1 1-6 0z" />
      <path d="M21 10h3M21 15h3M21 20h3" />
      <path d="M4 30q5-3 10 0t10 0 10 0 10 0" />
      <circle cx="24" cy="32" r="2" fill="currentColor" />
    </Svg>
  )
}

// ===== ไอคอนแถบเมนูล่าง =====

// ตอนนี้: นาเกลือมีน้ำ + ดวงอาทิตย์เล็ก
export function TabNow(props) {
  return (
    <Svg {...props}>
      <circle cx="35" cy="11" r="5" />
      <path d="M35 2v1.5M44 11h-1.5M41.5 4.5l-1 1M28.5 4.5l1 1" />
      <path d="M3 20h7v20h28V20h7" />
      <path d="M10 30h28v10H10z" fill="currentColor" opacity=".25" stroke="none" />
      <path d="M10 30q3.5-2 7 0t7 0 7 0 7 0" />
    </Svg>
  )
}

// 7 วัน: ปฏิทินมีช่องวันเล็กๆ
export function TabWeek(props) {
  return (
    <Svg {...props}>
      <rect x="6" y="9" width="36" height="33" rx="3" />
      <path d="M6 18h36M16 5v7M32 5v7" />
      <path
        d="M13 25h.01M20 25h.01M27 25h.01M34 25h.01M13 33h.01M20 33h.01M27 33h.01"
        strokeWidth="4.5"
      />
    </Svg>
  )
}

// ประวัติ/แจ้งเตือน: กระดิ่ง
export function TabHistory(props) {
  return (
    <Svg {...props}>
      <path d="M12 34V22a12 12 0 0 1 24 0v12l4 4H8z" />
      <path d="M20 42a4 4 0 0 0 8 0" />
      <path d="M24 6v4" />
    </Svg>
  )
}

// ตั้งค่า: ฟันเฟืองเรียบง่าย
export function TabSettings(props) {
  return (
    <Svg {...props}>
      <circle cx="24" cy="24" r="6" />
      <path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.6 10.6l4.2 4.2M33.2 33.2l4.2 4.2M10.6 37.4l4.2-4.2M33.2 14.8l4.2-4.2" />
      <circle cx="24" cy="24" r="13" />
    </Svg>
  )
}
