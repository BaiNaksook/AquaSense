import { PanSafe, PanWarning, PanDanger, SensorOff } from './SaltIcons.jsx'

// ไอคอนนาเกลือตามสถานะน้ำ (ใช้คู่กับ WATER_STATUS ใน water.js)
export const PAN_ICON = { safe: PanSafe, warning: PanWarning, danger: PanDanger, unknown: SensorOff }
