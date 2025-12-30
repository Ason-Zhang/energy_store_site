// 模拟数据服务 - 生成智能储能系统的模拟数据

export interface SystemStatus {
  status: 'normal' | 'warning' | 'error'
  load: number
  totalPower: number
  runTime: string
}

export interface TelemetryData {
  currentTime: string
  averageVoltage: number
  totalCurrent: number
  averageTemperature: number
  systemSOC: number
  systemSOH: number // 保留小数点后三位
}

export interface DeviceTelemetry {
  voltage: number
  current: number
  temperature: number
  soc: number
  soh: number
  power: number
  chargingStatus: 'charging' | 'discharging' | 'idle'
}

export interface PcsTelemetry {
  status: 'normal' | 'warning' | 'error'
  dispatchMode: 'AVC' | 'AGC'
  setpointKw: number
  actualKw: number
  rampRateKwPerMin: number
  acVoltageV: number
  acCurrentA: number
  frequencyHz: number
  powerFactor: number
  reactivePowerKvar: number
  dcVoltageV: number
  dcCurrentA: number
  efficiencyPct: number
  temperature: number
  runningState: 'running' | 'standby' | 'fault'
}

export interface BmsGroupTelemetry {
  status: 'normal' | 'warning' | 'error'
  voltageV: number
  currentA: number
  temperatureC: number
  socPct: number
  sohPct: number
  maxCellVoltageV: number
  minCellVoltageV: number
  deltaCellVoltageMv: number
  maxCellTempC: number
  minCellTempC: number
  insulationResistanceKohm: number
  contactorClosed: boolean
  balancingActive: boolean
  warningCount: number
  faultCount: number
}

export interface BatteryGroup {
  id: number
  name: string
  status: 'normal' | 'warning' | 'error'
  faultReason?: string | null
  lastUpdateTime: string
  pcs: PcsTelemetry
  bms: BmsGroupTelemetry
}

export interface CoordinationUpperCommand {
  source: 'EMS' | '调度中心'
  mode: 'AVC' | 'AGC'
  planId: string
  planWindow: string
  targetPowerKw: number
  enable: boolean
  issuedAt: string
}

export interface CoordinationSafetySignals {
  // 同层/安全系统：电池预警系统、保护装置、以及联锁信号
  batteryPreWarning: boolean
  batteryWarning: boolean
  batteryTrip: boolean
  electricalProtectionTrip: boolean
  dcBusOverVoltage: boolean
  dcBusUnderVoltage: boolean
  acBreakerClosed: boolean
  emergencyStop: boolean
  fireConfirmed: boolean
  interlockActive: boolean
  lockReason: string
}

export interface CoordinationDeviceInputPcs {
  pcsId: number
  status: 'normal' | 'warning' | 'error'
  runningState: 'running' | 'standby' | 'fault'
  faultCode: string
  actualKw: number
  adjustableMinKw: number
  adjustableMaxKw: number
}

export interface CoordinationDeviceInputBms {
  bmsId: number
  status: 'normal' | 'warning' | 'error'
  socPct: number
  temperatureC: number
  insulationResistanceKohm: number
  deltaCellVoltageMv: number
  warningCount: number
  faultCount: number
}

export interface CoordinationInputs {
  upper: CoordinationUpperCommand
  safety: CoordinationSafetySignals
  peerSignals: Array<{
    peerUnitId: number
    commStatus: 'normal' | 'warning' | 'error'
    lastRxTime: string
    latencyMs: number
    peerReady: boolean
    peerLimitPower: boolean
    peerExitRun: boolean
  }>
  devices: {
    pcs: CoordinationDeviceInputPcs[]
    bms: CoordinationDeviceInputBms[]
  }
}

export interface CoordinationPcsCommand {
  pcsId: number
  enable: boolean
  startStop: 'start' | 'stop'
  modeCmd: 'AVC' | 'AGC'
  setpointKw: number
  rampRateKwPerMin: number
}

export interface CoordinationUpperReport {
  stationActualTotalKw: number
  availableCapacityKwh: number
  ready: boolean
  executionStatus: '跟踪正常' | '受限' | '未就绪' | '退出运行'
  commandTrackingErrorKw: number
  alarmSummary: { critical: number; warning: number; info: number }
  eventSummary: { startStop: number; modeSwitch: number; interlock: number }
  reportedAt: string
}

export interface CoordinationPeerOutputs {
  fireConfirmed: boolean
  limitPower: boolean
  exitRun: boolean
  limitReason: string
}

export interface CoordinationOutputs {
  pcsCommands: CoordinationPcsCommand[]
  upperReport: CoordinationUpperReport
  peerOutputs: CoordinationPeerOutputs
}

export interface CoordinationUnit {
  unitId: number
  name: string
  status: 'normal' | 'warning' | 'error'
  lastUpdateTime: string
  inputs: CoordinationInputs
  outputs: CoordinationOutputs
}

export interface Alarm {
  timestamp: string
  device: string
  type: string
  level: 'critical' | 'warning' | 'info'
  description: string
  status: 'active' | 'resolved'
}

export interface AlarmData {
  totalAlarms: number
  criticalAlarms: number
  warningAlarms: number
  infoAlarms: number
  alarmList: Alarm[]
}

export interface ModbusPacket {
  timestamp: string
  functionCode: number
  registerAddr: number
  dataLength: number
  dataValue: string
  status: 'normal' | 'warning' | 'error'
}

export type CommProtocol = 'ModbusTCP' | 'IEC61850' | 'IEC104' | 'InternalBus'

export type CommDirection = 'uplink' | 'downlink'

export interface CommFrame {
  timestamp: string
  protocol: CommProtocol
  direction: CommDirection
  from: string
  to: string
  ok: boolean
  status: 'normal' | 'warning' | 'error'
  latencyMs: number
  bytes: number
  summary: string
  payloadHex: string
  error?: string
}

export interface ConnectedDevice {
  name: string
  status: 'normal' | 'warning' | 'error'
}

export interface CommunicationData {
  status: 'normal' | 'warning' | 'error'
  lastCommTime: string
  modbusPackets: ModbusPacket[]
  connectedDevices: ConnectedDevice[]

  protocolFrames?: CommFrame[]
}

export interface Device {
  id: string | number
  type: 'ems' | 'bms' | 'battery' | 'pcs' | 'ccu' | 'frontServer' | 'remote'
  name: string
}

// 生成随机数
const random = (min: number, max: number): number => {
  return Math.random() * (max - min) + min
}

// 生成随机整数
const randomInt = (min: number, max: number): number => {
  return Math.floor(random(min, max))
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const anomalyLevel = (groupId: number, nowMs: number): 'none' | 'warning' | 'critical' => {
  // Rotate anomalies across groups to keep frequency uniform.
  // Each window targets exactly one group; most windows are normal.
  const windowMs = 90_000
  const slot = Math.floor(nowMs / windowMs)
  const targetGroup = (slot % 10) + 1
  if (groupId !== targetGroup) return 'none'

  // Sparse severity schedule for the selected group
  // - every 10 windows: 1 critical
  // - every 3 windows: warning
  if (slot % 10 === 0) return 'critical'
  if (slot % 3 === 0) return 'warning'
  return 'none'
}

const weightedBatteryBinStatus = (): 'normal' | 'warning' | 'error' => {
  // 电池仓：异常与故障大幅降低（告警极少、故障几乎不发生）
  const r = random(0, 1)
  if (r < 0.995) return 'normal'
  if (r < 0.9995) return 'warning'
  return 'error'
}

const weightedCommStatus = (): 'normal' | 'warning' | 'error' => {
  const r = random(0, 1)
  if (r < 0.995) return 'normal'
  if (r < 0.999) return 'warning'
  return 'error'
}

// -----------------------------
// 连续运行模拟状态（更符合电网日常运行）
// - SOC：安全区 20%~90%，几分钟内变化不超过 10%
// - SOH：一天内变化不超过 0.5%，保留三位小数
// - 故障：极少发生，且一旦故障需要人工复位才能恢复
// -----------------------------

type GroupSim = {
  id: number
  soc: number
  soh: number
  temperatureC: number
  voltageV: number
  pcsActualKw: number
  faultLatched: boolean
  warningUntilMs: number
  resetCooldownUntilMs: number
  insulationResistanceKohm: number
  deltaCellVoltageMv: number
  maxCellTempC: number
}

type SimState = {
  inited: boolean
  lastMs: number
  systemSoc: number
  systemSoh: number
  systemVoltage: number
  systemCurrent: number
  systemTemp: number
  stationTargetKw: number
  groups: Map<number, GroupSim>
}

const sim: SimState = {
  inited: false,
  lastMs: 0,
  systemSoc: 55,
  systemSoh: 98.5,
  systemVoltage: 420,
  systemCurrent: 120,
  systemTemp: 30,
  stationTargetKw: 0,
  groups: new Map(),
}

const round3 = (n: number) => Number(n.toFixed(3))

const ensureSim = (groupCount: number = 10) => {
  if (sim.inited) return
  sim.inited = true
  sim.lastMs = Date.now()
  sim.systemSoc = randomInt(45, 75)
  sim.systemSoh = round3(random(96.5, 99.8))
  sim.systemVoltage = Number(random(390, 430).toFixed(1))
  sim.systemCurrent = Number(random(80, 180).toFixed(1))
  sim.systemTemp = randomInt(26, 33)
  sim.stationTargetKw = 0

  for (let i = 1; i <= groupCount; i++) {
    const baseTemp = randomInt(26, 34)
    sim.groups.set(i, {
      id: i,
      soc: clamp(randomInt(35, 80), 20, 90),
      soh: round3(random(96.5, 99.8)),
      temperatureC: baseTemp,
      voltageV: Number(random(720, 820).toFixed(1)),
      pcsActualKw: 0,
      faultLatched: false,
      warningUntilMs: 0,
      resetCooldownUntilMs: 0,
      insulationResistanceKohm: randomInt(520, 820),
      deltaCellVoltageMv: randomInt(12, 28),
      maxCellTempC: baseTemp + randomInt(2, 6),
    })
  }
}

const tickSim = (groupCount: number = 10, stationTargetKw?: number) => {
  ensureSim(groupCount)
  const now = Date.now()
  const dtMs = Math.max(0, Math.min(60_000, now - sim.lastMs)) // 防止后台挂起导致跳变
  sim.lastMs = now
  const ticks = dtMs / 5000 // 以 5s 为“一个tick”的尺度

  if (typeof stationTargetKw === 'number') {
    sim.stationTargetKw = stationTargetKw
  }

  // SOH：非常缓慢衰减（一天 < 0.5%）
  sim.systemSoh = round3(clamp(sim.systemSoh - random(0, 0.00002) * ticks, 80, 100))

  // SOC：随机游走，限制几分钟变化不超过 10%
  // 5s 最大变化 ~0.16，则 5min 60 tick 内最多 ~9.6%
  const socStep = clamp(random(-0.12, 0.12) * ticks, -0.2, 0.2)
  sim.systemSoc = clamp(sim.systemSoc + socStep, 20, 90)

  // 电压/电流/温度：小幅波动
  sim.systemVoltage = Number(
    clamp(sim.systemVoltage + random(-0.8, 0.8) * ticks, 380, 550).toFixed(1),
  )
  sim.systemTemp = Math.round(clamp(sim.systemTemp + random(-0.15, 0.15) * ticks, 24, 38))

  for (let i = 1; i <= groupCount; i++) {
    const g = sim.groups.get(i)
    if (!g) continue

    const inResetCooldown = now < (g.resetCooldownUntilMs ?? 0)

    if (!g.faultLatched) {
      const lvl = inResetCooldown ? 'none' : anomalyLevel(i, now)
      g.warningUntilMs = lvl === 'none' ? 0 : now + 75_000
    }

    // 组内 SOC/SOH/温度/电压小幅变化
    const gSocStep = clamp(random(-0.12, 0.12) * ticks, -0.2, 0.2)
    g.soc = clamp(g.soc + gSocStep, 20, 90)
    g.soh = round3(clamp(g.soh - random(0, 0.00002) * ticks, 80, 100))
    g.temperatureC = Math.round(clamp(g.temperatureC + random(-0.2, 0.2) * ticks, 24, 40))
    g.voltageV = Number(clamp(g.voltageV + random(-1.5, 1.5) * ticks, 680, 860).toFixed(1))

    // BMS 关键异常量：用连续状态驱动，避免每次请求随机跳变。
    // 规则：同一个告警窗口内只激活一种主异常，避免“一次性多个异常”。
    if (!g.faultLatched) {
      const lvl = inResetCooldown ? 'none' : anomalyLevel(i, now)
      const windowMs = 90_000
      const slot = Math.floor(now / windowMs)
      const kind = (slot + i) % 3 // 0:绝缘 1:压差 2:温度

      if (lvl === 'warning') {
        g.insulationResistanceKohm =
          kind === 0 ? 230 : Math.round(clamp(g.insulationResistanceKohm + 6, 320, 900))
        g.deltaCellVoltageMv = kind === 1 ? 50 : Math.round(clamp(g.deltaCellVoltageMv - 1, 10, 35))
        g.maxCellTempC =
          kind === 2
            ? 54
            : Math.round(
                clamp(
                  g.maxCellTempC + random(-0.5, 0.5) * ticks,
                  g.temperatureC + 1,
                  g.temperatureC + 10,
                ),
              )
      } else if (lvl === 'critical') {
        g.insulationResistanceKohm =
          kind === 0 ? 140 : Math.round(clamp(g.insulationResistanceKohm + 8, 320, 900))
        g.deltaCellVoltageMv = kind === 1 ? 70 : Math.round(clamp(g.deltaCellVoltageMv + 1, 10, 35))
        g.maxCellTempC =
          kind === 2
            ? 62
            : Math.round(
                clamp(
                  g.maxCellTempC + random(-0.5, 0.5) * ticks,
                  g.temperatureC + 1,
                  g.temperatureC + 12,
                ),
              )
      } else {
        // 正常：缓慢回归安全区
        g.insulationResistanceKohm = Math.round(
          clamp(g.insulationResistanceKohm + random(-4, 4) * ticks + 1.5 * ticks, 320, 900),
        )
        g.deltaCellVoltageMv = Math.round(
          clamp(g.deltaCellVoltageMv + random(-1.5, 1.5) * ticks, 10, 35),
        )
        g.maxCellTempC = Math.round(
          clamp(g.maxCellTempC + random(-0.6, 0.6) * ticks, g.temperatureC + 1, g.temperatureC + 8),
        )
      }
    }

    const dtSec = dtMs / 1000
    const perGroupMaxAbsKw = 180
    const perGroupTargetKw = clamp(
      sim.stationTargetKw / Math.max(1, groupCount),
      -perGroupMaxAbsKw,
      perGroupMaxAbsKw,
    )
    const targetKw = g.faultLatched ? 0 : perGroupTargetKw
    const delta = targetKw - g.pcsActualKw
    const rateKwPerSec = dtSec > 0 ? Math.max(2, Math.abs(delta) / 20) : 0
    const step = clamp(delta, -rateKwPerSec * dtSec, rateKwPerSec * dtSec)
    g.pcsActualKw = Number((g.pcsActualKw + step).toFixed(1))
  }

  const stationActualKw = Array.from(sim.groups.values()).reduce(
    (s, g) => s + (g.pcsActualKw ?? 0),
    0,
  )
  const desiredCurrentA = sim.systemVoltage !== 0 ? (stationActualKw * 1000) / sim.systemVoltage : 0
  const deltaA = desiredCurrentA - sim.systemCurrent
  const dtSec = dtMs / 1000
  const rateAps = dtSec > 0 ? Math.max(5, Math.abs(deltaA) / 20) : 0
  const stepA = clamp(deltaA, -rateAps * dtSec, rateAps * dtSec)
  sim.systemCurrent = Number(clamp(sim.systemCurrent + stepA, -3000, 3000).toFixed(1))
}

export const resetBatteryGroupFault = (groupId: number) => {
  ensureSim(10)
  const g = sim.groups.get(groupId)
  if (!g) return
  g.faultLatched = false
  g.warningUntilMs = 0
  // 人工复位后给一个冷却时间，避免“刚复位又立刻复现异常窗口”，导致需要多次点击。
  g.resetCooldownUntilMs = Date.now() + 120_000
}

export const setBatteryGroupFaultLatched = (groupId: number, latched: boolean) => {
  ensureSim(10)
  const g = sim.groups.get(groupId)
  if (!g) return
  g.faultLatched = latched
  if (latched) {
    g.warningUntilMs = 0
    g.resetCooldownUntilMs = 0
  }
}

// 格式化时间
const formatTime = (date: Date): string => {
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// 生成系统状态
export const generateSystemStatus = (): SystemStatus => {
  const load = Math.round(random(40, 90))
  let status: 'normal' | 'warning' | 'error' = 'normal'

  if (load > 80) {
    status = 'warning'
  } else if (load > 90) {
    status = 'error'
  }

  return {
    status,
    load,
    totalPower: Math.round(random(500, 1200)),
    runTime: '247天12小时',
  }
}

// 生成遥测量数据
export const generateTelemetryData = (): TelemetryData => {
  tickSim(10)
  return {
    currentTime: formatTime(new Date()),
    averageVoltage: sim.systemVoltage, // 平滑小幅波动
    totalCurrent: sim.systemCurrent,
    averageTemperature: sim.systemTemp,
    systemSOC: Math.round(sim.systemSoc), // SOC 安全区 20~90
    systemSOH: round3(sim.systemSoh), // 三位小数，日变化很小
  }
}

export const generateTelemetryDataWithTarget = (stationTargetKw: number): TelemetryData => {
  tickSim(10, stationTargetKw)
  return generateTelemetryData()
}

// 生成设备遥测量数据
export const generateDeviceTelemetry = (): DeviceTelemetry => {
  const voltage = Number(random(3.2, 3.6).toFixed(2))
  const current = Number(random(-5, 5).toFixed(1))
  return {
    voltage,
    current,
    temperature: Math.round(random(25, 35)),
    soc: Math.round(random(30, 90)),
    soh: Math.round(random(85, 100)),
    power: Number(Math.abs(voltage * current).toFixed(1)),
    chargingStatus: current > 0 ? 'charging' : current < 0 ? 'discharging' : 'idle',
  }
}

// 生成告警数据
export const generateAlarmData = (): AlarmData => {
  const alarmTypes = [
    { type: '热失控', level: 'critical' as const, description: '电池温度超过安全阈值' },
    { type: '绝缘异常', level: 'critical' as const, description: '绝缘电阻低于安全值' },
    { type: '电压异常', level: 'warning' as const, description: '电压超出正常范围' },
    { type: '电流异常', level: 'warning' as const, description: '电流超出正常范围' },
    { type: 'SOC异常', level: 'warning' as const, description: 'SOC变化率异常' },
    { type: '通信中断', level: 'warning' as const, description: '设备通信中断' },
    { type: '系统启动', level: 'info' as const, description: '系统正常启动' },
    { type: '模式切换', level: 'info' as const, description: '系统模式切换' },
  ]

  const alarmList: Alarm[] = []
  const alarmCount = randomInt(5, 20)

  for (let i = 0; i < alarmCount; i++) {
    const alarmType = alarmTypes[randomInt(0, alarmTypes.length)] as (typeof alarmTypes)[number]
    const deviceType = randomInt(0, 2) === 0 ? '电池仓' : 'BMS'
    const deviceId = randomInt(1, 11)

    alarmList.push({
      timestamp: formatTime(new Date(Date.now() - randomInt(0, 3600000))),
      device: `${deviceType} ${deviceId}`,
      type: alarmType.type,
      level: alarmType.level,
      description: alarmType.description,
      status: randomInt(0, 2) === 0 ? 'active' : 'resolved',
    })
  }

  const criticalAlarms = alarmList.filter((a) => a.level === 'critical').length
  const warningAlarms = alarmList.filter((a) => a.level === 'warning').length
  const infoAlarms = alarmList.filter((a) => a.level === 'info').length

  return {
    totalAlarms: alarmCount,
    criticalAlarms,
    warningAlarms,
    infoAlarms,
    alarmList,
  }
}

// 生成Modbus包数据
export const generateModbusPackets = (count: number = 10): ModbusPacket[] => {
  const packets: ModbusPacket[] = []

  for (let i = 0; i < count; i++) {
    const functionCode = [1, 2, 3, 4, 5, 6][randomInt(0, 6)] as number
    const status = ['normal', 'warning', 'error'][randomInt(0, 3)] as 'normal' | 'warning' | 'error'

    packets.push({
      timestamp: formatTime(new Date(Date.now() - i * 5000)),
      functionCode,
      registerAddr: randomInt(0, 1000),
      dataLength: randomInt(1, 10),
      dataValue: Array.from({ length: randomInt(4, 16) }, () => randomInt(0, 16).toString(16)).join(
        '',
      ),
      status,
    })
  }

  return packets
}

// 生成连接设备数据
export const generateConnectedDevices = (device: Device): ConnectedDevice[] => {
  const devices: ConnectedDevice[] = []

  if (device.type === 'ems') {
    // EMS连接所有BMS
    for (let i = 1; i <= 10; i++) {
      devices.push({
        name: `BMS ${i}`,
        status: ['normal', 'warning', 'error'][randomInt(0, 3)] as 'normal' | 'warning' | 'error',
      })
    }
  } else if (device.type === 'bms') {
    // BMS连接EMS和2个电池仓
    devices.push({
      name: 'EMS',
      status: ['normal', 'warning', 'error'][randomInt(0, 3)] as 'normal' | 'warning' | 'error',
    })

    const batteryIds = [parseInt(device.id as string) * 2 - 1, parseInt(device.id as string) * 2]
    for (const id of batteryIds) {
      if (id <= 10) {
        devices.push({
          name: `电池仓 ${id}`,
          status: weightedBatteryBinStatus(),
        })
      }
    }
  } else if (device.type === 'battery') {
    // 电池仓连接对应的BMS
    const bmsId = Math.ceil(parseInt(device.id as string) / 2)
    devices.push({
      name: `BMS ${bmsId}`,
      status: ['normal', 'warning', 'error'][randomInt(0, 3)] as 'normal' | 'warning' | 'error',
    })
  }

  return devices
}

// 生成通信数据
export const generateCommunicationData = (device: Device): CommunicationData => {
  tickSim(10)
  const status =
    device.type === 'battery'
      ? // 电池通信状态：与电池故障/告警相关联
        (() => {
          const g = sim.groups.get(Number(device.id))
          if (g?.faultLatched) return 'error'
          if (g && g.warningUntilMs > Date.now()) return 'warning'
          return weightedCommStatus()
        })()
      : (['normal', 'warning', 'error'][randomInt(0, 3)] as 'normal' | 'warning' | 'error')

  return {
    status,
    lastCommTime: formatTime(new Date()),
    modbusPackets: generateModbusPackets(10),
    connectedDevices: generateConnectedDevices(device),
  }
}

// 生成设备遥测量数据
export const getDeviceTelemetry = (deviceType: string, deviceId: number): DeviceTelemetry => {
  tickSim(10)
  // 为不同设备类型生成不同范围的数据
  if (deviceType === 'battery') {
    const g = sim.groups.get(deviceId)
    const voltage = Number(random(3.2, 3.6).toFixed(2))
    const current = Number(random(-5, 5).toFixed(1)) // 单体电池电流较小
    return {
      voltage,
      current,
      temperature: Math.round(g?.temperatureC ?? random(25, 35)),
      soc: Math.round(g?.soc ?? random(30, 90)),
      soh: round3(g?.soh ?? random(85, 100)),
      power: Number(Math.abs(voltage * current).toFixed(1)), // 功率由电压电流计算得出
      chargingStatus: current > 0 ? 'charging' : current < 0 ? 'discharging' : 'idle', // 根据电流方向判断充放电状态
    }
  } else if (deviceType === 'bms') {
    const g = sim.groups.get(deviceId)
    // BMS（电池管理系统）：组级电压通常在 680-860V
    const voltage = Number(
      clamp((g?.voltageV ?? random(720, 820)) + random(-2, 2), 680, 860).toFixed(1),
    )
    const current = Number(random(-30, 30).toFixed(1))
    return {
      voltage,
      current,
      temperature: Math.round(g?.temperatureC ?? random(25, 35)),
      soc: Math.round(g?.soc ?? random(30, 90)),
      soh: round3(g?.soh ?? random(90, 100)),
      power: Number(Math.abs(voltage * current).toFixed(1)),
      chargingStatus: current > 0 ? 'charging' : current < 0 ? 'discharging' : 'idle',
    }
  }

  // 默认返回电池仓数据
  return generateDeviceTelemetry()
}

// 生成 PCS 遥测数据（用于电池组视图）
export const generatePcsTelemetry = (opts?: {
  groupId?: number
  dispatchMode?: PcsTelemetry['dispatchMode']
  setpointKw?: number
}): PcsTelemetry => {
  tickSim(10)
  const gid = opts?.groupId ?? 1
  const g = sim.groups.get(gid)
  const now = Date.now()
  const latchedFault = g?.faultLatched ?? false
  const warnActive = (g?.warningUntilMs ?? 0) > now

  const windowMs = 90_000
  const slot = Math.floor(now / windowMs)
  const kind = (slot + gid) % 3 // 0:绝缘 1:压差 2:温度
  const lvl = now < (g?.resetCooldownUntilMs ?? 0) ? 'none' : anomalyLevel(gid, now)

  const dispatchMode = (opts?.dispatchMode ?? 'AGC') as PcsTelemetry['dispatchMode']
  const setpointKw = Number((opts?.setpointKw ?? random(-80, 80)).toFixed(1))
  const trackNoise = latchedFault ? random(-12, 12) : warnActive ? random(-6, 6) : random(-3, 3)
  const baseActual = typeof g?.pcsActualKw === 'number' ? g.pcsActualKw : setpointKw
  const actualKw = Number((baseActual + trackNoise).toFixed(1))
  const acVoltageV = Number(random(380, 410).toFixed(1))
  const frequencyHz = Number(random(49.85, 50.15).toFixed(2))
  const powerFactor = Number(random(0.95, 1.0).toFixed(3))
  const reactivePowerKvar = Number(random(-40, 40).toFixed(1))
  const dcVoltageV = Number(random(650, 850).toFixed(1))
  const efficiencyPct = Number(random(96.0, 99.2).toFixed(2))
  let temperature = Math.round(random(28, 45))
  // 只有当该窗口的“主异常类型”为温度时，才让 PCS 出现过温。
  if (kind === 2) {
    if (lvl === 'warning') temperature = 54
    else if (lvl === 'critical') temperature = 60
  }

  // 三相电流近似：I = P / (sqrt(3)*V*pf)
  const acCurrentA = Number(
    clamp((Math.abs(actualKw) * 1000) / (Math.sqrt(3) * acVoltageV * powerFactor), 0, 400).toFixed(
      1,
    ),
  )
  // DC 电流近似：Idc = P / Vdc
  const dcCurrentA = Number(clamp((Math.abs(actualKw) * 1000) / dcVoltageV, 0, 450).toFixed(1))

  // 运行状态：基本不发生故障；故障由电池锁存驱动
  const runningState = latchedFault
    ? ('fault' as const)
    : randomInt(0, 100) < 8
      ? ('standby' as const)
      : ('running' as const)

  // 状态判定
  let status: PcsTelemetry['status'] = 'normal'
  if (runningState === 'fault') status = 'error'
  else if (warnActive) status = 'warning'
  else if (temperature >= 45) status = 'warning'
  else if (Math.abs(actualKw - setpointKw) > 20 && lvl === 'none') status = 'warning'

  return {
    status,
    dispatchMode,
    setpointKw,
    actualKw,
    rampRateKwPerMin: Number(random(10, 60).toFixed(0)),
    acVoltageV,
    acCurrentA,
    frequencyHz,
    powerFactor,
    reactivePowerKvar,
    dcVoltageV,
    dcCurrentA,
    efficiencyPct,
    temperature,
    runningState,
  }
}

// 生成 BMS（电池组级）遥测数据
export const generateBmsGroupTelemetry = (groupId: number): BmsGroupTelemetry => {
  tickSim(10)
  const now = Date.now()
  const g = sim.groups.get(groupId)
  const latchedFault = g?.faultLatched ?? false
  const warnActive = (g?.warningUntilMs ?? 0) > now

  // 复用现有 BMS 遥测（电压/电流/温度/SOC/SOH）
  const base = getDeviceTelemetry('bms', groupId)

  const maxCellVoltageV = 3.55
  const deltaCellVoltageMv = Math.round(clamp(g?.deltaCellVoltageMv ?? 25, 10, 80))
  const minCellVoltageV = Number(
    clamp(maxCellVoltageV - deltaCellVoltageMv / 1000, 3.2, 3.6).toFixed(3),
  )

  const maxCellTempC = Math.round(clamp(g?.maxCellTempC ?? base.temperature, base.temperature, 70))
  const minCellTempC = Math.round(clamp(base.temperature - 2, 20, base.temperature))
  const insulationResistanceKohm = Math.round(clamp(g?.insulationResistanceKohm ?? 650, 120, 900))

  const warningCount = warnActive ? 2 : 0
  const faultCount = latchedFault ? 1 : 0

  let status: BmsGroupTelemetry['status'] = 'normal'
  if (faultCount > 0) status = 'error'
  else if (warningCount > 0) {
    status = 'warning'
  }
  // 若处于异常窗口，BMS 状态会根据锁存/计数体现；具体告警由后端规则产生。
  const lvl = now < (g?.resetCooldownUntilMs ?? 0) ? 'none' : anomalyLevel(groupId, now)
  if (lvl === 'critical') status = 'error'

  return {
    status,
    voltageV: base.voltage,
    currentA: base.current,
    temperatureC: base.temperature,
    socPct: base.soc,
    sohPct: round3(base.soh),
    maxCellVoltageV,
    minCellVoltageV,
    deltaCellVoltageMv,
    maxCellTempC,
    minCellTempC,
    insulationResistanceKohm,
    contactorClosed: faultCount === 0 ? randomInt(0, 10) > 0 : false,
    balancingActive: randomInt(0, 10) > 6,
    warningCount,
    faultCount,
  }
}

const mergeStatus = (
  a: 'normal' | 'warning' | 'error',
  b: 'normal' | 'warning' | 'error',
): 'normal' | 'warning' | 'error' => {
  if (a === 'error' || b === 'error') return 'error'
  if (a === 'warning' || b === 'warning') return 'warning'
  return 'normal'
}

type CommandLike = {
  enabled?: boolean
  targetPower?: number
  rampRate?: number
  deadband?: number
  targetVoltage?: number
  voltageRange?: { min?: number; max?: number }
}

type ControlCommandsLike = {
  agc: CommandLike
  avc: CommandLike
  manualPower: CommandLike
}

// 生成电池组列表（10组：每组 1 PCS + 1 BMS）
export const generateBatteryGroups = (
  count: number = 10,
  controlCommands?: ControlCommandsLike,
): BatteryGroup[] => {
  const stationTargetKw = controlCommands?.manualPower?.enabled
    ? Number(controlCommands.manualPower.targetPower ?? 0)
    : controlCommands?.agc?.enabled
      ? Number(controlCommands.agc.targetPower ?? 0)
      : 0
  tickSim(count, stationTargetKw)
  const now = new Date()
  const lastUpdateTime = formatTime(now)

  const dispatchMode: PcsTelemetry['dispatchMode'] = controlCommands?.avc?.enabled ? 'AVC' : 'AGC'
  const perGroupSetpoint = count > 0 ? Number((stationTargetKw / count).toFixed(1)) : 0

  const groups: BatteryGroup[] = []
  for (let i = 1; i <= count; i++) {
    const pcs = generatePcsTelemetry({ groupId: i, dispatchMode, setpointKw: perGroupSetpoint })
    const bms = generateBmsGroupTelemetry(i)
    const status = mergeStatus(pcs.status, bms.status)
    groups.push({
      id: i,
      name: `电池组 ${i}`,
      status,
      lastUpdateTime,
      pcs,
      bms,
    })
  }
  return groups
}

const pickUpperSource = (): CoordinationUpperCommand['source'] =>
  randomInt(0, 2) === 0 ? 'EMS' : '调度中心'

const buildPlanId = () => {
  const y = new Date().getFullYear()
  return `PLAN-${y}-${randomInt(1000, 9999)}`
}

const buildPlanWindow = () => {
  const now = new Date()
  const hh = now.getHours().toString().padStart(2, '0')
  return `${hh}:00-${hh}:15`
}

const generateSafetySignals = (): CoordinationSafetySignals => {
  // 安全信号应尽量由“真实异常条件”驱动，避免在正常运行时随机跳闸。
  // 这里以 sim 状态为准：
  // - batteryTrip: 仅当某电池组发生锁存故障
  // - batteryWarning/preWarning: 仅当存在告警窗口或温度偏高
  // - dcBusOver/under: 由系统电压越界驱动（示例阈值）
  // - fire/emergencyStop: 默认不触发（可后续添加演示按钮触发）
  tickSim(10)
  const now = Date.now()
  const groups = Array.from(sim.groups.values())
  const anyFault = groups.some((g) => g.faultLatched)
  const anyWarn = groups.some((g) => g.warningUntilMs > now)

  const dcBusOverVoltage = sim.systemVoltage > 520
  const dcBusUnderVoltage = sim.systemVoltage < 390

  const fireConfirmed = false
  const emergencyStop = false
  const batteryTrip = anyFault
  const batteryWarning = !batteryTrip && anyWarn
  const batteryPreWarning =
    !batteryTrip &&
    !batteryWarning &&
    (sim.systemTemp >= 36 || groups.some((g) => g.temperatureC >= 38))

  // 电气保护动作：仅在严重工况下触发（示例）
  const electricalProtectionTrip = Boolean(batteryTrip && (dcBusOverVoltage || dcBusUnderVoltage))

  // 断路器默认合位；如触发保护/联锁可断开
  const acBreakerClosed = !(
    fireConfirmed ||
    emergencyStop ||
    electricalProtectionTrip ||
    batteryTrip
  )

  const interlockActive = fireConfirmed || emergencyStop || electricalProtectionTrip || batteryTrip
  const lockReason = interlockActive
    ? fireConfirmed
      ? '消防确认'
      : emergencyStop
        ? '急停'
        : electricalProtectionTrip
          ? '电气保护动作'
          : '电池跳闸'
    : batteryWarning
      ? '电池告警'
      : dcBusOverVoltage
        ? '直流母线过压'
        : dcBusUnderVoltage
          ? '直流母线欠压'
          : ''

  return {
    batteryPreWarning,
    batteryWarning,
    batteryTrip,
    electricalProtectionTrip,
    dcBusOverVoltage,
    dcBusUnderVoltage,
    acBreakerClosed,
    emergencyStop,
    fireConfirmed,
    interlockActive,
    lockReason,
  }
}

const distributeSetpoints = (
  pcsIds: number[],
  targetKw: number,
  perPcsMaxAbsKw: number,
): number[] => {
  if (pcsIds.length === 0) return []
  const per = clamp(targetKw / pcsIds.length, -perPcsMaxAbsKw, perPcsMaxAbsKw)
  // 加一点轻微扰动，避免完全一致
  const values = pcsIds.map(() => Number((per + random(-3, 3)).toFixed(1)))
  // 让总和更接近 target
  const sum = values.reduce((a, b) => a + b, 0)
  const delta = Number((targetKw - sum).toFixed(1))
  if (values.length > 0) {
    values[0] = Number(((values[0] ?? 0) + delta).toFixed(1))
  }
  return values
}

const mergeStatus3 = (
  a: 'normal' | 'warning' | 'error',
  b: 'normal' | 'warning' | 'error',
  c: 'normal' | 'warning' | 'error',
): 'normal' | 'warning' | 'error' => mergeStatus(mergeStatus(a, b), c)

// 生成协控单元（3个），聚合输入输出，侧重"输入/输出"
export const generateCoordinationUnits = (
  unitCount: number = 3,
  totalPcsCount: number = 10,
  userCommands?: ControlCommandsLike,
): CoordinationUnit[] => {
  const now = new Date()
  const ts = formatTime(now)

  // 固定分组：把 10 台 PCS 尽量均匀分到 3 个协控单元
  const unitToPcsIds: number[][] = Array.from({ length: unitCount }, () => [])
  for (let pcsId = 1; pcsId <= totalPcsCount; pcsId++) {
    const unitIndex = (pcsId - 1) % unitCount
    unitToPcsIds[unitIndex]?.push(pcsId)
  }

  // 上层目标：使用用户设置的命令，如果没有则使用随机值
  let globalMode: CoordinationUpperCommand['mode'] = 'AGC'
  let globalTargetKw = Number(random(-600, 600).toFixed(1))
  let globalEnable = randomInt(0, 10) > 0

  if (userCommands) {
    if (userCommands.agc.enabled) {
      globalMode = 'AGC'
      globalTargetKw = Number(userCommands.agc.targetPower ?? 0)
      globalEnable = true
    } else if (userCommands.avc.enabled) {
      globalMode = 'AVC'
      globalTargetKw = Number(userCommands.avc.targetVoltage ?? 0) // 转换为功率表示
      globalEnable = true
    } else if (userCommands.manualPower.enabled) {
      globalMode = 'AGC' // 手动控制也用AGC模式
      globalTargetKw = Number(userCommands.manualPower.targetPower ?? 0)
      globalEnable = true
    }
  } else {
    globalMode = (randomInt(0, 2) === 0 ? 'AVC' : 'AGC') as CoordinationUpperCommand['mode']
  }

  const planId = buildPlanId()
  const planWindow = buildPlanWindow()
  const source = pickUpperSource()

  const safety = generateSafetySignals()

  // 用于上报汇总的全站值（简单聚合）
  // 这里复用 PCS/BMS 的连续状态，异常率极低，故障几乎不发生（故障由电池锁存驱动）
  const perPcsSetpoint = totalPcsCount > 0 ? Number((globalTargetKw / totalPcsCount).toFixed(1)) : 0
  const allPcsTelem = Array.from({ length: totalPcsCount }, (_, i) => ({
    pcsId: i + 1,
    telem: generatePcsTelemetry({
      groupId: i + 1,
      dispatchMode: globalMode,
      setpointKw: perPcsSetpoint,
    }),
  }))
  const stationActualTotalKw = Number(
    allPcsTelem.reduce((sum, p) => sum + p.telem.actualKw, 0).toFixed(1),
  )

  // 容量估算：假设每组 200kWh，总容量=2000kWh，根据 SOC 粗估可用容量（中值附近最大）
  const bmsList = Array.from({ length: totalPcsCount }, (_, i) => generateBmsGroupTelemetry(i + 1))
  const avgSoc = bmsList.reduce((s, b) => s + b.socPct, 0) / Math.max(1, bmsList.length)
  const totalCapacityKwh = totalPcsCount * 200
  const availableCapacityKwh = Math.round(totalCapacityKwh * clamp(avgSoc / 100, 0.05, 0.95))

  // 报警/事件汇总（模拟）
  const alarmSummary = {
    critical: randomInt(0, 3),
    warning: randomInt(0, 8),
    info: randomInt(0, 6),
  }
  const eventSummary = {
    startStop: randomInt(0, 3),
    modeSwitch: randomInt(0, 2),
    interlock: safety.interlockActive ? randomInt(1, 3) : randomInt(0, 1),
  }

  // 指令跟踪误差（简单用上层目标 vs 实际总功率）
  const commandTrackingErrorKw = Number((globalTargetKw - stationActualTotalKw).toFixed(1))

  const ready =
    globalEnable &&
    !safety.interlockActive &&
    safety.acBreakerClosed &&
    !safety.electricalProtectionTrip
  const executionStatus: CoordinationUpperReport['executionStatus'] = !ready
    ? safety.interlockActive
      ? '退出运行'
      : '未就绪'
    : Math.abs(commandTrackingErrorKw) > 80
      ? '受限'
      : '跟踪正常'

  const unitReportsBase: Omit<CoordinationUpperReport, 'reportedAt'> = {
    stationActualTotalKw,
    availableCapacityKwh,
    ready,
    executionStatus,
    commandTrackingErrorKw,
    alarmSummary,
    eventSummary,
  }

  const units: CoordinationUnit[] = []
  for (let u = 1; u <= unitCount; u++) {
    const pcsIds = unitToPcsIds[u - 1] ?? []
    const upper: CoordinationUpperCommand = {
      source,
      mode: globalMode,
      planId,
      planWindow,
      targetPowerKw: globalTargetKw,
      enable: globalEnable,
      issuedAt: ts,
    }

    // peer 通信：与其它单元的链路状态
    const peerSignals = Array.from({ length: unitCount }, (_, idx) => idx + 1)
      .filter((peerId) => peerId !== u)
      .map((peerId) => {
        const commStatus = weightedCommStatus()
        const latencyMs =
          commStatus === 'normal'
            ? randomInt(8, 35)
            : commStatus === 'warning'
              ? randomInt(40, 120)
              : randomInt(200, 900)
        const peerReady = ready && commStatus !== 'error' ? randomInt(0, 10) > 1 : false
        const peerLimitPower = randomInt(0, 30) === 0
        const peerExitRun = randomInt(0, 120) === 0
        return {
          peerUnitId: peerId,
          commStatus,
          lastRxTime: ts,
          latencyMs,
          peerReady,
          peerLimitPower,
          peerExitRun,
        }
      })

    // 下层设备输入（PCS/BMS）
    const pcsInputs: CoordinationDeviceInputPcs[] = pcsIds.map((pcsId) => {
      const telem = allPcsTelem.find((x) => x.pcsId === pcsId)?.telem ?? generatePcsTelemetry()
      const adjustableMaxKw = randomInt(120, 220)
      const adjustableMinKw = -adjustableMaxKw
      const faultCode = telem.runningState === 'fault' ? `PCS-${pcsId}-${randomInt(100, 999)}` : ''
      return {
        pcsId,
        status: telem.status,
        runningState: telem.runningState,
        faultCode,
        actualKw: telem.actualKw,
        adjustableMinKw,
        adjustableMaxKw,
      }
    })

    const bmsInputs: CoordinationDeviceInputBms[] = pcsIds.map((id) => {
      const b = bmsList[id - 1] ?? generateBmsGroupTelemetry(id)
      return {
        bmsId: id,
        status: b.status,
        socPct: b.socPct,
        temperatureC: b.temperatureC,
        insulationResistanceKohm: b.insulationResistanceKohm,
        deltaCellVoltageMv: b.deltaCellVoltageMv,
        warningCount: b.warningCount,
        faultCount: b.faultCount,
      }
    })

    // 输出：下发到 PCS
    const perPcsMaxAbsKw = 180
    const setpoints = distributeSetpoints(pcsIds, globalTargetKw / unitCount, perPcsMaxAbsKw)
    const pcsCommands: CoordinationPcsCommand[] = pcsIds.map((pcsId, i) => {
      const setpointKw = setpoints[i] ?? 0
      const enable = ready
      const startStop: CoordinationPcsCommand['startStop'] = enable ? 'start' : 'stop'
      const modeCmd = globalMode
      const rampRateKwPerMin = randomInt(10, 60)
      return { pcsId, enable, startStop, modeCmd, setpointKw, rampRateKwPerMin }
    })

    // 同层输出：联锁/协调信号
    const peerOutputs: CoordinationPeerOutputs = {
      fireConfirmed: safety.fireConfirmed,
      limitPower:
        executionStatus === '受限' ||
        safety.batteryWarning ||
        safety.batteryPreWarning ||
        safety.dcBusUnderVoltage ||
        safety.dcBusOverVoltage,
      exitRun: executionStatus === '退出运行',
      limitReason:
        executionStatus === '退出运行'
          ? safety.lockReason
          : executionStatus === '受限'
            ? '容量/设备受限'
            : '',
    }

    // 单元状态：综合 上层/安全/设备
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
    const unitStatus = mergeStatus3(pcsWorst, bmsWorst, safetyStatus)

    units.push({
      unitId: u,
      name: `协控单元 ${u}`,
      status: unitStatus,
      lastUpdateTime: ts,
      inputs: {
        upper,
        safety,
        peerSignals,
        devices: { pcs: pcsInputs, bms: bmsInputs },
      },
      outputs: {
        pcsCommands,
        upperReport: { ...unitReportsBase, reportedAt: ts },
        peerOutputs,
      },
    })
  }

  return units
}

// 设备计数
export const deviceCounts = {
  batteryBins: 10,
  bms: 10,
  normal: randomInt(15, 20),
  abnormal: randomInt(1, 6),
}
