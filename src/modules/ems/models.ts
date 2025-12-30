export type Status = 'normal' | 'warning' | 'error'

export interface EmsFieldDeviceSummary {
  pcsCount: number
  bmsCount: number
  protectionCount: number
  pcsStatusCounts: Record<Status, number>
  bmsStatusCounts: Record<Status, number>
  protectionStatusCounts: Record<Status, number>
  pcsFaultCodes: Array<{ pcsId: number; faultCode: string }>
}

export interface EmsProtectionDevice {
  name: string
  status: Status
  trip: boolean
  lastAction: string
  reason?: string
}

export interface EmsCoordinationLayerInfo {
  unitCount: number
  unitStatusCounts: Record<Status, number>
  availablePowerUpperLimitKw: number
  safetyInterlockActive: boolean
  interlockReason: string
  unitCommStatusCounts: Record<Status, number>
}

export interface EmsDispatchCommands {
  agcSetpointKw: number
  agcEnabled: boolean
  avcBusVoltageSetpointKv: number
  avcEnabled: boolean
  issuedAt: string
  source: '调度中心' | '上级EMS'
}

export interface EmsInputs {
  timestamp: string
  fieldDevices: EmsFieldDeviceSummary
  protectionDevices: EmsProtectionDevice[]
  coordinationLayer: EmsCoordinationLayerInfo
  dispatch: EmsDispatchCommands
  station: {
    actualTotalKw: number
    availableCapacityKwh: number
    avgSocPct: number
  }
}

export interface EmsDecision {
  timestamp: string
  decisionId: string
  ready: boolean
  decisionMode: 'AGC' | 'AVC' | 'SAFE_STOP' | 'LIMITED'
  stationTargetPowerKw: number
  stationTargetVoltageKv: number | null
  stationTargetVoltageSource: 'remote' | 'auto' | 'local' | null
  limitReason: string
  actions: string[]
  rationale: string[]
}

export interface EmsOutputs {
  toCoordinationLayer: {
    stationControlTargetPowerKw: number
    stationControlMode: 'AGC' | 'AVC' | 'SAFE_STOP' | 'LIMITED'
    targetVoltageKv: number | null
  }
  toMasterStation: {
    reportActualTotalKw: number
    reportAvailableCapacityKwh: number
    reportFaults: Array<{ device: string; level: Status; code?: string; description: string }>
  }
  toScada: {
    kpis: {
      ready: boolean
      mode: 'AGC' | 'AVC' | 'SAFE_STOP' | 'LIMITED'
      targetPowerKw: number
      actualPowerKw: number
      trackingErrorKw: number
      availableCapacityKwh: number
      avgSocPct: number
      availablePowerUpperLimitKw: number
    }
    fireSystem: {
      fireConfirmed: boolean
      fireLinkageModuleStatus: Status
      note: string
    }
    temperatureCloud: {
      minC: number
      maxC: number
      points: Array<{
        groupId: number
        label: string
        temperatureC: number
        status: Status
      }>
    }
    consistencyAnalysis: {
      worstDeltaMv: number
      worstGroups: Array<{
        groupId: number
        deltaCellVoltageMv: number
        insulationResistanceKohm: number
        status: Status
        score: number
      }>
      all: Array<{
        groupId: number
        deltaCellVoltageMv: number
        insulationResistanceKohm: number
        status: Status
        score: number
      }>
    }
    alarms: Array<{
      level: 'critical' | 'warning' | 'info'
      title: string
      detail: string
      at: string
    }>
    reports: Array<{ title: string; summary: string; at: string }>
    optimizationSuggestions: string[]
    visualizationHints: string[]
    decisionDigest: string
  }
}

export interface EmsSnapshot {
  inputs: EmsInputs
  decision: EmsDecision
  outputs: EmsOutputs
}
