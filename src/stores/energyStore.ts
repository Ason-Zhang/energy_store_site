import { defineStore } from 'pinia'
import type {
  SystemStatus,
  TelemetryData,
  DeviceTelemetry,
  AlarmData,
  CommunicationData,
  Device,
  BatteryGroup,
  CoordinationUnit,
} from '../services/mockDataService'
import type { EmsSnapshot } from '../modules/ems/models'
import type {
  ConversionLog,
  FrontServerSnapshot,
  PointMapping,
} from '../modules/frontServer/models'
import {
  generateSystemStatus,
  generateTelemetryData,
  generateAlarmData,
  generateCommunicationData,
  getDeviceTelemetry as getDeviceTelemetryMock,
  deviceCounts as deviceCountsMock,
  generateBatteryGroups,
  generateCoordinationUnits,
} from '../services/mockDataService'
import { computeEmsSnapshot } from '../modules/ems/decisionEngine'
import {
  getDeviceCounts,
  getControlCommands,
  getControlCommandsStatus,
  getBatteryGroupsLatest,
  getCoordinationUnitsLatest,
  getLatestAlarmData,
  getLatestCommunicationAll,
  getLatestDeviceTelemetryAll,
  getLatestEmsSnapshot,
  getLatestPlantSnapshot,
  getLatestFrontServerSnapshot,
  getLatestSystemStatus,
  getLatestTelemetry,
  resetBatteryGroup as resetBatteryGroupApi,
  setControlCommands,
} from '../services/dataApiService'
import type {
  ControlCommands,
  ControlCommandsStatus,
  PlantSnapshot,
} from '../services/dataApiService'

const buildFrontServerSnapshotFromComm = (params: {
  now: string
  frontServer: CommunicationData
  pcsCount: number
  bmsCount: number
}): FrontServerSnapshot => {
  const frames = params.frontServer.protocolFrames ?? []
  const samples = frames
    .filter((f) => f.protocol === 'IEC61850')
    .slice(0, 12)
    .map((f) => ({
      timestamp: f.timestamp,
      ied: f.from,
      dataset: 'COMM_BUS',
      service: 'MMS' as const,
      direction: 'subscribe' as const,
      status: f.status,
      payload: f.summary,
    }))

  const iec104Frames = frames
    .filter((f) => f.protocol === 'IEC104')
    .slice(0, 12)
    .map((f, idx) => ({
      timestamp: f.timestamp,
      direction: f.direction,
      status: f.status,
      apci: `I ${idx}`,
      asdu: f.summary,
      ioa: 1000 + idx,
      cot: f.direction === 'uplink' ? 'CYCLIC' : 'ACTIVATION',
      value: String(f.bytes),
    }))

  const badQualityPct = Math.round(
    (samples.filter((x) => x.status !== 'normal').length / Math.max(1, samples.length)) * 100,
  )

  const stationStatus = ((): 'normal' | 'warning' | 'error' => {
    const s = params.frontServer.status
    return s === 'normal' ? 'normal' : s === 'warning' ? 'warning' : 'error'
  })()

  const masterStatus = iec104Frames.some((x) => x.status === 'error')
    ? ('error' as const)
    : iec104Frames.some((x) => x.status === 'warning')
      ? ('warning' as const)
      : ('normal' as const)

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

  const logs: ConversionLog[] = []
  for (const [idx, m] of table.slice(0, 9).entries()) {
    logs.push({
      timestamp: params.now,
      status: stationStatus,
      direction: '61850→104',
      mappingId: m.id,
      summary: `采集并上送：${m.iedName} → IOA ${m.ioa}`,
      detail: `Q=${m.quality} idx=${idx}`,
    })
  }
  for (const m of table.slice(9, 12)) {
    logs.push({
      timestamp: params.now,
      status: masterStatus,
      direction: '104→61850',
      mappingId: m.id,
      summary: `下发并转换：IOA ${m.ioa} → ${m.iedName}`,
      detail: `Q=${m.quality}`,
    })
  }

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

  return {
    timestamp: params.now,
    stationSide: {
      protocol: 'IEC61850',
      ieds,
      samples,
      stats: {
        mmsRxPerMin: samples.length * 6,
        gooseRxPerMin: 0,
        svRxPerMin: 0,
        badQualityPct,
      },
    },
    masterSide: {
      protocol: 'IEC104',
      endpoint: { host: 'dispatch-master', port: 2404, linkStatus: masterStatus },
      frames: iec104Frames,
      stats: {
        txAsduPerMin: iec104Frames.length * 6,
        rxCmdPerMin: 0,
        linkKeepalive: masterStatus === 'error' ? 'DEGRADED' : 'OK',
        lastAck: params.now,
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
      backlog: 0,
      latencyMsP95: Math.max(0, Math.max(...frames.map((x) => x.latencyMs ?? 0))),
      logs: logs.slice(0, 12),
    },
  }
}

export const useEnergyStore = defineStore('energy', {
  state: () => ({
    // 系统状态
    systemStatus: {} as SystemStatus,

    // 遥测量数据
    telemetryData: {} as TelemetryData,

    // 告警数据
    alarmData: {} as AlarmData,

    // 通信数据
    communicationData: new Map<string, CommunicationData>(),

    // 设备遥测量（BMS + 电池仓）
    deviceTelemetryData: new Map<string, DeviceTelemetry>(),

    // 设备计数
    deviceCounts: deviceCountsMock,

    // 电池组（每组包含 PCS + BMS）
    batteryGroups: [] as BatteryGroup[],

    // 协调控制单元（3个）
    coordinationUnits: [] as CoordinationUnit[],

    // EMS：输入/决策/输出快照
    emsSnapshot: null as EmsSnapshot | null,

    // 前置服务器：采集与协议转换快照
    frontServerSnapshot: null as FrontServerSnapshot | null,

    // 告警/故障记录（用于“告警记录”页面）
    eventLog: [] as Array<{
      id: string
      ts: number
      level: 'warning' | 'error'
      source: string
      message: string
      // 触发时的关键上下文，用于“为什么出现告警/故障”的解释
      context?: Record<string, string | number | boolean | null>
      acknowledged: boolean
    }>,

    // EMS 历史序列（供 SCADA 曲线/报表）
    emsHistory: [] as Array<{
      t: string
      actualKw: number
      targetKw: number
      availableCapacityKwh: number
      avgSocPct: number
      ready: boolean
      mode: string
      alarmsCritical: number
      alarmsWarning: number
    }>,

    // 控制命令和参数
    controlCommands: {
      // AGC 命令
      agc: {
        enabled: false,
        targetPower: 0, // kW
        rampRate: 10, // kW/min
        deadband: 5, // kW
      },
      // AVC 命令
      avc: {
        enabled: false,
        targetVoltage: 400, // V
        voltageRange: { min: 380, max: 420 }, // V
      },
      // 手动功率设定
      manualPower: {
        enabled: false,
        targetPower: 0, // kW
      },
    },

    controlCommandsDirty: false,
    controlCommandsSyncTimeout: null as number | null,

    controlCommandsStatus: {
      ts: null,
      actor: null,
      username: null,
    } as ControlCommandsStatus,

    // 系统参数
    systemParams: {
      maxChargePower: 600, // kW
      maxDischargePower: 600, // kW
      efficiency: 95, // %
      responseTime: 5, // seconds
      safetyMargin: 10, // %
    },

    // 更新定时器
    updateInterval: null as number | null,

    // 更新间隔（毫秒）
    updateIntervalMs: 5000,
  }),

  getters: {
    // 获取系统状态
    getSystemStatus: (state) => state.systemStatus,

    // 获取遥测量数据
    getTelemetryData: (state) => state.telemetryData,

    // 获取告警数据
    getAlarmData: (state) => state.alarmData,

    // 获取通信数据（无副作用；如果缺失则返回默认值）
    getCommunicationData:
      (state) =>
      (device: Device): CommunicationData => {
        const key = `${device.type}-${device.id}`
        return (
          state.communicationData.get(key) ?? {
            status: 'normal',
            lastCommTime: '',
            modbusPackets: [],
            connectedDevices: [],
            protocolFrames: [],
          }
        )
      },

    // 获取设备遥测量（优先 DB/API 数据；缺失时回退 mock）
    getDeviceTelemetry:
      (state) =>
      (deviceType: string, deviceId: number): DeviceTelemetry => {
        const key = `${deviceType}-${deviceId}`
        return state.deviceTelemetryData.get(key) ?? getDeviceTelemetryMock(deviceType, deviceId)
      },

    // 获取设备计数
    getDeviceCounts: (state) => state.deviceCounts,

    // 获取电池组数据
    getBatteryGroups: (state) => state.batteryGroups,

    // 获取协控单元数据
    getCoordinationUnits: (state) => state.coordinationUnits,

    getEmsSnapshot: (state) => state.emsSnapshot,

    getFrontServerSnapshot: (state) => state.frontServerSnapshot,

    getEmsHistory: (state) => state.emsHistory,

    // 获取控制命令
    getControlCommands: (state) => state.controlCommands,

    getControlCommandsStatus: (state) => state.controlCommandsStatus,

    // 获取系统参数
    getSystemParams: (state) => state.systemParams,

    getEventLog: (state) => state.eventLog,
    getEventById: (state) => (id: string) => state.eventLog.find((e) => e.id === id) ?? null,
    getActiveEventBySource: (state) => (source: string) =>
      state.eventLog.find((e) => e.source === source && !e.acknowledged) ?? null,
  },

  actions: {
    applyCoordinationUnits(nextUnits: CoordinationUnit[]) {
      const prev = this.coordinationUnits
      this.coordinationUnits = nextUnits

      for (const u of nextUnits) {
        const before = prev.find((x) => x.unitId === u.unitId)
        if (!before) continue
        if (before.status === u.status) continue
        if (u.status === 'warning') {
          this.recordEvent('warning', `CCU-${u.unitId}`, `${u.name} 出现告警`, {
            unitId: u.unitId,
            batteryWarning: u.inputs.safety.batteryWarning,
            batteryTrip: u.inputs.safety.batteryTrip,
            electricalProtectionTrip: u.inputs.safety.electricalProtectionTrip,
            interlockActive: u.inputs.safety.interlockActive,
            lockReason: u.inputs.safety.lockReason,
          })
        } else if (u.status === 'error') {
          this.recordEvent('error', `CCU-${u.unitId}`, `${u.name} 出现故障`, {
            unitId: u.unitId,
            emergencyStop: u.inputs.safety.emergencyStop,
            fireConfirmed: u.inputs.safety.fireConfirmed,
            electricalProtectionTrip: u.inputs.safety.electricalProtectionTrip,
            batteryTrip: u.inputs.safety.batteryTrip,
          })
        }
      }
    },

    // 初始化数据
    async initData() {
      await this.refreshTick()
    },

    async refreshTick() {
      await this.updateControlCommands()
      await this.updateControlCommandsStatus()

      let plant: PlantSnapshot | null = null
      try {
        plant = await getLatestPlantSnapshot()
      } catch {
        plant = null
      }

      // 并发刷新（除 EMS 决策外）；失败则各自回退 mock
      await Promise.all([
        this.updateSystemStatus(),
        this.updateTelemetryData(),
        this.updateAlarmData(),
        this.updateDeviceCounts(),
        this.updateAllDeviceTelemetryData(),
        this.updateAllCommunicationData(),
        plant?.batteryGroups
          ? Promise.resolve().then(() => {
              this.batteryGroups = plant.batteryGroups ?? []
            })
          : this.updateBatteryGroups(),
        plant?.coordinationUnits
          ? Promise.resolve().then(() => {
              this.applyCoordinationUnits(plant.coordinationUnits ?? [])
            })
          : this.updateCoordinationUnits(),
      ])

      if (plant?.emsSnapshot) {
        this.updateEmsSnapshot(plant.emsSnapshot)
      } else {
        // EMS 决策依赖 batteryGroups/coordinationUnits，放到并发之后计算
        this.updateEmsSnapshot()
      }

      if (plant?.frontServerSnapshot) {
        this.frontServerSnapshot = plant.frontServerSnapshot
      } else {
        // 前置服务器展示依赖全站数据（EMS/电池组/协控）
        this.updateFrontServerSnapshot()
      }
    },

    async updateControlCommands() {
      if (this.controlCommandsDirty) return
      try {
        const next = (await getControlCommands()) as ControlCommands
        this.controlCommands = next
      } catch {
        // ignore
      }
    },

    async updateControlCommandsStatus() {
      try {
        this.controlCommandsStatus = await getControlCommandsStatus()
      } catch {
        // ignore
      }
    },

    queuePersistControlCommands() {
      this.controlCommandsDirty = true
      if (this.controlCommandsSyncTimeout) {
        clearTimeout(this.controlCommandsSyncTimeout)
      }
      this.controlCommandsSyncTimeout = window.setTimeout(() => {
        void this.persistControlCommandsNow()
      }, 250)
    },

    async persistControlCommandsNow() {
      try {
        const saved = (await setControlCommands(
          this.controlCommands as ControlCommands,
        )) as ControlCommands
        this.controlCommands = saved
        this.controlCommandsDirty = false
      } catch {
        // ignore
      }
    },

    // 更新系统状态
    async updateSystemStatus() {
      try {
        this.systemStatus = await getLatestSystemStatus()
      } catch {
        this.systemStatus = generateSystemStatus()
      }
    },

    // 更新遥测量数据
    async updateTelemetryData() {
      try {
        this.telemetryData = await getLatestTelemetry()
      } catch {
        this.telemetryData = generateTelemetryData()
      }
    },

    // 更新告警数据
    async updateAlarmData() {
      try {
        this.alarmData = await getLatestAlarmData()
      } catch {
        this.alarmData = generateAlarmData()
      }
    },

    async updateDeviceCounts() {
      try {
        this.deviceCounts = await getDeviceCounts()
      } catch {
        this.deviceCounts = deviceCountsMock
      }
    },

    // 更新所有通信数据
    async updateAllCommunicationData() {
      try {
        const rows = await getLatestCommunicationAll()
        const next = new Map<string, CommunicationData>()
        for (const row of rows) {
          next.set(`${row.deviceType}-${row.deviceId}`, row.data)
        }
        this.communicationData = next
        return
      } catch {
        // fallback mock
      }

      const next = new Map<string, CommunicationData>()
      next.set('ems-ems', generateCommunicationData({ id: 'ems', type: 'ems', name: 'EMS' }))
      for (let i = 1; i <= 10; i++) {
        next.set(`bms-${i}`, generateCommunicationData({ id: i, type: 'bms', name: `BMS ${i}` }))
        next.set(
          `battery-${i}`,
          generateCommunicationData({ id: i, type: 'battery', name: `电池仓 ${i}` }),
        )
      }
      this.communicationData = next
    },

    // 更新单个设备通信数据
    updateCommunicationData(device: Device) {
      const key = `${device.type}-${device.id}`
      this.communicationData.set(key, generateCommunicationData(device))
    },

    // 更新所有设备遥测量（BMS + Battery）
    async updateAllDeviceTelemetryData() {
      try {
        const rows = await getLatestDeviceTelemetryAll()
        const next = new Map<string, DeviceTelemetry>()
        for (const row of rows) {
          next.set(`${row.deviceType}-${row.deviceId}`, row.data)
        }
        this.deviceTelemetryData = next
        return
      } catch {
        // fallback mock
      }

      const next = new Map<string, DeviceTelemetry>()
      for (let i = 1; i <= 10; i++) {
        next.set(`bms-${i}`, getDeviceTelemetryMock('bms', i))
        next.set(`battery-${i}`, getDeviceTelemetryMock('battery', i))
      }
      this.deviceTelemetryData = next
    },

    // 更新电池组数据（当前仅使用 mock；后续可对接后端调度/PCS/BMS 实时数据）
    async updateBatteryGroups() {
      try {
        this.batteryGroups = await getBatteryGroupsLatest()
        return
      } catch {
        // fallback mock
      }

      this.batteryGroups = generateBatteryGroups(10, this.controlCommands)
    },

    async updateCoordinationUnits() {
      let next: CoordinationUnit[]
      try {
        next = await getCoordinationUnitsLatest()
      } catch {
        next = generateCoordinationUnits(3, 10, this.controlCommands)
      }

      this.applyCoordinationUnits(next)
    },

    updateEmsSnapshot(nextSnapshot?: EmsSnapshot | null) {
      // Prefer backend-derived EMS snapshot (already computed from unified link pipeline)
      // Fallback to local compute only when API is unavailable.
      void (async () => {
        if (nextSnapshot) {
          this.emsSnapshot = nextSnapshot
        } else {
          try {
            this.emsSnapshot = await getLatestEmsSnapshot()
          } catch {
            this.emsSnapshot = computeEmsSnapshot({
              batteryGroups: this.batteryGroups,
              coordinationUnits: this.coordinationUnits,
              controlCommands: this.controlCommands,
            })
          }
        }

        // 记录历史（仅保留最近 120 个点）
        const s = this.emsSnapshot
        if (!s) return
        const next = this.emsHistory.slice()
        next.push({
          t: s.inputs.timestamp,
          actualKw: s.outputs.toScada.kpis.actualPowerKw,
          targetKw: s.outputs.toScada.kpis.targetPowerKw,
          availableCapacityKwh: s.outputs.toScada.kpis.availableCapacityKwh,
          avgSocPct: s.outputs.toScada.kpis.avgSocPct,
          ready: s.outputs.toScada.kpis.ready,
          mode: s.outputs.toScada.kpis.mode,
          alarmsCritical: s.outputs.toScada.alarms.filter((a) => a.level === 'critical').length,
          alarmsWarning: s.outputs.toScada.alarms.filter((a) => a.level === 'warning').length,
        })
        this.emsHistory = next.length > 120 ? next.slice(next.length - 120) : next
      })()

      return
    },

    updateFrontServerSnapshot() {
      void (async () => {
        try {
          this.frontServerSnapshot = await getLatestFrontServerSnapshot()
          return
        } catch {
          // fallback to local derivation from comm frames
        }

        const now = new Date().toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })

        const fsDevice = { id: 1, type: 'frontServer', name: '前置服务器' } as const
        const fsComm = this.getCommunicationData(fsDevice)
        const bmsCount = Math.max(1, this.deviceCounts?.bms ?? 10)
        const pcsCount = Math.max(1, bmsCount)

        this.frontServerSnapshot = buildFrontServerSnapshotFromComm({
          now,
          frontServer: fsComm,
          pcsCount,
          bmsCount,
        })
      })()
    },

    // 开始实时更新
    startRealTimeUpdate() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval)
      }

      this.updateInterval = window.setInterval(() => {
        void this.refreshTick()
      }, this.updateIntervalMs)
    },

    // 停止实时更新
    stopRealTimeUpdate() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval)
        this.updateInterval = null
      }
    },

    // 设置更新间隔
    setUpdateInterval(ms: number) {
      this.updateIntervalMs = ms
      if (this.updateInterval) {
        this.stopRealTimeUpdate()
        this.startRealTimeUpdate()
      }
    },

    // AGC 控制命令
    setAgcCommand(command: {
      enabled: boolean
      targetPower?: number
      rampRate?: number
      deadband?: number
    }) {
      if (command.targetPower !== undefined) {
        this.controlCommands.agc.targetPower = Math.max(
          -this.systemParams.maxDischargePower,
          Math.min(this.systemParams.maxChargePower, command.targetPower),
        )
      }
      if (command.rampRate !== undefined) {
        this.controlCommands.agc.rampRate = Math.max(1, Math.min(100, command.rampRate))
      }
      if (command.deadband !== undefined) {
        this.controlCommands.agc.deadband = Math.max(0, Math.min(50, command.deadband))
      }
      this.controlCommands.agc.enabled = command.enabled

      if (command.enabled) {
        this.controlCommands.manualPower.enabled = false
      }

      this.queuePersistControlCommands()
    },

    // AVC 控制命令
    setAvcCommand(command: {
      enabled: boolean
      targetVoltage?: number
      voltageRange?: { min: number; max: number }
    }) {
      if (command.targetVoltage !== undefined) {
        this.controlCommands.avc.targetVoltage = Math.max(300, Math.min(500, command.targetVoltage))
      }
      if (command.voltageRange) {
        this.controlCommands.avc.voltageRange = {
          min: Math.max(300, Math.min(450, command.voltageRange.min)),
          max: Math.max(350, Math.min(500, command.voltageRange.max)),
        }
      }
      this.controlCommands.avc.enabled = command.enabled

      this.queuePersistControlCommands()
    },

    // 手动功率控制
    setManualPowerCommand(command: { enabled: boolean; targetPower?: number }) {
      if (command.targetPower !== undefined) {
        this.controlCommands.manualPower.targetPower = Math.max(
          -this.systemParams.maxDischargePower,
          Math.min(this.systemParams.maxChargePower, command.targetPower),
        )
      }
      this.controlCommands.manualPower.enabled = command.enabled

      if (command.enabled) {
        this.controlCommands.agc.enabled = false
      }

      this.queuePersistControlCommands()
    },

    // 更新系统参数
    updateSystemParams(params: Partial<typeof this.systemParams>) {
      if (params.maxChargePower !== undefined) {
        this.systemParams.maxChargePower = Math.max(100, params.maxChargePower)
      }
      if (params.maxDischargePower !== undefined) {
        this.systemParams.maxDischargePower = Math.max(100, params.maxDischargePower)
      }
      if (params.efficiency !== undefined) {
        this.systemParams.efficiency = Math.max(80, Math.min(100, params.efficiency))
      }
      if (params.responseTime !== undefined) {
        this.systemParams.responseTime = Math.max(1, Math.min(30, params.responseTime))
      }
      if (params.safetyMargin !== undefined) {
        this.systemParams.safetyMargin = Math.max(0, Math.min(50, params.safetyMargin))
      }
    },

    // 重置所有控制命令
    resetAllCommands() {
      this.controlCommands.agc.enabled = false
      this.controlCommands.avc.enabled = false
      this.controlCommands.manualPower.enabled = false

      this.queuePersistControlCommands()
    },

    recordEvent(
      level: 'warning' | 'error',
      source: string,
      message: string,
      context?: Record<string, string | number | boolean | null>,
    ) {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      this.eventLog.unshift({
        id,
        ts: Date.now(),
        level,
        source,
        message,
        context,
        acknowledged: false,
      })
      if (this.eventLog.length > 500) this.eventLog = this.eventLog.slice(0, 500)
    },

    acknowledgeEvent(id: string) {
      const e = this.eventLog.find((x) => x.id === id)
      if (e) e.acknowledged = true
    },

    acknowledgeAllEvents() {
      for (const e of this.eventLog) e.acknowledged = true
    },

    // 直接移除单条事件（用于设备页面“消除”）
    dismissEvent(id: string) {
      this.eventLog = this.eventLog.filter((e) => e.id !== id)
    },

    // 按来源消除最新的一条未确认事件
    dismissLatestBySource(source: string) {
      const idx = this.eventLog.findIndex((e) => e.source === source && !e.acknowledged)
      if (idx < 0) return
      const next = this.eventLog.slice()
      next.splice(idx, 1)
      this.eventLog = next
    },

    clearAcknowledgedEvents() {
      this.eventLog = this.eventLog.filter((x) => !x.acknowledged)
    },

    // 电池故障人工复位（清除锁存故障）
    async resetBatteryGroup(id: number) {
      const prev = this.batteryGroups
      try {
        await resetBatteryGroupApi(id)
      } catch {
        // ignore
      }

      // 复位属于“单组操作”，避免立刻替换所有组数据造成视觉上的全站跳变。
      try {
        const fresh = await getBatteryGroupsLatest()
        if (!prev.length) {
          this.batteryGroups = fresh
          return
        }
        const prevMap = new Map(prev.map((g) => [g.id, g]))
        this.batteryGroups = fresh.map((g) => (g.id === id ? g : (prevMap.get(g.id) ?? g)))
        return
      } catch {
        // ignore
      }

      await this.updateBatteryGroups()
    },

    async resetBatteryGroupsBulk(ids: number[]) {
      const unique = Array.from(new Set(ids)).filter((x) => Number.isFinite(x))
      if (unique.length === 0) return

      const prev = this.batteryGroups

      for (const id of unique) {
        try {
          await resetBatteryGroupApi(id)
        } catch {
          // ignore
        }
      }

      // 批量复位也只替换目标组，减少对其它组的“瞬时跳变”观感。
      try {
        const fresh = await getBatteryGroupsLatest()
        if (!prev.length) {
          this.batteryGroups = fresh
          return
        }
        const set = new Set(unique)
        const prevMap = new Map(prev.map((g) => [g.id, g]))
        this.batteryGroups = fresh.map((g) => (set.has(g.id) ? g : (prevMap.get(g.id) ?? g)))
        return
      } catch {
        // ignore
      }

      await this.updateBatteryGroups()
    },
  },
})
