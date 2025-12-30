import type { BatteryGroup } from '../../services/mockDataService'
import type { CoordinationUnit } from '../../services/mockDataService'
import type { EmsDispatchCommands, EmsProtectionDevice, EmsSnapshot, Status } from './models'
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const nowZh = () =>
  new Date().toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

const mergeStatus = (a: Status, b: Status): Status => {
  if (a === 'error' || b === 'error') return 'error'
  if (a === 'warning' || b === 'warning') return 'warning'
  return 'normal'
}

const countStatuses = (statuses: Status[]) =>
  statuses.reduce(
    (acc, s) => {
      acc[s]++
      return acc
    },
    { normal: 0, warning: 0, error: 0 } as Record<Status, number>,
  )

type DispatchControlCommands = {
  agc?: { enabled?: boolean; targetPower?: number }
  avc?: { enabled?: boolean; targetVoltage?: number }
  meta?: { actor?: string; avcProvided?: boolean } | undefined
}

export const generateDispatchCommands = (
  controlCommands?: DispatchControlCommands,
): EmsDispatchCommands => {
  const issuedAt = nowZh()
  const source = '调度中心'

  const agcEnabled = Boolean(controlCommands?.agc?.enabled)
  const avcEnabled = Boolean(controlCommands?.avc?.enabled)
  const agcSetpointKw = Number(controlCommands?.agc?.targetPower ?? 0)
  const avcBusVoltageSetpointKv = Number(controlCommands?.avc?.targetVoltage ?? 400) / 1000

  return {
    agcSetpointKw,
    agcEnabled,
    avcBusVoltageSetpointKv,
    avcEnabled,
    issuedAt,
    source,
  }
}

const protectionTripLatch = new Map<string, { reason: string; at: number }>()

export const resetProtectionDeviceLatch = (name: string) => {
  protectionTripLatch.delete(name)
}

const buildProtectionDevices = (params: {
  forceNormal: boolean
  batteryGroups: BatteryGroup[]
  coordinationUnits: CoordinationUnit[]
}): EmsProtectionDevice[] => {
  const names = [
    '电气保护装置-交流侧',
    '电气保护装置-直流侧',
    '消防联动模块',
    '电池预警系统(BEW)',
    '绝缘监测装置(IMD)',
  ]

  if (params.forceNormal) {
    for (const n of names) protectionTripLatch.delete(n)
    return names.map((name) => ({ name, status: 'normal', trip: false, lastAction: '无' }))
  }

  const cu = params.coordinationUnits
  const safety = {
    fireConfirmed: cu.some((u) => u.inputs.safety.fireConfirmed),
    emergencyStop: cu.some((u) => u.inputs.safety.emergencyStop),
    electricalProtectionTrip: cu.some((u) => u.inputs.safety.electricalProtectionTrip),
    batteryTrip: cu.some((u) => u.inputs.safety.batteryTrip),
    batteryWarning: cu.some((u) => u.inputs.safety.batteryWarning),
    batteryPreWarning: cu.some((u) => u.inputs.safety.batteryPreWarning),
    dcBusOverVoltage: cu.some((u) => u.inputs.safety.dcBusOverVoltage),
    dcBusUnderVoltage: cu.some((u) => u.inputs.safety.dcBusUnderVoltage),
    acBreakerClosed: cu.every((u) => u.inputs.safety.acBreakerClosed),
  }

  const worstInsu = (() => {
    let best: { groupId: number; insulationResistanceKohm: number } | null = null
    for (const g of params.batteryGroups) {
      const v = Number(g.bms.insulationResistanceKohm)
      if (!Number.isFinite(v)) continue
      if (!best || v < best.insulationResistanceKohm) {
        best = { groupId: g.id, insulationResistanceKohm: v }
      }
    }
    return best ?? { groupId: 0, insulationResistanceKohm: 999 }
  })()

  const mk = (
    name: string,
    computed: { warnReason?: string; tripReason?: string },
  ): EmsProtectionDevice => {
    const latched = protectionTripLatch.get(name)
    if (latched) {
      return {
        name,
        status: 'error',
        trip: true,
        lastAction: '跳闸',
        reason: `跳闸锁存：${latched.reason}（需线下复位）`,
      }
    }

    if (computed.tripReason) {
      protectionTripLatch.set(name, { reason: computed.tripReason, at: Date.now() })
      return {
        name,
        status: 'error',
        trip: true,
        lastAction: '跳闸',
        reason: `触发跳闸：${computed.tripReason}（已锁存，需线下复位）`,
      }
    }

    if (computed.warnReason) {
      return {
        name,
        status: 'warning',
        trip: false,
        lastAction: '预警',
        reason: `预警：${computed.warnReason}`,
      }
    }

    return { name, status: 'normal', trip: false, lastAction: '无' }
  }

  return [
    mk('电气保护装置-交流侧', {
      tripReason:
        safety.emergencyStop || safety.electricalProtectionTrip
          ? `安全信号触发（emergencyStop=${safety.emergencyStop ? 1 : 0}，electricalProtectionTrip=${
              safety.electricalProtectionTrip ? 1 : 0
            }）`
          : undefined,
      warnReason: !safety.acBreakerClosed
        ? '交流断路器处于断开状态（acBreakerClosed=0），保护装置进入监视/闭锁'
        : undefined,
    }),
    mk('电气保护装置-直流侧', {
      tripReason: safety.electricalProtectionTrip
        ? `电气保护动作信号触发（electricalProtectionTrip=1），直流侧保护跳闸`
        : undefined,
      warnReason: safety.dcBusOverVoltage
        ? '直流母线过压信号触发（dcBusOverVoltage=1）'
        : safety.dcBusUnderVoltage
          ? '直流母线欠压信号触发（dcBusUnderVoltage=1）'
          : undefined,
    }),
    mk('消防联动模块', {
      tripReason: safety.fireConfirmed
        ? '消防确认信号触发（fireConfirmed=1），按策略应触发联动并退出运行'
        : undefined,
    }),
    mk('电池预警系统(BEW)', {
      // 电池组故障/退出只应隔离故障组并降额，不应让 EMS 直接进入全站 SAFE_STOP。
      // 因此这里不将 batteryTrip 作为“跳闸”条件，只作为更高优先级的预警提示。
      warnReason: safety.batteryTrip
        ? '检测到电池组故障/隔离（batteryTrip=1），已将故障组可用功率视为0并重新分配出力'
        : safety.batteryWarning
          ? '电池告警信号触发（batteryWarning=1），建议核查电池状态与告警来源'
          : safety.batteryPreWarning
            ? '电池预警信号触发（batteryPreWarning=1），建议重点关注温度/一致性/绝缘趋势'
            : undefined,
    }),
    mk('绝缘监测装置(IMD)', {
      // IMD 正常运行下不应轻易“跳闸”。
      // 只有在绝缘极低（<120kΩ）并伴随硬触发信号（保护动作/急停/消防/电池跳闸）才允许跳闸，并且会锁存。
      tripReason:
        worstInsu.insulationResistanceKohm < 120 &&
        (safety.electricalProtectionTrip ||
          safety.emergencyStop ||
          safety.fireConfirmed ||
          safety.batteryTrip)
          ? `绝缘极低且伴随硬触发（Group-${worstInsu.groupId} 绝缘=${worstInsu.insulationResistanceKohm}kΩ < 120kΩ；` +
            `electricalProtectionTrip=${safety.electricalProtectionTrip ? 1 : 0}，emergencyStop=${
              safety.emergencyStop ? 1 : 0
            }，fireConfirmed=${safety.fireConfirmed ? 1 : 0}，batteryTrip=${safety.batteryTrip ? 1 : 0}）`
          : undefined,
      warnReason:
        worstInsu.insulationResistanceKohm < 200
          ? `绝缘偏低（最差：Group-${worstInsu.groupId} 绝缘=${worstInsu.insulationResistanceKohm}kΩ < 200kΩ），建议排查：直流侧对地泄漏/潮湿凝露/线缆破损/接地回路异常`
          : undefined,
    }),
  ]
}

const buildFaults = (batteryGroups: BatteryGroup[], protection: EmsProtectionDevice[]) => {
  const faults: Array<{ device: string; level: Status; code?: string; description: string }> = []
  for (const g of batteryGroups) {
    if (g.pcs.runningState === 'fault') {
      faults.push({
        device: `PCS-${g.id}`,
        level: 'error',
        code: `PCS-${g.id}-F`,
        description: 'PCS故障',
      })
    } else if (g.pcs.status === 'warning') {
      faults.push({ device: `PCS-${g.id}`, level: 'warning', description: 'PCS告警' })
    }
    if (g.bms.status === 'error') {
      faults.push({ device: `BMS-${g.id}`, level: 'error', description: 'BMS故障/跳闸' })
    } else if (g.bms.status === 'warning') {
      faults.push({ device: `BMS-${g.id}`, level: 'warning', description: 'BMS告警' })
    }
  }
  for (const p of protection) {
    if (p.status !== 'normal') {
      faults.push({
        device: p.name,
        level: p.status,
        description: p.trip ? '保护动作/跳闸' : '保护预警',
      })
    }
  }
  return faults
}

const toAlarmLevel = (s: Status) =>
  s === 'error' ? ('critical' as const) : s === 'warning' ? ('warning' as const) : ('info' as const)

const computeAvailablePowerUpperLimit = (coordUnits: CoordinationUnit[]): number => {
  // 取协控层上报的 PCS 可调上限求和（只取正向上限）
  let sum = 0
  for (const u of coordUnits) {
    for (const p of u.inputs.devices.pcs) {
      sum += Math.max(0, p.adjustableMaxKw)
    }
  }
  return Number(sum.toFixed(0))
}

const computeAvgSoc = (batteryGroups: BatteryGroup[]) => {
  if (batteryGroups.length === 0) return 0
  const v = batteryGroups.reduce((s, g) => s + g.bms.socPct, 0) / batteryGroups.length
  return Math.round(v)
}

const computeAvailableCapacity = (batteryGroups: BatteryGroup[]) => {
  // 简化：每组 200kWh，总容量 = 2000kWh，根据 SOC 粗估
  const totalCapacity = batteryGroups.length * 200
  const soc = computeAvgSoc(batteryGroups)
  return Math.round(totalCapacity * clamp(soc / 100, 0.05, 0.95))
}

export const computeEmsSnapshot = (params: {
  batteryGroups: BatteryGroup[]
  coordinationUnits: CoordinationUnit[]
  dispatch?: EmsDispatchCommands
  controlCommands?: DispatchControlCommands
  protectionDevices?: EmsProtectionDevice[]
}): EmsSnapshot => {
  const nowMs = Date.now()
  const timestamp = new Date(nowMs).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const dispatch = params.dispatch ?? generateDispatchCommands(params.controlCommands)
  const protectionDevices =
    params.protectionDevices ??
    buildProtectionDevices({
      forceNormal: dispatch.agcEnabled || dispatch.avcEnabled,
      batteryGroups: params.batteryGroups,
      coordinationUnits: params.coordinationUnits,
    })

  const bg = params.batteryGroups
  const cu = params.coordinationUnits

  const pcsFaultCodes = bg
    .filter((g) => g.pcs.runningState === 'fault')
    .map((g) => ({ pcsId: g.id, faultCode: `PCS-${g.id}-F` }))

  const pcsStatuses = bg.map((g) => g.pcs.status)
  const bmsStatuses = bg.map((g) => g.bms.status)
  const protectionStatuses = protectionDevices.map((p) => p.status)

  const availablePowerUpperLimitKw = computeAvailablePowerUpperLimit(cu)

  const unitStatuses = cu.map((u) => u.status)
  const unitCommStatuses = cu.flatMap((u) => u.inputs.peerSignals.map((p) => p.commStatus))

  const safetyInterlockActive = cu.some((u) => u.inputs.safety.interlockActive)
  const interlockReason =
    cu.find((u) => u.inputs.safety.interlockActive)?.inputs.safety.lockReason ||
    (protectionDevices.find((p) => p.trip)?.name ?? '')

  const actualTotalKw = Number(bg.reduce((s, g) => s + g.pcs.actualKw, 0).toFixed(1))
  const avgSocPct = computeAvgSoc(bg)
  const availableCapacityKwh = computeAvailableCapacity(bg)

  const faults = buildFaults(bg, protectionDevices)

  // -------- Decision system --------
  const rationale: string[] = []
  const actions: string[] = []

  const protectionTripActive = protectionDevices.some((p) => p.trip)
  const commBad = unitCommStatuses.filter((s) => s === 'error').length > 0
  const fieldError = pcsStatuses.includes('error') || bmsStatuses.includes('error')

  let ready = true
  if (safetyInterlockActive || protectionTripActive) {
    ready = false
    rationale.push('检测到安全联锁/保护跳闸，系统进入安全停机策略')
  }
  if (commBad) {
    rationale.push('协控单元通信存在故障链路，进入限功率策略')
  }
  if (fieldError) {
    rationale.push('现场设备存在故障态，控制目标需要降级/限幅')
  }

  let decisionMode: 'AGC' | 'AVC' | 'SAFE_STOP' | 'LIMITED' = 'AGC'
  let stationTargetPowerKw = 0
  let stationTargetVoltageKv: number | null = null
  let stationTargetVoltageSource: 'remote' | 'auto' | 'local' | null = null
  let limitReason = ''

  if (!ready) {
    decisionMode = 'SAFE_STOP'
    stationTargetPowerKw = 0
    stationTargetVoltageKv = null
    stationTargetVoltageSource = null
    limitReason = interlockReason || '安全联锁'
    rationale.push('全站目标功率计算：因安全联锁/保护跳闸进入 SAFE_STOP，目标功率强制为 0kW')
    actions.push('下发全站停机目标：目标功率=0kW')
    actions.push('冻结AGC/AVC执行，等待联锁解除后再恢复')
  } else {
    // 模式优先级：AGC（功率）为主，AVC（电压）为辅（可以同时使能，但页面展示分别给出）
    const requestedKw = dispatch.agcEnabled ? dispatch.agcSetpointKw : 0
    const lim = Math.max(0, availablePowerUpperLimitKw || 0)
    const boundedKw = lim > 0 ? clamp(requestedKw, -lim, lim) : requestedKw

    rationale.push(
      `全站目标功率计算：请求功率 P_req = ${dispatch.agcEnabled ? 'AGC设定值' : '0（AGC未使能）'} = ${requestedKw}kW`,
    )
    rationale.push(
      `全站目标功率计算：协控可用功率上限 P_lim = max(0, availablePowerUpperLimitKw) = ${lim}kW`,
    )
    rationale.push(
      `全站目标功率计算：限幅后 P_clamp = ${lim > 0 ? `clamp(${requestedKw}, -${lim}, ${lim})` : String(requestedKw)} = ${Number(boundedKw.toFixed(1))}kW`,
    )

    stationTargetPowerKw = Number(boundedKw.toFixed(1))
    decisionMode = dispatch.agcEnabled ? 'AGC' : 'LIMITED'
    if (!dispatch.agcEnabled) {
      limitReason = 'AGC未使能，维持/退出功率调节'
      rationale.push('全站目标功率计算：由于 AGC 未使能，本周期仅给出限功率/维持策略的目标功率')
      actions.push('AGC未使能：输出为限功率/维持策略')
    }

    {
      const actor = String(params.controlCommands?.meta?.actor ?? '')
      const avcProvided = params.controlCommands?.meta?.avcProvided

      // Source is determined by whether AVC was explicitly provided by the command issuer.
      // - local: always authoritative
      // - remote + avcProvided: authoritative even if remote disables AVC
      // - otherwise: if AVC is effectively enabled, it's auto takeover
      if (actor === 'local') stationTargetVoltageSource = 'local'
      else if (actor === 'remote' && avcProvided === true) stationTargetVoltageSource = 'remote'
      else if (dispatch.avcEnabled) stationTargetVoltageSource = 'auto'
      else stationTargetVoltageSource = null

      if (dispatch.avcEnabled) {
        stationTargetVoltageKv = dispatch.avcBusVoltageSetpointKv
        actions.push(`AVC使能：母线电压目标=${dispatch.avcBusVoltageSetpointKv}kV`)
      } else {
        stationTargetVoltageKv = null
      }
    }

    if (commBad || fieldError || avgSocPct < 15 || avgSocPct > 95) {
      decisionMode = 'LIMITED'
      const shrink = commBad ? 0.75 : 0.85
      const beforeShrinkKw = stationTargetPowerKw
      stationTargetPowerKw = Number((stationTargetPowerKw * shrink).toFixed(1))
      limitReason = commBad ? '通信异常限幅' : fieldError ? '设备故障降额' : 'SOC边界保护'
      rationale.push(
        `全站目标功率计算：触发降级/限幅（原因=${limitReason}），缩放系数 k=${shrink}，P = ${beforeShrinkKw}×${shrink} = ${stationTargetPowerKw}kW`,
      )
      actions.push(`限幅系数=${shrink}，目标功率调整为 ${stationTargetPowerKw}kW`)
    } else {
      rationale.push('满足就绪条件，执行AGC/AVC跟踪控制')
      actions.push(`下发全站控制目标：P=${stationTargetPowerKw}kW`)
    }
  }

  const decisionId = `EMS-${new Date(nowMs).getFullYear()}-${nowMs}`

  // SCADA outputs (for future page)
  const alarms = faults.slice(0, 8).map((f) => ({
    level: toAlarmLevel(f.level),
    title: `${f.device} ${f.level === 'error' ? '故障' : '告警'}`,
    detail: f.description + (f.code ? `（${f.code}）` : ''),
    at: timestamp,
  }))

  const optimizationSuggestions: string[] = []
  if (avgSocPct < 20)
    optimizationSuggestions.push('SOC偏低：建议降低放电目标或提升充电功率，避免深度放电')
  if (avgSocPct > 90)
    optimizationSuggestions.push('SOC偏高：建议限制充电、优化均衡策略，降低过充风险')
  if (faults.some((f) => f.level === 'warning'))
    optimizationSuggestions.push('存在告警：建议适当降低爬坡率、复核冷却与绝缘状态')
  if (optimizationSuggestions.length === 0)
    optimizationSuggestions.push('运行平稳：建议维持当前策略，按计划执行AGC/AVC')

  const reports = [
    {
      title: 'EMS运行日报(模拟)',
      summary: `可用容量≈${availableCapacityKwh}kWh，平均SOC≈${avgSocPct}%`,
      at: timestamp,
    },
    {
      title: '执行情况摘要',
      summary: `模式=${decisionMode}，目标P=${stationTargetPowerKw}kW`,
      at: timestamp,
    },
  ]

  const visualizationHints = [
    '建议画面：P指令/实际对比曲线（全站 + 单元）',
    '建议画面：协控就绪/联锁状态时序图',
    '建议画面：设备故障拓扑（PCS/BMS/保护装置）',
  ]

  const decisionDigest = `决策=${decisionMode}，就绪=${ready ? '是' : '否'}，目标P=${stationTargetPowerKw}kW${
    stationTargetVoltageKv ? `，目标U=${stationTargetVoltageKv}kV` : ''
  }${limitReason ? `，原因=${limitReason}` : ''}`

  // 温度云图数据：以每个电池组 BMS 温度作为云图点（后续可扩展为簇/面）
  const temps = bg.map((g) => g.bms.temperatureC)
  const minC = temps.length ? Math.min(...temps) : 0
  const maxC = temps.length ? Math.max(...temps) : 0
  const temperatureCloud = {
    minC,
    maxC,
    points: bg.map((g) => ({
      groupId: g.id,
      label: g.name,
      temperatureC: g.bms.temperatureC,
      status: g.bms.status,
    })),
  }

  // 一致性分析：用 deltaCellVoltageMv + 绝缘电阻综合打分（越低越好）
  const consistencyAll = bg
    .map((g) => {
      const delta = g.bms.deltaCellVoltageMv
      const insu = g.bms.insulationResistanceKohm
      const score = Math.round(clamp(delta * 1.5 + clamp(300 - insu, 0, 300) * 0.8, 0, 999))
      return {
        groupId: g.id,
        deltaCellVoltageMv: delta,
        insulationResistanceKohm: insu,
        status: mergeStatus(g.bms.status, g.pcs.status),
        score,
      }
    })
    .sort((a, b) => b.score - a.score)

  const worstDeltaMv = consistencyAll.length
    ? Math.max(...consistencyAll.map((x) => x.deltaCellVoltageMv))
    : 0

  // 消防系统：优先从保护装置“消防联动模块”，并结合协控 fireConfirmed
  const fireLinkage = protectionDevices.find((p) => p.name.includes('消防')) ?? protectionDevices[0]
  const fireConfirmed =
    cu.some((u) => u.inputs.safety.fireConfirmed) || (fireLinkage?.trip ?? false)
  const fireSystem = {
    fireConfirmed,
    fireLinkageModuleStatus: fireLinkage?.status ?? 'normal',
    note: fireConfirmed ? '已确认火灾：系统应退出运行并联锁' : '未确认火灾：消防链路监视中',
  }

  return {
    inputs: {
      timestamp,
      fieldDevices: {
        pcsCount: bg.length,
        bmsCount: bg.length,
        protectionCount: protectionDevices.length,
        pcsStatusCounts: countStatuses(pcsStatuses),
        bmsStatusCounts: countStatuses(bmsStatuses),
        protectionStatusCounts: countStatuses(protectionStatuses),
        pcsFaultCodes,
      },
      protectionDevices,
      coordinationLayer: {
        unitCount: cu.length,
        unitStatusCounts: countStatuses(unitStatuses),
        availablePowerUpperLimitKw,
        safetyInterlockActive,
        interlockReason,
        unitCommStatusCounts: countStatuses(
          unitCommStatuses.length ? unitCommStatuses : (['normal'] as Status[]),
        ),
      },
      dispatch,
      station: {
        actualTotalKw,
        availableCapacityKwh,
        avgSocPct,
      },
    },
    decision: {
      timestamp,
      decisionId,
      ready,
      decisionMode,
      stationTargetPowerKw,
      stationTargetVoltageKv,
      stationTargetVoltageSource,
      limitReason,
      actions,
      rationale,
    },
    outputs: {
      toCoordinationLayer: {
        stationControlTargetPowerKw: stationTargetPowerKw,
        stationControlMode: decisionMode,
        targetVoltageKv: stationTargetVoltageKv,
      },
      toMasterStation: {
        reportActualTotalKw: actualTotalKw,
        reportAvailableCapacityKwh: availableCapacityKwh,
        reportFaults: faults.slice(0, 12),
      },
      toScada: {
        kpis: {
          ready,
          mode: decisionMode,
          targetPowerKw: stationTargetPowerKw,
          actualPowerKw: actualTotalKw,
          trackingErrorKw: Number((stationTargetPowerKw - actualTotalKw).toFixed(1)),
          availableCapacityKwh,
          avgSocPct,
          availablePowerUpperLimitKw,
        },
        fireSystem,
        temperatureCloud,
        consistencyAnalysis: {
          worstDeltaMv,
          worstGroups: consistencyAll.slice(0, 5),
          all: consistencyAll,
        },
        alarms,
        reports,
        optimizationSuggestions,
        visualizationHints,
        decisionDigest,
      },
    },
  }
}
