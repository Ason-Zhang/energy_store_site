import type { BatteryGroup } from '../../services/mockDataService'
import type { CoordinationUnit } from '../../services/mockDataService'
import type { EmsSnapshot } from '../ems/models'
import type {
  ConversionLog,
  FrontServerSnapshot,
  Iec104Frame,
  Iec61850Sample,
  PointMapping,
  Status,
} from './models'

const random = (min: number, max: number) => Math.random() * (max - min) + min
const randomInt = (min: number, max: number) => Math.floor(random(min, max))
const pick = <T>(arr: readonly T[]): T => {
  if (arr.length === 0) throw new Error('pick() requires a non-empty array')
  return arr[randomInt(0, arr.length)] as T
}

const nowZh = () =>
  new Date().toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

const statusFromProb = (pError: number, pWarn: number): Status => {
  const r = random(0, 1)
  if (r < pError) return 'error'
  if (r < pError + pWarn) return 'warning'
  return 'normal'
}

const qFromStatus = (s: Status): PointMapping['quality'] =>
  s === 'normal' ? 'GOOD' : s === 'warning' ? 'QUESTIONABLE' : 'INVALID'

const buildIoa = (base: number, idx: number) => base + idx

const hex = (len: number) =>
  Array.from({ length: len }, () => randomInt(0, 16).toString(16))
    .join('')
    .toUpperCase()

const mkMapping = (idx: number): PointMapping => {
  const iedName =
    idx % 4 === 0
      ? 'EMS-IED'
      : idx % 4 === 1
        ? `PCS-IED-${(idx % 10) + 1}`
        : idx % 4 === 2
          ? `BMS-IED-${(idx % 10) + 1}`
          : 'PROT-IED'
  const ln = idx % 4 === 0 ? 'MMXU1' : idx % 4 === 1 ? 'DRCC1' : idx % 4 === 2 ? 'BMSC1' : 'PTOC1'
  const doName =
    ln === 'MMXU1' ? 'TotW' : ln === 'DRCC1' ? 'OutWSet' : ln === 'BMSC1' ? 'Soc' : 'Str'
  const daName = ln === 'PTOC1' ? 'stVal' : 'mag.f'
  const asduType =
    ln === 'PTOC1'
      ? ('M_SP_NA_1' as const)
      : doName === 'OutWSet'
        ? ('C_SE_NC_1' as const)
        : ('M_ME_NC_1' as const)

  const status: Status = statusFromProb(0.03, 0.07)
  const scale = asduType === 'M_ME_NC_1' || asduType === 'C_SE_NC_1' ? 1 : 1
  const unit = doName === 'TotW' || doName === 'OutWSet' ? 'kW' : doName === 'Soc' ? '%' : ''
  const name =
    doName === 'TotW'
      ? '全站总有功功率'
      : doName === 'OutWSet'
        ? 'PCS功率设定值'
        : doName === 'Soc'
          ? '电池SOC'
          : '保护动作'

  const causes = ['spont', 'cyclic', 'interrogated'] as const
  const cause: PointMapping['causeOfTransmission'] = asduType.startsWith('C_')
    ? 'activation'
    : pick(causes)

  return {
    id: `MAP-${idx.toString().padStart(3, '0')}`,
    name,
    iedName,
    ld: 'LD0',
    ln,
    doName,
    daName,
    fc: asduType.startsWith('C_') ? 'CF' : ln === 'PTOC1' ? 'ST' : 'MX',
    ioa: buildIoa(1000, idx),
    asduType,
    causeOfTransmission: cause,
    scale,
    unit,
    quality: qFromStatus(status),
  }
}

const mk61850 = (mapping: PointMapping, value: string, status: Status): Iec61850Sample => {
  const dataset = `${mapping.ld}/${mapping.ln}$Dataset`
  const payload = `${mapping.iedName} ${mapping.ld}/${mapping.ln}.${mapping.doName}.${mapping.daName}=${value} q=${mapping.quality}`
  const service = mapping.ln === 'PTOC1' ? 'GOOSE' : 'MMS'
  return {
    timestamp: nowZh(),
    ied: mapping.iedName,
    dataset,
    service,
    direction: 'subscribe',
    status,
    payload,
  }
}

const mk104 = (
  mapping: PointMapping,
  value: string,
  status: Status,
  direction: Iec104Frame['direction'],
): Iec104Frame => {
  const apci = direction === 'uplink' ? `I ${hex(4)} ${hex(4)}` : `I ${hex(4)} ${hex(4)}`
  const asdu = `${mapping.asduType} IOA=${mapping.ioa}`
  const cot = mapping.causeOfTransmission.toUpperCase()
  return {
    timestamp: nowZh(),
    direction,
    status,
    apci,
    asdu,
    ioa: mapping.ioa,
    cot,
    value,
  }
}

const mkLog = (
  direction: ConversionLog['direction'],
  mapping: PointMapping,
  inValue: string,
  outValue: string,
  status: Status,
): ConversionLog => {
  return {
    timestamp: nowZh(),
    status,
    direction,
    mappingId: mapping.id,
    summary: `${mapping.name} (${mapping.iedName} ↔ IOA ${mapping.ioa})`,
    detail: `${direction} | q=${mapping.quality} | in=${inValue} → out=${outValue}`,
  }
}

const valueForMapping = (m: PointMapping, ems?: EmsSnapshot): string => {
  if (ems && m.name === '全站总有功功率') return `${ems.outputs.toScada.kpis.actualPowerKw}`
  if (ems && m.name === 'PCS功率设定值') return `${ems.outputs.toScada.kpis.targetPowerKw}`
  if (ems && m.name === '电池SOC') return `${ems.outputs.toScada.kpis.avgSocPct}`

  if (m.unit === 'kW') return Number(random(-800, 800).toFixed(1)).toString()
  if (m.unit === '%') return randomInt(10, 95).toString()
  return randomInt(0, 1).toString()
}

export const generateFrontServerSnapshot = (params: {
  batteryGroups: BatteryGroup[]
  coordinationUnits: CoordinationUnit[]
  emsSnapshot?: EmsSnapshot | null
}): FrontServerSnapshot => {
  const timestamp = nowZh()
  const ems = params.emsSnapshot ?? undefined

  const table = Array.from({ length: 24 }, (_, i) => mkMapping(i + 1))
  const ok = table.filter((m) => m.quality === 'GOOD').length
  const questionable = table.filter((m) => m.quality === 'QUESTIONABLE').length
  const invalid = table.filter((m) => m.quality === 'INVALID').length

  const stationStatus: Status = statusFromProb(0.02, 0.08)
  const masterStatus: Status = statusFromProb(0.01, 0.06)

  // 站内 IED 列表：与项目已有模块关联
  const ieds = [
    { name: 'EMS-IED', type: 'EMS' as const, status: stationStatus, ip: '10.10.0.10' },
    ...Array.from({ length: 4 }, (_, i) => ({
      name: `PCS-IED-${i + 1}`,
      type: 'PCS' as const,
      status: statusFromProb(0.03, 0.07),
      ip: `10.10.0.${20 + i}`,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      name: `BMS-IED-${i + 1}`,
      type: 'BMS' as const,
      status: statusFromProb(0.03, 0.07),
      ip: `10.10.0.${40 + i}`,
    })),
    {
      name: 'PROT-IED',
      type: '保护装置' as const,
      status: statusFromProb(0.02, 0.04),
      ip: '10.10.0.90',
    },
  ]

  // 采集（61850）样本：随机挑选若干点
  const sampleMappings = Array.from({ length: 10 }, () => pick(table))
  const samples: Iec61850Sample[] = sampleMappings.map((m) => {
    const s: Status =
      m.quality === 'GOOD' ? 'normal' : m.quality === 'QUESTIONABLE' ? 'warning' : 'error'
    const v = valueForMapping(m, ems)
    return mk61850(m, v, s)
  })

  // IEC104 上送帧：基于同一批点
  const uplinkFrames: Iec104Frame[] = sampleMappings.slice(0, 8).map((m) => {
    const s: Status =
      m.quality === 'GOOD' ? 'normal' : m.quality === 'QUESTIONABLE' ? 'warning' : 'error'
    const v = valueForMapping(m, ems)
    return mk104(m, v, s, 'uplink')
  })

  // IEC104 下发命令（AGC/AVC/启停等，简化为几个 IOA）
  const cmdMappings = table.filter((m) => m.asduType.startsWith('C_'))
  const downMappings = cmdMappings.length ? cmdMappings : [pick(table)]
  const downlinkFrames: Iec104Frame[] = downMappings.slice(0, 3).map((m) => {
    const s: Status = statusFromProb(0.02, 0.08)
    const v =
      m.asduType === 'C_SC_NA_1'
        ? randomInt(0, 2) === 0
          ? 'ON'
          : 'OFF'
        : Number(random(-500, 500).toFixed(1)).toString()
    return mk104(m, v, s, 'downlink')
  })

  const frames = [...downlinkFrames, ...uplinkFrames].slice(0, 12)

  // 转换日志：把采集点转上送、把命令转站内控制
  const logs: ConversionLog[] = []
  for (const m of sampleMappings.slice(0, 6)) {
    const inVal = `${m.iedName}.${m.ln}.${m.doName}=${valueForMapping(m, ems)}`
    const outVal = `ASDU ${m.asduType} IOA=${m.ioa} VAL=${valueForMapping(m, ems)}`
    const s: Status =
      m.quality === 'GOOD' ? 'normal' : m.quality === 'QUESTIONABLE' ? 'warning' : 'error'
    logs.push(mkLog('61850→104', m, inVal, outVal, s))
  }
  for (const m of downMappings.slice(0, 3)) {
    const inVal = `ASDU ${m.asduType} IOA=${m.ioa} CMD=${m.asduType === 'C_SC_NA_1' ? 'ON/OFF' : 'SET'}`
    const outVal = `${m.iedName} Operate ${m.ld}/${m.ln}.${m.doName}.${m.daName}`
    logs.push(mkLog('104→61850', m, inVal, outVal, statusFromProb(0.02, 0.08)))
  }

  const badQualityPct = Math.round(((questionable + invalid) / Math.max(1, table.length)) * 100)

  return {
    timestamp,
    stationSide: {
      protocol: 'IEC61850',
      ieds,
      samples,
      stats: {
        mmsRxPerMin: randomInt(120, 520),
        gooseRxPerMin: randomInt(10, 80),
        svRxPerMin: randomInt(0, 20),
        badQualityPct,
      },
    },
    masterSide: {
      protocol: 'IEC104',
      endpoint: { host: 'dispatch-master', port: 2404, linkStatus: masterStatus },
      frames,
      stats: {
        txAsduPerMin: randomInt(60, 240),
        rxCmdPerMin: randomInt(0, 18),
        linkKeepalive: masterStatus === 'error' ? 'DEGRADED' : 'OK',
        lastAck: timestamp,
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
      backlog: randomInt(0, 40),
      latencyMsP95: randomInt(25, 180),
      logs: logs.slice(0, 12),
    },
  }
}
