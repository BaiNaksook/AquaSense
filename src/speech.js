import { useEffect, useRef, useState } from 'react'

// ===== เสียงอ่านให้ฟัง =====
// ทำให้ไม่ฟังเป็นหุ่นยนต์: เลือกเสียงคุณภาพดีที่สุดในเครื่อง, พูดเป็นประโยคสั้นๆ มีช่วงหายใจ,
// ใช้คำพูดแบบคนคุยกัน (หนึ่งทุ่ม / บ่ายสองโมง / ประมาณ 10 เซน) แทนการอ่านตัวเลขตรงๆ

// เสียง neural ของ Edge/Windows, Google และ Apple ฟังเป็นธรรมชาติกว่าเสียงพื้นฐาน
const VOICE_RANK = [/natural|online|neural/i, /premwadee|niwat/i, /google/i, /kanya|narisa/i]
const MALE_VOICES = /niwat|male|ชาย/i

function pickThaiVoice(voices) {
  const thai = voices.filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('th'))
  for (const pattern of VOICE_RANK) {
    const hit = thai.find((v) => pattern.test(v.name))
    if (hit) return hit
  }
  return thai[0] ?? null
}

// เวลาแบบที่คนไทยพูด: 19:00 → "หนึ่งทุ่ม", 14:00 → "บ่ายสองโมง"
const THAI_NUM = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า', 'สิบ', 'สิบเอ็ด']
export function spokenTime(hhmm) {
  const h = Number(hhmm.slice(0, 2))
  if (h === 0) return 'เที่ยงคืน'
  if (h <= 5) return `ตี${THAI_NUM[h]}`
  if (h <= 11) return `${THAI_NUM[h]}โมงเช้า`
  if (h === 12) return 'เที่ยง'
  if (h === 13) return 'บ่ายโมง'
  if (h <= 15) return `บ่าย${THAI_NUM[h - 12]}โมง`
  if (h <= 17) return `${THAI_NUM[h - 12]}โมงเย็น`
  return `${THAI_NUM[h - 18]}ทุ่ม`
}

export function useThaiSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voice, setVoice] = useState(null)
  const [speaking, setSpeaking] = useState(false)
  const queueRef = useRef([])
  const timerRef = useRef(null)

  // รายชื่อเสียงโหลดช้าในบางเบราว์เซอร์ ต้องรอ voiceschanged
  useEffect(() => {
    if (!supported) return
    const synth = window.speechSynthesis
    const load = () => setVoice(pickThaiVoice(synth.getVoices()))
    load()
    synth.addEventListener?.('voiceschanged', load)
    return () => {
      synth.removeEventListener?.('voiceschanged', load)
      synth.cancel()
      clearTimeout(timerRef.current)
    }
  }, [supported])

  // คำลงท้ายให้ตรงกับเสียง ผู้หญิง "ค่ะ" ผู้ชาย "ครับ"
  const polite = voice && MALE_VOICES.test(voice.name) ? 'ครับ' : 'ค่ะ'

  const stop = () => {
    if (!supported) return
    queueRef.current = []
    clearTimeout(timerRef.current)
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  // พูดทีละประโยค เว้นช่วงสั้นๆ ระหว่างประโยคเหมือนคนพูด
  const speak = (sentences) => {
    if (!supported) return
    stop()
    queueRef.current = sentences.filter(Boolean)
    const next = () => {
      const text = queueRef.current.shift()
      if (!text) { setSpeaking(false); return }
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'th-TH'
      if (voice) u.voice = voice
      u.rate = 0.95
      u.pitch = 1.05
      u.onend = () => { timerRef.current = setTimeout(next, 280) }
      u.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(u)
    }
    setSpeaking(true)
    next()
  }

  return { supported, speaking, speak, stop, polite }
}
