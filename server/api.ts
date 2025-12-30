import type { Db } from './db.js'
import {
  generateBatteryGroups,
  resetBatteryGroupFault,
  setBatteryGroupFaultLatched,
} from '../src/services/mockDataService.js'
import { resetProtectionDeviceLatch as resetProtectionDeviceLatchLocal } from '../src/modules/ems/decisionEngine.js'
import type { FrontServerSnapshot } from '../src/modules/frontServer/models.js'
import type {
  Alarm,
  AlarmData,
  CommFrame,
  CommunicationData,
  CoordinationUnit,
  BatteryGroup,
  DeviceTelemetry,
  SystemStatus,
  TelemetryData,
} from '../src/services/mockDataService.js'
import type { EmsSnapshot } from '../src/modules/ems/models.js'
import type {
  AlarmStatsBreakdownItem,
  AlarmStatsResponse,
  AlarmStatsWindowKey,
} from '../src/services/alarmStats.js'

import { computeAutoPowerDecision } from './emsAutoPower.js'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

type TelemetryHistoryRow = {
  ts: number
  averageVoltage: number
  totalCurrent: number
  averageTemperature: number
  systemSOC: number
  systemSOH: number
  samples: number
}

type SystemStatusHistoryRow = {
  ts: number
  status: string
  loadAvg: number
  totalPowerAvg: number
  samples: number
}

type AlarmSnapshotsHistoryRow = {
  ts: number
  totalAlarms: number
  criticalAlarms: number
  warningAlarms: number
  infoAlarms: number
  samples: number
}

type DeviceTelemetryHistoryRow = {
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

type CommunicationHistoryRow = {
  ts: number
  status: string
  lastCommTime: string
  samples: number
}

type ControlCommands = {
  agc: { enabled: boolean; targetPower: number; rampRate: number; deadband: number }
  avc: { enabled: boolean; targetVoltage: number; voltageRange: { min: number; max: number } }
  manualPower: { enabled: boolean; targetPower: number }
}

type ControlCommandsMeta = {
  actor: string
  agcProvided: boolean
  avcProvided: boolean
  manualPowerProvided: boolean
}

type ControlCommandsStatus = {
  ts: number | null
  actor: string | null
  username: string | null
}

type ControlCommandsWriteMeta = {
  actor: string
  username?: string
  ip?: string
}

type ControlCommandLogItem = {
  id: number
  ts: number
  actor: string
  username: string | null
  ip: string | null
  commands: ControlCommands
}

type AlarmOccurrence = {
  id: number
  ts: number
  groupId: number | null
  source: string
  device: string
  type: string
  level: 'critical' | 'warning' | 'info'
  description: string
  status: 'active' | 'resolved'
}

type BatteryLatchRow = {
  groupId: number
  latched: number
  latchedAt: number | null
  reason: string | null
  lastResetAt: number | null
  updatedAt: number
}

type BatteryLatch = {
  groupId: number
  latched: boolean
  latchedAt: number | null
  reason: string | null
  lastResetAt: number | null
  updatedAt: number
}

type ScadaNotification = {
  id: number
  ts: number
  groupId: number | null
  level: 'critical' | 'warning' | 'info'
  message: string
  acknowledged: boolean
  meta: Record<string, unknown>
}

const defaultControlCommands = (): ControlCommands => ({
  agc: { enabled: false, targetPower: 0, rampRate: 10, deadband: 5 },
  avc: { enabled: false, targetVoltage: 400, voltageRange: { min: 380, max: 420 } },
  manualPower: { enabled: false, targetPower: 0 },
})

type CommRow = {
  ts: number
  deviceType: string
  deviceId: string
  status: CommunicationData['status']
  lastCommTime: string
  modbusPacketsJson: string
  connectedDevicesJson: string
}

type CommFrameRow = {
  ts: number
  linkKey: string
  protocol: string
  direction: string
  fromDevice: string
  toDevice: string
  ok: number
  status: string
  latencyMs: number
  bytes: number
  summary: string
  payloadHex: string
  error: string | null
}

type DeviceTelemetryRow = {
  ts: number
  deviceType: string
  deviceId: number
  voltage: number
  current: number
  temperature: number
  soc: number
  soh: number
  power: number
  chargingStatus: DeviceTelemetry['chargingStatus']
}

export function createApi(db: Db) {
  const fmtTs = (ms: number): string => {
    return new Date(ms).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const parseJson = <T>(json: string | null | undefined, fallback: T): T => {
    if (!json) return fallback
    try {
      return JSON.parse(json) as T
    } catch {
      return fallback
    }
  }

  const buildDeviceKey = (deviceType: string, deviceId: string): string => {
    return deviceType === 'ems' ? 'ems-ems' : `${deviceType}-${deviceId}`
  }

  const getControlCommandsStmt = db.prepare(
    `SELECT ts, json, actor, username FROM control_commands WHERE id = 1 LIMIT 1`,
  )
  const upsertControlCommandsStmt = db.prepare(
    `INSERT INTO control_commands(id, ts, json, actor, username)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ts = excluded.ts, json = excluded.json, actor = excluded.actor, username = excluded.username`,
  )

  const insertControlCommandLogStmt = db.prepare(
    `INSERT INTO control_command_logs(ts, actor, username, ip, json) VALUES (?, ?, ?, ?, ?)`,
  )
  const selectControlCommandLogsStmt = db.prepare(
    `SELECT id, ts, actor, username, ip, json FROM control_command_logs ORDER BY ts DESC LIMIT ? OFFSET ?`,
  )

  const selectRecentAlarmOccurrencesStmt = db.prepare(
    `SELECT id, ts, groupId, source, device, type, level, description, status
     FROM alarm_occurrences
     ORDER BY ts DESC
     LIMIT ? OFFSET ?`,
  )

  const selectBatteryLatchesStmt = db.prepare(
    `SELECT groupId, latched, latchedAt, reason, lastResetAt, updatedAt
     FROM battery_latches
     ORDER BY groupId ASC`,
  )

  const selectLatestBatteryGroupsSnapshotStmt = db.prepare(
    `SELECT json FROM battery_groups_snapshots ORDER BY ts DESC LIMIT 1`,
  )

  const selectLatestCoordinationUnitsSnapshotStmt = db.prepare(
    `SELECT json FROM coordination_units_snapshots ORDER BY ts DESC LIMIT 1`,
  )

  const selectLatestEmsSnapshotStmt = db.prepare(
    `SELECT json FROM ems_snapshots ORDER BY ts DESC LIMIT 1`,
  )

  const selectLatestFrontServerSnapshotStmt = db.prepare(
    `SELECT json FROM front_server_snapshots ORDER BY ts DESC LIMIT 1`,
  )

  const selectLatestSnapshotTsStmt = db.prepare(`SELECT ts FROM snapshots ORDER BY ts DESC LIMIT 1`)

  const selectBatteryGroupsSnapshotByTsStmt = db.prepare(
    `SELECT json FROM battery_groups_snapshots WHERE ts = ? LIMIT 1`,
  )
  const selectCoordinationUnitsSnapshotByTsStmt = db.prepare(
    `SELECT json FROM coordination_units_snapshots WHERE ts = ? LIMIT 1`,
  )
  const selectEmsSnapshotByTsStmt = db.prepare(
    `SELECT json FROM ems_snapshots WHERE ts = ? LIMIT 1`,
  )
  const selectFrontServerSnapshotByTsStmt = db.prepare(
    `SELECT json FROM front_server_snapshots WHERE ts = ? LIMIT 1`,
  )

  const selectLatestCriticalOccurrenceForLatchStmt = db.prepare(
    `SELECT ts, source, device, type, level, description
     FROM alarm_occurrences
     WHERE groupId = ?
       AND ts <= ?
       AND level = 'critical'
       AND type <> '锁存'
     ORDER BY ts DESC
     LIMIT 1`,
  )

  const selectLastThreeOccurrencesForLatchWindowStmt = db.prepare(
    `SELECT ts, source, device, type, level, description
     FROM alarm_occurrences
     WHERE groupId = ?
       AND ts BETWEEN ? AND ?
       AND (level = 'warning' OR level = 'critical')
       AND type <> '锁存'
     ORDER BY ts DESC
     LIMIT 3`,
  )

  const selectRecentOccurrencesBeforeLatchStmt = db.prepare(
    `SELECT ts, source, device, type, level, description
     FROM alarm_occurrences
     WHERE groupId = ?
       AND ts <= ?
       AND (level = 'warning' OR level = 'critical')
       AND type <> '锁存'
     ORDER BY ts DESC
     LIMIT ?`,
  )

  const selectLatestLatchOccurrenceTsStmt = db.prepare(
    `SELECT ts
     FROM alarm_occurrences
     WHERE groupId = ?
       AND type = '锁存'
     ORDER BY ts DESC
     LIMIT 1`,
  )

  const upsertBatteryLatchStmt = db.prepare(
    `INSERT INTO battery_latches(groupId, latched, latchedAt, reason, lastResetAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(groupId)
     DO UPDATE SET
       latched = excluded.latched,
       latchedAt = excluded.latchedAt,
       reason = excluded.reason,
       lastResetAt = excluded.lastResetAt,
       updatedAt = excluded.updatedAt`,
  )

  const resolveAlarmOccurrencesByGroupStmt = db.prepare(
    `UPDATE alarm_occurrences
     SET status = 'resolved'
     WHERE groupId = ? AND status = 'active'`,
  )

  const insertAlarmOccurrenceStmt = db.prepare(
    `INSERT INTO alarm_occurrences(ts, groupId, source, device, type, level, description, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  const insertScadaNotificationStmt = db.prepare(
    `INSERT INTO scada_notifications(ts, groupId, level, message, acknowledged, metaJson)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )

  const selectLatestScadaNotificationsStmt = db.prepare(
    `SELECT id, ts, groupId, level, message, acknowledged, metaJson
     FROM scada_notifications
     ORDER BY ts DESC
     LIMIT ? OFFSET ?`,
  )

  const selectCommFramesForDeviceStmt = db.prepare(
    `SELECT ts, linkKey, protocol, direction, fromDevice, toDevice, ok, status, latencyMs, bytes, summary, payloadHex, error
     FROM comm_frames
     WHERE fromDevice = ? OR toDevice = ?
     ORDER BY ts DESC, id DESC
     LIMIT ?`,
  )

  function getSnapshotRange(): { minTs: number | null; maxTs: number | null; count: number } {
    const row = db
      .prepare(`SELECT MIN(ts) AS minTs, MAX(ts) AS maxTs, COUNT(*) AS count FROM snapshots`)
      .get() as { minTs: number | null; maxTs: number | null; count: number } | undefined
    return {
      minTs: row?.minTs ?? null,
      maxTs: row?.maxTs ?? null,
      count: row?.count ?? 0,
    }
  }

  function getRecentAlarmOccurrences(params?: {
    limit?: number
    offset?: number
  }): AlarmOccurrence[] {
    const limit = clamp(typeof params?.limit === 'number' ? params.limit : 80, 1, 1000)
    const offset = clamp(typeof params?.offset === 'number' ? params.offset : 0, 0, 100_000)
    const rows = selectRecentAlarmOccurrencesStmt.all(limit, offset) as AlarmOccurrence[]
    return rows
  }

  function getBatteryLatches(): BatteryLatch[] {
    const rows = selectBatteryLatchesStmt.all() as BatteryLatchRow[]
    return rows.map((r) => ({
      groupId: r.groupId,
      latched: Boolean(r.latched),
      latchedAt: r.latchedAt ?? null,
      reason: r.reason ?? null,
      lastResetAt: r.lastResetAt ?? null,
      updatedAt: r.updatedAt,
    }))
  }

  function getLatestScadaNotifications(params?: {
    limit?: number
    offset?: number
  }): ScadaNotification[] {
    const limit = clamp(typeof params?.limit === 'number' ? params.limit : 50, 1, 500)
    const offset = clamp(typeof params?.offset === 'number' ? params.offset : 0, 0, 100_000)
    const rows = selectLatestScadaNotificationsStmt.all(limit, offset) as Array<{
      id: number
      ts: number
      groupId: number | null
      level: 'critical' | 'warning' | 'info'
      message: string
      acknowledged: number
      metaJson: string
    }>
    return rows.map((r) => ({
      id: r.id,
      ts: r.ts,
      groupId: r.groupId,
      level: r.level,
      message: r.message,
      acknowledged: Boolean(r.acknowledged),
      meta: (() => {
        try {
          return JSON.parse(r.metaJson) as Record<string, unknown>
        } catch {
          return {}
        }
      })(),
    }))
  }

  function getBatteryGroupsLatest(): ReturnType<typeof generateBatteryGroups> {
    const commands = getControlCommands()
    const groups = (() => {
      const row = selectLatestBatteryGroupsSnapshotStmt.get() as { json: string } | undefined
      const fromDb = row?.json
        ? parseJson<ReturnType<typeof generateBatteryGroups>>(row.json, [])
        : null
      if (fromDb && Array.isArray(fromDb) && fromDb.length > 0) return fromDb
      return generateBatteryGroups(10, commands)
    })()
    const latches = new Map(getBatteryLatches().map((x) => [x.groupId, x]))

    const fmt = (ms: number): string => {
      return new Date(ms).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    }

    const inferredFaultReason = (g: (typeof groups)[number]): string | null => {
      const bms = g.bms
      if (bms.insulationResistanceKohm <= 150) {
        return `故障原因：绝缘电阻过低（${bms.insulationResistanceKohm}kΩ）`
      }
      if (bms.deltaCellVoltageMv >= 65) {
        return `故障原因：单体最大压差过大（${bms.deltaCellVoltageMv}mV）`
      }
      if (bms.maxCellTempC >= 60) {
        return `故障原因：单体温度过高（${bms.maxCellTempC}℃）`
      }
      return null
    }

    for (const g of groups) {
      const l = latches.get(g.id)
      if (l?.latched) {
        g.status = 'error'
        g.pcs.status = 'error'
        g.pcs.runningState = 'fault'
        g.bms.status = 'error'
        g.bms.faultCount = Math.max(1, g.bms.faultCount)

        const latchedAt =
          l.latchedAt ??
          (selectLatestLatchOccurrenceTsStmt.get(g.id) as { ts: number } | undefined)?.ts ??
          Date.now()
        if (l.reason === 'critical_alarm') {
          const occ = selectLatestCriticalOccurrenceForLatchStmt.get(g.id, latchedAt) as
            | {
                ts: number
                source: string
                device: string
                type: string
                level: string
                description: string
              }
            | undefined

          const lines = ['锁存原因：关键告警触发（critical）']
          if (occ) {
            lines.push(
              `触发告警：${fmt(occ.ts)} | ${occ.device} | ${occ.type} | ${occ.description}`,
            )
          } else {
            lines.push('触发告警：未找到对应 critical 告警（可能已被清理或时间窗口不足）')
          }
          g.faultReason = lines.join('\n')
        } else if (l.reason === '3_warnings_1m') {
          const windowStart = latchedAt - 60_000
          let rows = selectLastThreeOccurrencesForLatchWindowStmt.all(
            g.id,
            windowStart,
            latchedAt,
          ) as Array<{
            ts: number
            source: string
            device: string
            type: string
            level: string
            description: string
          }>

          if (rows.length < 3) {
            rows = selectRecentOccurrencesBeforeLatchStmt.all(g.id, latchedAt, 10) as Array<{
              ts: number
              source: string
              device: string
              type: string
              level: string
              description: string
            }>
          }

          if (rows.length === 0) {
            rows = selectRecentOccurrencesBeforeLatchStmt.all(g.id, latchedAt, 3) as Array<{
              ts: number
              source: string
              device: string
              type: string
              level: string
              description: string
            }>
          }

          const lines = ['锁存原因：1分钟内告警>=3次']
          const ordered = rows.slice(0, 3).reverse()
          for (let i = 0; i < ordered.length; i++) {
            const r = ordered[i]
            lines.push(`${i + 1}) ${fmt(r.ts)} | ${r.device} | ${r.type} | ${r.description}`)
          }
          if (ordered.length < 3) {
            lines.push('（告警明细不足 3 条：可能尚未积累到完整窗口，或数据被清理）')
          }
          g.faultReason = lines.join('\n')
        } else {
          g.faultReason = l.reason ? `锁存原因：${l.reason}` : '锁存原因：未知'
        }
      } else {
        g.faultReason = g.status === 'error' ? inferredFaultReason(g) : null
      }
    }
    return groups
  }

  function getCoordinationUnitsLatest() {
    const row = selectLatestCoordinationUnitsSnapshotStmt.get() as { json: string } | undefined
    return row?.json ? parseJson(row.json, []) : []
  }

  function getLatestEmsSnapshot() {
    const row = selectLatestEmsSnapshotStmt.get() as { json: string } | undefined
    return row?.json ? parseJson(row.json, null) : null
  }

  function getLatestFrontServerSnapshot(): FrontServerSnapshot | null {
    const row = selectLatestFrontServerSnapshotStmt.get() as { json: string } | undefined
    return row?.json ? parseJson<FrontServerSnapshot | null>(row.json, null) : null
  }

  function getLatestPlantSnapshot(): {
    ts: number
    tsText: string
    batteryGroups: BatteryGroup[] | null
    coordinationUnits: CoordinationUnit[] | null
    emsSnapshot: EmsSnapshot | null
    frontServerSnapshot: FrontServerSnapshot | null
  } | null {
    const head = selectLatestSnapshotTsStmt.get() as { ts: number } | undefined
    const ts = head?.ts
    if (typeof ts !== 'number') return null

    const batteryGroupsRow = selectBatteryGroupsSnapshotByTsStmt.get(ts) as
      | { json: string }
      | undefined
    const coordinationUnitsRow = selectCoordinationUnitsSnapshotByTsStmt.get(ts) as
      | { json: string }
      | undefined
    const emsRow = selectEmsSnapshotByTsStmt.get(ts) as { json: string } | undefined
    const fsRow = selectFrontServerSnapshotByTsStmt.get(ts) as { json: string } | undefined

    return {
      ts,
      tsText: fmtTs(ts),
      batteryGroups: batteryGroupsRow?.json
        ? parseJson<BatteryGroup[] | null>(batteryGroupsRow.json, null)
        : null,
      coordinationUnits: coordinationUnitsRow?.json
        ? parseJson<CoordinationUnit[] | null>(coordinationUnitsRow.json, null)
        : null,
      emsSnapshot: emsRow?.json ? parseJson<EmsSnapshot | null>(emsRow.json, null) : null,
      frontServerSnapshot: fsRow?.json
        ? parseJson<FrontServerSnapshot | null>(fsRow.json, null)
        : null,
    }
  }

  function resetBatteryGroup(
    groupId: number,
    meta?: { actor?: string; ip?: string },
  ): {
    ok: true
    groupId: number
    resetAt: number
  } {
    const now = Date.now()
    const actor = meta?.actor ?? 'local'
    const ip = meta?.ip ?? null

    const tx = db.transaction(() => {
      // 清除后端模拟状态（告警/故障窗口）
      resetBatteryGroupFault(groupId)

      // 确保解除 sim 锁存（避免 DB 已复位但 sim 仍阻塞）
      setBatteryGroupFaultLatched(groupId, false)

      // 清除锁存
      upsertBatteryLatchStmt.run(groupId, 0, null, null, now, now)

      // 同步清除“保护/安全装置”中的跳闸锁存（否则 BEW 可能在电池组复位后仍保持跳闸）
      resetProtectionDeviceLatchLocal('电池预警系统(BEW)')

      // 将该组所有 active 记录标记为 resolved（保留历史）
      resolveAlarmOccurrencesByGroupStmt.run(groupId)

      // 写入一条“复位事件”到告警流
      insertAlarmOccurrenceStmt.run(
        now,
        groupId,
        `BAT-${groupId}`,
        `电池组 ${groupId}`,
        '人工复位',
        'info',
        `电池组 ${groupId} 已人工复位`,
        'resolved',
      )

      insertScadaNotificationStmt.run(
        now,
        groupId,
        'info',
        `SCADA: 电池组 ${groupId} 人工复位`,
        0,
        JSON.stringify({ actor, ip }),
      )
    })

    tx()
    return { ok: true, groupId, resetAt: now }
  }

  function resetProtectionDevice(name: string): { ok: true; name: string; resetAt: number } {
    const now = Date.now()
    const n = String(name ?? '').trim()
    if (!n) return { ok: true, name: '', resetAt: now }
    resetProtectionDeviceLatchLocal(n)
    return { ok: true, name: n, resetAt: now }
  }

  function clampRange(input: {
    startTs?: number
    endTs?: number
    maxPoints?: number
    defaultWindowMs?: number
  }): { startTs: number; endTs: number; maxPoints: number } {
    const range = getSnapshotRange()
    const endDefault = range.maxTs ?? Date.now()
    const endTs = Number.isFinite(input.endTs) ? (input.endTs as number) : endDefault
    const defaultWindow = input.defaultWindowMs ?? 60 * 60_000
    const startDefault = endTs - defaultWindow
    const startTs = Number.isFinite(input.startTs) ? (input.startTs as number) : startDefault
    const maxPoints = clamp(
      Number.isFinite(input.maxPoints) ? (input.maxPoints as number) : 1200,
      10,
      5000,
    )
    return {
      startTs: Math.min(startTs, endTs),
      endTs: Math.max(startTs, endTs),
      maxPoints,
    }
  }

  // bucketMs: null/0 表示 raw；否则按 bucketMs 聚合（ts 为毫秒）
  function getTelemetryHistory(params: {
    startTs?: number
    endTs?: number
    bucketMs?: number | null
    maxPoints?: number
  }): TelemetryHistoryRow[] {
    const { startTs, endTs, maxPoints } = clampRange({ ...params, defaultWindowMs: 60 * 60_000 })
    const bucketMs =
      typeof params.bucketMs === 'number' && params.bucketMs > 0 ? params.bucketMs : null

    if (!bucketMs) {
      return db
        .prepare(
          `
          SELECT ts, averageVoltage, totalCurrent, averageTemperature, systemSOC, systemSOH, 1 AS samples
          FROM telemetry
          WHERE ts BETWEEN ? AND ?
          ORDER BY ts ASC
          LIMIT ?
        `,
        )
        .all(startTs, endTs, maxPoints) as TelemetryHistoryRow[]
    }

    return db
      .prepare(
        `
        WITH grouped AS (
          SELECT
            CAST(ts / ? AS INTEGER) * ? AS ts,
            AVG(averageVoltage) AS averageVoltage,
            AVG(totalCurrent) AS totalCurrent,
            AVG(averageTemperature) AS averageTemperature,
            AVG(systemSOC) AS systemSOC,
            AVG(systemSOH) AS systemSOH,
            COUNT(*) AS samples
          FROM telemetry
          WHERE ts BETWEEN ? AND ?
          GROUP BY CAST(ts / ? AS INTEGER)
          ORDER BY ts ASC
          LIMIT ?
        )
        SELECT * FROM grouped
      `,
      )
      .all(bucketMs, bucketMs, startTs, endTs, bucketMs, maxPoints) as TelemetryHistoryRow[]
  }

  function getSystemStatusHistory(params: {
    startTs?: number
    endTs?: number
    bucketMs?: number | null
    maxPoints?: number
  }): SystemStatusHistoryRow[] {
    const { startTs, endTs, maxPoints } = clampRange({ ...params, defaultWindowMs: 60 * 60_000 })
    const bucketMs =
      typeof params.bucketMs === 'number' && params.bucketMs > 0 ? params.bucketMs : null

    if (!bucketMs) {
      return db
        .prepare(
          `
          SELECT ts, status, load AS loadAvg, totalPower AS totalPowerAvg, 1 AS samples
          FROM system_status
          WHERE ts BETWEEN ? AND ?
          ORDER BY ts ASC
          LIMIT ?
        `,
        )
        .all(startTs, endTs, maxPoints) as SystemStatusHistoryRow[]
    }

    return db
      .prepare(
        `
        WITH grouped AS (
          SELECT
            CAST(ts / ? AS INTEGER) * ? AS ts,
            MAX(ts) AS maxTs,
            AVG(load) AS loadAvg,
            AVG(totalPower) AS totalPowerAvg,
            COUNT(*) AS samples
          FROM system_status
          WHERE ts BETWEEN ? AND ?
          GROUP BY CAST(ts / ? AS INTEGER)
          ORDER BY ts ASC
          LIMIT ?
        )
        SELECT
          g.ts AS ts,
          (SELECT status FROM system_status s2 WHERE s2.ts = g.maxTs LIMIT 1) AS status,
          g.loadAvg AS loadAvg,
          g.totalPowerAvg AS totalPowerAvg,
          g.samples AS samples
        FROM grouped g
      `,
      )
      .all(bucketMs, bucketMs, startTs, endTs, bucketMs, maxPoints) as SystemStatusHistoryRow[]
  }

  function getAlarmSnapshotsHistory(params: {
    startTs?: number
    endTs?: number
    bucketMs?: number | null
    maxPoints?: number
  }): AlarmSnapshotsHistoryRow[] {
    const { startTs, endTs, maxPoints } = clampRange({
      ...params,
      defaultWindowMs: 6 * 60 * 60_000,
    })
    const bucketMs =
      typeof params.bucketMs === 'number' && params.bucketMs > 0 ? params.bucketMs : null

    if (!bucketMs) {
      return db
        .prepare(
          `
          SELECT ts, totalAlarms, criticalAlarms, warningAlarms, infoAlarms, 1 AS samples
          FROM alarm_snapshots
          WHERE ts BETWEEN ? AND ?
          ORDER BY ts ASC
          LIMIT ?
        `,
        )
        .all(startTs, endTs, maxPoints) as AlarmSnapshotsHistoryRow[]
    }

    return db
      .prepare(
        `
        WITH grouped AS (
          SELECT
            CAST(ts / ? AS INTEGER) * ? AS ts,
            AVG(totalAlarms) AS totalAlarms,
            AVG(criticalAlarms) AS criticalAlarms,
            AVG(warningAlarms) AS warningAlarms,
            AVG(infoAlarms) AS infoAlarms,
            COUNT(*) AS samples
          FROM alarm_snapshots
          WHERE ts BETWEEN ? AND ?
          GROUP BY CAST(ts / ? AS INTEGER)
          ORDER BY ts ASC
          LIMIT ?
        )
        SELECT
          ts,
          CAST(totalAlarms AS INTEGER) AS totalAlarms,
          CAST(criticalAlarms AS INTEGER) AS criticalAlarms,
          CAST(warningAlarms AS INTEGER) AS warningAlarms,
          CAST(infoAlarms AS INTEGER) AS infoAlarms,
          samples
        FROM grouped
      `,
      )
      .all(bucketMs, bucketMs, startTs, endTs, bucketMs, maxPoints) as AlarmSnapshotsHistoryRow[]
  }

  function getDeviceTelemetryHistory(params: {
    deviceType: string
    deviceId: number
    startTs?: number
    endTs?: number
    bucketMs?: number | null
    maxPoints?: number
  }): DeviceTelemetryHistoryRow[] {
    const { startTs, endTs, maxPoints } = clampRange({ ...params, defaultWindowMs: 60 * 60_000 })
    const bucketMs =
      typeof params.bucketMs === 'number' && params.bucketMs > 0 ? params.bucketMs : null

    if (!bucketMs) {
      return db
        .prepare(
          `
          SELECT
            ts,
            voltage AS voltageAvg,
            current AS currentAvg,
            temperature AS temperatureAvg,
            soc AS socAvg,
            soh AS sohAvg,
            power AS powerAvg,
            chargingStatus AS chargingStatus,
            1 AS samples
          FROM device_telemetry
          WHERE deviceType = ? AND deviceId = ? AND ts BETWEEN ? AND ?
          ORDER BY ts ASC
          LIMIT ?
        `,
        )
        .all(
          params.deviceType,
          params.deviceId,
          startTs,
          endTs,
          maxPoints,
        ) as DeviceTelemetryHistoryRow[]
    }

    return db
      .prepare(
        `
        WITH grouped AS (
          SELECT
            CAST(ts / ? AS INTEGER) * ? AS ts,
            MAX(ts) AS maxTs,
            AVG(voltage) AS voltageAvg,
            AVG(current) AS currentAvg,
            AVG(temperature) AS temperatureAvg,
            AVG(soc) AS socAvg,
            AVG(soh) AS sohAvg,
            AVG(power) AS powerAvg,
            COUNT(*) AS samples
          FROM device_telemetry
          WHERE deviceType = ? AND deviceId = ? AND ts BETWEEN ? AND ?
          GROUP BY CAST(ts / ? AS INTEGER)
          ORDER BY ts ASC
          LIMIT ?
        )
        SELECT
          g.ts AS ts,
          g.voltageAvg AS voltageAvg,
          g.currentAvg AS currentAvg,
          g.temperatureAvg AS temperatureAvg,
          g.socAvg AS socAvg,
          g.sohAvg AS sohAvg,
          g.powerAvg AS powerAvg,
          (SELECT chargingStatus FROM device_telemetry d2 WHERE d2.ts = g.maxTs AND d2.deviceType = ? AND d2.deviceId = ? LIMIT 1) AS chargingStatus,
          g.samples AS samples
        FROM grouped g
      `,
      )
      .all(
        bucketMs,
        bucketMs,
        params.deviceType,
        params.deviceId,
        startTs,
        endTs,
        bucketMs,
        maxPoints,
        params.deviceType,
        params.deviceId,
      ) as DeviceTelemetryHistoryRow[]
  }

  function getCommunicationHistory(params: {
    deviceType: string
    deviceId: string
    startTs?: number
    endTs?: number
    bucketMs?: number | null
    maxPoints?: number
  }): CommunicationHistoryRow[] {
    const { startTs, endTs, maxPoints } = clampRange({ ...params, defaultWindowMs: 60 * 60_000 })
    const bucketMs =
      typeof params.bucketMs === 'number' && params.bucketMs > 0 ? params.bucketMs : null

    if (!bucketMs) {
      return db
        .prepare(
          `
          SELECT ts, status, lastCommTime, 1 AS samples
          FROM communication
          WHERE deviceType = ? AND deviceId = ? AND ts BETWEEN ? AND ?
          ORDER BY ts ASC
          LIMIT ?
        `,
        )
        .all(
          params.deviceType,
          params.deviceId,
          startTs,
          endTs,
          maxPoints,
        ) as CommunicationHistoryRow[]
    }

    return db
      .prepare(
        `
        WITH grouped AS (
          SELECT
            CAST(ts / ? AS INTEGER) * ? AS ts,
            MAX(ts) AS maxTs,
            COUNT(*) AS samples
          FROM communication
          WHERE deviceType = ? AND deviceId = ? AND ts BETWEEN ? AND ?
          GROUP BY CAST(ts / ? AS INTEGER)
          ORDER BY ts ASC
          LIMIT ?
        )
        SELECT
          g.ts AS ts,
          (SELECT status FROM communication c2 WHERE c2.ts = g.maxTs AND c2.deviceType = ? AND c2.deviceId = ? LIMIT 1) AS status,
          (SELECT lastCommTime FROM communication c3 WHERE c3.ts = g.maxTs AND c3.deviceType = ? AND c3.deviceId = ? LIMIT 1) AS lastCommTime,
          g.samples AS samples
        FROM grouped g
      `,
      )
      .all(
        bucketMs,
        bucketMs,
        params.deviceType,
        params.deviceId,
        startTs,
        endTs,
        bucketMs,
        maxPoints,
        params.deviceType,
        params.deviceId,
        params.deviceType,
        params.deviceId,
      ) as CommunicationHistoryRow[]
  }

  function getLatestSystemStatus(): SystemStatus | null {
    const row = db
      .prepare(
        `SELECT status, load, totalPower, runTime
         FROM system_status
         ORDER BY ts DESC
         LIMIT 1`,
      )
      .get() as SystemStatus | undefined
    return row ?? null
  }

  function getLatestTelemetry(): TelemetryData | null {
    const row = db
      .prepare(
        `SELECT currentTime, averageVoltage, totalCurrent, averageTemperature, systemSOC, systemSOH
         FROM telemetry
         ORDER BY ts DESC
         LIMIT 1`,
      )
      .get() as TelemetryData | undefined
    return row ?? null
  }

  function getLatestAlarmData(): AlarmData | null {
    const formatTs = (ms: number): string => {
      return new Date(ms).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    }

    const countsRow = db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(level = 'critical') AS critical,
           SUM(level = 'warning') AS warning,
           SUM(level = 'info') AS info
         FROM alarm_occurrences
         WHERE status = 'active'`,
      )
      .get() as
      | {
          total: number
          critical: number | null
          warning: number | null
          info: number | null
        }
      | undefined

    const rows = db
      .prepare(
        `SELECT ts, device, type, level, description, status
         FROM alarm_occurrences
         ORDER BY ts DESC
         LIMIT 120`,
      )
      .all() as Array<{
      ts: number
      device: string
      type: string
      level: Alarm['level']
      description: string
      status: Alarm['status']
    }>

    if (rows.length > 0) {
      const alarmList: Alarm[] = rows.map((r) => ({
        timestamp: formatTs(r.ts),
        device: r.device,
        type: r.type,
        level: r.level,
        description: r.description,
        status: r.status,
      }))

      const criticalAlarms = countsRow?.critical ?? 0
      const warningAlarms = countsRow?.warning ?? 0
      const infoAlarms = countsRow?.info ?? 0
      const totalAlarms = countsRow?.total ?? 0

      return {
        totalAlarms,
        criticalAlarms,
        warningAlarms,
        infoAlarms,
        alarmList,
      }
    }

    const snap = db
      .prepare(
        `SELECT ts, totalAlarms, criticalAlarms, warningAlarms, infoAlarms
         FROM alarm_snapshots
         ORDER BY ts DESC
         LIMIT 1`,
      )
      .get() as (Omit<AlarmData, 'alarmList'> & { ts: number }) | undefined
    if (!snap) return null

    const alarms = db
      .prepare(
        `SELECT timestamp, device, type, level, description, status
         FROM alarms
         WHERE snapshot_ts = ?
         ORDER BY id ASC`,
      )
      .all(snap.ts) as Alarm[]

    return {
      totalAlarms: snap.totalAlarms,
      criticalAlarms: snap.criticalAlarms,
      warningAlarms: snap.warningAlarms,
      infoAlarms: snap.infoAlarms,
      alarmList: alarms,
    }
  }

  function getAlarmStats(): AlarmStatsResponse {
    const latest = db.prepare(`SELECT MAX(ts) AS ts FROM alarm_occurrences`).get() as {
      ts?: number | null
    }
    const endTs = typeof latest.ts === 'number' ? latest.ts : Date.now()

    const makeWindow = (key: AlarmStatsWindowKey, durationMs: number) => {
      const startTs = endTs - durationMs

      const totalRow = db
        .prepare(
          `
          SELECT COUNT(*) AS total
          FROM alarm_occurrences
          WHERE ts BETWEEN ? AND ?
        `,
        )
        .get(startTs, endTs) as { total: number } | undefined

      const byType = db
        .prepare(
          `
          SELECT
            type AS key,
            COUNT(*) AS total,
            SUM(level = 'critical') AS critical,
            SUM(level = 'warning') AS warning,
            SUM(level = 'info') AS info,
            SUM(status = 'active') AS active,
            SUM(status = 'resolved') AS resolved
          FROM alarm_occurrences
          WHERE ts BETWEEN ? AND ?
          GROUP BY type
          ORDER BY total DESC
        `,
        )
        .all(startTs, endTs) as AlarmStatsBreakdownItem[]

      const byDevice = db
        .prepare(
          `
          SELECT
            device AS key,
            COUNT(*) AS total,
            SUM(level = 'critical') AS critical,
            SUM(level = 'warning') AS warning,
            SUM(level = 'info') AS info,
            SUM(status = 'active') AS active,
            SUM(status = 'resolved') AS resolved
          FROM alarm_occurrences
          WHERE ts BETWEEN ? AND ?
          GROUP BY device
          ORDER BY total DESC
        `,
        )
        .all(startTs, endTs) as AlarmStatsBreakdownItem[]

      return {
        key,
        startTs,
        endTs,
        total: totalRow?.total ?? 0,
        byType,
        byDevice,
      }
    }

    return {
      generatedAt: Date.now(),
      windows: {
        '1m': makeWindow('1m', 60_000),
        '1h': makeWindow('1h', 60 * 60_000),
        '1d': makeWindow('1d', 24 * 60 * 60_000),
      },
    }
  }

  function getLatestDeviceTelemetryAll(): Array<{
    deviceType: string
    deviceId: number
    data: DeviceTelemetry
  }> {
    const rows = db
      .prepare(
        `
        SELECT dt.ts, dt.deviceType, dt.deviceId, dt.voltage, dt.current, dt.temperature, dt.soc, dt.soh, dt.power, dt.chargingStatus
        FROM device_telemetry dt
        JOIN (
          SELECT deviceType, deviceId, MAX(ts) AS ts
          FROM device_telemetry
          GROUP BY deviceType, deviceId
        ) latest
        ON dt.deviceType = latest.deviceType AND dt.deviceId = latest.deviceId AND dt.ts = latest.ts
        ORDER BY dt.deviceType, dt.deviceId
      `,
      )
      .all() as DeviceTelemetryRow[]

    return rows.map((r) => ({
      deviceType: r.deviceType,
      deviceId: r.deviceId,
      data: {
        voltage: r.voltage,
        current: r.current,
        temperature: r.temperature,
        soc: r.soc,
        soh: r.soh,
        power: r.power,
        chargingStatus: r.chargingStatus,
      },
    }))
  }

  function getLatestDeviceTelemetryOne(
    deviceType: string,
    deviceId: number,
  ): DeviceTelemetry | null {
    const row = db
      .prepare(
        `
        SELECT voltage, current, temperature, soc, soh, power, chargingStatus
        FROM device_telemetry
        WHERE deviceType = ? AND deviceId = ?
        ORDER BY ts DESC
        LIMIT 1
      `,
      )
      .get(deviceType, deviceId) as DeviceTelemetry | undefined
    return row ?? null
  }

  function getLatestCommunicationAll(): Array<{
    deviceType: string
    deviceId: string
    data: CommunicationData
  }> {
    const rows = db
      .prepare(
        `
        SELECT c.ts, c.deviceType, c.deviceId, c.status, c.lastCommTime, c.modbusPacketsJson, c.connectedDevicesJson
        FROM communication c
        JOIN (
          SELECT deviceType, deviceId, MAX(ts) AS ts
          FROM communication
          GROUP BY deviceType, deviceId
        ) latest
        ON c.deviceType = latest.deviceType AND c.deviceId = latest.deviceId AND c.ts = latest.ts
        ORDER BY c.deviceType, c.deviceId
      `,
      )
      .all() as CommRow[]

    return rows.map((r) => {
      const key = buildDeviceKey(r.deviceType, r.deviceId)
      const frames = selectCommFramesForDeviceStmt.all(key, key, 40) as CommFrameRow[]
      const protocolFrames: CommFrame[] = frames.map((f) => ({
        timestamp: fmtTs(f.ts),
        protocol: f.protocol as CommFrame['protocol'],
        direction: f.direction as CommFrame['direction'],
        from: f.fromDevice,
        to: f.toDevice,
        ok: Boolean(f.ok),
        status: f.status as CommFrame['status'],
        latencyMs: f.latencyMs,
        bytes: f.bytes,
        summary: f.summary,
        payloadHex: f.payloadHex,
        error: f.error ?? undefined,
      }))

      return {
        deviceType: r.deviceType,
        deviceId: r.deviceId,
        data: {
          status: r.status,
          lastCommTime: r.lastCommTime,
          modbusPackets: JSON.parse(r.modbusPacketsJson),
          connectedDevices: JSON.parse(r.connectedDevicesJson),
          protocolFrames,
        },
      }
    })
  }

  function getLatestCommunicationOne(
    deviceType: string,
    deviceId: string,
  ): CommunicationData | null {
    const row = db
      .prepare(
        `
        SELECT status, lastCommTime, modbusPacketsJson, connectedDevicesJson
        FROM communication
        WHERE deviceType = ? AND deviceId = ?
        ORDER BY ts DESC
        LIMIT 1
      `,
      )
      .get(deviceType, deviceId) as
      | {
          status: CommunicationData['status']
          lastCommTime: string
          modbusPacketsJson: string
          connectedDevicesJson: string
        }
      | undefined
    if (!row) return null
    const key = buildDeviceKey(deviceType, deviceId)
    const frames = selectCommFramesForDeviceStmt.all(key, key, 40) as CommFrameRow[]
    const protocolFrames: CommFrame[] = frames.map((f) => ({
      timestamp: fmtTs(f.ts),
      protocol: f.protocol as CommFrame['protocol'],
      direction: f.direction as CommFrame['direction'],
      from: f.fromDevice,
      to: f.toDevice,
      ok: Boolean(f.ok),
      status: f.status as CommFrame['status'],
      latencyMs: f.latencyMs,
      bytes: f.bytes,
      summary: f.summary,
      payloadHex: f.payloadHex,
      error: f.error ?? undefined,
    }))
    return {
      status: row.status,
      lastCommTime: row.lastCommTime,
      modbusPackets: JSON.parse(row.modbusPacketsJson),
      connectedDevices: JSON.parse(row.connectedDevicesJson),
      protocolFrames,
    }
  }

  function parseControlCommandsJson(json: string | undefined): ControlCommands {
    if (!json) return defaultControlCommands()
    try {
      const parsed = JSON.parse(json) as Partial<ControlCommands>
      const d = defaultControlCommands()
      return {
        agc: { ...d.agc, ...(parsed.agc ?? {}) },
        avc: {
          ...d.avc,
          ...(parsed.avc ?? {}),
          voltageRange: { ...d.avc.voltageRange, ...(parsed.avc?.voltageRange ?? {}) },
        },
        manualPower: { ...d.manualPower, ...(parsed.manualPower ?? {}) },
      }
    } catch {
      return defaultControlCommands()
    }
  }

  function getControlCommands(): ControlCommands {
    const row = getControlCommandsStmt.get() as
      | { ts?: number; json?: string; actor?: string | null; username?: string | null }
      | undefined
    return parseControlCommandsJson(row?.json)
  }

  function getControlCommandsStatus(): ControlCommandsStatus {
    const row = getControlCommandsStmt.get() as
      | { ts?: number; json?: string; actor?: string | null; username?: string | null }
      | undefined
    return {
      ts: typeof row?.ts === 'number' ? row.ts : null,
      actor: (row?.actor ?? null) as string | null,
      username: (row?.username ?? null) as string | null,
    }
  }

  function setControlCommands(next: unknown, meta?: ControlCommandsWriteMeta): ControlCommands {
    const d = defaultControlCommands()
    const obj = (next ?? {}) as Partial<ControlCommands>

    const agcProvided = Object.prototype.hasOwnProperty.call(obj, 'agc')
    const avcProvided = Object.prototype.hasOwnProperty.call(obj, 'avc')
    const manualPowerProvided = Object.prototype.hasOwnProperty.call(obj, 'manualPower')

    const merged: ControlCommands = {
      agc: { ...d.agc, ...(obj.agc ?? {}) },
      avc: {
        ...d.avc,
        ...(obj.avc ?? {}),
        voltageRange: { ...d.avc.voltageRange, ...(obj.avc?.voltageRange ?? {}) },
      },
      manualPower: { ...d.manualPower, ...(obj.manualPower ?? {}) },
    }

    const actor = meta?.actor ?? 'unknown'
    const username = meta?.username ?? null
    const ip = meta?.ip ?? null
    const ts = Date.now()

    const payload = {
      ...merged,
      meta: {
        actor,
        agcProvided,
        avcProvided,
        manualPowerProvided,
      } satisfies ControlCommandsMeta,
    }

    upsertControlCommandsStmt.run(ts, JSON.stringify(payload), actor, username)
    insertControlCommandLogStmt.run(ts, actor, username, ip, JSON.stringify(payload))

    return merged
  }

  function getControlCommandLogs(params?: {
    limit?: number
    offset?: number
  }): ControlCommandLogItem[] {
    const limit = clamp(typeof params?.limit === 'number' ? params.limit : 50, 1, 500)
    const offset = clamp(typeof params?.offset === 'number' ? params.offset : 0, 0, 100_000)

    const rows = selectControlCommandLogsStmt.all(limit, offset) as Array<{
      id: number
      ts: number
      actor: string
      username: string | null
      ip: string | null
      json: string
    }>

    return rows.map((r) => ({
      id: r.id,
      ts: r.ts,
      actor: r.actor,
      username: r.username,
      ip: r.ip,
      commands: parseControlCommandsJson(r.json),
    }))
  }

  return {
    getSnapshotRange,
    getLatestSystemStatus,
    getLatestTelemetry,
    getLatestAlarmData,
    getRecentAlarmOccurrences,
    getAlarmStats,
    getBatteryGroupsLatest,
    getCoordinationUnitsLatest,
    getLatestEmsSnapshot,
    getLatestFrontServerSnapshot,
    getLatestPlantSnapshot,
    getBatteryLatches,
    getLatestScadaNotifications,
    resetBatteryGroup,
    resetProtectionDevice,
    getLatestDeviceTelemetryAll,
    getLatestDeviceTelemetryOne,
    getLatestCommunicationAll,
    getLatestCommunicationOne,
    getTelemetryHistory,
    getSystemStatusHistory,
    getAlarmSnapshotsHistory,
    getDeviceTelemetryHistory,
    getCommunicationHistory,
    getControlCommands,
    getControlCommandsStatus,
    setControlCommands,
    getControlCommandLogs,

    getAutoPowerDecision: (params?: { windowMs?: number }) => {
      const windowMs = typeof params?.windowMs === 'number' ? params.windowMs : undefined
      return computeAutoPowerDecision({ db, historyWindowMs: windowMs })
    },
  }
}
