import type { CommStatus } from '../virtualBus.js'

export type ModbusTcpRequest = {
  type: 'readHoldingRegisters'
  transactionId: number
  unitId: number
  start: number
  quantity: number
}

export type ModbusTcpResponse =
  | { type: 'readHoldingRegisters'; transactionId: number; unitId: number; values: number[] }
  | {
      type: 'exception'
      transactionId: number
      unitId: number
      functionCode: number
      exceptionCode: number
    }

export function encodeReadHoldingRegisters(params: {
  transactionId: number
  unitId: number
  start: number
  quantity: number
}): Buffer {
  const pdu = Buffer.alloc(5)
  pdu.writeUInt8(0x03, 0)
  pdu.writeUInt16BE(params.start & 0xffff, 1)
  pdu.writeUInt16BE(params.quantity & 0xffff, 3)

  // MBAP: tid(2) pid(2) len(2) uid(1)
  const mbap = Buffer.alloc(7)
  mbap.writeUInt16BE(params.transactionId & 0xffff, 0)
  mbap.writeUInt16BE(0x0000, 2)
  mbap.writeUInt16BE(pdu.length + 1, 4)
  mbap.writeUInt8(params.unitId & 0xff, 6)

  return Buffer.concat([mbap, pdu])
}

export function decodeRequest(buf: Buffer): ModbusTcpRequest {
  if (buf.length < 8) throw new Error('modbus_tcp: short_frame')
  const transactionId = buf.readUInt16BE(0)
  const protocolId = buf.readUInt16BE(2)
  if (protocolId !== 0x0000) throw new Error('modbus_tcp: bad_protocol_id')
  const len = buf.readUInt16BE(4)
  const unitId = buf.readUInt8(6)
  const pdu = buf.subarray(7)
  if (len !== pdu.length + 1) {
    throw new Error('modbus_tcp: bad_length')
  }
  const fc = pdu.readUInt8(0)
  if (fc === 0x03) {
    if (pdu.length < 5) throw new Error('modbus_tcp: bad_pdu_len')
    const start = pdu.readUInt16BE(1)
    const quantity = pdu.readUInt16BE(3)
    return { type: 'readHoldingRegisters', transactionId, unitId, start, quantity }
  }
  throw new Error(`modbus_tcp: unsupported_fc_${fc}`)
}

export function encodeResponse(res: ModbusTcpResponse): Buffer {
  if (res.type === 'exception') {
    const pdu = Buffer.alloc(3)
    pdu.writeUInt8((res.functionCode & 0xff) | 0x80, 0)
    pdu.writeUInt8(res.exceptionCode & 0xff, 1)
    pdu.writeUInt8(0, 2)

    const mbap = Buffer.alloc(7)
    mbap.writeUInt16BE(res.transactionId & 0xffff, 0)
    mbap.writeUInt16BE(0x0000, 2)
    mbap.writeUInt16BE(pdu.length + 1, 4)
    mbap.writeUInt8(res.unitId & 0xff, 6)
    return Buffer.concat([mbap, pdu.subarray(0, 2)])
  }

  const byteCount = res.values.length * 2
  const pdu = Buffer.alloc(2 + byteCount)
  pdu.writeUInt8(0x03, 0)
  pdu.writeUInt8(byteCount & 0xff, 1)
  for (let i = 0; i < res.values.length; i++) {
    pdu.writeUInt16BE(res.values[i] & 0xffff, 2 + i * 2)
  }

  const mbap = Buffer.alloc(7)
  mbap.writeUInt16BE(res.transactionId & 0xffff, 0)
  mbap.writeUInt16BE(0x0000, 2)
  mbap.writeUInt16BE(pdu.length + 1, 4)
  mbap.writeUInt8(res.unitId & 0xff, 6)
  return Buffer.concat([mbap, pdu])
}

export function decodeResponse(buf: Buffer): ModbusTcpResponse {
  if (buf.length < 8) throw new Error('modbus_tcp: short_frame')
  const transactionId = buf.readUInt16BE(0)
  const protocolId = buf.readUInt16BE(2)
  if (protocolId !== 0x0000) throw new Error('modbus_tcp: bad_protocol_id')
  const len = buf.readUInt16BE(4)
  const unitId = buf.readUInt8(6)
  const pdu = buf.subarray(7)
  if (len !== pdu.length + 1) throw new Error('modbus_tcp: bad_length')
  const fc = pdu.readUInt8(0)

  if (fc === 0x03) {
    const byteCount = pdu.readUInt8(1)
    const values: number[] = []
    for (let i = 0; i < byteCount / 2; i++) {
      const off = 2 + i * 2
      if (off + 2 > pdu.length) throw new Error('modbus_tcp: bad_byte_count')
      values.push(pdu.readUInt16BE(off))
    }
    return { type: 'readHoldingRegisters', transactionId, unitId, values }
  }

  if ((fc & 0x80) !== 0) {
    const original = fc & 0x7f
    const exceptionCode = pdu.readUInt8(1)
    return { type: 'exception', transactionId, unitId, functionCode: original, exceptionCode }
  }

  throw new Error(`modbus_tcp: unsupported_fc_${fc}`)
}

export function statusFromException(): CommStatus {
  return 'error'
}
