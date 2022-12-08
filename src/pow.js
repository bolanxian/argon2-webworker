
import blake2bWasmJson from 'hash-wasm/wasm/blake2b.wasm.json'
import argon2WasmJson from 'hash-wasm/wasm/argon2.wasm.json'
import { compileBase64 } from './hash/utils'
import { Blake2b } from './hash/blake2b'
import { Argon2 } from './hash/argon2'
import workerUrl from './pow.worker?url&worker'

const noop = () => { }
let modules
export const ready = (async () => {
  const [blakeModule, argon2Module] = await Promise.all([
    compileBase64(blake2bWasmJson.data),
    compileBase64(argon2WasmJson.data)
  ])
  Blake2b.init(blakeModule)
  Argon2.init(argon2Module)
  modules = { blake2b: blakeModule, argon2: argon2Module }
})()
export class PoW {
  static async create(options) {
    await ready
    return new this(options)
  }
  #onTerminate
  #workers = []
  constructor({ numberOfThread, numberOfZeroBit, options, onProgress, onError, onResult, onTerminate }) {
    numberOfThread ??= (typeof navigator === 'object' ? navigator.hardwareConcurrency : null) ?? 4
    numberOfZeroBit ??= 16
    onProgress ??= noop
    onError ??= noop
    onResult ??= noop
    this.#onTerminate = onTerminate ?? noop
    const message = {
      modules, numberOfZeroBit, options
    }, onmessage = (e) => {
      const { data } = e
      if (typeof data === 'number') { onProgress(data); return }
      if (data == null) { return }
      switch (data.type) {
        case 'error': { onError(data) } break
        case 'result': { onResult(data) } break
      }
    }
    let i, workers = this.#workers
    for (i = 0; i < numberOfThread; i++) {
      const worker = workers[i] = new Worker(workerUrl)
      worker.addEventListener('message', onmessage)
      worker.postMessage(message)
    }
  }
  terminate() {
    for (const worker of this.#workers) { worker.terminate() }
    this.#onTerminate()
  }
}