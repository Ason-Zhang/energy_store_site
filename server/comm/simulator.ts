import type {
  BatteryGroup,
  BmsGroupTelemetry,
  DeviceTelemetry,
  PcsTelemetry,
} from '../../src/services/mockDataService.js'

import {
  VirtualBus,
  type DeviceKey,
  type FrameRecord,
  type LinkDef,
  type ReceiveHandler,
} from './virtualBus.js'
import {
  decodeRequest,
  decodeResponse,
  encodeReadHoldingRegisters,
  encodeResponse,
  type ModbusTcpRequest,
  type ModbusTcpResponse,
} from './protocol/modbusTcp.js'
import { decodeMessage, encodeMessage, type Iec61850Message } from './protocol/iec61850.js'
import { decodeIFrame, encodeIFrame, type Iec104Frame } from './protocol/iec104.js'

const fmtTs = (ms: number) =>
  new Date(ms).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

export type CommSimulatorConfig = {
  bmsCount: number
  pcsCount: number
  ccuCount?: number
  // error injection default
  dropRate?: number
  corruptRate?: number
}

export class CommSimulator {
  private readonly bus = new VirtualBus()
  private readonly cfg: CommSimulatorConfig

  private readonly ccuCount: number

  // Base (source) telemetry. Should be set by the generator once per tick.
  private readonly bmsSource = new Map<number, DeviceTelemetry>()

  private readonly groupSource = new Map<
    number,
    {
      bms: BmsGroupTelemetry
      pcs: PcsTelemetry
      lastUpdateTime: string
      status: BatteryGroup['status']
    }
  >()

  // Battery -> BMS internal bus samples (single source for BMS)
  private readonly batteryLatest = new Map<number, DeviceTelemetry>()

  // A very small point-store inside FrontServer
  private readonly bmsLatest = new Map<number, DeviceTelemetry>()

  // Transaction id increments like a Modbus master
  private txId = 1

  constructor(cfg: CommSimulatorConfig) {
    this.cfg = cfg
    this.ccuCount = Math.max(1, cfg.ccuCount ?? 3)
    this.registerTopology()
    this.registerDevices()
  }

  private buildCcu61850Report(ccuId: number, ts: number): Iec61850Message {
    // Aggregate plant status for the CCU based on groupSource.
    const groups = Array.from(this.groupSource.entries())
      .filter(([gid]) => ((gid - 1) % this.ccuCount) + 1 === ccuId)
      .map(([, g]) => g)

    const err = groups.filter((g) => g.status === 'error').length
    const warn = groups.filter((g) => g.status === 'warning').length
    const ok = groups.filter((g) => g.status === 'normal').length

    const entries: Iec61850Message['entries'] = []
    entries.push({ key: `CCU${ccuId}/Groups/Normal`, value: String(ok), quality: 'GOOD' })
    entries.push({
      key: `CCU${ccuId}/Groups/Warning`,
      value: String(warn),
      quality: warn > 0 ? 'QUESTIONABLE' : 'GOOD',
    })
    entries.push({
      key: `CCU${ccuId}/Groups/Error`,
      value: String(err),
      quality: err > 0 ? 'INVALID' : 'GOOD',
    })

    return {
      service: 'MMS',
      direction: 'uplink',
      dataset: `CCU${ccuId}/Report@${fmtTs(ts)}`,
      entries,
    }
  }

  private buildCcu61850Command(ccuId: number, ts: number): Iec61850Message {
    const entries: Iec61850Message['entries'] = []
    entries.push({ key: `CCU${ccuId}/Cmd/Heartbeat`, value: String(ts), quality: 'GOOD' })
    return {
      service: 'MMS',
      direction: 'downlink',
      dataset: `FS1/CCU${ccuId}_Cmd@${fmtTs(ts)}`,
      entries,
    }
  }

  setBmsSourceTelemetry(next: Map<number, DeviceTelemetry>) {
    this.bmsSource.clear()
    for (const [k, v] of next.entries()) {
      this.bmsSource.set(k, v)
    }
  }

  setBatteryGroupSource(next: Map<number, BatteryGroup>) {
    this.groupSource.clear()
    for (const [k, g] of next.entries()) {
      this.groupSource.set(k, {
        bms: g.bms,
        pcs: g.pcs,
        lastUpdateTime: g.lastUpdateTime,
        status: g.status,
      })
    }
  }

  private buildPcs61850Report(pcsId: number, ts: number): Iec61850Message {
    const bms = this.bmsSource.get(pcsId) ?? this.bmsLatest.get(pcsId)
    const base: DeviceTelemetry =
      bms ??
      ({
        voltage: 0,
        current: 0,
        temperature: 0,
        soc: 0,
        soh: 0,
        power: 0,
        chargingStatus: 'idle',
      } satisfies DeviceTelemetry)
    const entries: Iec61850Message['entries'] = []

    const estKw = Number(((base.voltage * base.current) / 1000).toFixed(2))
    entries.push({ key: `PCS${pcsId}/EstKw`, value: String(estKw), quality: 'GOOD' })
    entries.push({ key: `PCS${pcsId}/Soc`, value: String(base.soc), quality: 'GOOD' })
    entries.push({ key: `PCS${pcsId}/Temp`, value: String(base.temperature), quality: 'GOOD' })

    return {
      service: 'MMS',
      direction: 'uplink',
      dataset: `PCS${pcsId}/Report@${fmtTs(ts)}`,
      entries,
    }
  }

  getLinks(): LinkDef[] {
    return this.bus.listLinks()
  }

  tick(ts: number): FrameRecord[] {
    const frames: FrameRecord[] = []

    // 0) Battery bin pushes internal CAN/Bus sample to its BMS
    for (let i = 1; i <= this.cfg.bmsCount; i++) {
      const t = this.bmsSource.get(i)
      if (!t) continue
      const g = this.groupSource.get(i)
      const payload = Buffer.from(
        JSON.stringify({
          deviceTelemetry: {
            voltage: t.voltage,
            current: t.current,
            temperature: t.temperature,
            soc: t.soc,
            soh: t.soh,
            power: t.power,
            chargingStatus: t.chargingStatus,
          },
          group: g
            ? {
                status: g.status,
                lastUpdateTime: g.lastUpdateTime,
                bms: g.bms,
                pcs: g.pcs,
              }
            : null,
        }),
      )
      this.bus.send(
        {
          linkKey: `internalbus-battery-${i}-bms-${i}`,
          protocol: 'InternalBus',
          from: `battery-${i}`,
          to: `bms-${i}`,
          direction: 'uplink',
          payload,
          summary: `InternalBus/CAN Sample voltage=${t.voltage} current=${t.current} soc=${t.soc}`,
        },
        ts,
        frames,
      )
    }

    // 1.8) CCU publishes IEC61850 report to FrontServer; FrontServer sends command back.
    for (let i = 1; i <= this.ccuCount; i++) {
      const report = this.buildCcu61850Report(i, ts)
      this.bus.send(
        {
          linkKey: `iec61850-ccu-${i}-frontServer-1`,
          protocol: 'IEC61850',
          from: `ccu-${i}`,
          to: 'frontServer-1',
          direction: 'uplink',
          payload: encodeMessage(report),
          summary: `IEC61850 CCU Report CCU${i} entries=${report.entries.length}`,
        },
        ts,
        frames,
      )

      const cmd = this.buildCcu61850Command(i, ts)
      this.bus.send(
        {
          linkKey: `iec61850-ccu-${i}-frontServer-1`,
          protocol: 'IEC61850',
          from: 'frontServer-1',
          to: `ccu-${i}`,
          direction: 'downlink',
          payload: encodeMessage(cmd),
          summary: `IEC61850 CCU Cmd CCU${i} entries=${cmd.entries.length}`,
        },
        ts,
        frames,
      )
    }

    // 1) FrontServer polls each BMS via Modbus TCP
    for (let i = 1; i <= this.cfg.bmsCount; i++) {
      const req = encodeReadHoldingRegisters({
        transactionId: this.nextTxId(),
        unitId: i,
        start: 0,
        quantity: 6,
      })
      this.bus.send(
        {
          linkKey: `modbus-bms-${i}-frontServer-1`,
          protocol: 'ModbusTCP',
          from: 'frontServer-1',
          to: `bms-${i}`,
          direction: 'downlink',
          payload: req,
          summary: `ModbusTCP ReadHoldingRegs unit=${i} start=0 qty=6`,
        },
        ts,
        frames,
      )
    }

    // 1.5) PCS publishes IEC61850 report to FrontServer (station bus)
    for (let i = 1; i <= this.cfg.pcsCount; i++) {
      const msg = this.buildPcs61850Report(i, ts)
      this.bus.send(
        {
          linkKey: `iec61850-pcs-${i}-frontServer-1`,
          protocol: 'IEC61850',
          from: `pcs-${i}`,
          to: 'frontServer-1',
          direction: 'uplink',
          payload: encodeMessage(msg),
          summary: `IEC61850 PCS Report PCS${i} entries=${msg.entries.length}`,
        },
        ts,
        frames,
      )
    }

    // 2) FrontServer publishes IEC61850 report to EMS (station bus)
    const emsMsg = this.build61850Report(ts)
    this.bus.send(
      {
        linkKey: 'iec61850-ems-frontServer-1',
        protocol: 'IEC61850',
        from: 'frontServer-1',
        to: 'ems-ems',
        direction: 'uplink',
        payload: encodeMessage(emsMsg),
        summary: `IEC61850 Report ${emsMsg.dataset} entries=${emsMsg.entries.length}`,
      },
      ts,
      frames,
    )

    // 3) FrontServer sends IEC104 uplink to remote
    const f104 = this.buildIec104Uplink()
    this.bus.send(
      {
        linkKey: 'iec104-frontServer-1-remote-1',
        protocol: 'IEC104',
        from: 'frontServer-1',
        to: 'remote-1',
        direction: 'uplink',
        payload: encodeIFrame(f104),
        summary: `IEC104 I-frame IOA=${f104.ioa} VAL=${f104.value}`,
      },
      ts,
      frames,
    )

    return frames
  }

  // ---------------------
  // Topology
  // ---------------------

  private registerTopology() {
    const dropRate = this.cfg.dropRate ?? 0.0
    const corruptRate = this.cfg.corruptRate ?? 0.0

    for (let i = 1; i <= this.cfg.bmsCount; i++) {
      this.bus.registerLink({
        key: `internalbus-battery-${i}-bms-${i}`,
        protocol: 'InternalBus',
        a: { type: 'battery', id: String(i), name: `电池仓 ${i}` },
        b: { type: 'bms', id: String(i), name: `BMS ${i}` },
        primaryDirection: { from: `battery-${i}`, to: `bms-${i}` },
        dropRate,
        corruptRate,
        latencyMsMin: 1,
        latencyMsMax: 8,
      })
    }

    for (let i = 1; i <= this.cfg.bmsCount; i++) {
      this.bus.registerLink({
        key: `modbus-bms-${i}-frontServer-1`,
        protocol: 'ModbusTCP',
        a: { type: 'bms', id: String(i), name: `BMS ${i}` },
        b: { type: 'frontServer', id: '1', name: '前置服务器' },
        primaryDirection: { from: 'frontServer-1', to: `bms-${i}` },
        dropRate,
        corruptRate,
        latencyMsMin: 6,
        latencyMsMax: 45,
      })
    }

    for (let i = 1; i <= this.cfg.pcsCount; i++) {
      this.bus.registerLink({
        key: `iec61850-pcs-${i}-frontServer-1`,
        protocol: 'IEC61850',
        a: { type: 'pcs', id: String(i), name: `PCS ${i}` },
        b: { type: 'frontServer', id: '1', name: '前置服务器' },
        primaryDirection: { from: `pcs-${i}`, to: 'frontServer-1' },
        dropRate,
        corruptRate,
        latencyMsMin: 3,
        latencyMsMax: 25,
      })
    }

    for (let i = 1; i <= this.ccuCount; i++) {
      this.bus.registerLink({
        key: `iec61850-ccu-${i}-frontServer-1`,
        protocol: 'IEC61850',
        a: { type: 'ccu', id: String(i), name: `CCU ${i}` },
        b: { type: 'frontServer', id: '1', name: '前置服务器' },
        primaryDirection: { from: `ccu-${i}` as DeviceKey, to: 'frontServer-1' },
        dropRate,
        corruptRate,
        latencyMsMin: 3,
        latencyMsMax: 28,
      })
    }

    this.bus.registerLink({
      key: 'iec61850-ems-frontServer-1',
      protocol: 'IEC61850',
      a: { type: 'ems', id: 'ems', name: 'EMS' },
      b: { type: 'frontServer', id: '1', name: '前置服务器' },
      primaryDirection: { from: 'frontServer-1', to: 'ems-ems' },
      dropRate,
      corruptRate,
      latencyMsMin: 2,
      latencyMsMax: 18,
    })

    this.bus.registerLink({
      key: 'iec104-frontServer-1-remote-1',
      protocol: 'IEC104',
      a: { type: 'frontServer', id: '1', name: '前置服务器' },
      b: { type: 'remote', id: '1', name: '远端主站' },
      primaryDirection: { from: 'frontServer-1', to: 'remote-1' },
      dropRate,
      corruptRate,
      latencyMsMin: 18,
      latencyMsMax: 120,
    })
  }

  private registerDevices() {
    // ---------------------
    // Battery: pushes internal samples
    // ---------------------
    for (let i = 1; i <= this.cfg.bmsCount; i++) {
      const key = `battery-${i}` as DeviceKey
      this.bus.registerDevice(key, (() => {
        // battery doesn't respond (uplink only)
        return { ok: true, status: 'normal' }
      }) satisfies ReceiveHandler)
    }

    // ---------------------
    // BMS: Modbus TCP server
    // ---------------------
    for (let i = 1; i <= this.cfg.bmsCount; i++) {
      const key = `bms-${i}` as DeviceKey
      this.bus.registerDevice(key, (({ protocol, payload, corrupted }) => {
        if (protocol === 'InternalBus') {
          if (corrupted) return { ok: false, status: 'warning', error: 'internal_corrupted' }
          try {
            const raw = JSON.parse(payload.toString('utf8')) as {
              deviceTelemetry?: Partial<DeviceTelemetry>
            }
            const parsed = raw.deviceTelemetry ?? {}
            const next: DeviceTelemetry = {
              voltage: typeof parsed.voltage === 'number' ? parsed.voltage : 0,
              current: typeof parsed.current === 'number' ? parsed.current : 0,
              temperature: typeof parsed.temperature === 'number' ? parsed.temperature : 0,
              soc: typeof parsed.soc === 'number' ? parsed.soc : 0,
              soh: typeof parsed.soh === 'number' ? parsed.soh : 0,
              power: typeof parsed.power === 'number' ? parsed.power : 0,
              chargingStatus:
                parsed.chargingStatus === 'charging' ||
                parsed.chargingStatus === 'discharging' ||
                parsed.chargingStatus === 'idle'
                  ? parsed.chargingStatus
                  : 'idle',
            }
            this.batteryLatest.set(i, next)
            const g = this.groupSource.get(i)
            return { ok: true, status: (g?.status ?? 'normal') as 'normal' | 'warning' | 'error' }
          } catch (e) {
            return { ok: false, status: 'error', error: String(e) }
          }
        }

        let req: ModbusTcpRequest
        try {
          req = decodeRequest(payload)
        } catch (e) {
          return { ok: false, status: 'error', error: String(e) }
        }

        if (req.type !== 'readHoldingRegisters') {
          return { ok: false, status: 'error', error: 'unsupported_request' }
        }

        const telemetry =
          this.batteryLatest.get(i) ??
          ({
            voltage: 0,
            current: 0,
            temperature: 0,
            soc: 0,
            soh: 0,
            power: 0,
            chargingStatus: 'idle',
          } satisfies DeviceTelemetry)
        const values = buildBmsRegisterBank(telemetry).slice(req.start, req.start + req.quantity)
        const res: ModbusTcpResponse = {
          type: 'readHoldingRegisters',
          transactionId: req.transactionId,
          unitId: req.unitId,
          values,
        }

        const g = this.groupSource.get(i)
        const businessStatus = (g?.bms.status ?? 'normal') as 'normal' | 'warning' | 'error'

        return {
          ok: true,
          status: businessStatus,
          response: {
            payload: encodeResponse(res),
            summary: `ModbusTCP ReadHoldingRegsResp unit=${i} words=${values.length}`,
          },
        }
      }) satisfies ReceiveHandler)
    }

    // ---------------------
    // FrontServer: receives Modbus responses from BMS
    // (In this demo the frontServer does not need a handler for downlink, only for rx.)
    // ---------------------
    this.bus.registerDevice('frontServer-1', (({ protocol, payload }) => {
      if (protocol === 'ModbusTCP') {
        try {
          const res = decodeResponse(payload)
          if (res.type === 'readHoldingRegisters') {
            const unitId = res.unitId
            const telemetry = decodeBmsRegisterBank(res.values)
            this.bmsLatest.set(unitId, telemetry)
            return { ok: true, status: 'normal' }
          }
          return { ok: false, status: 'warning', error: 'modbus_exception' }
        } catch (e) {
          return { ok: false, status: 'error', error: String(e) }
        }
      }

      if (protocol === 'IEC61850') {
        // For PCS -> FrontServer messages (not fully used yet)
        try {
          void decodeMessage(payload)
          return { ok: true, status: 'normal' }
        } catch (e) {
          return { ok: false, status: 'error', error: String(e) }
        }
      }

      return { ok: false, status: 'error', error: 'unsupported_protocol' }
    }) satisfies ReceiveHandler)

    // EMS: receives IEC61850 report
    this.bus.registerDevice('ems-ems', (({ protocol, payload }) => {
      if (protocol !== 'IEC61850') return { ok: false, status: 'error', error: 'bad_protocol' }
      try {
        void decodeMessage(payload)
        return { ok: true, status: 'normal' }
      } catch (e) {
        return { ok: false, status: 'error', error: String(e) }
      }
    }) satisfies ReceiveHandler)

    // Remote master: receives IEC104
    this.bus.registerDevice('remote-1', (({ protocol, payload }) => {
      if (protocol !== 'IEC104') return { ok: false, status: 'error', error: 'bad_protocol' }
      try {
        void decodeIFrame(payload)
        return { ok: true, status: 'normal' }
      } catch (e) {
        return { ok: false, status: 'error', error: String(e) }
      }
    }) satisfies ReceiveHandler)

    // PCS devices: for now they are present in topology but can be extended later.
    for (let i = 1; i <= this.cfg.pcsCount; i++) {
      this.bus.registerDevice(`pcs-${i}` as DeviceKey, () => ({ ok: true, status: 'normal' }))
    }

    // CCU devices: receive IEC61850 commands from FrontServer
    for (let i = 1; i <= this.ccuCount; i++) {
      this.bus.registerDevice(`ccu-${i}` as DeviceKey, (({ protocol, payload, corrupted }) => {
        if (protocol !== 'IEC61850') return { ok: false, status: 'error', error: 'bad_protocol' }
        if (corrupted) return { ok: false, status: 'warning', error: 'corrupted' }
        try {
          void decodeMessage(payload)
          return { ok: true, status: 'normal' }
        } catch (e) {
          return { ok: false, status: 'error', error: String(e) }
        }
      }) satisfies ReceiveHandler)
    }
  }

  private nextTxId(): number {
    const v = this.txId
    this.txId = (this.txId + 1) & 0xffff
    return v
  }

  private build61850Report(ts: number): Iec61850Message {
    const entries: Iec61850Message['entries'] = []
    const bms = Array.from(this.bmsLatest.entries())

    const avgSoc =
      bms.length === 0
        ? 0
        : Number((bms.reduce((s, [, t]) => s + t.soc, 0) / bms.length).toFixed(1))

    const stationKw =
      bms.length === 0
        ? 0
        : Number(
            (
              bms.reduce((s, [, t]) => s + Number((t.voltage * t.current).toFixed(1)), 0) / 1000
            ).toFixed(2),
          )

    entries.push({ key: 'Station/AvgSocPct', value: String(avgSoc), quality: 'GOOD' })
    entries.push({ key: 'Station/EstPowerMw', value: String(stationKw), quality: 'GOOD' })

    // Include each BMS voltage/current
    for (const [id, t] of bms.slice(0, 10)) {
      entries.push({ key: `BMS${id}/Voltage`, value: String(t.voltage), quality: 'GOOD' })
      entries.push({ key: `BMS${id}/Current`, value: String(t.current), quality: 'GOOD' })
      entries.push({ key: `BMS${id}/Soc`, value: String(t.soc), quality: 'GOOD' })
    }

    return {
      service: 'MMS',
      direction: 'uplink',
      dataset: `FS1/EMS_Report@${fmtTs(ts)}`,
      entries,
    }
  }

  private buildIec104Uplink(): Iec104Frame {
    const bms = Array.from(this.bmsLatest.values())
    const avgSoc =
      bms.length === 0 ? 0 : Number((bms.reduce((s, t) => s + t.soc, 0) / bms.length).toFixed(1))

    return {
      type: 'I',
      direction: 'uplink',
      ioa: 1001,
      asduType: 'M_ME_NC_1',
      cot: 'CYCLIC',
      value: String(avgSoc),
    }
  }
}

function buildBmsRegisterBank(t: DeviceTelemetry): number[] {
  // Holding registers (uint16) for demo:
  // 0: Voltage*10 (V)
  // 1: Current*10 (A) signed mapped to uint16
  // 2: Temperature (C)
  // 3: SOC (%)
  // 4: SOH*1000
  // 5: Power*10 (kW)
  const cur = Math.round(t.current * 10)
  const curU16 = cur < 0 ? (0x10000 + (cur % 0x10000)) & 0xffff : cur & 0xffff
  return [
    Math.round(t.voltage * 10) & 0xffff,
    curU16,
    Math.round(t.temperature) & 0xffff,
    Math.round(t.soc) & 0xffff,
    Math.round(t.soh * 1000) & 0xffff,
    Math.round((t.power / 1000) * 10) & 0xffff,
  ]
}

function decodeBmsRegisterBank(words: number[]): DeviceTelemetry {
  const voltage = (words[0] ?? 0) / 10
  const curRaw = words[1] ?? 0
  const curSigned = curRaw & 0x8000 ? curRaw - 0x10000 : curRaw
  const current = curSigned / 10
  const temperature = words[2] ?? 0
  const soc = words[3] ?? 0
  const soh = (words[4] ?? 0) / 1000
  const power = Math.abs(voltage * current)

  return {
    voltage,
    current,
    temperature,
    soc,
    soh,
    power,
    chargingStatus: current > 0 ? 'charging' : current < 0 ? 'discharging' : 'idle',
  }
}
