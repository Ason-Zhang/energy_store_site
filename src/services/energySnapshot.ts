import type {
  AlarmData,
  CommunicationData,
  DeviceTelemetry,
  SystemStatus,
  TelemetryData,
} from './mockDataService'

/**
 * 一次“全站数据快照”。
 * - 后端每 5 秒生成 1 条并入库（按 ts 记录）
 * - 前端通过 /api/latest 拉取最新快照用于渲染
 */
export interface EnergySnapshot {
  /** 服务器写库时间戳（ISO） */
  ts: string
  systemStatus: SystemStatus
  telemetryData: TelemetryData
  alarmData: AlarmData
  /** key 形如：ems-ems / bms-1 / battery-3 */
  communicationData: Record<string, CommunicationData>
  /** key 形如：bms-1 / battery-3 */
  deviceTelemetry: Record<string, DeviceTelemetry>
}

export interface EnergySnapshotRow {
  id: number
  ts: string
  data: EnergySnapshot
}


