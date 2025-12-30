import type {
  AlarmData,
  BatteryGroup,
  CommunicationData,
  CoordinationUnit,
  DeviceTelemetry,
  SystemStatus,
  TelemetryData,
} from './mockDataService'
import type { EmsSnapshot } from '../modules/ems/models'
import type { FrontServerSnapshot } from '../modules/frontServer/models'
import type { AlarmStatsResponse } from './alarmStats'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  return (await res.json()) as T
}

export type DeviceTelemetryAllResponse = Array<{
  deviceType: string
  deviceId: number
  data: DeviceTelemetry
}>

export type CommunicationAllResponse = Array<{
  deviceType: string
  deviceId: string
  data: CommunicationData
}>

export type ControlCommands = {
  agc: { enabled: boolean; targetPower: number; rampRate: number; deadband: number }
  avc: { enabled: boolean; targetVoltage: number; voltageRange: { min: number; max: number } }
  manualPower: { enabled: boolean; targetPower: number }
}

export type ControlCommandsStatus = {
  ts: number | null
  actor: string | null
  username: string | null
}

export async function getLatestSystemStatus(): Promise<SystemStatus> {
  return fetchJson<SystemStatus>('/api/system-status/latest')
}

export async function getLatestTelemetry(): Promise<TelemetryData> {
  return fetchJson<TelemetryData>('/api/telemetry/latest')
}

export async function getLatestAlarmData(): Promise<AlarmData> {
  return fetchJson<AlarmData>('/api/alarm/latest')
}

export async function getAlarmStats(): Promise<AlarmStatsResponse> {
  return fetchJson<AlarmStatsResponse>('/api/alarm/stats')
}

export async function getLatestDeviceTelemetryAll(): Promise<DeviceTelemetryAllResponse> {
  return fetchJson<DeviceTelemetryAllResponse>('/api/device-telemetry/latest/all')
}

export async function getLatestCommunicationAll(): Promise<CommunicationAllResponse> {
  return fetchJson<CommunicationAllResponse>('/api/communication/latest/all')
}

export async function getDeviceCounts(): Promise<{
  batteryBins: number
  bms: number
  normal: number
  abnormal: number
}> {
  return fetchJson('/api/device-counts')
}

export async function getControlCommands(): Promise<ControlCommands> {
  return fetchJson<ControlCommands>('/api/control-commands')
}

export async function getControlCommandsStatus(): Promise<ControlCommandsStatus> {
  return fetchJson<ControlCommandsStatus>('/api/control-commands/status')
}

export async function setControlCommands(commands: ControlCommands): Promise<ControlCommands> {
  const res = await fetch('/api/control-commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(commands),
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for /api/control-commands`)
  }
  return (await res.json()) as ControlCommands
}

export async function getBatteryGroupsLatest(): Promise<BatteryGroup[]> {
  return fetchJson<BatteryGroup[]>('/api/battery-groups/latest')
}

export async function getCoordinationUnitsLatest(): Promise<CoordinationUnit[]> {
  return fetchJson<CoordinationUnit[]>('/api/coordination-units/latest')
}

export async function getLatestEmsSnapshot(): Promise<EmsSnapshot> {
  return fetchJson<EmsSnapshot>('/api/ems/latest')
}

export async function getLatestFrontServerSnapshot(): Promise<FrontServerSnapshot> {
  return fetchJson<FrontServerSnapshot>('/api/front-server/latest')
}

export type PlantSnapshot = {
  ts: number
  tsText: string
  batteryGroups: BatteryGroup[] | null
  coordinationUnits: CoordinationUnit[] | null
  emsSnapshot: EmsSnapshot | null
  frontServerSnapshot: FrontServerSnapshot | null
}

export async function getLatestPlantSnapshot(): Promise<PlantSnapshot> {
  return fetchJson<PlantSnapshot>('/api/plant/latest')
}

export async function resetBatteryGroup(
  groupId: number,
): Promise<{ ok: true; groupId: number; resetAt: number }> {
  const res = await fetch(`/api/battery-groups/${groupId}/reset`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for /api/battery-groups/${groupId}/reset`)
  }
  return (await res.json()) as { ok: true; groupId: number; resetAt: number }
}

export async function resetProtectionDevice(
  name: string,
): Promise<{ ok: true; name: string; resetAt: number }> {
  const n = String(name ?? '')
  const res = await fetch(`/api/protection-devices/${encodeURIComponent(n)}/reset`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for /api/protection-devices/${n}/reset`)
  }
  return (await res.json()) as { ok: true; name: string; resetAt: number }
}

export type HistoryRangeResponse = { minTs: number | null; maxTs: number | null; count: number }

export type HistoryBucket = 'raw' | '5s' | '10s' | '30s' | '1m' | '5m' | '15m' | '1h' | '6h' | '1d'

export type TelemetryHistoryPoint = {
  ts: number
  averageVoltage: number
  totalCurrent: number
  averageTemperature: number
  systemSOC: number
  systemSOH: number
  samples: number
}

export type SystemStatusHistoryPoint = {
  ts: number
  status: string
  loadAvg: number
  totalPowerAvg: number
  samples: number
}

export type AlarmSnapshotsHistoryPoint = {
  ts: number
  totalAlarms: number
  criticalAlarms: number
  warningAlarms: number
  infoAlarms: number
  samples: number
}

export type DeviceTelemetryHistoryPoint = {
  ts: number
  voltageAvg: number
  currentAvg: number
  temperatureAvg: number
  socAvg: number
  sohAvg: number
  powerAvg: number
  chargingStatus: string
  samples: number
}

export type CommunicationHistoryPoint = {
  ts: number
  status: string
  lastCommTime: string
  samples: number
}

function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export async function getHistoryRange(): Promise<HistoryRangeResponse> {
  return fetchJson<HistoryRangeResponse>('/api/history/range')
}

export async function getTelemetryHistory(params: {
  startTs?: number
  endTs?: number
  bucket?: HistoryBucket
  maxPoints?: number
}): Promise<TelemetryHistoryPoint[]> {
  return fetchJson(`/api/history/telemetry${qs(params)}`)
}

export async function getSystemStatusHistory(params: {
  startTs?: number
  endTs?: number
  bucket?: HistoryBucket
  maxPoints?: number
}): Promise<SystemStatusHistoryPoint[]> {
  return fetchJson(`/api/history/system-status${qs(params)}`)
}

export async function getAlarmSnapshotsHistory(params: {
  startTs?: number
  endTs?: number
  bucket?: HistoryBucket
  maxPoints?: number
}): Promise<AlarmSnapshotsHistoryPoint[]> {
  return fetchJson(`/api/history/alarm-snapshots${qs(params)}`)
}

export async function getDeviceTelemetryHistory(params: {
  type: string
  id: number
  startTs?: number
  endTs?: number
  bucket?: HistoryBucket
  maxPoints?: number
}): Promise<DeviceTelemetryHistoryPoint[]> {
  return fetchJson(`/api/history/device-telemetry${qs(params)}`)
}

export async function getCommunicationHistory(params: {
  type: string
  id: string
  startTs?: number
  endTs?: number
  bucket?: HistoryBucket
  maxPoints?: number
}): Promise<CommunicationHistoryPoint[]> {
  return fetchJson(`/api/history/communication${qs(params)}`)
}
