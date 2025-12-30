export type CommStatus = 'normal' | 'warning' | 'error'

export type CommProtocol = 'ModbusTCP' | 'IEC61850' | 'IEC104' | 'InternalBus'

export type CommDirection = 'uplink' | 'downlink'

export type DeviceType = 'battery' | 'bms' | 'pcs' | 'ccu' | 'frontServer' | 'ems' | 'remote'

export type DeviceKey = `${DeviceType}-${string}`

export type LinkKey = string

export type LinkEndpoint = {
  type: DeviceType
  id: string
  name: string
}

export type LinkDef = {
  key: LinkKey
  protocol: CommProtocol
  a: LinkEndpoint
  b: LinkEndpoint
  // For visualization; protocol can still be bidirectional.
  primaryDirection?: { from: DeviceKey; to: DeviceKey }

  // Error injection (for demo/testing)
  dropRate?: number
  corruptRate?: number
  latencyMsMin?: number
  latencyMsMax?: number
}

export type FrameRecord = {
  ts: number
  tsText: string
  linkKey: LinkKey
  protocol: CommProtocol
  direction: CommDirection
  from: DeviceKey
  to: DeviceKey
  ok: boolean
  status: CommStatus
  latencyMs: number
  bytes: number
  summary: string
  payloadHex: string
  error?: string
}

export type SendPayload = {
  linkKey: LinkKey
  protocol: CommProtocol
  from: DeviceKey
  to: DeviceKey
  direction: CommDirection
  payload: Buffer
  summary: string
}

export type ReceiveHandler = (msg: {
  linkKey: LinkKey
  protocol: CommProtocol
  from: DeviceKey
  to: DeviceKey
  direction: CommDirection
  payload: Buffer
  ts: number
  tsText: string
  latencyMs: number
  corrupted: boolean
}) => {
  ok: boolean
  status: CommStatus
  error?: string
  response?: { payload: Buffer; summary: string }
}

const random = (min: number, max: number) => Math.random() * (max - min) + min

const randomInt = (min: number, max: number) => Math.floor(random(min, max))

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

const fmtTs = (ms: number) =>
  new Date(ms).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

const hex = (buf: Buffer) => buf.toString('hex').toUpperCase()

export class VirtualBus {
  private readonly links = new Map<LinkKey, LinkDef>()
  private readonly handlers = new Map<DeviceKey, ReceiveHandler>()

  registerLink(def: LinkDef) {
    this.links.set(def.key, def)
  }

  registerDevice(key: DeviceKey, handler: ReceiveHandler) {
    this.handlers.set(key, handler)
  }

  listLinks(): LinkDef[] {
    return Array.from(this.links.values())
  }

  send(params: SendPayload, ts: number, outFrames: FrameRecord[]): void {
    const link = this.links.get(params.linkKey)
    if (!link) {
      outFrames.push({
        ts,
        tsText: fmtTs(ts),
        linkKey: params.linkKey,
        protocol: params.protocol,
        direction: params.direction,
        from: params.from,
        to: params.to,
        ok: false,
        status: 'error',
        latencyMs: 0,
        bytes: params.payload.length,
        summary: params.summary,
        payloadHex: hex(params.payload),
        error: 'link_not_found',
      })
      return
    }

    const dropRate = clamp01(link.dropRate ?? 0)
    const corruptRate = clamp01(link.corruptRate ?? 0)
    const latencyMsMin = Math.max(0, link.latencyMsMin ?? 3)
    const latencyMsMax = Math.max(latencyMsMin, link.latencyMsMax ?? 30)
    const latencyMs = randomInt(latencyMsMin, latencyMsMax + 1)

    // TX record
    outFrames.push({
      ts,
      tsText: fmtTs(ts),
      linkKey: params.linkKey,
      protocol: params.protocol,
      direction: params.direction,
      from: params.from,
      to: params.to,
      ok: true,
      status: 'normal',
      latencyMs,
      bytes: params.payload.length,
      summary: `TX ${params.summary}`,
      payloadHex: hex(params.payload),
    })

    if (Math.random() < dropRate) {
      outFrames.push({
        ts,
        tsText: fmtTs(ts),
        linkKey: params.linkKey,
        protocol: params.protocol,
        direction: params.direction,
        from: params.from,
        to: params.to,
        ok: false,
        status: 'error',
        latencyMs,
        bytes: params.payload.length,
        summary: `DROP ${params.summary}`,
        payloadHex: hex(params.payload),
        error: 'dropped',
      })
      return
    }

    const handler = this.handlers.get(params.to)
    if (!handler) {
      outFrames.push({
        ts,
        tsText: fmtTs(ts),
        linkKey: params.linkKey,
        protocol: params.protocol,
        direction: params.direction,
        from: params.from,
        to: params.to,
        ok: false,
        status: 'error',
        latencyMs,
        bytes: params.payload.length,
        summary: `RX ${params.summary}`,
        payloadHex: hex(params.payload),
        error: 'target_unreachable',
      })
      return
    }

    const corrupted = Math.random() < corruptRate
    const rxPayload = corrupted ? corrupt(params.payload) : params.payload

    const res = handler({
      linkKey: params.linkKey,
      protocol: params.protocol,
      from: params.from,
      to: params.to,
      direction: params.direction,
      payload: rxPayload,
      ts,
      tsText: fmtTs(ts),
      latencyMs,
      corrupted,
    })

    outFrames.push({
      ts,
      tsText: fmtTs(ts),
      linkKey: params.linkKey,
      protocol: params.protocol,
      direction: params.direction,
      from: params.from,
      to: params.to,
      ok: res.ok,
      status: res.status,
      latencyMs,
      bytes: rxPayload.length,
      summary: `RX ${params.summary}`,
      payloadHex: hex(rxPayload),
      error: res.error,
    })

    if (res.response) {
      // For response direction, swap endpoints
      this.send(
        {
          linkKey: params.linkKey,
          protocol: params.protocol,
          from: params.to,
          to: params.from,
          direction: params.direction === 'uplink' ? 'downlink' : 'uplink',
          payload: res.response.payload,
          summary: res.response.summary,
        },
        ts,
        outFrames,
      )
    }
  }
}

function corrupt(buf: Buffer): Buffer {
  if (buf.length === 0) return buf
  const out = Buffer.from(buf)
  const count = Math.max(1, Math.min(3, Math.floor(out.length / 8)))
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * out.length)
    out[idx] = out[idx] ^ (1 << (Math.floor(Math.random() * 8) & 7))
  }
  return out
}
