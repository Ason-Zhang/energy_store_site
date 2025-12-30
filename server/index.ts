import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

import { openDb, migrate } from './db.js'
import { createDataGenerator } from './generator.js'
import { createApi } from './api.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = Number(process.env.PORT ?? 3001)
const INTERVAL_MS = Number(process.env.GENERATE_INTERVAL_MS ?? 5000)
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, 'data', 'energy-monitor.db')

const db = openDb(DB_PATH)
migrate(db)

const generator = createDataGenerator(db)
const api = createApi(db)

const app = express()
app.use(cors())
app.use(express.json())

app.use('/remote', express.static(path.join(__dirname, '..', 'remote-console')))

const REMOTE_USER = process.env.REMOTE_CONSOLE_USER ?? 'admin'
const REMOTE_PASS = process.env.REMOTE_CONSOLE_PASS ?? 'admin'
const REMOTE_SESSION_COOKIE = 'remote_session'
const remoteSessions = new Map<string, { username: string; createdAt: number }>()

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const out: Record<string, string> = {}
  if (!cookieHeader) return out
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (!k) continue
    out[k] = decodeURIComponent(v)
  }
  return out
}

const getRemoteSession = (req: express.Request): { username: string } | null => {
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[REMOTE_SESSION_COOKIE]
  if (!token) return null
  const s = remoteSessions.get(token)
  if (!s) return null
  return { username: s.username }
}

const requireRemoteAuth: express.RequestHandler = (req, res, next) => {
  const s = getRemoteSession(req)
  if (!s) return res.status(401).json({ error: 'unauthorized' })
  ;(req as unknown as { remoteUser?: string }).remoteUser = s.username
  next()
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/remote/login', (req, res) => {
  const body = (req.body ?? {}) as { username?: string; password?: string }
  const username = String(body.username ?? '')
  const password = String(body.password ?? '')
  if (!username || !password) return res.status(400).json({ error: 'bad_request' })
  if (username !== REMOTE_USER || password !== REMOTE_PASS) {
    return res.status(401).json({ error: 'invalid_credentials' })
  }
  const token = crypto.randomBytes(24).toString('hex')
  remoteSessions.set(token, { username, createdAt: Date.now() })
  res.setHeader(
    'Set-Cookie',
    `${REMOTE_SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24}`,
  )
  res.json({ ok: true, username })
})

app.get('/api/remote/me', (req, res) => {
  const s = getRemoteSession(req)
  if (!s) return res.status(401).json({ ok: false })
  res.json({ ok: true, username: s.username })
})

app.post('/api/remote/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[REMOTE_SESSION_COOKIE]
  if (token) remoteSessions.delete(token)
  res.setHeader(
    'Set-Cookie',
    `${REMOTE_SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  )
  res.json({ ok: true })
})

app.get('/api/system-status/latest', (_req, res) => {
  const data = api.getLatestSystemStatus()
  if (!data) return res.status(404).json({ error: 'no_data' })
  res.json(data)
})

app.get('/api/telemetry/latest', (_req, res) => {
  const data = api.getLatestTelemetry()
  if (!data) return res.status(404).json({ error: 'no_data' })
  res.json(data)
})

app.get('/api/alarm/latest', (_req, res) => {
  const data = api.getLatestAlarmData()
  if (!data) return res.status(404).json({ error: 'no_data' })
  res.json(data)
})

app.get('/api/alarms/recent', (req, res) => {
  const limit = Number(req.query.limit)
  const offset = Number(req.query.offset)
  res.json(
    api.getRecentAlarmOccurrences({
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    }),
  )
})

app.get('/api/alarm/stats', (_req, res) => {
  res.json(api.getAlarmStats())
})

app.get('/api/battery-groups/latest', (_req, res) => {
  res.json(api.getBatteryGroupsLatest())
})

app.get('/api/coordination-units/latest', (_req, res) => {
  res.json(api.getCoordinationUnitsLatest())
})

app.get('/api/ems/latest', (_req, res) => {
  const data = api.getLatestEmsSnapshot()
  if (!data) return res.status(404).json({ error: 'no_data' })
  res.json(data)
})

app.get('/api/ems/auto-power/decision', (req, res) => {
  const windowMs = Number(req.query.windowMs)
  res.json(
    api.getAutoPowerDecision({
      windowMs: Number.isFinite(windowMs) ? windowMs : undefined,
    }),
  )
})

app.get('/api/front-server/latest', (_req, res) => {
  const data = api.getLatestFrontServerSnapshot()
  if (!data) return res.status(404).json({ error: 'no_data' })
  res.json(data)
})

app.get('/api/plant/latest', (_req, res) => {
  const data = api.getLatestPlantSnapshot()
  if (!data) return res.status(404).json({ error: 'no_data' })
  res.json(data)
})

app.get('/api/battery-latches', (_req, res) => {
  res.json(api.getBatteryLatches())
})

app.post('/api/battery-groups/:id/reset', (req, res) => {
  const groupId = Number(req.params.id)
  if (!Number.isFinite(groupId) || groupId <= 0)
    return res.status(400).json({ error: 'bad_request' })
  const ip = req.ip
  const result = api.resetBatteryGroup(groupId, { actor: 'local', ip })
  try {
    // Publish an immediate snapshot after reset so the UI doesn't need to wait for the next interval tick.
    generator.tick()
  } catch (e) {
    console.error('[server] tick after battery reset failed:', e)
  }
  res.json(result)
})

app.post('/api/protection-devices/:name/reset', (req, res) => {
  const name = String(req.params.name ?? '')
  if (!name) return res.status(400).json({ error: 'bad_request' })
  res.json(api.resetProtectionDevice(name))
})

app.get('/api/scada/notifications/latest', (req, res) => {
  const limit = Number(req.query.limit)
  const offset = Number(req.query.offset)
  res.json(
    api.getLatestScadaNotifications({
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    }),
  )
})

app.get('/api/control-commands', (_req, res) => {
  res.json(api.getControlCommands())
})

app.get('/api/control-commands/status', (_req, res) => {
  res.json(api.getControlCommandsStatus())
})

app.post('/api/control-commands', (req, res) => {
  const ip = req.ip
  res.json(api.setControlCommands(req.body, { actor: 'local', ip }))
})

app.get('/api/remote/control-commands', requireRemoteAuth, (_req, res) => {
  res.json(api.getControlCommands())
})

app.post('/api/remote/control-commands', requireRemoteAuth, (req, res) => {
  const username = String((req as unknown as { remoteUser?: string }).remoteUser ?? '')
  const ip = req.ip
  res.json(api.setControlCommands(req.body, { actor: 'remote', username, ip }))
})

app.get('/api/remote/control-command-logs', requireRemoteAuth, (req, res) => {
  const limit = Number(req.query.limit)
  const offset = Number(req.query.offset)
  res.json(
    api.getControlCommandLogs({
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    }),
  )
})

app.get('/api/device-telemetry/latest/all', (_req, res) => {
  res.json(api.getLatestDeviceTelemetryAll())
})

app.get('/api/device-telemetry/latest', (req, res) => {
  const type = String(req.query.type ?? '')
  const id = Number(req.query.id)
  if (!type || Number.isNaN(id)) {
    return res.status(400).json({ error: 'bad_request' })
  }
  const data = api.getLatestDeviceTelemetryOne(type, id)
  if (!data) return res.status(404).json({ error: 'no_data' })
  res.json(data)
})

app.get('/api/communication/latest/all', (_req, res) => {
  res.json(api.getLatestCommunicationAll())
})

app.get('/api/communication/latest', (req, res) => {
  const type = String(req.query.type ?? '')
  const id = String(req.query.id ?? '')
  if (!type || !id) return res.status(400).json({ error: 'bad_request' })
  const data = api.getLatestCommunicationOne(type, id)
  if (!data) return res.status(404).json({ error: 'no_data' })
  res.json(data)
})

app.get('/api/device-counts', (_req, res) => {
  // 目前以“固定拓扑”为准（可按需改为从 DB 统计）
  res.json({
    batteryBins: 10,
    bms: 10,
    pcs: 10,
    frontServer: 1,
    ems: 1,
    remote: 1,
    normal: 18,
    abnormal: 2,
  })
})

const parseBucketMs = (bucket: string | undefined): number | null => {
  const b = String(bucket ?? 'raw')
  if (b === 'raw' || b === '0') return null
  const table: Record<string, number> = {
    '5s': 5_000,
    '10s': 10_000,
    '30s': 30_000,
    '1m': 60_000,
    '5m': 5 * 60_000,
    '15m': 15 * 60_000,
    '1h': 60 * 60_000,
    '6h': 6 * 60 * 60_000,
    '1d': 24 * 60 * 60_000,
  }
  return table[b] ?? null
}

const parseNum = (v: unknown): number | undefined => {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

app.get('/api/history/range', (_req, res) => {
  res.json(api.getSnapshotRange())
})

app.get('/api/history/telemetry', (req, res) => {
  const startTs = parseNum(req.query.startTs)
  const endTs = parseNum(req.query.endTs)
  const maxPoints = parseNum(req.query.maxPoints)
  const bucketMs = parseBucketMs(String(req.query.bucket ?? 'raw'))
  res.json(api.getTelemetryHistory({ startTs, endTs, maxPoints, bucketMs }))
})

app.get('/api/history/system-status', (req, res) => {
  const startTs = parseNum(req.query.startTs)
  const endTs = parseNum(req.query.endTs)
  const maxPoints = parseNum(req.query.maxPoints)
  const bucketMs = parseBucketMs(String(req.query.bucket ?? 'raw'))
  res.json(api.getSystemStatusHistory({ startTs, endTs, maxPoints, bucketMs }))
})

app.get('/api/history/alarm-snapshots', (req, res) => {
  const startTs = parseNum(req.query.startTs)
  const endTs = parseNum(req.query.endTs)
  const maxPoints = parseNum(req.query.maxPoints)
  const bucketMs = parseBucketMs(String(req.query.bucket ?? 'raw'))
  res.json(api.getAlarmSnapshotsHistory({ startTs, endTs, maxPoints, bucketMs }))
})

app.get('/api/history/device-telemetry', (req, res) => {
  const deviceType = String(req.query.type ?? '')
  const deviceId = Number(req.query.id)
  if (!deviceType || Number.isNaN(deviceId)) return res.status(400).json({ error: 'bad_request' })
  const startTs = parseNum(req.query.startTs)
  const endTs = parseNum(req.query.endTs)
  const maxPoints = parseNum(req.query.maxPoints)
  const bucketMs = parseBucketMs(String(req.query.bucket ?? 'raw'))
  res.json(
    api.getDeviceTelemetryHistory({ deviceType, deviceId, startTs, endTs, maxPoints, bucketMs }),
  )
})

app.get('/api/history/communication', (req, res) => {
  const deviceType = String(req.query.type ?? '')
  const deviceId = String(req.query.id ?? '')
  if (!deviceType || !deviceId) return res.status(400).json({ error: 'bad_request' })
  const startTs = parseNum(req.query.startTs)
  const endTs = parseNum(req.query.endTs)
  const maxPoints = parseNum(req.query.maxPoints)
  const bucketMs = parseBucketMs(String(req.query.bucket ?? 'raw'))
  res.json(
    api.getCommunicationHistory({ deviceType, deviceId, startTs, endTs, maxPoints, bucketMs }),
  )
})

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)

  console.log(`[server] db: ${DB_PATH}`)

  console.log(`[server] generate interval: ${INTERVAL_MS}ms`)

  // Ensure there is at least one snapshot on boot (run after listen to avoid blocking startup)
  setTimeout(() => {
    try {
      generator.tick()
    } catch (e) {
      console.error('[server] initial tick failed:', e)
    }
  }, 0)

  setInterval(() => {
    try {
      generator.tick()
    } catch (e) {
      console.error('[server] tick failed:', e)
    }
  }, INTERVAL_MS)
})
