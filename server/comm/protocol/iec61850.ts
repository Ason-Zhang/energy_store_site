import type { CommDirection } from '../virtualBus.js'

export type Iec61850Message = {
  service: 'MMS' | 'GOOSE'
  direction: CommDirection
  dataset: string
  entries: Array<{ key: string; value: string; quality: 'GOOD' | 'QUESTIONABLE' | 'INVALID' }>
}

// IEC 61850 is complex; for this project we simulate the transport as bytes
// carrying a structured message that behaves like station-bus reporting.
export function encodeMessage(m: Iec61850Message): Buffer {
  const payload = JSON.stringify(m)
  const header = Buffer.from('IEC61850', 'ascii')
  const p = Buffer.from(payload, 'utf8')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(p.length, 0)
  return Buffer.concat([header, len, p])
}

export function decodeMessage(buf: Buffer): Iec61850Message {
  if (buf.length < 12) throw new Error('iec61850: short')
  const magic = buf.subarray(0, 8).toString('ascii')
  if (magic !== 'IEC61850') throw new Error('iec61850: bad_magic')
  const len = buf.readUInt32BE(8)
  const json = buf.subarray(12, 12 + len).toString('utf8')
  const obj = JSON.parse(json) as Iec61850Message
  if (!obj || !obj.service) throw new Error('iec61850: bad_payload')
  return obj
}
