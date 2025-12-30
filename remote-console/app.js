const $ = (id) => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing element: ${id}`)
  return el
}

function alarmSeverityRank(level) {
  const lv = String(level || '').toLowerCase()
  if (lv === 'critical' || lv === 'crit' || lv === 'error') return 3
  if (lv === 'warning' || lv === 'warn') return 2
  return 1
}

function alarmTs(a) {
  const v = a?.ts ?? a?.timestamp
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const t = Date.parse(v)
    return Number.isFinite(t) ? t : 0
  }
  return 0
}

function sortedAlarmList(raw) {
  const arr = Array.isArray(raw) ? [...raw] : []
  if (alarmSortMode === 'severity') {
    arr.sort((a, b) => {
      const ra = alarmSeverityRank(a?.level)
      const rb = alarmSeverityRank(b?.level)
      if (ra !== rb) return rb - ra
      return alarmTs(b) - alarmTs(a)
    })
    return arr
  }
  // default: time desc
  arr.sort((a, b) => alarmTs(b) - alarmTs(a))
  return arr
}

const ui = {
  connPill: $('connPill'),
  refreshLabel: $('refreshLabel'),
  localMonitorLink: $('localMonitorLink'),
  userLabel: $('userLabel'),
  logoutBtn: $('logoutBtn'),
  sysStatusChip: $('sysStatusChip'),
  powerKw: $('powerKw'),
  powerHint: $('powerHint'),
  voltageV: $('voltageV'),
  currentA: $('currentA'),
  socPct: $('socPct'),
  socBar: $('socBar'),
  tempC: $('tempC'),
  alarmTotal: $('alarmTotal'),
  alarmCrit: $('alarmCrit'),
  alarmWarn: $('alarmWarn'),
  alarmInfo: $('alarmInfo'),
  alarmList: $('alarmList'),
  alarmSort: $('alarmSort'),
  sparkPower: $('sparkPower'),
  sparkVoltage: $('sparkVoltage'),
  sparkCurrent: $('sparkCurrent'),
  cmdSyncChip: $('cmdSyncChip'),
  agcEnabled: $('agcEnabled'),
  avcEnabled: $('avcEnabled'),
  manualEnabled: $('manualEnabled'),
  allOffBtn: $('allOffBtn'),
  agcTarget: $('agcTarget'),
  agcRamp: $('agcRamp'),
  agcDeadband: $('agcDeadband'),
  avcTarget: $('avcTarget'),
  avcMin: $('avcMin'),
  avcMax: $('avcMax'),
  manualTarget: $('manualTarget'),
  manualTargetLabel: $('manualTargetLabel'),
  applyBtn: $('applyBtn'),
  reloadBtn: $('reloadBtn'),
  applyNote: $('applyNote'),
  logReloadBtn: $('logReloadBtn'),
  logList: $('logList'),
}

const historyMax = 30
const history = {
  powerKw: [],
  voltageV: [],
  currentA: [],
}

let alarmSortMode = 'time'

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

function fmt(n, digits = 1) {
  if (!Number.isFinite(n)) return '--'
  return n.toFixed(digits)
}

function setConn(ok) {
  ui.connPill.classList.remove('ok', 'bad')
  ui.connPill.textContent = ok ? 'ONLINE' : 'OFFLINE'
  ui.connPill.classList.add(ok ? 'ok' : 'bad')
}

function setSysStatus(status) {
  ui.sysStatusChip.classList.remove('chip--ok', 'chip--warn', 'chip--bad')
  if (status === 'normal') {
    ui.sysStatusChip.textContent = '系统：正常'
    ui.sysStatusChip.classList.add('chip--ok')
  } else if (status === 'warning') {
    ui.sysStatusChip.textContent = '系统：告警'
    ui.sysStatusChip.classList.add('chip--warn')
  } else if (status === 'error') {
    ui.sysStatusChip.textContent = '系统：故障'
    ui.sysStatusChip.classList.add('chip--bad')
  } else {
    ui.sysStatusChip.textContent = '系统：--'
  }
}

function polylinePoints(arr) {
  if (!arr.length) return ''
  const w = 240
  const h = 64
  const pad = 6
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const span = max - min || 1
  const step = (w - pad * 2) / Math.max(1, arr.length - 1)
  return arr
    .map((v, i) => {
      const x = pad + i * step
      const y = h - pad - ((v - min) / span) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function pushHistory(key, v) {
  const a = history[key]
  a.push(v)
  while (a.length > historyMax) a.shift()
}

function renderSparks() {
  ui.sparkPower.setAttribute('points', polylinePoints(history.powerKw))
  ui.sparkVoltage.setAttribute('points', polylinePoints(history.voltageV))
  ui.sparkCurrent.setAttribute('points', polylinePoints(history.currentA))
}

async function fetchJson(url, opts) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${url}`)
    err.status = res.status
    throw err
  }
  return await res.json()
}

function toLogin() {
  const next = `${location.pathname}${location.search}`
  location.href = `/remote/login.html?next=${encodeURIComponent(next)}`
}

async function requireAuth() {
  try {
    const me = await fetchJson('/api/remote/me')
    if (!me?.ok) return toLogin()
    ui.userLabel.textContent = String(me.username || '--')
  } catch {
    return toLogin()
  }
}

async function logout() {
  try {
    await fetchJson('/api/remote/logout', { method: 'POST' })
  } catch {
    // ignore
  }
  toLogin()
}

function fmtLogTs(ts) {
  try {
    return new Date(ts).toLocaleString('zh-CN')
  } catch {
    return String(ts)
  }
}

function summarizeMode(cmd) {
  const parts = []
  if (cmd?.agc?.enabled) parts.push(`AGC · ${Number(cmd.agc.targetPower ?? 0)} kW`)
  if (cmd?.avc?.enabled) parts.push(`AVC · ${Number(cmd.avc.targetVoltage ?? 0)} V`)
  if (cmd?.manualPower?.enabled) parts.push(`手动 · ${Number(cmd.manualPower.targetPower ?? 0)} kW`)
  return parts.length ? parts.join(' | ') : '全部关闭'
}

async function refreshLogs() {
  try {
    const items = await fetchJson('/api/remote/control-command-logs?limit=30&offset=0')
    ui.logList.innerHTML = ''
    if (!Array.isArray(items) || items.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'logItem logItem--empty'
      empty.textContent = '暂无下发记录'
      ui.logList.appendChild(empty)
      return
    }

    for (const it of items) {
      const wrap = document.createElement('div')
      wrap.className = 'logItem'

      const top = document.createElement('div')
      top.className = 'logItem__top'

      const ts = document.createElement('div')
      ts.className = 'logItem__ts'
      ts.textContent = fmtLogTs(it.ts)

      const who = document.createElement('div')
      who.className = 'logItem__who'
      const actor = String(it.actor || '')
      const uname = it.username ? `/${String(it.username)}` : ''
      who.textContent = `${actor}${uname}`

      const msg = document.createElement('div')
      msg.className = 'logItem__msg'
      msg.textContent = summarizeMode(it.commands)

      top.appendChild(ts)
      top.appendChild(who)
      wrap.appendChild(top)
      wrap.appendChild(msg)
      ui.logList.appendChild(wrap)
    }
  } catch (e) {
    if (e && e.status === 401) {
      toLogin()
      return
    }
    ui.logList.innerHTML = ''
    const empty = document.createElement('div')
    empty.className = 'logItem logItem--empty'
    empty.textContent = '日志读取失败'
    ui.logList.appendChild(empty)
  }
}

function readEnabledFlags() {
  return {
    agc: Boolean(ui.agcEnabled.checked),
    avc: Boolean(ui.avcEnabled.checked),
    manual: Boolean(ui.manualEnabled.checked),
  }
}

function applyEnabledFlags(flags) {
  ui.agcEnabled.checked = Boolean(flags?.agc)
  ui.avcEnabled.checked = Boolean(flags?.avc)
  ui.manualEnabled.checked = Boolean(flags?.manual)
}

function isFormEditing() {
  const a = document.activeElement
  return (
    a === ui.agcEnabled ||
    a === ui.avcEnabled ||
    a === ui.manualEnabled ||
    a === ui.agcTarget ||
    a === ui.agcRamp ||
    a === ui.agcDeadband ||
    a === ui.avcTarget ||
    a === ui.avcMin ||
    a === ui.avcMax ||
    a === ui.manualTarget
  )
}

function applyCommandsToForm(cmd, opts = {}) {
  const syncTargets = opts.syncTargets !== false
  const syncAvcRange = opts.syncAvcRange !== false
  const syncManualTarget = opts.syncManualTarget !== false

  if (syncTargets && document.activeElement !== ui.agcTarget)
    ui.agcTarget.value = String(cmd.agc.targetPower ?? 0)
  if (document.activeElement !== ui.agcRamp) ui.agcRamp.value = String(cmd.agc.rampRate ?? 10)
  if (document.activeElement !== ui.agcDeadband)
    ui.agcDeadband.value = String(cmd.agc.deadband ?? 5)

  if (syncTargets && document.activeElement !== ui.avcTarget)
    ui.avcTarget.value = String(cmd.avc.targetVoltage ?? 400)
  if (syncAvcRange && document.activeElement !== ui.avcMin)
    ui.avcMin.value = String(cmd.avc.voltageRange?.min ?? 380)
  if (syncAvcRange && document.activeElement !== ui.avcMax)
    ui.avcMax.value = String(cmd.avc.voltageRange?.max ?? 420)

  const manual = Number(cmd.manualPower.targetPower ?? 0)
  if (syncManualTarget && document.activeElement !== ui.manualTarget)
    ui.manualTarget.value = String(manual)
  ui.manualTargetLabel.textContent = `${ui.manualTarget.value} kW`

  if (document.activeElement !== ui.agcEnabled) ui.agcEnabled.checked = Boolean(cmd?.agc?.enabled)
  if (document.activeElement !== ui.avcEnabled) ui.avcEnabled.checked = Boolean(cmd?.avc?.enabled)
  if (document.activeElement !== ui.manualEnabled)
    ui.manualEnabled.checked = Boolean(cmd?.manualPower?.enabled)
}

function buildCommandsFromForm(prev) {
  const flags = readEnabledFlags()

  // Power control source must be unique: manual vs AGC.
  // If both are checked, manual wins and we force AGC off.
  if (flags.manual && flags.agc) {
    flags.agc = false
    ui.agcEnabled.checked = false
  }

  const next = {
    agc: {
      enabled: Boolean(flags.agc),
      targetPower: Number(ui.agcTarget.value || 0),
      rampRate: Number(ui.agcRamp.value || 10),
      deadband: Number(ui.agcDeadband.value || 5),
    },
    avc: {
      enabled: Boolean(flags.avc),
      targetVoltage: Number(ui.avcTarget.value || 400),
      voltageRange: {
        min: Number(ui.avcMin.value || 380),
        max: Number(ui.avcMax.value || 420),
      },
    },
    manualPower: {
      enabled: Boolean(flags.manual),
      targetPower: Number(ui.manualTarget.value || 0),
    },
  }

  if (next.avc.voltageRange.min > next.avc.voltageRange.max) {
    ;[next.avc.voltageRange.min, next.avc.voltageRange.max] = [
      next.avc.voltageRange.max,
      next.avc.voltageRange.min,
    ]
  }

  // Preserve any future keys if backend adds them
  return { ...(prev || {}), ...next }
}

function setupToggleExclusivity() {
  ui.agcEnabled.addEventListener('change', () => {
    if (ui.agcEnabled.checked && ui.manualEnabled.checked) {
      ui.manualEnabled.checked = false
    }
  })
  ui.manualEnabled.addEventListener('change', () => {
    if (ui.manualEnabled.checked && ui.agcEnabled.checked) {
      ui.agcEnabled.checked = false
    }
  })
  ui.allOffBtn.addEventListener('click', () => {
    applyEnabledFlags({ agc: false, avc: false, manual: false })
  })
}

let lastCommands = null
let suppressFormSyncUntil = 0

function markUserEditing() {
  suppressFormSyncUntil = Date.now() + 4000
}

async function refreshOnce() {
  const startedAt = Date.now()
  try {
    const [systemStatus, telemetry, alarmData, deviceCounts, controlCommands] = await Promise.all([
      fetchJson('/api/system-status/latest'),
      fetchJson('/api/telemetry/latest'),
      fetchJson('/api/alarm/latest'),
      fetchJson('/api/device-counts'),
      fetchJson('/api/remote/control-commands'),
    ])

    setConn(true)

    setSysStatus(systemStatus.status)

    const voltage = Number(telemetry.averageVoltage)
    const current = Number(telemetry.totalCurrent)
    const powerKw = (voltage * current) / 1000

    ui.powerKw.textContent = fmt(powerKw, 1)
    ui.voltageV.textContent = fmt(voltage, 1)
    ui.currentA.textContent = fmt(current, 1)
    ui.socPct.textContent = String(telemetry.systemSOC ?? '--')
    ui.tempC.textContent = String(telemetry.averageTemperature ?? '--')

    const soc = clamp(Number(telemetry.systemSOC ?? 0), 0, 100)
    ui.socBar.style.width = `${soc}%`

    ui.alarmTotal.textContent = String(alarmData.totalAlarms ?? 0)
    ui.alarmCrit.textContent = String(alarmData.criticalAlarms ?? 0)
    ui.alarmWarn.textContent = String(alarmData.warningAlarms ?? 0)
    ui.alarmInfo.textContent = String(alarmData.infoAlarms ?? 0)

    const target = controlCommands.manualPower?.enabled
      ? Number(controlCommands.manualPower.targetPower ?? 0)
      : controlCommands.agc?.enabled
        ? Number(controlCommands.agc.targetPower ?? 0)
        : 0

    const diff = powerKw - target
    ui.powerHint.textContent = `目标 ${fmt(target, 1)} kW · 偏差 ${fmt(diff, 1)} kW`

    // Alarm list (top 8)
    const list = sortedAlarmList(alarmData.alarmList).slice(0, 8)
    ui.alarmList.innerHTML = ''
    if (!list.length) {
      const empty = document.createElement('div')
      empty.className = 'alarm'
      empty.textContent = '暂无告警'
      ui.alarmList.appendChild(empty)
    } else {
      for (const a of list) {
        const wrap = document.createElement('div')
        wrap.className = 'alarm'

        const top = document.createElement('div')
        top.className = 'alarm__top'

        const lv = document.createElement('div')
        lv.className = `alarm__lv ${a.level || 'info'}`
        lv.textContent = String(a.level || 'info').toUpperCase()

        const t = document.createElement('div')
        t.className = 'alarm__t'
        t.textContent = String(a.timestamp || '')

        const msg = document.createElement('div')
        msg.className = 'alarm__msg'
        msg.textContent = `${a.device || ''} · ${a.type || ''} · ${a.description || ''}`.trim()

        top.appendChild(lv)
        top.appendChild(t)
        wrap.appendChild(top)
        wrap.appendChild(msg)
        ui.alarmList.appendChild(wrap)
      }
    }

    // History
    pushHistory('powerKw', Number.isFinite(powerKw) ? powerKw : 0)
    pushHistory('voltageV', Number.isFinite(voltage) ? voltage : 0)
    pushHistory('currentA', Number.isFinite(current) ? current : 0)
    renderSparks()

    // Show counts in title tooltips (lightweight)
    ui.sysStatusChip.title = `负载 ${systemStatus.load ?? '--'}% · 总功率 ${systemStatus.totalPower ?? '--'}kW · 运行 ${systemStatus.runTime ?? '--'}`

    // Only update form from backend when commands changed (avoid fighting user input)
    const cmdJson = JSON.stringify(controlCommands)
    if (!lastCommands || JSON.stringify(lastCommands) !== cmdJson) {
      lastCommands = controlCommands
      if (!isFormEditing() && Date.now() >= suppressFormSyncUntil) {
        applyCommandsToForm(controlCommands, {
          syncTargets: false,
          syncAvcRange: false,
          syncManualTarget: false,
        })
      }
    }

    ui.cmdSyncChip.classList.remove('chip--warn', 'chip--bad')
    ui.cmdSyncChip.classList.add('chip--ok')
    ui.cmdSyncChip.textContent = 'SYNC'

    const cost = Date.now() - startedAt
    ui.refreshLabel.textContent = `${telemetry.currentTime || new Date().toLocaleString('zh-CN')} · ${cost}ms`

    void deviceCounts
  } catch (e) {
    if (e && e.status === 401) {
      toLogin()
      return
    }
    void e
    setConn(false)
    ui.cmdSyncChip.classList.remove('chip--ok')
    ui.cmdSyncChip.classList.add('chip--bad')
    ui.cmdSyncChip.textContent = 'NO API'
    ui.refreshLabel.textContent = new Date().toLocaleString('zh-CN')
  }
}

async function applyControl() {
  ui.applyBtn.disabled = true
  ui.applyNote.textContent = '下发中…'
  ui.cmdSyncChip.classList.remove('chip--ok', 'chip--bad')
  ui.cmdSyncChip.classList.add('chip--warn')
  ui.cmdSyncChip.textContent = 'SENDING'

  try {
    const prev = lastCommands
    const next = buildCommandsFromForm(prev)
    const saved = await fetchJson('/api/remote/control-commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(next),
    })

    lastCommands = saved
    suppressFormSyncUntil = 0
    applyCommandsToForm(saved)

    ui.applyNote.textContent = `已下发：${new Date().toLocaleTimeString('zh-CN')}`

    ui.cmdSyncChip.classList.remove('chip--warn')
    ui.cmdSyncChip.classList.add('chip--ok')
    ui.cmdSyncChip.textContent = 'SYNC'

    void refreshLogs()
  } catch (e) {
    void e
    ui.applyNote.textContent = '下发失败：请确认后端已启动。'
    ui.cmdSyncChip.classList.remove('chip--warn')
    ui.cmdSyncChip.classList.add('chip--bad')
    ui.cmdSyncChip.textContent = 'FAILED'
  } finally {
    ui.applyBtn.disabled = false
  }
}

function wireUi() {
  const editEls = [
    ui.agcEnabled,
    ui.avcEnabled,
    ui.manualEnabled,
    ui.agcTarget,
    ui.agcRamp,
    ui.agcDeadband,
    ui.avcTarget,
    ui.avcMin,
    ui.avcMax,
    ui.manualTarget,
  ]

  if (!ui.agcTarget.value) ui.agcTarget.value = '0'
  if (!ui.avcTarget.value) ui.avcTarget.value = '400'
  if (!ui.avcMin.value) ui.avcMin.value = '380'
  if (!ui.avcMax.value) ui.avcMax.value = '420'
  if (!ui.manualTarget.value) ui.manualTarget.value = '0'
  ui.manualTargetLabel.textContent = `${ui.manualTarget.value} kW`

  editEls.forEach((el) => {
    el.addEventListener('focus', () => markUserEditing())
    el.addEventListener('input', () => markUserEditing())
    el.addEventListener('change', () => markUserEditing())
  })

  const numericInputs = [
    ui.agcTarget,
    ui.agcRamp,
    ui.agcDeadband,
    ui.avcTarget,
    ui.avcMin,
    ui.avcMax,
    ui.manualTarget,
  ]
  numericInputs.forEach((el) => {
    el.addEventListener('keydown', () => markUserEditing())
    el.addEventListener(
      'wheel',
      () => {
        // Some browsers allow wheel to change <input type="number"> value without focus,
        // so we treat wheel as active editing and keep focus on the input.
        markUserEditing()
        try {
          el.focus({ preventScroll: true })
        } catch {
          el.focus()
        }
      },
      { passive: true },
    )
  })

  ui.manualTarget.addEventListener('input', () => {
    ui.manualTargetLabel.textContent = `${ui.manualTarget.value} kW`
  })

  setupToggleExclusivity()

  ui.applyBtn.addEventListener('click', () => void applyControl())
  ui.reloadBtn.addEventListener('click', () => void ((lastCommands = null), refreshOnce()))
  ui.logReloadBtn.addEventListener('click', () => void refreshLogs())
  ui.logoutBtn.addEventListener('click', () => void logout())

  ui.alarmSort.addEventListener('change', () => {
    alarmSortMode = String(ui.alarmSort.value || 'time')
    void refreshOnce()
  })

  document.querySelectorAll('button[data-quick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = Number(btn.getAttribute('data-quick') || 0)
      ui.manualTarget.value = String(v)
      ui.manualTargetLabel.textContent = `${v} kW`
      ui.manualEnabled.checked = true
      ui.agcEnabled.checked = false
    })
  })
}

wireUi()

// In dev setup, backend serves this page at :3001 while local monitor runs on Vite :5173.
// Provide a sensible default so cross-page navigation works without additional config.
try {
  if (location.port === '3001') {
    ui.localMonitorLink.href = `${location.protocol}//${location.hostname}:5173/`
  } else {
    ui.localMonitorLink.href = `${location.origin}/`
  }
} catch {
  // ignore
}

// Start
let refreshTimer = null

window.addEventListener('beforeunload', () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})

void requireAuth().then(() => {
  void refreshLogs()
  void refreshOnce()
  refreshTimer = setInterval(() => void refreshOnce(), 2000)
})
