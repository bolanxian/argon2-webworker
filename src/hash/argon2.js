
import { instantiate, getMemoryBuffer, getInstanceExports } from './utils'
import { getBuffer, encodeBase64Async, match, bufToHex } from './utils'
import { Blake2b } from './blake2b'

const { floor, ceil } = Math
const uint32U8 = new Uint8Array(4)
const uint32View = new DataView(uint32U8.buffer)
const int32LE = (x) => {
  uint32View.setInt32(0, x, true)
  return uint32U8
}
// ret1024 = new Uint8Array(1024)
const vp = new Uint8Array(64), vp32 = vp.subarray(0, 32)
const createHashFunc = async (blake512, len = 1024) => {
  if (len <= 64) {
    const { init, update, digest } = await Blake2b.create(len * 8)
    return (data, result) => {
      init()
      update(int32LE(len))
      update(data)
      result.set(digest())
    }
  }
  const r = ceil(len / 32) - 2, r32 = r * 32
  const partialBytesNeeded = len - r32
  const {
    init: initShort, update: updateShort, digest: digestShort
  } = await (partialBytesNeeded === 64 ? blake512 : Blake2b.create(partialBytesNeeded * 8))
  const { init, update, digest } = await blake512
  const vpPartial = vp.subarray(0, partialBytesNeeded)
  return (data, result) => {
    init()
    update(int32LE(len))
    update(data)
    vp.set(digest())
    result.set(vp32, 0)
    let i; for (i = 32; i < r32; i += 32) {
      init()
      update(vp)
      vp.set(digest())
      result.set(vp32, i)
    }
    initShort()
    updateShort(vp)
    vp.set(digestShort())
    result.set(vpPartial, r32)
  }
}

let module, blake512, hash1024
export class Argon2 {
  static init(data) { module = data }
  static async create(options) {
    if (blake512 == null) {
      blake512 = Blake2b.create(512)
      hash1024 = createHashFunc(blake512, 1024)
    }
    let { hashType, password, salt, memorySize, iterations, parallelism, hashLength } = options
    hashType = getHashType(hashType)
    password = getPassword(password)
    salt = getSalt(salt)
    validateOptions(memorySize, iterations, parallelism, hashLength)
    return new this(await Promise.all([
      instantiate(module),
      blake512,
      hash1024,
      createHashFunc(blake512, hashLength)
    ]), {
      hashType, password, salt, memorySize, iterations, parallelism, hashLength
    })
  }
  #salt; get salt() { return this.#salt }
  #digest; get digest() { return this.#digest }
  constructor([instance, { init, update, digest }, hash1024, hashFunc], options) {
    const { memory, Hash_SetMemorySize, Hash_GetBuffer, Hash_Calculate } = getInstanceExports(instance)
    const { hashType, memorySize, iterations, parallelism, hashLength } = options
    const version = 0x13

    Hash_GetBuffer()
    const memoryByteSize = memorySize * 1024
    Hash_SetMemorySize(memoryByteSize + 1024)
    const arrayOffset = Hash_GetBuffer()
    const memoryBuffer = getMemoryBuffer(memory)
    const memoryU8 = new Uint8Array(memoryBuffer, arrayOffset, memoryByteSize + 1024)
    const memoryResult = new Uint8Array(memoryBuffer, arrayOffset, 1024)

    const initVector = new ArrayBuffer(24)
    const initVectorU8 = new Uint8Array(initVector, 0, 24)
    const initVectorView = new DataView(initVector, 0, 24)
    initVectorView.setInt32(0, parallelism, true)
    initVectorView.setInt32(4, hashLength, true)
    initVectorView.setInt32(8, memorySize, true)
    initVectorView.setInt32(12, iterations, true)
    initVectorView.setInt32(16, version, true)
    initVectorView.setInt32(20, hashType, true)
    memoryU8.set(initVectorU8, memoryByteSize)

    let { password, salt } = options
    let passwordLength = password.length, saltLength = salt.length
    let beginData = new Uint8Array(24 + 4 + 4 + 8 + passwordLength + saltLength)
    beginData.set(initVectorU8, 0)
    beginData.set(int32LE(passwordLength), 24)
    let pos = 24 + 4
    beginData.set(password, pos)
    beginData.set(int32LE(saltLength), pos += passwordLength)
    beginData.set(salt, pos += 4)
    this.#salt = new Uint8Array(beginData.buffer, pos, saltLength)

    const segments = floor(memorySize / (parallelism * 4))// length of each lane
    const lanes = segments * 4
    const param = new Uint8Array(72), chunk = new Uint8Array(1024), result = new Uint8Array(hashLength)
    this.#digest = () => {
      init()
      update(beginData)
      param.set(digest())

      memoryU8.fill(0, 0, memoryByteSize)
      let lane, position; for (lane = 0; lane < parallelism; lane++) {
        param.set(int32LE(0), 64)
        param.set(int32LE(lane), 68)
        position = lane * lanes * 1024
        hash1024(param, chunk)
        memoryU8.set(chunk, position)
        position += 1024
        param.set(int32LE(1), 64)
        hash1024(param, chunk)
        memoryU8.set(chunk, position)
      }

      Hash_Calculate(0, memorySize)
      hashFunc(memoryResult, result)
      return result
    }
  }
}
const getHashType = (type) => {
  switch (type) {
    case 'd': case 0: return 0
    case 'i': case 1: return 1
    case 'id': case 2: return 2
    default: return 2
  }
}
const getPassword = (password) => {
  if (password == null) { throw new TypeError('Password must be specified') }
  password = getBuffer(password)
  if (password.length < 1) { throw new TypeError('Password must be specified') }
  return password
}
const getSalt = (salt) => {
  if (salt == null) { throw new TypeError('Salt must be specified') }
  salt = getBuffer(salt)
  if (salt.length < 8) { throw new TypeError('Salt should be at least 8 bytes long') }
  return salt
}
const { isInteger } = Number
const validateOptions = (memorySize, iterations, parallelism, hashLength) => {
  if (!isInteger(iterations) || iterations < 1) { throw new TypeError('Iterations should be a positive number') }
  if (!isInteger(parallelism) || parallelism < 1) { throw new TypeError('Parallelism should be a positive number') }
  if (!isInteger(hashLength) || hashLength < 4) { throw new TypeError('Hash length should be at least 4 bytes.') }
  if (!isInteger(memorySize)) { throw new TypeError('Memory size should be specified.') }
  if (memorySize < 8 * parallelism) { throw new TypeError('Memory size should be at least 8 * parallelism.') }
}
const optionsReg = /^\$argon2(id|i|d)\$v=(\d+)\$((?:[a-z]=\d+,)+[a-z]=\d+)\$([A-Za-z\d+/]+)\$([A-Za-z\d+/]+)$/
const paramMap = { m: 'memorySize', p: 'parallelism', t: 'iterations' }
export const parseResult = (encoded) => {
  const m = match(optionsReg, encoded)
  if (m == null) { throw new TypeError('Invalid hash') }
  const [, hashType, version, parameters, salt, hash] = m
  if (version !== '19') { throw new TypeError(`Unsupported version: ${version}`) }
  const opts = { hashType, salt, hash, outputType: 'encoded' }
  for (const x of parameters.split(',')) {
    const [k, v] = x.split('=')
    opts[paramMap[k]] = +v
  }
  return opts
}
export const encodeResult = async (salt, opts, result) => {
  const { hashType, memorySize: m, iterations: t, parallelism: p } = opts
  salt = await encodeBase64Async(salt)
  result = result != null ? await encodeBase64Async(result) : ''
  return `$argon2${hashType}$v=19$m=${m},t=${t},p=${p}$${salt}$${result}`
}
export const argon2 = async (options) => {
  const outputType = options.outputType ?? 'encoded'
  options.salt = getSalt(options.salt)
  const argon2 = await Argon2.create(options)
  const result = argon2.digest()
  if (outputType === 'binary') { return result }
  if (outputType === 'hex') { return bufToHex(result) }
  if (outputType === 'encoded') { return encodeResult(options.salt, options, result) }
  throw new TypeError(`Unsupported output type ${outputType}`)
}
