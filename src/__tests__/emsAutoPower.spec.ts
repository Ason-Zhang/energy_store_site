import { describe, expect, it } from 'vitest'

import { openDb, migrate } from '../../server/db.js'
import { computeAutoPowerDecision } from '../../server/emsAutoPower.js'
import { computeEmsSnapshot } from '../modules/ems/decisionEngine'
import type { BatteryGroup, CoordinationUnit } from '../services/mockDataService'

describe('computeAutoPowerDecision', () => {
  it('returns a decision with controlCommands and basic fields', () => {
    const db = openDb(':memory:')
    migrate(db)

    const ts = Date.now()

    db.prepare(`INSERT INTO snapshots(ts) VALUES (?)`).run(ts)

    db.prepare(
      `INSERT INTO telemetry(ts, currentTime, averageVoltage, totalCurrent, averageTemperature, systemSOC, systemSOH)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(ts, 'now', 420, 100, 30, 55, 98.5)

    db.prepare(
      `INSERT INTO system_status(ts, status, load, totalPower, runTime)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(ts, 'normal', 60, 800, '1d')

    const batteryGroups = [
      {
        id: 1,
        status: 'normal',
        pcs: { actualKw: 0 },
        bms: {
          socPct: 55,
          temperatureC: 30,
          insulationResistanceKohm: 600,
          deltaCellVoltageMv: 20,
        },
      },
    ]

    const coordinationUnits = [
      {
        inputs: {
          devices: { pcs: [{ adjustableMaxKw: 180 }] },
          safety: { interlockActive: false },
        },
      },
    ]

    db.prepare(`INSERT INTO battery_groups_snapshots(ts, json) VALUES (?, ?)`).run(
      ts,
      JSON.stringify(batteryGroups),
    )
    db.prepare(`INSERT INTO coordination_units_snapshots(ts, json) VALUES (?, ?)`).run(
      ts,
      JSON.stringify(coordinationUnits),
    )

    const decision = computeAutoPowerDecision({ db, nowMs: ts, historyWindowMs: 60_000 })

    expect(decision.ts).toBe(ts)
    expect(typeof decision.stationTargetPowerKw).toBe('number')
    expect(decision.controlCommands).toBeTruthy()
    expect(typeof decision.controlCommands.agc.enabled).toBe('boolean')
    expect(typeof decision.controlCommands.agc.targetPower).toBe('number')
    expect(typeof decision.controlCommands.avc.enabled).toBe('boolean')
  })

  it('does not introduce step jumps at load threshold (50..75)', () => {
    const db = openDb(':memory:')
    migrate(db)

    const ts = Date.now()
    db.prepare(`INSERT INTO snapshots(ts) VALUES (?)`).run(ts)

    db.prepare(
      `INSERT INTO telemetry(ts, currentTime, averageVoltage, totalCurrent, averageTemperature, systemSOC, systemSOH)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(ts, 'now', 420, 100, 30, 60, 98.5)

    const batteryGroups = [
      {
        id: 1,
        status: 'normal',
        pcs: { actualKw: 0 },
        bms: {
          socPct: 60,
          temperatureC: 30,
          insulationResistanceKohm: 600,
          deltaCellVoltageMv: 20,
        },
      },
    ]

    const coordinationUnits = [
      {
        inputs: {
          devices: { pcs: [{ adjustableMaxKw: 1800 }] },
          safety: { interlockActive: false },
        },
      },
    ]

    db.prepare(`INSERT INTO battery_groups_snapshots(ts, json) VALUES (?, ?)`).run(
      ts,
      JSON.stringify(batteryGroups),
    )
    db.prepare(`INSERT INTO coordination_units_snapshots(ts, json) VALUES (?, ?)`).run(
      ts,
      JSON.stringify(coordinationUnits),
    )

    db.prepare(
      `INSERT INTO system_status(ts, status, load, totalPower, runTime)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(ts, 'normal', 50, 800, '1d')
    const d50 = computeAutoPowerDecision({ db, nowMs: ts, historyWindowMs: 60_000 })

    db.prepare(`DELETE FROM system_status`).run()
    db.prepare(
      `INSERT INTO system_status(ts, status, load, totalPower, runTime)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(ts, 'normal', 51, 800, '1d')
    const d51 = computeAutoPowerDecision({ db, nowMs: ts, historyWindowMs: 60_000 })

    // With continuous mapping, 1% load change near the threshold should not cause huge jump.
    expect(Math.abs(d51.stationTargetPowerKw - d50.stationTargetPowerKw)).toBeLessThanOrEqual(120)
  })

  it('applies energy headroom limits based on SOC window', () => {
    const db = openDb(':memory:')
    migrate(db)

    const ts = Date.now()
    db.prepare(`INSERT INTO snapshots(ts) VALUES (?)`).run(ts)

    const batteryGroups = [
      {
        id: 1,
        status: 'normal',
        pcs: { actualKw: 0 },
        bms: {
          socPct: 22,
          temperatureC: 30,
          insulationResistanceKohm: 600,
          deltaCellVoltageMv: 20,
        },
      },
    ]

    const coordinationUnits = [
      {
        inputs: {
          devices: { pcs: [{ adjustableMaxKw: 1800 }] },
          safety: { interlockActive: false },
        },
      },
    ]

    db.prepare(
      `INSERT INTO system_status(ts, status, load, totalPower, runTime)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(ts, 'normal', 90, 800, '1d')

    db.prepare(
      `INSERT INTO telemetry(ts, currentTime, averageVoltage, totalCurrent, averageTemperature, systemSOC, systemSOH)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(ts, 'now', 420, 100, 30, 22, 98.5)

    db.prepare(`INSERT INTO battery_groups_snapshots(ts, json) VALUES (?, ?)`).run(
      ts,
      JSON.stringify(batteryGroups),
    )
    db.prepare(`INSERT INTO coordination_units_snapshots(ts, json) VALUES (?, ?)`).run(
      ts,
      JSON.stringify(coordinationUnits),
    )

    const dLowSoc = computeAutoPowerDecision({ db, nowMs: ts, historyWindowMs: 60_000 })

    db.prepare(`DELETE FROM telemetry`).run()
    db.prepare(
      `INSERT INTO telemetry(ts, currentTime, averageVoltage, totalCurrent, averageTemperature, systemSOC, systemSOH)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(ts, 'now', 420, 100, 30, 88, 98.5)
    const dHighSoc = computeAutoPowerDecision({ db, nowMs: ts, historyWindowMs: 60_000 })

    // Under the same high-load condition (which tends to discharge), low SOC should strongly limit discharge.
    expect(Math.abs(dLowSoc.stationTargetPowerKw)).toBeLessThan(
      Math.abs(dHighSoc.stationTargetPowerKw),
    )
    expect(Math.abs(dLowSoc.stationTargetPowerKw)).toBeLessThanOrEqual(50)
  })

  it('computes station target voltage within configured range when voltage telemetry exists', () => {
    const db = openDb(':memory:')
    migrate(db)

    const ts = Date.now()
    db.prepare(`INSERT INTO snapshots(ts) VALUES (?)`).run(ts)

    db.prepare(
      `INSERT INTO telemetry(ts, currentTime, averageVoltage, totalCurrent, averageTemperature, systemSOC, systemSOH)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(ts, 'now', 395, 100, 30, 60, 98.5)

    db.prepare(
      `INSERT INTO system_status(ts, status, load, totalPower, runTime)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(ts, 'normal', 60, 800, '1d')

    db.prepare(`INSERT INTO battery_groups_snapshots(ts, json) VALUES (?, ?)`).run(
      ts,
      JSON.stringify([]),
    )
    db.prepare(`INSERT INTO coordination_units_snapshots(ts, json) VALUES (?, ?)`).run(
      ts,
      JSON.stringify([]),
    )

    const d = computeAutoPowerDecision({ db, nowMs: ts, historyWindowMs: 60_000 })
    expect(
      d.stationTargetVoltageV === null ||
        (d.stationTargetVoltageV >= 380 && d.stationTargetVoltageV <= 420),
    ).toBe(true)
  })

  it('enables AVC setpoint in auto decision when voltage telemetry exists', () => {
    const db = openDb(':memory:')
    migrate(db)

    const ts = Date.now()
    db.prepare(`INSERT INTO snapshots(ts) VALUES (?)`).run(ts)

    db.prepare(
      `INSERT INTO telemetry(ts, currentTime, averageVoltage, totalCurrent, averageTemperature, systemSOC, systemSOH)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(ts, 'now', 402, 100, 30, 60, 98.5)

    db.prepare(
      `INSERT INTO system_status(ts, status, load, totalPower, runTime)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(ts, 'normal', 65, 800, '1d')

    db.prepare(`INSERT INTO battery_groups_snapshots(ts, json) VALUES (?, ?)`).run(
      ts,
      JSON.stringify([]),
    )
    db.prepare(`INSERT INTO coordination_units_snapshots(ts, json) VALUES (?, ?)`).run(
      ts,
      JSON.stringify([]),
    )

    const d = computeAutoPowerDecision({ db, nowMs: ts, historyWindowMs: 60_000 })
    expect(d.controlCommands.avc.enabled).toBe(true)
    expect(Number.isFinite(d.controlCommands.avc.targetVoltage)).toBe(true)
  })

  it('labels station target voltage source as auto when remote did not provide AVC', () => {
    const batteryGroups = [] as unknown as BatteryGroup[]
    const coordinationUnits = [] as unknown as CoordinationUnit[]

    const snapshot = computeEmsSnapshot({
      batteryGroups,
      coordinationUnits,
      controlCommands: {
        agc: { enabled: true, targetPower: 100 },
        avc: { enabled: true, targetVoltage: 402 },
        meta: { actor: 'remote', avcProvided: false },
      },
    })

    expect(snapshot.decision.stationTargetVoltageKv).toBeCloseTo(0.402)
    expect(snapshot.decision.stationTargetVoltageSource).toBe('auto')
  })

  it('labels station target voltage source as remote when remote explicitly provided AVC', () => {
    const batteryGroups = [] as unknown as BatteryGroup[]
    const coordinationUnits = [] as unknown as CoordinationUnit[]

    const snapshot = computeEmsSnapshot({
      batteryGroups,
      coordinationUnits,
      controlCommands: {
        agc: { enabled: true, targetPower: 100 },
        avc: { enabled: false, targetVoltage: 399 },
        meta: { actor: 'remote', avcProvided: true },
      },
    })

    expect(snapshot.decision.stationTargetVoltageSource).toBe('remote')
  })
})
