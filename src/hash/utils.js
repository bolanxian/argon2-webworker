
const { apply } = Reflect
const { bind: _bind, call: _call } = Function.prototype
export const bindCall = apply(_bind, _bind, [_call])
export const bind = bindCall(_bind), call = bindCall(_call)

const { parseInt } = Number, fromU8 = bind(Uint8Array.from, Uint8Array)
export const numToStr = bindCall(Number.prototype.toString)
export const padStart = bindCall(String.prototype.padStart)
export const match = bindCall(RegExp.prototype[Symbol.match])
export const replace = bindCall(RegExp.prototype[Symbol.replace])
const hexToBufReg = /[\da-f]{2}/gi, hexToBufCb = h => parseInt(h, 16)
export const hexToBuf = hex => fromU8(match(hexToBufReg, hex), hexToBufCb)
export const bufToHex = buf => {
  let str = ''; for (const a of buf) {
    str += padStart(numToStr(a & 0xFF, 16), 2, '0')
  }
  return str
}

const { getOwnPropertyDescriptor: getPropDesc } = Object
const EventTargetProto = EventTarget.prototype
export const on = bindCall(EventTargetProto.addEventListener)
export const off = bindCall(EventTargetProto.removeEventListener)

const $fetch = fetch
export { $fetch as fetch }
export const respToBuffer = bindCall(Response.prototype.arrayBuffer)
const Reader = FileReader, ReaderProto = Reader.prototype
const _getResult = getPropDesc(ReaderProto, 'result').get
const _getError = getPropDesc(ReaderProto, 'error').get
const _readAsDataURL = ReaderProto.readAsDataURL
export const readAsDataURL = (blob) => new Promise((ok, reject) => {
  const reader = new Reader()
  on(reader, 'load', e => {
    try { ok(call(_getResult, reader)) } catch (e) { reject(e) }
  })
  on(reader, 'error', e => {
    try { reject(call(_getError, reader)) } catch (e) { reject(e) }
  })
  call(_readAsDataURL, reader, blob)
})
const dataReg = /^data:application\/octet-stream;base64,([A-Za-z\d+/]*)=*$/
const dataPre = 'data:application/octet-stream;base64,'
export const encodeBase64Async = async (...args) => replace(dataReg, await readAsDataURL(new Blob(args)), '$1')
export const decodeBase64Async = async (data) => respToBuffer(await $fetch(dataPre + data))

export const { compileStreaming, instantiate, Memory, Module, Instance } = WebAssembly
export const compileFetch = (url, init) => compileStreaming(fetch(url, init))
export const getMemoryBuffer = bindCall(getPropDesc(Memory.prototype, 'buffer').get)
export const getInstanceExports = bindCall(getPropDesc(Instance.prototype, 'exports').get)

const Encoder = TextEncoder, EncoderProto = Encoder.prototype
const encoder = new Encoder()
const encode = bind(EncoderProto.encode, encoder)
const encodeInto = bind(EncoderProto.encodeInto, encoder)
export const getBuffer = (data) => {
  if (typeof data === 'string') { return encode(data) }
  encodeInto('', data)
  return data
}

const { floor } = Math
export const createChecker = (numberOfZeroBit) => {
  const numberOfZeroByte = floor(numberOfZeroBit / 8), max = 0x100 >> (numberOfZeroBit % 8)
  let i
  return (result) => {
    for (i = 0; i < numberOfZeroByte; i++) {
      if (result[i] !== 0) { return !1 }
    }
    return result[i] < max
  }
}
export const getNumberOfZeroByte = result => {
  let i = 0, j = 0, len = result.length; for (; i < len; i++) {
    if (result[i] !== 0) {
      let last = result[i]; for (; j < 8; j++) {
        if (last >= (0x100 >> j)) { break }
      }
      j--
      break
    }
  }
  return i * 8 + j
}