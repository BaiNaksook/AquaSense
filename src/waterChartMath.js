// คณิตของกราฟ "ห่างขีดอันตราย" — แยกออกมาเพื่อทดสอบได้โดยไม่ต้อง render
import { RED_MAX, YELLOW_MAX } from './water.js'

export const WARN_BAND = Math.round((YELLOW_MAX - RED_MAX) * 10) / 10 // 12.6
export const GAP_MS = 20_000

// แปลง {t, v: ระยะ} → {t, m: ห่างขีดอันตราย} เรียงตามเวลา ตัดค่าที่ไม่ใช่ตัวเลขทิ้ง
export function toMarginPoints(history) {
  return (history || [])
    .filter((p) => p && Number.isFinite(p.t) && Number.isFinite(p.v))
    .map((p) => ({ t: p.t, v: p.v, m: Math.round((p.v - RED_MAX) * 10) / 10 }))
    .sort((a, b) => a.t - b.t)
}

// ช่วงแกน y: ครอบทั้งขีดอันตราย (0) และขีดเฝ้าระวังเสมอ
export function yDomain(points) {
  const ms = points.map((p) => p.m)
  const lo = Math.min(...ms, -2) - 3
  const hi = Math.max(...ms, WARN_BAND) + 5
  return [lo, hi]
}

export function xDomain(points) {
  if (points.length === 0) return [0, 1]
  const a = points[0].t
  const b = points[points.length - 1].t
  return a === b ? [a - 30_000, b + 30_000] : [a, b]
}

// ตัดเส้นเมื่อเว้นช่วงนานกว่า GAP_MS (กล่องวัดหยุดส่ง)
export function splitSegments(points, gap = GAP_MS) {
  const segs = []
  let cur = []
  points.forEach((p, i) => {
    if (i > 0 && p.t - points[i - 1].t > gap) {
      segs.push(cur)
      cur = []
    }
    cur.push(p)
  })
  if (cur.length) segs.push(cur)
  return segs
}

// เส้นแบ่งแกน y ที่อ่านง่าย (1, 2, 5, 10, 20…)
export function niceTicks(lo, hi, target = 5) {
  const span = hi - lo
  if (!(span > 0)) return [lo]
  const raw = span / target
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((k) => k * pow).find((s) => s >= raw)
  const out = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
    out.push(Math.round(v * 10) / 10 + 0)
  }
  return out
}

// จุดที่เวลาใกล้ที่สุด (binary search)
export function nearestIndex(points, t) {
  if (points.length === 0) return -1
  let lo = 0
  let hi = points.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (points[mid].t < t) lo = mid
    else hi = mid
  }
  return Math.abs(points[lo].t - t) <= Math.abs(points[hi].t - t) ? lo : hi
}

export function hhmm(t) {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function fmt1(n) {
  return (Math.round(n * 10) / 10).toLocaleString('th-TH', { maximumFractionDigits: 1 })
}
