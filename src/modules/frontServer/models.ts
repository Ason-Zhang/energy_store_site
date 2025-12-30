export type Status = 'normal' | 'warning' | 'error'

export type Iec104Direction = 'uplink' | 'downlink'
export type Iec61850Direction = 'subscribe' | 'publish'

export interface PointMapping {
  id: string
  name: string
  // IEC61850 side
  iedName: string
  ld: string
  ln: string
  doName: string
  daName: string
  fc: 'MX' | 'SP' | 'CF' | 'ST'
  // IEC104 side
  ioa: number
  asduType: 'M_ME_NC_1' | 'M_SP_NA_1' | 'M_DP_NA_1' | 'C_SE_NC_1' | 'C_SC_NA_1'
  causeOfTransmission: 'spont' | 'cyclic' | 'interrogated' | 'activation'
  scale: number
  unit: string
  quality: 'GOOD' | 'QUESTIONABLE' | 'INVALID'
}

export interface Iec61850Sample {
  timestamp: string
  ied: string
  dataset: string
  service: 'MMS' | 'GOOSE' | 'SV'
  direction: Iec61850Direction
  status: Status
  payload: string
}

export interface Iec104Frame {
  timestamp: string
  direction: Iec104Direction
  status: Status
  apci: string
  asdu: string
  ioa: number
  cot: string
  value: string
}

export interface ConversionLog {
  timestamp: string
  status: Status
  direction: '61850→104' | '104→61850'
  mappingId: string
  summary: string
  detail: string
}

export interface FrontServerSnapshot {
  timestamp: string
  stationSide: {
    protocol: 'IEC61850'
    ieds: Array<{ name: string; type: 'EMS' | 'PCS' | 'BMS' | '保护装置'; status: Status; ip: string }>
    samples: Iec61850Sample[]
    stats: {
      mmsRxPerMin: number
      gooseRxPerMin: number
      svRxPerMin: number
      badQualityPct: number
    }
  }
  masterSide: {
    protocol: 'IEC104'
    endpoint: { host: string; port: number; linkStatus: Status }
    frames: Iec104Frame[]
    stats: {
      txAsduPerMin: number
      rxCmdPerMin: number
      linkKeepalive: 'OK' | 'DEGRADED'
      lastAck: string
    }
  }
  mapping: {
    total: number
    ok: number
    questionable: number
    invalid: number
    table: PointMapping[]
  }
  conversion: {
    backlog: number
    latencyMsP95: number
    logs: ConversionLog[]
  }
}


