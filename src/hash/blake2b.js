
const { instantiate } = WebAssembly, { isInteger } = Number
const MAX_HEAP = 16 * 1024
let module
export class Blake2b {
  static init(data) { module = data }
  static async create(bits = 512, key = null) {
    if (!(isInteger(bits) && bits >= 8 && bits <= 512 && bits % 8 === 0)) {
      throw new DOMException("The operation failed for an operation-specific reason", "OperationError")
    }
    if (key != null) {
      throw new DOMException("Operation is not supported", "NotSupportedError")
    }
    return new this(await instantiate(module), bits, key)
  }
  #memoryU8
  #init; get init() { return this.#init }
  #updateHeap; get updateHeap() { return this.#updateHeap }
  #update; get update() { return this.#update }
  #digest; get digest() { return this.#digest }
  get blockSize() { return 128 }
  #digestSize; get digestSize() { return this.#digestSize }
  constructor({ exports: { memory, Hash_GetBuffer, Hash_Init, Hash_Update, Hash_Final } }, bits) {
    const memoryBuffer = memory.buffer
    const memoryOffset = Hash_GetBuffer()
    const digestSize = this.#digestSize = bits / 8

    const memoryU8 = this.#memoryU8 = new Uint8Array(memoryBuffer, memoryOffset, MAX_HEAP)
    const digestU8 = new Uint8Array(memoryBuffer, memoryOffset, digestSize)
    this.#init = () => {
      Hash_Init(bits)
    }
    this.#updateHeap = (data) => {
      memoryU8.set(data)
      Hash_Update(data.length)
    }
    this.#update = (data) => {
      const dataLength = data.length
      if (dataLength <= MAX_HEAP) {
        memoryU8.set(data)
        Hash_Update(dataLength)
      } else {
        let read = 0; while (read < dataLength) {
          const chunk = data.subarray(read, read + MAX_HEAP)
          const { length } = chunk
          read += length
          memoryU8.set(chunk)
          Hash_Update(length)
        }
      }
    }
    this.#digest = () => {
      Hash_Final(0)
      return digestU8
    }
  }
}
export const blake2b = async (
  data, bits = 512, key = null
) => {
  const blake = await Blake2b.create(bits)
  blake.init()
  blake.update(data)
  return blake.digest()
}