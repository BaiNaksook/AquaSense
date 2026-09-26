// ประมวลผลไฟล์เสียงที่อัดไว้ → public/voice/<id>.mp3 + manifest.json
//
//   npm run voice:process                 (อ่านจากโฟลเดอร์ voice-raw/)
//   npm run voice:process -- ที่อยู่โฟลเดอร์ --tempo 1.05
//
// ตั้งชื่อไฟล์ตาม id ในบท (docs/voice-recording.md) เช่น w-safe.m4a, n-20.wav — นามสกุลอะไรก็ได้
// ขั้นตอน: ตัดเสียงต่ำ (ลม/ไมค์) → ลดเสียงรบกวน → ตัดช่วงเงียบหัวท้าย → ปรับความดังให้เท่ากัน → mp3 mono
// ต้องมี ffmpeg: ติดตั้งเอง (Windows: winget install ffmpeg / Mac: brew install ffmpeg)
// หรือ npm i --no-save ffmpeg-static
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { CLIP_TEXT } from '../src/voiceClips.js'

const args = process.argv.slice(2)
const tempoAt = args.indexOf('--tempo')
const tempo = tempoAt >= 0 ? Number(args[tempoAt + 1]) : 1
const inputDir = args.find((a, i) => !a.startsWith('--') && i !== tempoAt + 1) ?? 'voice-raw'
const outDir = 'public/voice'
const AUDIO_EXT = new Set(['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.opus', '.webm', '.flac', '.amr', '.3gp'])

async function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH
  try {
    const mod = await import('ffmpeg-static')
    if (mod.default) return mod.default
  } catch { /* ไม่ได้ติดตั้ง ใช้ ffmpeg ในเครื่อง */ }
  return 'ffmpeg'
}

const ffmpeg = await findFfmpeg()
if (spawnSync(ffmpeg, ['-version']).status !== 0) {
  console.error('ไม่พบ ffmpeg — ติดตั้งก่อน (Windows: winget install ffmpeg / Mac: brew install ffmpeg) หรือ npm i --no-save ffmpeg-static')
  process.exit(1)
}
if (!existsSync(inputDir)) {
  console.error(`ไม่พบโฟลเดอร์ ${inputDir} — ใส่ไฟล์เสียงที่อัดไว้ในโฟลเดอร์นี้ก่อน`)
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04'
const filters = [
  'highpass=f=80',
  'afftdn=nf=-25',
  trim, 'areverse', trim, 'areverse',
  tempo !== 1 ? `atempo=${tempo}` : null,
  'loudnorm=I=-16:TP=-1.5:LRA=11',
].filter(Boolean).join(',')

const unknown = []
let done = 0
for (const file of readdirSync(inputDir)) {
  const ext = extname(file).toLowerCase()
  if (!AUDIO_EXT.has(ext)) continue
  const id = basename(file, extname(file))
  if (!CLIP_TEXT[id]) { unknown.push(file); continue }
  const r = spawnSync(ffmpeg, [
    '-y', '-loglevel', 'error', '-i', join(inputDir, file),
    '-af', filters, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k',
    join(outDir, `${id}.mp3`),
  ], { encoding: 'utf8' })
  if (r.status !== 0) console.error(`✗ ${file}: ${r.stderr.trim()}`)
  else { done += 1; console.log(`✓ ${id}  "${CLIP_TEXT[id]}"`) }
}

// manifest = ไฟล์ที่มีอยู่จริงทั้งหมด (รวมที่ประมวลผลไว้ก่อนหน้า)
const have = readdirSync(outDir).filter((f) => f.endsWith('.mp3')).map((f) => basename(f, '.mp3')).filter((id) => CLIP_TEXT[id]).sort()
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ clips: have }, null, 2) + '\n')

const missing = Object.keys(CLIP_TEXT).filter((id) => !have.includes(id))
console.log(`\nประมวลผลแล้ว ${done} ไฟล์ · มีเสียงทั้งหมด ${have.length}/${Object.keys(CLIP_TEXT).length}`)
if (unknown.length) console.log(`ชื่อไฟล์ไม่ตรงกับบท (ข้าม): ${unknown.join(', ')}`)
if (missing.length) console.log(`ยังไม่ได้อัด: ${missing.join(', ')}`)
