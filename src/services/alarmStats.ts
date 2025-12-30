export type AlarmStatsWindowKey = '1m' | '1h' | '1d'

export type AlarmStatsBreakdownItem = {
  /** 分组维度：告警类型 / 设备 */
  key: string
  /** 总数（= critical + warning + info） */
  total: number
  critical: number
  warning: number
  info: number
  active: number
  resolved: number
}

export type AlarmStatsWindow = {
  key: AlarmStatsWindowKey
  /** 时间窗起点（epoch ms） */
  startTs: number
  /** 时间窗终点（epoch ms） */
  endTs: number
  /** 本窗告警总数 */
  total: number
  /** 告警类型分布（降序） */
  byType: AlarmStatsBreakdownItem[]
  /** 设备分布（降序） */
  byDevice: AlarmStatsBreakdownItem[]
}

export type AlarmStatsResponse = {
  /** 生成时间（epoch ms） */
  generatedAt: number
  windows: Record<AlarmStatsWindowKey, AlarmStatsWindow>
}



