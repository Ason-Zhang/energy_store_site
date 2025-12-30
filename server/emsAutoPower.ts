import type { Db } from './db.js'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  if (edge0 === edge1) return x < edge0 ? 0 : 1
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

const smoothstepDecreasing = (goodAtOrBelow: number, badAtOrAbove: number, x: number): number =>
  1 - smoothstep(goodAtOrBelow, badAtOrAbove, x)

type ControlCommands = {
  agc: { enabled: boolean; targetPower: number; rampRate: number; deadband: number }
  avc: { enabled: boolean; targetVoltage: number; voltageRange: { min: number; max: number } }
  manualPower: { enabled: boolean; targetPower: number }
}

export type MarketPriceSignal = {
  priceCnyPerMwh: number
  source: string
  ts: number
} | null

export interface MarketDataProvider {
  getPriceSignal(params: { ts: number }): Promise<MarketPriceSignal> | MarketPriceSignal
}

export const NullMarketDataProvider: MarketDataProvider = {
  getPriceSignal: () => null,
}

export type AutoPowerDecision = {
  ts: number
  tsText: string
  active: boolean
  decisionMode: 'AUTO_AGC' | 'SAFE_STOP'
  stationTargetPowerKw: number
  stationTargetVoltageV: number | null
  powerLimitKw: number
  reasons: string[]
  rationale: string[]
  market: MarketPriceSignal
  inputs: {
    systemSocPct: number | null
    systemSohPct: number | null
    systemLoadPct: number | null
    systemAverageVoltageV: number | null
    avgSocPctFromGroups: number | null
    worstInsulationResistanceKohm: number | null
    worstDeltaCellVoltageMv: number | null
    maxTemperatureC: number | null
    history: {
      windowMs: number
      points: number
      insulationSlopeKohmPerHour: number | null
      deltaCellSlopeMvPerHour: number | null
      socSlopePctPerHour: number | null
    }
  }
  controlCommands: ControlCommands
}

const defaultControlCommands = (): ControlCommands => ({
  agc: { enabled: false, targetPower: 0, rampRate: 20, deadband: 5 },
  avc: { enabled: false, targetVoltage: 400, voltageRange: { min: 380, max: 420 } },
  manualPower: { enabled: false, targetPower: 0 },
})

const fmtTs = (ms: number): string =>
  new Date(ms).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

const safeJsonParse = <T>(json: string | null | undefined, fallback: T): T => {
  if (!json) return fallback
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

type BatteryGroup = {
  id: number
  status: 'normal' | 'warning' | 'error'
  pcs?: { actualKw?: number }
  bms?: {
    socPct?: number
    temperatureC?: number
    insulationResistanceKohm?: number
    deltaCellVoltageMv?: number
  }
}

type CoordinationUnit = {
  inputs?: {
    devices?: { pcs?: Array<{ adjustableMaxKw?: number }> }
    safety?: { interlockActive?: boolean }
  }
}

const computeSlopePerHour = (series: Array<{ ts: number; v: number }>): number | null => {
  if (series.length < 2) return null
  const a = series[0]
  const b = series[series.length - 1]
  const dtHours = (b.ts - a.ts) / 3_600_000
  if (dtHours <= 0) return null
  return (b.v - a.v) / dtHours
}

const computeAvg = (arr: number[]): number | null => {
  if (!arr.length) return null
  const sum = arr.reduce((s, x) => s + x, 0)
  return sum / arr.length
}

export function computeAutoPowerDecision(params: {
  db: Db
  nowMs?: number
  historyWindowMs?: number
  maxHistoryPoints?: number
  market?: MarketDataProvider
}): AutoPowerDecision {
  const nowMs = params.nowMs ?? Date.now()
  const historyWindowMs = params.historyWindowMs ?? 60 * 60_000
  const maxHistoryPoints = params.maxHistoryPoints ?? 720
  const marketProvider = params.market ?? NullMarketDataProvider

  const latestBatteryGroupsRow = params.db
    .prepare(`SELECT ts, json FROM battery_groups_snapshots ORDER BY ts DESC LIMIT 1`)
    .get() as { ts: number; json: string } | undefined
  const latestCoordUnitsRow = params.db
    .prepare(`SELECT ts, json FROM coordination_units_snapshots ORDER BY ts DESC LIMIT 1`)
    .get() as { ts: number; json: string } | undefined

  const latestTelem = params.db
    .prepare(
      `SELECT ts, systemSOC, systemSOH, averageVoltage, averageTemperature FROM telemetry ORDER BY ts DESC LIMIT 1`,
    )
    .get() as
    | {
        ts: number
        systemSOC: number
        systemSOH: number
        averageVoltage: number
        averageTemperature: number
      }
    | undefined

  const latestSystem = params.db
    .prepare(`SELECT ts, status, load FROM system_status ORDER BY ts DESC LIMIT 1`)
    .get() as { ts: number; status: string; load: number } | undefined

  const batteryGroups = safeJsonParse<BatteryGroup[]>(latestBatteryGroupsRow?.json, [])
  const coordinationUnits = safeJsonParse<CoordinationUnit[]>(latestCoordUnitsRow?.json, [])

  const activeInterlock = coordinationUnits.some((u) => Boolean(u?.inputs?.safety?.interlockActive))

  const avgSocFromGroups = (() => {
    const socs = batteryGroups
      .map((g) => Number(g?.bms?.socPct))
      .filter((x) => Number.isFinite(x)) as number[]
    const v = computeAvg(socs)
    return v === null ? null : Math.round(v)
  })()

  const worstInsu = (() => {
    const vs = batteryGroups
      .map((g) => Number(g?.bms?.insulationResistanceKohm))
      .filter((x) => Number.isFinite(x)) as number[]
    if (!vs.length) return null
    return Math.min(...vs)
  })()

  const worstDelta = (() => {
    const vs = batteryGroups
      .map((g) => Number(g?.bms?.deltaCellVoltageMv))
      .filter((x) => Number.isFinite(x)) as number[]
    if (!vs.length) return null
    return Math.max(...vs)
  })()

  const maxTemp = (() => {
    const vs = batteryGroups
      .map((g) => Number(g?.bms?.temperatureC))
      .filter((x) => Number.isFinite(x)) as number[]
    if (!vs.length) return null
    return Math.max(...vs)
  })()

  const powerLimitKw = (() => {
    let sum = 0
    for (const u of coordinationUnits) {
      const pcs = u?.inputs?.devices?.pcs ?? []
      for (const p of pcs) sum += Math.max(0, Number(p?.adjustableMaxKw ?? 0))
    }
    if (sum > 0) return Number(sum.toFixed(0))
    const count = batteryGroups.length
    if (count > 0) return count * 180
    const fallback = Number(process.env.AUTO_POWER_FALLBACK_LIMIT_KW ?? 1800)
    return Number.isFinite(fallback) && fallback > 0 ? Number(fallback.toFixed(0)) : 0
  })()

  const rows = params.db
    .prepare(
      `SELECT ts, json FROM battery_groups_snapshots WHERE ts BETWEEN ? AND ? ORDER BY ts ASC LIMIT ?`,
    )
    .all(nowMs - historyWindowMs, nowMs, maxHistoryPoints) as Array<{ ts: number; json: string }>

  const insuSeries: Array<{ ts: number; v: number }> = []
  const deltaSeries: Array<{ ts: number; v: number }> = []
  for (const r of rows) {
    const groups = safeJsonParse<BatteryGroup[]>(r.json, [])
    const insus = groups
      .map((g) => Number(g?.bms?.insulationResistanceKohm))
      .filter((x) => Number.isFinite(x)) as number[]
    const deltas = groups
      .map((g) => Number(g?.bms?.deltaCellVoltageMv))
      .filter((x) => Number.isFinite(x)) as number[]
    if (insus.length) insuSeries.push({ ts: r.ts, v: Math.min(...insus) })
    if (deltas.length) deltaSeries.push({ ts: r.ts, v: Math.max(...deltas) })
  }

  const telemetryRows = params.db
    .prepare(`SELECT ts, systemSOC FROM telemetry WHERE ts BETWEEN ? AND ? ORDER BY ts ASC LIMIT ?`)
    .all(nowMs - historyWindowMs, nowMs, maxHistoryPoints) as Array<{
    ts: number
    systemSOC: number
  }>
  const socSeries = telemetryRows
    .map((r) => ({ ts: r.ts, v: Number(r.systemSOC) }))
    .filter((p) => Number.isFinite(p.v))

  const insulationSlope = computeSlopePerHour(insuSeries)
  const deltaSlope = computeSlopePerHour(deltaSeries)
  const socSlope = computeSlopePerHour(socSeries)

  const reasons: string[] = []
  const rationale: string[] = []

  const faultedGroupCount = batteryGroups.filter((g) => g.status === 'error').length
  const anyGroupError = faultedGroupCount > 0

  let hardStop = false
  let healthFactor = 1
  if (activeInterlock) {
    hardStop = true
    reasons.push('安全联锁激活')
  }
  if (anyGroupError) {
    if (batteryGroups.length > 0 && faultedGroupCount >= batteryGroups.length) {
      hardStop = true
      reasons.push('所有电池组故障')
    } else {
      reasons.push(`检测到电池组故障：${faultedGroupCount}组（已按可用功率=0隔离并重算限值）`)
    }
  }

  if (!hardStop) {
    const insuFactor = typeof worstInsu === 'number' ? smoothstep(120, 260, worstInsu) : 1
    const deltaFactor =
      typeof worstDelta === 'number' ? smoothstepDecreasing(40, 80, worstDelta) : 1
    const tempFactor = typeof maxTemp === 'number' ? smoothstepDecreasing(45, 65, maxTemp) : 1

    const insuTrendFactor =
      typeof insulationSlope === 'number' ? smoothstep(-60, -10, insulationSlope) : 1
    const deltaTrendFactor =
      typeof deltaSlope === 'number' ? smoothstepDecreasing(5, 25, deltaSlope) : 1

    const socTrendFactor =
      typeof socSlope === 'number' ? smoothstepDecreasing(2, 6, Math.abs(socSlope)) : 1

    const combined =
      insuFactor * deltaFactor * tempFactor * insuTrendFactor * deltaTrendFactor * socTrendFactor

    // Soft-safety policy: extreme trend factors should degrade dispatch, but should NOT force a full station stop.
    // Hard-stop is reserved for interlock or all-groups-faulted conditions.
    const minHealthFactor = clamp(Number(process.env.AUTO_POWER_MIN_HEALTH_FACTOR ?? 0.2), 0, 1)
    healthFactor = clamp(combined, minHealthFactor, 1)

    if (typeof worstInsu === 'number' && worstInsu < 200) reasons.push('绝缘偏低')
    if (typeof worstDelta === 'number' && worstDelta >= 55) reasons.push('一致性偏差偏大')
    if (typeof maxTemp === 'number' && maxTemp >= 54) reasons.push('温度偏高')
    if (typeof insulationSlope === 'number' && insulationSlope < -30)
      reasons.push('绝缘下降趋势明显')
    if (typeof deltaSlope === 'number' && deltaSlope > 12) reasons.push('压差上升趋势明显')
    if (typeof socSlope === 'number' && Math.abs(socSlope) > 4) reasons.push('SOC变化趋势偏快')
  } else {
    healthFactor = 0
  }

  const systemSocPct = typeof latestTelem?.systemSOC === 'number' ? latestTelem.systemSOC : null
  const systemSohPct = typeof latestTelem?.systemSOH === 'number' ? latestTelem.systemSOH : null
  const systemLoadPct = typeof latestSystem?.load === 'number' ? latestSystem.load : null
  const systemAverageVoltageV =
    typeof latestTelem?.averageVoltage === 'number' ? latestTelem.averageVoltage : null

  const market = (() => {
    try {
      const v = marketProvider.getPriceSignal({ ts: nowMs })
      if (v && typeof (v as Promise<unknown>).then === 'function') return null
      return v as MarketPriceSignal
    } catch {
      return null
    }
  })()

  const limit = Math.max(0, powerLimitKw)

  const baseFromLoad = (() => {
    if (!Number.isFinite(systemLoadPct as number) || limit <= 0) return 0
    const load = systemLoadPct as number
    const low = 50
    const high = 75
    const t = clamp((load - low) / (high - low), 0, 1)
    const coeff = 0.5 + (-0.6 - 0.5) * t
    return coeff * limit
  })()

  const socForControl = Number.isFinite(systemSocPct as number)
    ? (systemSocPct as number)
    : Number.isFinite(avgSocFromGroups as number)
      ? (avgSocFromGroups as number)
      : null

  const baseFromSoc = (() => {
    if (!Number.isFinite(socForControl as number) || limit <= 0) return 0
    const soc = socForControl as number
    const target = 60
    const err = soc - target
    if (Math.abs(err) <= 3) return 0
    const k = clamp(Math.abs(err) / 30, 0, 1)
    const mag = 0.4 * limit * k
    return err > 0 ? -mag : mag
  })()

  const baseFromMarket = (() => {
    if (!market) return 0
    const price = Number(market.priceCnyPerMwh)
    if (!Number.isFinite(price) || limit <= 0) return 0
    const mid = Number(process.env.AUTO_POWER_PRICE_MID_CNY_PER_MWH ?? 500)
    const span = Number(process.env.AUTO_POWER_PRICE_SPAN_CNY_PER_MWH ?? 300)
    const z = span > 0 ? clamp((price - mid) / span, -1, 1) : 0
    const scale = clamp(Number(process.env.AUTO_POWER_PRICE_SCALE ?? 0.25), 0, 1)
    return -z * scale * limit
  })()

  let targetUnclamped = baseFromLoad + baseFromSoc + baseFromMarket

  if (typeof systemSohPct === 'number' && systemSohPct < 92) {
    const shrink = clamp((systemSohPct - 85) / 7, 0.4, 1)
    targetUnclamped *= shrink
    reasons.push('SOH偏低，降低循环强度')
  }

  const active = limit > 0
  let decisionMode: AutoPowerDecision['decisionMode'] = 'AUTO_AGC'
  let stationTargetPowerKw = 0
  let stationTargetVoltageV: number | null = null

  if (!active || healthFactor === 0) {
    decisionMode = 'SAFE_STOP'
    stationTargetPowerKw = 0
    stationTargetVoltageV = null
    if (!active) reasons.push('无可用功率上限')
  } else {
    const groupCount = batteryGroups.length
    const perGroupCapacityKwh = Number(process.env.AUTO_POWER_GROUP_CAPACITY_KWH ?? 200)
    const totalCapacityKwh = Math.max(0, groupCount * perGroupCapacityKwh)
    const socPctForEnergy = Number.isFinite(socForControl as number)
      ? (socForControl as number)
      : 60

    const socMin = Number(process.env.AUTO_POWER_SOC_MIN ?? 20)
    const socMax = Number(process.env.AUTO_POWER_SOC_MAX ?? 90)
    const horizonHours = Number(process.env.AUTO_POWER_ENERGY_HORIZON_HOURS ?? 0.25)

    const chargeHeadroomKwh = totalCapacityKwh * clamp((socMax - socPctForEnergy) / 100, 0, 1)
    const dischargeHeadroomKwh = totalCapacityKwh * clamp((socPctForEnergy - socMin) / 100, 0, 1)

    const maxChargeKwByEnergy = horizonHours > 0 ? chargeHeadroomKwh / horizonHours : limit
    const maxDischargeKwByEnergy = horizonHours > 0 ? dischargeHeadroomKwh / horizonHours : limit

    const energyLimited = clamp(targetUnclamped, -maxDischargeKwByEnergy, maxChargeKwByEnergy)
    stationTargetPowerKw = clamp(energyLimited, -limit, limit) * healthFactor

    // -----------------------------
    // AVC (station target voltage)
    // -----------------------------
    const nominalV = Number(process.env.AUTO_VOLTAGE_NOMINAL_V ?? 400)
    const vMin = Number(process.env.AUTO_VOLTAGE_MIN_V ?? 380)
    const vMax = Number(process.env.AUTO_VOLTAGE_MAX_V ?? 420)
    const kp = clamp(Number(process.env.AUTO_VOLTAGE_KP ?? 0.35), 0, 2)
    const maxErrV = Math.max(1, Number(process.env.AUTO_VOLTAGE_MAX_ERR_V ?? 15))
    const loadCompV = clamp(Number(process.env.AUTO_VOLTAGE_LOAD_COMP_V ?? 3), 0, 20)
    const socCompV = clamp(Number(process.env.AUTO_VOLTAGE_SOC_COMP_V ?? 2), 0, 20)

    const vMeas = Number.isFinite(systemAverageVoltageV as number)
      ? (systemAverageVoltageV as number)
      : null

    const load = Number.isFinite(systemLoadPct as number) ? (systemLoadPct as number) : 60
    const tLoad = clamp((load - 50) / 25, 0, 1)
    const loadBias = (tLoad - 0.5) * 2 // -1..1

    const socPctForAvc = Number.isFinite(socForControl as number) ? (socForControl as number) : 60
    const socBias = clamp((60 - socPctForAvc) / 30, -1, 1) // low SOC => +1 (raise voltage slightly)

    const vErr = vMeas === null ? 0 : clamp(nominalV - vMeas, -maxErrV, maxErrV)

    const deltaV = (kp * vErr + loadCompV * loadBias + socCompV * socBias) * healthFactor
    const desiredV = nominalV + deltaV

    stationTargetVoltageV = clamp(Number(desiredV.toFixed(1)), vMin, vMax)
  }

  stationTargetPowerKw = Number(stationTargetPowerKw.toFixed(1))

  rationale.push(`功率上限=${limit}kW，健康系数=${Number(healthFactor.toFixed(2))}`)
  if (Number.isFinite(baseFromLoad)) rationale.push(`负载项=${Number(baseFromLoad.toFixed(1))}kW`)
  if (Number.isFinite(baseFromSoc)) rationale.push(`SOC项=${Number(baseFromSoc.toFixed(1))}kW`)
  if (Number.isFinite(baseFromMarket))
    rationale.push(`电价项=${Number(baseFromMarket.toFixed(1))}kW`)
  if (typeof stationTargetVoltageV === 'number') {
    const vMeas = Number.isFinite(systemAverageVoltageV as number)
      ? (systemAverageVoltageV as number)
      : null
    rationale.push(
      `AVC目标U=${stationTargetVoltageV}V${vMeas === null ? '' : `（测量U=${Number(vMeas.toFixed(1))}V）`}`,
    )
  }
  if (typeof insulationSlope === 'number')
    rationale.push(`绝缘趋势=${Number(insulationSlope.toFixed(1))}kΩ/小时`)
  if (typeof deltaSlope === 'number')
    rationale.push(`压差趋势=${Number(deltaSlope.toFixed(1))}mV/小时`)
  if (typeof socSlope === 'number') rationale.push(`SOC趋势=${Number(socSlope.toFixed(1))}%/小时`)

  const commands = defaultControlCommands()
  if (decisionMode === 'SAFE_STOP') {
    commands.agc.enabled = false
    commands.agc.targetPower = 0
    commands.manualPower.enabled = false
    commands.manualPower.targetPower = 0
    commands.avc.enabled = false
  } else {
    commands.agc.enabled = true
    commands.agc.targetPower = stationTargetPowerKw

    // In AUTO mode, we can enable AVC by default to provide a stable station voltage setpoint.
    // (AGC remains primary in the EMS decision engine.)
    const avcEnabled = (process.env.AUTO_VOLTAGE_ENABLED ?? '1') !== '0'
    commands.avc.enabled = avcEnabled && typeof stationTargetVoltageV === 'number'
    if (avcEnabled && typeof stationTargetVoltageV === 'number') {
      commands.avc.targetVoltage = stationTargetVoltageV
      commands.avc.voltageRange = {
        min: Number(process.env.AUTO_VOLTAGE_MIN_V ?? commands.avc.voltageRange.min),
        max: Number(process.env.AUTO_VOLTAGE_MAX_V ?? commands.avc.voltageRange.max),
      }
    }
  }

  return {
    ts: nowMs,
    tsText: fmtTs(nowMs),
    active,
    decisionMode,
    stationTargetPowerKw,
    stationTargetVoltageV,
    powerLimitKw: limit,
    reasons: Array.from(new Set(reasons)),
    rationale,
    market,
    inputs: {
      systemSocPct,
      systemSohPct,
      systemLoadPct,
      systemAverageVoltageV,
      avgSocPctFromGroups: avgSocFromGroups,
      worstInsulationResistanceKohm: worstInsu,
      worstDeltaCellVoltageMv: worstDelta,
      maxTemperatureC: maxTemp,
      history: {
        windowMs: historyWindowMs,
        points: rows.length,
        insulationSlopeKohmPerHour: insulationSlope,
        deltaCellSlopeMvPerHour: deltaSlope,
        socSlopePctPerHour: socSlope,
      },
    },
    controlCommands: commands,
  }
}

export function shouldUseAutoPower(params: {
  remoteActor: string | null
  remoteTs: number | null
  nowMs?: number
  remoteTtlMs?: number
  enabled?: boolean
}): boolean {
  const enabled = params.enabled ?? true
  if (!enabled) return false
  const nowMs = params.nowMs ?? Date.now()
  const ttl = params.remoteTtlMs ?? 5 * 60_000
  if (params.remoteActor !== 'remote') return true
  if (typeof params.remoteTs !== 'number') return true
  return nowMs - params.remoteTs > ttl
}
