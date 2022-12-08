
const dataReg = /^data:application\/octet-stream;base64,([A-Za-z\d+/]*)=*$/
export const encodeBase64Async = (...args) => new Promise((ok, reject) => {
  const reader = new FileReader()
  reader.addEventListener("load", () => { ok(replace(dataReg, reader.result, '$1')) })
  reader.addEventListener("error", () => { reject(reader.error) })
  reader.readAsDataURL(new Blob(args))
})
export const decodeBase64Async = async (data) => (await fetch('data:application/octet-stream;base64,' + data)).arrayBuffer()
const cs = WebAssembly.compileStreaming
export const compileBase64 = (data) => cs(fetch('data:application/wasm;base64,' + data))

const { apply } = Reflect, { parseInt } = Number, { floor } = Math
const { bind: _bind, call: _call } = Function.prototype
export const numToStr = apply(_bind, _call, [Number.prototype.toString])
export const padStart = apply(_bind, _call, [String.prototype.padStart])
export const match = apply(_bind, _call, [RegExp.prototype[Symbol.match]])
export const replace = apply(_bind, _call, [RegExp.prototype[Symbol.replace]])
const hexToBufReg = /[\da-f]{2}/gi, hexToBufCb = h => parseInt(h, 16)
export const hexToBuf = (hex) => Uint8Array.from(match(hexToBufReg, hex), hexToBufCb)
export const bufToHex = buf => {
  let str = ''
  for (const a of buf) { str += padStart(numToStr(a & 0xFF, 16), 2, '0') }
  return str
}

const encoder = new TextEncoder()
export const getBuffer = (data) => {
  if (typeof data === "string") { return encoder.encode(data) }
  encoder.encodeInto('', data)
  return data
}

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