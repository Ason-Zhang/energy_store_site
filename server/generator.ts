import type { Db } from './db.js'
import {
  generateAlarmData,
  generateBatteryGroups,
  generateSystemStatus,
  generateTelemetryData,
  getDeviceTelemetry,
  setBatteryGroupFaultLatched,
} from '../src/services/mockDataService.js'

import type { BatteryGroup, CoordinationUnit } from '../src/services/mockDataService.js'

import type {
  ConversionLog,
  FrontServerSnapshot,
  Iec104Frame,
  Iec61850Sample,
  PointMapping,
} from '../src/modules/frontServer/models.js'

import { computeEmsSnapshot } from '../src/modules/ems/decisionEngine.js'

import { computeAutoPowerDecision } from './emsAutoPower.js'

import { CommSimulator } from './comm/simulator.js'
import { decodeRequest, decodeResponse } from './comm/protocol/modbusTcp.js'

const COMM_BMS_COUNT = 10
const COMM_PCS_COUNT = 10

const commSim = new CommSimulator({
  bmsCount: COMM_BMS_COUNT,
  pcsCount: COMM_PCS_COUNT,
  dropRate: 0,
  corruptRate: 0,
})

export function createDataGenerator(db: Db) {
  const insertSnapshot = db.prepare(`INSERT INTO snapshots(ts) VALUES (?)`)

  const pruneSnapshotsStmt = db.prepare(`DELETE FROM snapshots WHERE ts < ?`)
  const pruneControlCommandLogsStmt = db.prepare(`DELETE FROM control_command_logs WHERE ts < ?`)
  const pruneAlarmOccurrencesStmt = db.prepare(`DELETE FROM alarm_occurrences WHERE ts < ?`)
  const pruneScadaNotificationsStmt = db.prepare(`DELETE FROM scada_notifications WHERE ts < ?`)

  const insertSystemStatus = db.prepare(`
    INSERT INTO system_status(ts, status, load, totalPower, runTime)
    VALUES (@ts, @status, @load, @totalPower, @runTime)
  `)

  const insertTelemetry = db.prepare(`
    INSERT INTO telemetry(ts, currentTime, averageVoltage, totalCurrent, averageTemperature, systemSOC, systemSOH)
    VALUES (@ts, @currentTime, @averageVoltage, @totalCurrent, @averageTemperature, @systemSOC, @systemSOH)
  `)

  const insertAlarmSnapshot = db.prepare(`
    INSERT INTO alarm_snapshots(ts, totalAlarms, criticalAlarms, warningAlarms, infoAlarms)
    VALUES (@ts, @totalAlarms, @criticalAlarms, @warningAlarms, @infoAlarms)
  `)

  const insertAlarm = db.prepare(`
    INSERT INTO alarms(snapshot_ts, timestamp, device, type, level, description, status)
    VALUES (@snapshot_ts, @timestamp, @device, @type, @level, @description, @status)
  `)

  const insertDeviceTelemetry = db.prepare(`
    INSERT INTO device_telemetry(ts, deviceType, deviceId, voltage, current, temperature, soc, soh, power, chargingStatus)
    VALUES (@ts, @deviceType, @deviceId, @voltage, @current, @temperature, @soc, @soh, @power, @chargingStatus)
  `)

  const insertBatteryGroupsSnapshot = db.prepare(`
    INSERT INTO battery_groups_snapshots(ts, json)
    VALUES (?, ?)
  `)

  const insertCoordinationUnitsSnapshot = db.prepare(`
    INSERT INTO coordination_units_snapshots(ts, json)
    VALUES (?, ?)
  `)

  const insertEmsSnapshot = db.prepare(`
    INSERT INTO ems_snapshots(ts, json)
    VALUES (?, ?)
  `)

  const insertFrontServerSnapshot = db.prepare(`
    INSERT INTO front_server_snapshots(ts, json)
    VALUES (?, ?)
  `)

  const selectControlCommandsStmt = db.prepare(`
    SELECT ts, json, actor
    FROM control_commands
    WHERE id = 1
    LIMIT 1
  `)

  const upsertControlCommandsStmt = db.prepare(`
    INSERT INTO control_commands(id, ts, json, actor, username)
    VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      ts = excluded.ts,
      json = excluded.json,
      actor = excluded.actor,
      username = excluded.username
  `)

  const insertCommunication = db.prepare(`
    INSERT INTO communication(ts, deviceType, deviceId, status, lastCommTime, modbusPacketsJson, connectedDevicesJson)
    VALUES (@ts, @deviceType, @deviceId, @status, @lastCommTime, @modbusPacketsJson, @connectedDevicesJson)
  `)

  const upsertCommLink = db.prepare(`
    INSERT INTO comm_links(key, protocol, aType, aId, aName, bType, bId, bName, primaryFrom, primaryTo)
    VALUES (@key, @protocol, @aType, @aId, @aName, @bType, @bId, @bName, @primaryFrom, @primaryTo)
    ON CONFLICT(key) DO UPDATE SET
      protocol = excluded.protocol,
      aType = excluded.aType,
      aId = excluded.aId,
      aName = excluded.aName,
      bType = excluded.bType,
      bId = excluded.bId,
      bName = excluded.bName,
      primaryFrom = excluded.primaryFrom,
      primaryTo = excluded.primaryTo
  `)

  const insertCommFrame = db.prepare(`
    INSERT INTO comm_frames(ts, linkKey, protocol, direction, fromDevice, toDevice, ok, status, latencyMs, bytes, summary, payloadHex, error)
    VALUES (@ts, @linkKey, @protocol, @direction, @fromDevice, @toDevice, @ok, @status, @latencyMs, @bytes, @summary, @payloadHex, @error)
  `)

  const selectBatteryLatchStmt = db.prepare(
    `SELECT groupId, latched, latchedAt, reason, lastResetAt, updatedAt
     FROM battery_latches
     WHERE groupId = ?
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

  const insertAlarmOccurrenceStmt = db.prepare(
    `INSERT INTO alarm_occurrences(ts, groupId, source, device, type, level, description, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  const insertScadaNotificationStmt = db.prepare(
    `INSERT INTO scada_notifications(ts, groupId, level, message, acknowledged, metaJson)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )

  const lastEmitTsByGroup = new Map<number, number>()
  const lastEmitTsBySource = new Map<string, number>()

  const fmtTs = (ms: number): string =>
    new Date(ms).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

  const rank = (s: string): number =>
    s === 'error' ? 3 : s === 'warning' ? 2 : s === 'normal' ? 1 : 0

  const mergeStatus = (a: 'normal' | 'warning' | 'error', b: 'normal' | 'warning' | 'error') =>
    rank(a) >= rank(b) ? a : b

  let lastMaintenanceMs = 0

  const runMaintenance = (nowMs: number) => {
    const retentionHours = Number(process.env.DATA_RETENTION_HOURS ?? 6)
    const retentionMs =
      Number.isFinite(retentionHours) && retentionHours > 0 ? retentionHours * 60 * 60_000 : 0

    if (retentionMs > 0) {
      const cutoffMs = nowMs - retentionMs
      db.transaction(() => {
        pruneSnapshotsStmt.run(cutoffMs)
        pruneControlCommandLogsStmt.run(cutoffMs)
        pruneAlarmOccurrencesStmt.run(cutoffMs)
        pruneScadaNotificationsStmt.run(cutoffMs)
      })()
    }

    if ((process.env.DATA_WAL_CHECKPOINT ?? '1') !== '0') {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)')
      } catch {
        // ignore
      }
    }
  }

  const buildCoordinationUnitsFromPlant = (params: {
    ts: number
    batteryGroups: BatteryGroup[]
    controlCommands?: Record<string, unknown>
    frames: Array<{ from: string; to: string; status: string; latencyMs: number }>
    unitCount?: number
  }): CoordinationUnit[] => {
    const unitCount = params.unitCount ?? 3
    const tsText = fmtTs(params.ts)

    const cc = params.controlCommands ?? {}
    const ccAgc = (cc as { agc?: { enabled?: boolean; targetPower?: number; rampRate?: number } })
      .agc
    const ccAvc = (cc as { avc?: { enabled?: boolean; targetVoltage?: number } }).avc
    const ccManual = (cc as { manualPower?: { enabled?: boolean; targetPower?: number } })
      .manualPower

    const mode: 'AGC' | 'AVC' =
      ccAgc?.enabled || ccManual?.enabled ? 'AGC' : ccAvc?.enabled ? 'AVC' : 'AGC'
    const enabled = Boolean(ccAgc?.enabled || ccAvc?.enabled || ccManual?.enabled)
    const globalTargetKw = Number(
      ccAgc?.enabled
        ? (ccAgc?.targetPower ?? 0)
        : ccManual?.enabled
          ? (ccManual?.targetPower ?? 0)
          : 0,
    )

    const totalPcsCount = params.batteryGroups.length

    // Exclude faulted groups from power allocation so a single group fault won't stop the entire station.
    // Faulted group: business status error (battery/bms/pcs).
    const availableGroups = params.batteryGroups.filter(
      (g) => g.status !== 'error' && g.bms.status !== 'error' && g.pcs.status !== 'error',
    )
    const availablePcsCount = availableGroups.length
    const perPcsSetpoint =
      availablePcsCount > 0 ? Number((globalTargetKw / availablePcsCount).toFixed(1)) : 0
    const rampRateKwPerMin = Math.max(1, Math.min(120, Number(ccAgc?.rampRate ?? 20)))

    const groupsById = new Map(params.batteryGroups.map((g) => [g.id, g]))

    const isGroupFaulted = (id: number) => {
      const g = groupsById.get(id)
      if (!g) return false
      return g.status === 'error' || g.bms.status === 'error' || g.pcs.status === 'error'
    }

    const unitToPcsIds: number[][] = Array.from({ length: unitCount }, () => [])
    for (let pcsId = 1; pcsId <= totalPcsCount; pcsId++) {
      const unitIndex = (pcsId - 1) % unitCount
      unitToPcsIds[unitIndex]?.push(pcsId)
    }

    const worstCommForGroups = (groupIds: number[]) => {
      let worst: 'normal' | 'warning' | 'error' = 'normal'
      let worstLatency = 0
      const keys = new Set<string>()
      for (const id of groupIds) {
        keys.add(`battery-${id}`)
        keys.add(`bms-${id}`)
        keys.add(`pcs-${id}`)
      }
      for (const f of params.frames) {
        if (!keys.has(f.from) && !keys.has(f.to)) continue
        if (rank(f.status) > rank(worst)) worst = f.status as 'normal' | 'warning' | 'error'
        worstLatency = Math.max(worstLatency, f.latencyMs)
      }
      return { worst, worstLatency }
    }

    const stationActualTotalKw = Number(
      params.batteryGroups.reduce((s, g) => s + Number(g.pcs.actualKw || 0), 0).toFixed(1),
    )

    const avgSoc =
      params.batteryGroups.length === 0
        ? 0
        : params.batteryGroups.reduce((s, g) => s + Number(g.bms.socPct || 0), 0) /
          params.batteryGroups.length
    const totalCapacityKwh = totalPcsCount * 200
    const availableCapacityKwh = Math.round(
      totalCapacityKwh * Math.max(0.05, Math.min(0.95, avgSoc / 100)),
    )

    const commandTrackingErrorKw = Number((globalTargetKw - stationActualTotalKw).toFixed(1))

    const units: CoordinationUnit[] = []
    for (let u = 1; u <= unitCount; u++) {
      const pcsIds = unitToPcsIds[u - 1] ?? []
      const groupIds = pcsIds

      const { worst: unitCommWorst, worstLatency } = worstCommForGroups(groupIds)

      const pcsInputs = pcsIds.map((pcsId) => {
        const g = groupsById.get(pcsId)
        const runningState = g?.pcs.runningState ?? 'standby'
        const status = g?.pcs.status ?? 'normal'
        return {
          pcsId,
          status,
          runningState,
          faultCode: runningState === 'fault' ? `PCS-${pcsId}-F` : '',
          actualKw: Number(g?.pcs.actualKw ?? 0),
          adjustableMinKw: -180,
          adjustableMaxKw: isGroupFaulted(pcsId) ? 0 : 180,
        }
      })

      const bmsInputs = pcsIds.map((id) => {
        const g = groupsById.get(id)
        const b = g?.bms
        return {
          bmsId: id,
          status: b?.status ?? 'normal',
          socPct: Number(b?.socPct ?? 0),
          temperatureC: Number(b?.temperatureC ?? 0),
          insulationResistanceKohm: Number(b?.insulationResistanceKohm ?? 999),
          deltaCellVoltageMv: Number(b?.deltaCellVoltageMv ?? 0),
          warningCount: Number(b?.warningCount ?? 0),
          faultCount: Number(b?.faultCount ?? 0),
        }
      })

      const faultedIds = pcsIds.filter((id) => isGroupFaulted(id))
      const batteryTrip = faultedIds.length > 0
      const batteryWarning =
        pcsInputs.some((x) => x.status === 'warning') ||
        bmsInputs.some((x) => x.status === 'warning')

      const safety = {
        batteryPreWarning: batteryWarning,
        batteryWarning,
        batteryTrip,
        electricalProtectionTrip: false,
        dcBusOverVoltage: false,
        dcBusUnderVoltage: false,
        acBreakerClosed: true,
        emergencyStop: false,
        fireConfirmed: false,
        // Single-group faults should isolate the group (power=0) but not stop the whole unit.
        interlockActive: false,
        lockReason: batteryTrip ? `故障电池组=${faultedIds.join(',')}` : '',
      }

      const ready =
        enabled &&
        safety.acBreakerClosed &&
        !safety.interlockActive &&
        !safety.electricalProtectionTrip

      const pcsCommands = pcsIds.map((pcsId) => ({
        pcsId,
        enable: ready && !isGroupFaulted(pcsId),
        startStop: ready && !isGroupFaulted(pcsId) ? ('start' as const) : ('stop' as const),
        modeCmd: mode,
        setpointKw: ready && !isGroupFaulted(pcsId) ? perPcsSetpoint : 0,
        rampRateKwPerMin,
      }))

      const executionStatus = !ready
        ? '未就绪'
        : Math.abs(commandTrackingErrorKw) > 80
          ? '受限'
          : '跟踪正常'

      const peerSignals = Array.from({ length: unitCount }, (_, idx) => idx + 1)
        .filter((peerId) => peerId !== u)
        .map((peerId) => ({
          peerUnitId: peerId,
          commStatus: unitCommWorst,
          lastRxTime: tsText,
          latencyMs: worstLatency,
          peerReady: ready && unitCommWorst !== 'error',
          peerLimitPower: executionStatus === '受限',
          peerExitRun: !ready,
        }))

      const pcsWorst = pcsInputs.reduce<'normal' | 'warning' | 'error'>(
        (acc, p) => mergeStatus(acc, p.status),
        'normal',
      )
      const bmsWorst = bmsInputs.reduce<'normal' | 'warning' | 'error'>(
        (acc, b) => mergeStatus(acc, b.status),
        'normal',
      )
      const safetyStatus: 'normal' | 'warning' | 'error' = safety.interlockActive
        ? 'error'
        : safety.batteryWarning || safety.batteryPreWarning
          ? 'warning'
          : 'normal'

      units.push({
        unitId: u,
        name: `协控单元 ${u}`,
        status: mergeStatus(mergeStatus(pcsWorst, bmsWorst), safetyStatus),
        lastUpdateTime: tsText,
        inputs: {
          upper: {
            source: 'EMS',
            mode,
            planId: `PLAN-${new Date(params.ts).getFullYear()}-${String(u).padStart(2, '0')}`,
            planWindow: tsText,
            targetPowerKw: globalTargetKw,
            enable: enabled,
            issuedAt: tsText,
          },
          safety,
          peerSignals,
          devices: { pcs: pcsInputs, bms: bmsInputs },
        },
        outputs: {
          pcsCommands,
          upperReport: {
            stationActualTotalKw,
            availableCapacityKwh,
            ready,
            executionStatus,
            commandTrackingErrorKw,
            alarmSummary: {
              critical: params.batteryGroups.filter((g) => g.status === 'error').length,
              warning: params.batteryGroups.filter((g) => g.status === 'warning').length,
              info: 0,
            },
            eventSummary: {
              startStop: 0,
              modeSwitch: 0,
              interlock: safety.interlockActive ? 1 : 0,
            },
            reportedAt: tsText,
          },
          peerOutputs: {
            fireConfirmed: safety.fireConfirmed,
            limitPower: executionStatus === '受限',
            exitRun: !ready,
            limitReason: executionStatus === '受限' ? '通信/设备状态受限' : '',
          },
        },
      })
    }

    return units
  }

  const toStatus = (s: string): 'normal' | 'warning' | 'error' =>
    s === 'normal' ? 'normal' : s === 'warning' ? 'warning' : 'error'

  const buildFrontServerSnapshotFromFrames = (params: {
    ts: number
    frames: Array<{
      protocol: string
      timestamp: string
      status: string
      direction: 'uplink' | 'downlink'
      from: string
      to: string
      summary: string
      bytes: number
    }>
    pcsCount: number
    bmsCount: number
  }): FrontServerSnapshot => {
    const nowText = fmtTs(params.ts)

    const iec61850 = params.frames.filter((f) => f.protocol === 'IEC61850')
    const iec104 = params.frames.filter((f) => f.protocol === 'IEC104')

    const samples: Iec61850Sample[] = iec61850.slice(0, 12).map((f) => ({
      timestamp: f.timestamp,
      ied: f.from,
      dataset: 'COMM_BUS',
      service: 'MMS',
      direction: 'subscribe',
      status: toStatus(f.status),
      payload: f.summary,
    }))

    const frames104: Iec104Frame[] = iec104.slice(0, 12).map((f, idx) => ({
      timestamp: f.timestamp,
      direction: f.direction,
      status: toStatus(f.status),
      apci: `I ${idx}`,
      asdu: f.summary,
      ioa: 1000 + idx,
      cot: f.direction === 'uplink' ? 'CYCLIC' : 'ACTIVATION',
      value: String(f.bytes),
    }))

    const worst = (arr: Array<'normal' | 'warning' | 'error'>): 'normal' | 'warning' | 'error' => {
      let w: 'normal' | 'warning' | 'error' = 'normal'
      for (const s of arr) {
        if (rank(s) > rank(w)) w = s
      }
      return w
    }

    const stationStatus = worst(samples.map((s) => s.status))
    const masterStatus = worst(frames104.map((f) => f.status))

    const ieds = [
      { name: 'EMS-IED', type: 'EMS' as const, status: stationStatus, ip: '10.10.0.10' },
      ...Array.from({ length: params.pcsCount }, (_, i) => ({
        name: `PCS-IED-${i + 1}`,
        type: 'PCS' as const,
        status: stationStatus,
        ip: `10.10.0.${20 + i}`,
      })),
      ...Array.from({ length: params.bmsCount }, (_, i) => ({
        name: `BMS-IED-${i + 1}`,
        type: 'BMS' as const,
        status: stationStatus,
        ip: `10.10.0.${40 + i}`,
      })),
      { name: 'PROT-IED', type: '保护装置' as const, status: stationStatus, ip: '10.10.0.90' },
    ]

    const mkMapping = (i: number, quality: PointMapping['quality']): PointMapping => {
      const idx = i - 1
      return {
        id: `P-${String(i).padStart(3, '0')}`,
        name: `点位-${i}`,
        iedName:
          idx % 2 === 0
            ? `PCS-IED-${(idx % Math.max(1, params.pcsCount)) + 1}`
            : `BMS-IED-${(idx % Math.max(1, params.bmsCount)) + 1}`,
        ld: 'LD0',
        ln: idx % 2 === 0 ? 'MMXU1' : 'BAT1',
        doName: idx % 2 === 0 ? 'TotW' : 'Soc',
        daName: idx % 2 === 0 ? 'mag.f' : 'instMag.f',
        fc: 'MX',
        ioa: 1000 + i,
        asduType: 'M_ME_NC_1',
        causeOfTransmission: 'cyclic',
        scale: 1,
        unit: idx % 2 === 0 ? 'kW' : '%',
        quality,
      }
    }

    const deriveQuality = (i: number): PointMapping['quality'] => {
      if (stationStatus === 'error')
        return i % 3 === 0 ? 'INVALID' : i % 3 === 1 ? 'QUESTIONABLE' : 'GOOD'
      if (stationStatus === 'warning') return i % 5 === 0 ? 'QUESTIONABLE' : 'GOOD'
      return 'GOOD'
    }

    const table = Array.from({ length: 24 }, (_, i) => mkMapping(i + 1, deriveQuality(i + 1)))
    const ok = table.filter((m) => m.quality === 'GOOD').length
    const questionable = table.filter((m) => m.quality === 'QUESTIONABLE').length
    const invalid = table.filter((m) => m.quality === 'INVALID').length

    const badQualityPct = Math.round(((questionable + invalid) / Math.max(1, table.length)) * 100)

    const factor = 12 // assume ~5s tick
    const mmsRxPerMin = iec61850.length * factor
    const txAsduPerMin = iec104.filter((f) => f.direction === 'uplink').length * factor
    const rxCmdPerMin = iec104.filter((f) => f.direction === 'downlink').length * factor

    const logs: ConversionLog[] = []
    for (const [idx, m] of table.slice(0, 9).entries()) {
      logs.push({
        timestamp: nowText,
        status: stationStatus,
        direction: '61850→104',
        mappingId: m.id,
        summary: `采集并上送：${m.iedName} → IOA ${m.ioa}`,
        detail: `Q=${m.quality} idx=${idx}`,
      })
    }
    for (const m of table.slice(9, 12)) {
      logs.push({
        timestamp: nowText,
        status: masterStatus,
        direction: '104→61850',
        mappingId: m.id,
        summary: `下发并转换：IOA ${m.ioa} → ${m.iedName}`,
        detail: `Q=${m.quality}`,
      })
    }

    return {
      timestamp: nowText,
      stationSide: {
        protocol: 'IEC61850',
        ieds,
        samples,
        stats: {
          mmsRxPerMin,
          gooseRxPerMin: 0,
          svRxPerMin: 0,
          badQualityPct,
        },
      },
      masterSide: {
        protocol: 'IEC104',
        endpoint: { host: 'dispatch-master', port: 2404, linkStatus: masterStatus },
        frames: frames104,
        stats: {
          txAsduPerMin,
          rxCmdPerMin,
          linkKeepalive: masterStatus === 'error' ? 'DEGRADED' : 'OK',
          lastAck: nowText,
        },
      },
      mapping: {
        total: table.length,
        ok,
        questionable,
        invalid,
        table,
      },
      conversion: {
        backlog: stationStatus === 'error' ? 20 : stationStatus === 'warning' ? 6 : 0,
        latencyMsP95: stationStatus === 'error' ? 180 : stationStatus === 'warning' ? 90 : 30,
        logs: logs.slice(0, 12),
      },
    }
  }

  const deriveDeviceStatus = (
    deviceKey: string,
    frames: Array<{ from: string; to: string; status: string }>,
  ): 'normal' | 'warning' | 'error' => {
    let worst: 'normal' | 'warning' | 'error' = 'normal'
    for (const f of frames) {
      if (f.from !== deviceKey && f.to !== deviceKey) continue
      if (rank(f.status) > rank(worst)) worst = f.status as 'normal' | 'warning' | 'error'
    }
    return worst
  }

  const deriveConnectedDevices = (
    deviceKey: string,
    links: Array<{ aKey: string; aName: string; bKey: string; bName: string }>,
    frames: Array<{ from: string; to: string; status: string }>,
  ): Array<{ name: string; status: 'normal' | 'warning' | 'error' }> => {
    const out: Array<{ name: string; status: 'normal' | 'warning' | 'error' }> = []
    for (const l of links) {
      if (l.aKey !== deviceKey && l.bKey !== deviceKey) continue
      const peerKey = l.aKey === deviceKey ? l.bKey : l.aKey
      const peerName = l.aKey === deviceKey ? l.bName : l.aName
      let st: 'normal' | 'warning' | 'error' = 'normal'
      for (const f of frames) {
        const match =
          (f.from === deviceKey && f.to === peerKey) || (f.from === peerKey && f.to === deviceKey)
        if (!match) continue
        if (rank(f.status) > rank(st)) st = f.status as 'normal' | 'warning' | 'error'
      }
      out.push({ name: peerName, status: st })
    }
    return out
  }

  const deriveModbusPackets = (
    deviceKey: string,
    frames: Array<{ ts: number; from: string; to: string; status: string; payloadHex: string }>,
  ): Array<{
    timestamp: string
    functionCode: number
    registerAddr: number
    dataLength: number
    dataValue: string
    status: 'normal' | 'warning' | 'error'
  }> => {
    const out: Array<{
      timestamp: string
      functionCode: number
      registerAddr: number
      dataLength: number
      dataValue: string
      status: 'normal' | 'warning' | 'error'
    }> = []

    const relevant = frames.filter((f) => f.from === deviceKey || f.to === deviceKey).slice(-12)

    for (const f of relevant) {
      try {
        const buf = Buffer.from(f.payloadHex, 'hex')
        // Heuristic: downlink from frontServer to bms is request, otherwise response
        if (f.payloadHex.length >= 16) {
          if (f.payloadHex.slice(14, 16) === '03') {
            const req = decodeRequest(buf)
            out.push({
              timestamp: fmtTs(f.ts),
              functionCode: 3,
              registerAddr: req.start,
              dataLength: req.quantity,
              dataValue: f.payloadHex.slice(0, 32),
              status: f.status as 'normal' | 'warning' | 'error',
            })
            continue
          }
        }
        const res = decodeResponse(buf)
        if (res.type === 'readHoldingRegisters') {
          out.push({
            timestamp: fmtTs(f.ts),
            functionCode: 3,
            registerAddr: 0,
            dataLength: res.values.length,
            dataValue: res.values.slice(0, 4).join(','),
            status: f.status as 'normal' | 'warning' | 'error',
          })
        }
      } catch {
        // ignore parsing errors
      }
    }

    return out
  }

  const tickTx = db.transaction(() => {
    const ts = Date.now()
    insertSnapshot.run(ts)

    // -----------------------------
    // Control commands (single source: DB)
    // -----------------------------
    const controlCommandsRow = selectControlCommandsStmt.get() as
      | { ts: number; json: string; actor: string | null }
      | undefined

    const parsedControlCommands = (() => {
      try {
        return controlCommandsRow?.json
          ? (JSON.parse(controlCommandsRow.json) as Record<string, unknown>)
          : undefined
      } catch {
        return undefined
      }
    })()

    const actor = (controlCommandsRow?.actor ?? null) as string | null
    const issuedTs = typeof controlCommandsRow?.ts === 'number' ? controlCommandsRow.ts : null

    const hasActiveSetpoint = (() => {
      const cc = (parsedControlCommands ?? {}) as {
        agc?: { enabled?: boolean }
        avc?: { enabled?: boolean }
        manualPower?: { enabled?: boolean }
      }
      return Boolean(cc.agc?.enabled || cc.avc?.enabled || cc.manualPower?.enabled)
    })()

    // Auto power: only takes over when there is no fresh remote-enabled command.
    // Local (onsite) commands are treated as authoritative and will not be overridden.
    const remoteTtlMs = Number(process.env.REMOTE_COMMAND_TTL_MS ?? 5 * 60_000)
    const remoteFresh =
      actor === 'remote' && typeof issuedTs === 'number' && ts - issuedTs <= remoteTtlMs

    const remoteExplicitStop = (() => {
      if (!remoteFresh) return false
      const cc = (parsedControlCommands ?? {}) as {
        agc?: { enabled?: boolean; targetPower?: number }
        avc?: { enabled?: boolean; targetVoltage?: number }
        manualPower?: { enabled?: boolean; targetPower?: number }
      }
      const agcTarget = Number(cc.agc?.targetPower ?? 0)
      const manualTarget = Number(cc.manualPower?.targetPower ?? 0)
      const avcTarget = cc.avc?.enabled ? Number(cc.avc?.targetVoltage ?? 0) : 0
      const targetsAllZero =
        (!Number.isFinite(agcTarget) || agcTarget === 0) &&
        (!Number.isFinite(manualTarget) || manualTarget === 0) &&
        (!Number.isFinite(avcTarget) || avcTarget === 0)
      return !hasActiveSetpoint && targetsAllZero
    })()

    // Auto-takeover policy:
    // - If there is no active setpoint, we should auto-run by default.
    // - A fresh remote command with enabled=false is treated as "no active remote setpoint", NOT as a blocker.
    // - Exception: if remote explicitly requests stop (all targets are zero while disabled), keep stop.
    const useAutoPower =
      (actor === 'auto' || !hasActiveSetpoint) && (!remoteFresh || !remoteExplicitStop)

    const shouldAutoAvc = (() => {
      if (actor === 'local') return false
      if (!remoteFresh || actor !== 'remote') return true

      // Remote command is fresh: only auto-takeover AVC when the remote request did NOT explicitly provide
      // the 'avc' field (i.e., remote did not intend to control voltage).
      // For backward compatibility (old rows without meta), default to treating as "provided".
      const meta = (parsedControlCommands as { meta?: { avcProvided?: boolean } } | undefined)?.meta
      if (!meta) return (process.env.AUTO_AVC_LEGACY_TAKEOVER ?? '1') !== '0'
      return meta.avcProvided === false
    })()

    const controlCommands = (() => {
      // Case 1) Power auto-takeover (existing behavior): write back DB and mark actor as auto.
      if (useAutoPower) {
        const decision = computeAutoPowerDecision({ db, nowMs: ts })

        // Ramp-limit auto target power to avoid abrupt setpoint jumps.
        const maxStepKw = Number(process.env.AUTO_POWER_MAX_STEP_KW ?? 120)
        const prevTargetKw = (() => {
          try {
            const prev = parsedControlCommands as
              | { agc?: { enabled?: boolean; targetPower?: number } }
              | undefined
            if (!prev?.agc?.enabled) return null
            const v = Number(prev.agc.targetPower)
            return Number.isFinite(v) ? v : null
          } catch {
            return null
          }
        })()

        const nextCommands = (() => {
          const cc = decision.controlCommands as unknown as {
            agc?: { enabled?: boolean; targetPower?: number }
            avc?: {
              enabled?: boolean
              targetVoltage?: number
              voltageRange?: { min?: number; max?: number }
            }
          }
          if (!cc?.agc?.enabled) return decision.controlCommands
          const desired = Number(cc.agc.targetPower ?? 0)
          if (!Number.isFinite(desired)) return decision.controlCommands

          if (typeof prevTargetKw !== 'number' || !Number.isFinite(maxStepKw) || maxStepKw <= 0) {
            return decision.controlCommands
          }

          const delta = desired - prevTargetKw
          const step = Math.max(-maxStepKw, Math.min(maxStepKw, delta))
          const limited = Number((prevTargetKw + step).toFixed(1))
          const out = {
            ...(decision.controlCommands as object),
            agc: {
              ...(cc.agc as object),
              targetPower: limited,
            },
          } as unknown as Record<string, unknown>

          // Optional: ramp-limit AVC voltage target as well.
          const maxStepV = Number(process.env.AUTO_VOLTAGE_MAX_STEP_V ?? 1)
          const prevTargetV = (() => {
            try {
              const prev = parsedControlCommands as
                | { avc?: { enabled?: boolean; targetVoltage?: number } }
                | undefined
              if (!prev?.avc?.enabled) return null
              const v = Number(prev.avc.targetVoltage)
              return Number.isFinite(v) ? v : null
            } catch {
              return null
            }
          })()

          if (
            cc?.avc?.enabled &&
            Number.isFinite(Number(cc.avc.targetVoltage)) &&
            Number.isFinite(maxStepV) &&
            maxStepV > 0
          ) {
            const desiredV = Number(cc.avc.targetVoltage)
            const nextV =
              typeof prevTargetV === 'number'
                ? Number(
                    (
                      prevTargetV + Math.max(-maxStepV, Math.min(maxStepV, desiredV - prevTargetV))
                    ).toFixed(1),
                  )
                : Number(desiredV.toFixed(1))

            ;(out as unknown as { avc?: { enabled?: boolean; targetVoltage?: number } }).avc = {
              ...(cc.avc as object),
              targetVoltage: nextV,
            }
          }

          return out
        })()

        const json = JSON.stringify(nextCommands)

        // Avoid rewriting DB every tick if values are identical.
        if (controlCommandsRow?.json !== json || actor !== 'auto') {
          upsertControlCommandsStmt.run(ts, json, 'auto', null)
        }

        return nextCommands as unknown as Record<string, unknown>
      }

      // Case 2) Remote (fresh) AGC is authoritative, but remote did not provide AVC: auto-compute AVC only.
      if (!shouldAutoAvc) return parsedControlCommands

      const base = (parsedControlCommands ?? {}) as {
        agc?: { enabled?: boolean; targetPower?: number }
        avc?: {
          enabled?: boolean
          targetVoltage?: number
          voltageRange?: { min?: number; max?: number }
        }
        manualPower?: { enabled?: boolean; targetPower?: number }
        meta?: unknown
      }

      const decision = computeAutoPowerDecision({ db, nowMs: ts })
      const desiredAvc = (
        decision.controlCommands as unknown as {
          avc?: {
            enabled?: boolean
            targetVoltage?: number
            voltageRange?: { min?: number; max?: number }
          }
        }
      )?.avc

      if (!desiredAvc?.enabled || !Number.isFinite(Number(desiredAvc.targetVoltage)))
        return parsedControlCommands

      // Ramp-limit AVC voltage target to avoid abrupt setpoint jumps.
      const maxStepV = Number(process.env.AUTO_VOLTAGE_MAX_STEP_V ?? 1)
      const prevTargetV = (() => {
        try {
          if (!base?.avc?.enabled) return null
          const v = Number(base.avc.targetVoltage)
          return Number.isFinite(v) ? v : null
        } catch {
          return null
        }
      })()

      const desiredV = Number(desiredAvc.targetVoltage)
      const nextV =
        typeof prevTargetV === 'number' && Number.isFinite(maxStepV) && maxStepV > 0
          ? Number(
              (
                prevTargetV + Math.max(-maxStepV, Math.min(maxStepV, desiredV - prevTargetV))
              ).toFixed(1),
            )
          : Number(desiredV.toFixed(1))

      return {
        ...base,
        avc: {
          ...(base.avc ?? {}),
          ...desiredAvc,
          targetVoltage: nextV,
          voltageRange: {
            ...((base.avc?.voltageRange ?? {}) as object),
            ...((desiredAvc.voltageRange ?? {}) as object),
          },
        },
      } as unknown as Record<string, unknown>
    })()

    // -----------------------------
    // Battery groups (authoritative plant state)
    // - Later: can be fully derived from frames/point_values.
    // - For now: we ensure link inputs (InternalBus/Modbus/61850/104) are derived from this single state.
    // -----------------------------
    const batteryGroups = generateBatteryGroups(10, controlCommands as never)

    const toDeviceTelemetry = (g: (typeof batteryGroups)[number]) => {
      return {
        voltage: g.bms.voltageV,
        current: g.bms.currentA,
        temperature: Math.round(g.bms.temperatureC),
        soc: Math.round(g.bms.socPct),
        soh: Math.round(g.bms.sohPct),
        power: g.pcs.actualKw,
        chargingStatus:
          g.pcs.actualKw > 1 ? 'charging' : g.pcs.actualKw < -1 ? 'discharging' : 'idle',
      } as const
    }

    // -----------------------------
    // Base/source telemetry (single source of truth)
    // -----------------------------
    const bmsSource = new Map<number, ReturnType<typeof getDeviceTelemetry>>()
    for (const g of batteryGroups) {
      bmsSource.set(g.id, toDeviceTelemetry(g))
    }
    commSim.setBmsSourceTelemetry(bmsSource)
    commSim.setBatteryGroupSource(new Map(batteryGroups.map((g) => [g.id, g])))

    // -----------------------------
    // Communication: run virtual links and persist topology + frames.
    // All higher-layer comm data should be traceable to these frames.
    // -----------------------------
    const links = commSim.getLinks().map((l) => ({
      key: l.key,
      protocol: l.protocol,
      aKey: `${l.a.type}-${l.a.id}`,
      aName: l.a.name,
      bKey: `${l.b.type}-${l.b.id}`,
      bName: l.b.name,
      primaryFrom: l.primaryDirection?.from ?? null,
      primaryTo: l.primaryDirection?.to ?? null,
    }))

    for (const l of commSim.getLinks()) {
      upsertCommLink.run({
        key: l.key,
        protocol: l.protocol,
        aType: l.a.type,
        aId: l.a.id,
        aName: l.a.name,
        bType: l.b.type,
        bId: l.b.id,
        bName: l.b.name,
        primaryFrom: l.primaryDirection?.from ?? null,
        primaryTo: l.primaryDirection?.to ?? null,
      })
    }

    const frames = commSim.tick(ts)
    for (const f of frames) {
      insertCommFrame.run({
        ts,
        linkKey: f.linkKey,
        protocol: f.protocol,
        direction: f.direction,
        fromDevice: f.from,
        toDevice: f.to,
        ok: f.ok ? 1 : 0,
        status: f.status,
        latencyMs: f.latencyMs,
        bytes: f.bytes,
        summary: f.summary,
        payloadHex: f.payloadHex,
        error: f.error ?? null,
      })
    }

    const systemStatus = generateSystemStatus()
    insertSystemStatus.run({ ts, ...systemStatus })

    const telemetry = generateTelemetryData()
    insertTelemetry.run({ ts, ...telemetry })

    const alarmData = generateAlarmData()
    insertAlarmSnapshot.run({ ts, ...alarmData })
    for (const alarm of alarmData.alarmList) {
      insertAlarm.run({ snapshot_ts: ts, ...alarm })
    }

    // -----------------------------
    // System-wide alarms (EMS / 协控 / 保护与安全装置)
    // Persist into alarm_occurrences so both remote+onsite are consistent.
    // -----------------------------
    const emitBySource = (payload: {
      source: string
      device: string
      type: string
      level: 'critical' | 'warning' | 'info'
      description: string
      groupId?: number | null
      minIntervalMs?: number
    }) => {
      const minIntervalMs = payload.minIntervalMs ?? 60_000
      const last = lastEmitTsBySource.get(payload.source) ?? 0
      if (ts - last < minIntervalMs) return
      lastEmitTsBySource.set(payload.source, ts)
      insertAlarmOccurrenceStmt.run(
        ts,
        payload.groupId ?? null,
        payload.source,
        payload.device,
        payload.type,
        payload.level,
        payload.description,
        'active',
      )
    }

    // Low frequency “protection/safety” events
    // Keep it sparse to avoid flooding.
    if (ts % 90_000 < 2500) {
      emitBySource({
        source: 'EMS',
        device: 'EMS',
        type: '系统自检',
        level: 'info',
        description: 'EMS 周期自检完成',
        minIntervalMs: 120_000,
      })
    }

    if (ts % 300_000 < 2500) {
      emitBySource({
        source: 'PROT-AC',
        device: '电气保护装置-交流侧',
        type: '保护预警',
        level: 'warning',
        description: '交流侧保护装置出现预警（模拟）',
        minIntervalMs: 300_000,
      })
    }

    if (ts % 480_000 < 2500) {
      emitBySource({
        source: 'PROT-DC',
        device: '电气保护装置-直流侧',
        type: '保护预警',
        level: 'warning',
        description: '直流侧保护装置出现预警（模拟）',
        minIntervalMs: 480_000,
      })
    }

    if (ts % 900_000 < 2500) {
      emitBySource({
        source: 'FIRE',
        device: '消防联动模块',
        type: '消防确认',
        level: 'critical',
        description: '消防联动模块确认（模拟）',
        minIntervalMs: 900_000,
      })
    }

    // Coordination layer interlock signals (very rare)
    if (ts % 600_000 < 2500) {
      emitBySource({
        source: 'CCU-1',
        device: '协控单元 1',
        type: '安全联锁',
        level: 'warning',
        description: '协控单元安全联锁信号触发（模拟）',
        minIntervalMs: 600_000,
      })
    }

    for (const g of batteryGroups) {
      const row = selectBatteryLatchStmt.get(g.id) as
        | {
            groupId: number
            latched: number
            latchedAt: number | null
            reason: string | null
            lastResetAt: number | null
            updatedAt: number
          }
        | undefined

      if (!row) {
        upsertBatteryLatchStmt.run(g.id, 0, null, null, null, ts)
      }

      const latched = Boolean(row?.latched)
      if (latched) {
        g.status = 'error'
        g.pcs.status = 'error'
        g.pcs.runningState = 'fault'
        g.bms.status = 'error'
        g.bms.faultCount = Math.max(1, g.bms.faultCount)
        g.faultReason = row?.reason ? `锁存原因：${row.reason}` : '锁存原因：未知'
        // 将 DB 锁存同步到 sim：确保该组“操作阻塞/出力归零”等表现稳定。
        setBatteryGroupFaultLatched(g.id, true)
        continue
      }

      // 复位后冷却一段时间：避免“刚复位又立刻再次触发锁存/告警”，导致需要多次点击复位。
      const lastResetAt = row?.lastResetAt ?? null
      if (typeof lastResetAt === 'number' && ts - lastResetAt < 60_000) continue

      const candidates: Array<{
        source: string
        device: string
        type: string
        level: 'critical' | 'warning'
        description: string
      }> = []

      const bms = g.bms
      const pcs = g.pcs

      if (bms.insulationResistanceKohm <= 150) {
        candidates.push({
          source: `BMS-${g.id}`,
          device: `BMS ${g.id}`,
          type: '绝缘异常',
          level: 'critical',
          description: `绝缘电阻过低（${bms.insulationResistanceKohm}kΩ）`,
        })
      } else if (bms.insulationResistanceKohm <= 260) {
        candidates.push({
          source: `BMS-${g.id}`,
          device: `BMS ${g.id}`,
          type: '绝缘异常',
          level: 'warning',
          description: `绝缘电阻偏低（${bms.insulationResistanceKohm}kΩ）`,
        })
      }

      if (bms.deltaCellVoltageMv >= 65) {
        candidates.push({
          source: `BMS-${g.id}`,
          device: `BMS ${g.id}`,
          type: '单体压差异常',
          level: 'critical',
          description: `单体最大压差过大（${bms.deltaCellVoltageMv}mV）`,
        })
      } else if (bms.deltaCellVoltageMv >= 45) {
        candidates.push({
          source: `BMS-${g.id}`,
          device: `BMS ${g.id}`,
          type: '单体压差异常',
          level: 'warning',
          description: `单体压差偏大（${bms.deltaCellVoltageMv}mV）`,
        })
      }

      if (bms.maxCellTempC >= 60) {
        candidates.push({
          source: `BMS-${g.id}`,
          device: `BMS ${g.id}`,
          type: '热失控',
          level: 'critical',
          description: `单体温度过高（${bms.maxCellTempC}℃）`,
        })
      } else if (bms.maxCellTempC >= 52) {
        candidates.push({
          source: `BMS-${g.id}`,
          device: `BMS ${g.id}`,
          type: '温度异常',
          level: 'warning',
          description: `单体温度偏高（${bms.maxCellTempC}℃）`,
        })
      }

      if (pcs.temperature >= 52) {
        candidates.push({
          source: `PCS-${g.id}`,
          device: `PCS ${g.id}`,
          type: 'PCS 过温',
          level: 'warning',
          description: `PCS 温度偏高（${pcs.temperature}℃）`,
        })
      }

      if (candidates.length === 0) continue

      const picked =
        candidates.find((c) => c.level === 'critical') ??
        candidates.find((c) => c.level === 'warning')
      if (!picked) continue

      const lastEmit = lastEmitTsByGroup.get(g.id) ?? 0
      if (ts - lastEmit < 20_000) continue
      lastEmitTsByGroup.set(g.id, ts)

      // 一旦出现异常，模拟“该电池组操作被阻塞”：直接锁存，直到人工复位。
      const reason = picked.level === 'critical' ? 'critical_alarm' : 'warning_alarm'
      const latchedAt = ts
      upsertBatteryLatchStmt.run(g.id, 1, latchedAt, reason, lastResetAt, ts)

      // 同步到 sim（阻塞该组继续运行/出力）
      setBatteryGroupFaultLatched(g.id, true)

      g.status = 'error'
      g.pcs.status = 'error'
      g.pcs.runningState = 'fault'
      g.bms.status = 'error'
      g.bms.faultCount = Math.max(1, g.bms.faultCount)
      g.faultReason = `锁存原因：${reason}`

      insertAlarmOccurrenceStmt.run(
        ts,
        g.id,
        `BAT-${g.id}`,
        `电池组 ${g.id}`,
        '锁存',
        'critical',
        `电池组 ${g.id} 已锁存（${reason}）。触发源：${picked.device} | ${picked.type} | ${picked.description}`,
        'active',
      )

      insertScadaNotificationStmt.run(
        ts,
        g.id,
        'critical',
        `SCADA: 电池组 ${g.id} 锁存（${reason}）`,
        0,
        JSON.stringify({ reason }),
      )
    }

    // Persist authoritative group snapshot (post-latch side effects are represented by DB latch + fault latched state)
    insertBatteryGroupsSnapshot.run(ts, JSON.stringify(batteryGroups))

    const coordinationUnits = buildCoordinationUnitsFromPlant({
      ts,
      batteryGroups,
      controlCommands: controlCommands as Record<string, unknown> | undefined,
      frames: frames.map((f) => ({
        from: f.from,
        to: f.to,
        status: f.status,
        latencyMs: f.latencyMs,
      })),
      unitCount: 3,
    })
    insertCoordinationUnitsSnapshot.run(ts, JSON.stringify(coordinationUnits))

    // EMS snapshot derived from plant state + coordination layer
    const emsSnapshot = computeEmsSnapshot({
      batteryGroups,
      coordinationUnits,
      controlCommands: controlCommands as never,
    })
    insertEmsSnapshot.run(ts, JSON.stringify(emsSnapshot))

    const frontServerSnapshot = buildFrontServerSnapshotFromFrames({
      ts,
      frames: frames.map((f) => ({
        protocol: f.protocol,
        timestamp: f.tsText,
        status: f.status,
        direction: f.direction,
        from: f.from,
        to: f.to,
        summary: f.summary,
        bytes: f.bytes,
      })),
      pcsCount: COMM_PCS_COUNT,
      bmsCount: COMM_BMS_COUNT,
    })
    insertFrontServerSnapshot.run(ts, JSON.stringify(frontServerSnapshot))

    // Device telemetry (BMS + Battery)
    // BMS is fed by battery->BMS InternalBus (bmsSource is the single source for that bus).
    for (let i = 1; i <= 10; i++) {
      const bms = bmsSource.get(i) ?? getDeviceTelemetry('bms', i)
      insertDeviceTelemetry.run({ ts, deviceType: 'bms', deviceId: i, ...bms })

      // Keep battery telemetry consistent with what it sent over InternalBus.
      // (Battery warehouse is the real upstream; BMS/PCS derive from it.)
      const battery = bms
      insertDeviceTelemetry.run({ ts, deviceType: 'battery', deviceId: i, ...battery })
    }

    // Communication snapshots (derived from frames)
    const frameLite = frames.map((f) => ({
      ts,
      from: f.from,
      to: f.to,
      status: f.status,
      payloadHex: f.payloadHex,
    }))

    const deviceKeys: Array<{ deviceType: string; deviceId: string; key: string; name: string }> =
      []
    deviceKeys.push({ deviceType: 'ems', deviceId: 'ems', key: 'ems-ems', name: 'EMS' })
    deviceKeys.push({
      deviceType: 'frontServer',
      deviceId: '1',
      key: 'frontServer-1',
      name: '前置服务器',
    })
    deviceKeys.push({ deviceType: 'remote', deviceId: '1', key: 'remote-1', name: '远端主站' })
    for (let i = 1; i <= 3; i++) {
      deviceKeys.push({ deviceType: 'ccu', deviceId: String(i), key: `ccu-${i}`, name: `CCU ${i}` })
    }
    for (let i = 1; i <= COMM_PCS_COUNT; i++) {
      deviceKeys.push({ deviceType: 'pcs', deviceId: String(i), key: `pcs-${i}`, name: `PCS ${i}` })
    }
    for (let i = 1; i <= COMM_BMS_COUNT; i++) {
      deviceKeys.push({ deviceType: 'bms', deviceId: String(i), key: `bms-${i}`, name: `BMS ${i}` })
    }
    for (let i = 1; i <= 10; i++) {
      deviceKeys.push({
        deviceType: 'battery',
        deviceId: String(i),
        key: `battery-${i}`,
        name: `电池仓 ${i}`,
      })
    }

    for (const d of deviceKeys) {
      let status = deriveDeviceStatus(d.key, frameLite)

      // Merge business-layer device status so comm page reflects real device faults even if link is OK.
      if (d.deviceType === 'bms') {
        const gid = Number(d.deviceId)
        const g = batteryGroups.find((x) => x.id === gid)
        if (g) status = mergeStatus(status, g.bms.status)
      }
      if (d.deviceType === 'battery') {
        const gid = Number(d.deviceId)
        const g = batteryGroups.find((x) => x.id === gid)
        if (g) status = mergeStatus(status, g.status)
      }
      if (d.deviceType === 'ccu') {
        const uid = Number(d.deviceId)
        const u = coordinationUnits.find((x) => x.unitId === uid)
        if (u) status = mergeStatus(status, u.status)
      }
      const connectedDevices = deriveConnectedDevices(d.key, links, frameLite)
      const modbusFrames = frameLite
        .filter((x) => (x.from === d.key || x.to === d.key) && x.payloadHex.length > 0)
        .slice(-20)
      const modbusPackets = deriveModbusPackets(d.key, modbusFrames)

      insertCommunication.run({
        ts,
        deviceType: d.deviceType,
        deviceId: d.deviceId,
        status,
        lastCommTime: fmtTs(ts),
        modbusPacketsJson: JSON.stringify(modbusPackets),
        connectedDevicesJson: JSON.stringify(connectedDevices),
      })
    }

    return ts
  })

  const tick = () => {
    const ts = tickTx()

    const maintenanceIntervalMs = Number(process.env.DATA_MAINTENANCE_INTERVAL_MS ?? 10 * 60_000)
    if (
      Number.isFinite(maintenanceIntervalMs) &&
      maintenanceIntervalMs > 0 &&
      lastMaintenanceMs > 0 &&
      ts - lastMaintenanceMs >= maintenanceIntervalMs
    ) {
      lastMaintenanceMs = ts
      runMaintenance(ts)
    }

    if (lastMaintenanceMs <= 0) lastMaintenanceMs = ts

    return ts
  }

  return { tick }
}
