import { useEffect, useRef, useState } from 'react'

// ===== เสียงพูด: ใช้เสียงอัดจริงก่อน ถ้าไม่มีไฟล์ค่อยใช้เสียงอ่านอัตโนมัติ =====
// ประโยค = { text, clips } — ถ้ามีไฟล์ครบทุก clip จะเล่นไฟล์ต่อกัน ไม่งั้นอ่าน text ด้วยเสียงเครื่อง

const VOICE_BASE = `${import.meta.env?.BASE_URL ?? '/'}voice/`
const SENTENCE_GAP_MS = 280
const CLIP_GAP_MS = 30

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

// โหลดรายชื่อไฟล์เสียงที่อัดไว้แล้ว (public/voice/manifest.json) ครั้งเดียวต่อการเปิดหน้า
let manifestPromise = null
function loadManifest() {
  manifestPromise ??= fetch(`${VOICE_BASE}manifest.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : { clips: [] }))
    .then((m) => new Set(m.clips ?? []))
    .catch(() => new Set())
  return manifestPromise
}

export function useThaiSpeech() {
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voice, setVoice] = useState(null)
  const [recorded, setRecorded] = useState(() => new Set())
  const [speaking, setSpeaking] = useState(false)
  const audioRef = useRef(null)
  const timerRef = useRef(null)
  const runRef = useRef(0)

  useEffect(() => {
    let alive = true
    loadManifest().then((set) => { if (alive) setRecorded(set) })
    if (!ttsSupported) return () => { alive = false }
    const synth = window.speechSynthesis
    // รายชื่อเสียงโหลดช้าในบางเบราว์เซอร์ ต้องรอ voiceschanged
    const load = () => setVoice(pickThaiVoice(synth.getVoices()))
    load()
    synth.addEventListener?.('voiceschanged', load)
    return () => {
      alive = false
      synth.removeEventListener?.('voiceschanged', load)
      synth.cancel()
    }
  }, [ttsSupported])

  useEffect(() => () => {
    clearTimeout(timerRef.current)
    audioRef.current?.pause()
  }, [])

  const hasRecordings = recorded.size > 0
  // คำลงท้าย: เสียงอัดจริงเป็นผู้ชาย "ครับ" / เสียงเครื่องส่วนใหญ่เป็นผู้หญิง "ค่ะ"
  const polite = hasRecordings || (voice && MALE_VOICES.test(voice.name)) ? 'ครับ' : 'ค่ะ'
  const supported = ttsSupported || hasRecordings

  const stop = () => {
    runRef.current += 1
    clearTimeout(timerRef.current)
    audioRef.current?.pause()
    if (ttsSupported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  const speak = (lines) => {
    stop()
    const run = runRef.current
    const queue = lines.filter(Boolean)
    // ใช้ <audio> ตัวเดียวตลอด — iOS อนุญาตให้เล่นต่อได้เพราะเริ่มจากการกดปุ่ม
    audioRef.current ??= new Audio()
    const audio = audioRef.current
    const alive = () => runRef.current === run
    const later = (fn, ms) => { timerRef.current = setTimeout(() => alive() && fn(), ms) }

    const nextLine = () => {
      const item = queue.shift()
      if (!item) { setSpeaking(false); return }
      const clips = item.clips ?? []
      if (clips.length && clips.every((id) => recorded.has(id))) playClips([...clips])
      else if (ttsSupported) sayText(item.text)
      else later(nextLine, 0)
    }

    const playClips = (ids) => {
      const id = ids.shift()
      if (!id) { later(nextLine, SENTENCE_GAP_MS); return }
      audio.onended = () => later(() => playClips(ids), CLIP_GAP_MS)
      audio.onerror = () => later(() => playClips(ids), 0)
      audio.src = `${VOICE_BASE}${id}.mp3`
      audio.play().catch(() => later(() => playClips(ids), 0))
    }

    const sayText = (text) => {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'th-TH'
      if (voice) u.voice = voice
      u.rate = 0.95
      u.pitch = 1.05
      u.onend = () => later(nextLine, SENTENCE_GAP_MS)
      u.onerror = () => later(nextLine, 0)
      window.speechSynthesis.speak(u)
    }

    setSpeaking(true)
    nextLine()
  }

  return { supported, speaking, speak, stop, polite, hasRecordings }
}
