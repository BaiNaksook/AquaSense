import { useEffect, useState } from 'react'
import { CircleCheck, TriangleAlert, OctagonAlert, CircleHelp } from 'lucide-react'
import { WATER_STATUS, RED_MAX } from '../water.js'
import '../styles/history.css'

const STATUS_ICON = { safe: CircleCheck, warning: TriangleAlert, danger: OctagonAlert, unknown: CircleHelp }

function StatusWord({ status }) {
  const key = WATER_STATUS[status] ? status : 'unknown'
  const Icon = STATUS_ICON[key]
  return (
    <span className="hs-word" data-state={key}>
      <Icon aria-hidden="true" />
      {WATER_STATUS[key].label}
    </span>
  )
}

export default function HistoryPage({ alertLog, onClear }) {
  const log = alertLog || []
  const [confirming, setConfirming] = useState(false)

  // ถ้ากดครั้งแรกแล้วไม่กดต่อ ให้กลับเป็นปุ่มปกติเองใน 6 วินาที
  useEffect(() => {
    if (!confirming) return undefined
    const id = setTimeout(() => setConfirming(false), 6000)
    return () => clearTimeout(id)
  }, [confirming])

  function clearAll() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    onClear?.()
  }

  return (
    <div className="hs">
      <header className="page-head hs-head">
        <div>
          <h1>ประวัติการแจ้งเตือน</h1>
          <p className="hs-head__sub muted">
            {log.length > 0 ? `บันทึกไว้ ${log.length} ครั้ง ล่าสุดอยู่บนสุด` : 'บันทึกทุกครั้งที่ระดับน้ำเปลี่ยนสถานะ'}
          </p>
        </div>
      </header>

      {log.length === 0 ? (
        <div className="panel hs-empty">
          <CircleCheck aria-hidden="true" />
          <p>ยังไม่มีการแจ้งเตือน</p>
          <p className="muted">เมื่อน้ำในนาเปลี่ยนจากปกติเป็นเฝ้าระวังหรืออันตราย จะบันทึกไว้ที่นี่</p>
        </div>
      ) : (
        <>
          <ol className="hs-list">
            {log.map((e) => {
              return (
                <li key={e.id} className="panel hs-item">
                  <p className="hs-item__when num">{e.date} · {e.time}</p>
                  <p className="hs-item__change">
                    เปลี่ยนจาก <StatusWord status={e.prevStatus} /> เป็น <StatusWord status={e.status} />
                  </p>
                  {Number.isFinite(Number(e.distance)) && e.distance !== null && (
                    <p className="hs-item__dist muted">
                      {e.distance - RED_MAX > 0
                        ? <>น้ำต่ำกว่าขีดอันตราย <span className="num">{Math.round(e.distance - RED_MAX)}</span> ซม.</>
                        : <>น้ำเกินขีดอันตราย <span className="num">{Math.round(RED_MAX - e.distance)}</span> ซม.</>}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>

          <div className="hs-clear" role="group" aria-label="ลบประวัติ">
            {confirming && (
              <p className="hs-clear__ask" role="status">ลบประวัติทั้งหมด {log.length} รายการ? ลบแล้วเอาคืนไม่ได้</p>
            )}
            <div className="hs-clear__row">
              <button
                type="button"
                className={`btn hs-clear__btn${confirming ? ' is-confirming' : ''}`}
                onClick={clearAll}
              >
                {confirming ? 'กดอีกครั้งเพื่อยืนยัน' : 'ลบทั้งหมด'}
              </button>
              {confirming && (
                <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>
                  ยกเลิก
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
