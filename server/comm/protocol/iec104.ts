import type { CommDirection, CommStatus } from '../virtualBus.js'

export type Iec104Frame = {
  type: 'I'
  direction: CommDirection
  ioa: number
  asduType: string
  cot: string
  value: string
}

// This is a simplified IEC 60870-5-104 framing for demo/visualization.
// We still emit bytes so the link can carry Buffer and be logged.
export function encodeIFrame(f: Iec104Frame): Buffer {
  const payload = JSON.stringify(f)
  const p = Buffer.from(payload, 'utf8')
  const apci = Buffer.alloc(2)
  apci.writeUInt8(0x68, 0)
  apci.writeUInt8(Math.min(255, p.length + 4), 1)
  const ctrl = Buffer.from([0x00, 0x00, 0x00, 0x00])
  return Buffer.concat([apci, ctrl, p])
}

export function decodeIFrame(buf: Buffer): Iec104Frame {
  if (buf.length < 6) throw new Error('iec104: short')
  if (buf.readUInt8(0) !== 0x68) throw new Error('iec104: bad_start')
  const json = buf.subarray(6).toString('utf8')
  const obj = JSON.parse(json) as Iec104Frame
  if (!obj || obj.type !== 'I') throw new Error('iec104: bad_payload')
  return obj
}

export function statusFromQuality(ok: boolean): CommStatus {
  return ok ? 'normal' : 'error'
}
