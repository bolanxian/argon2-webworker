
import { data as blake2bWasmData } from 'hash-wasm/wasm/blake2b.wasm.json'
import { data as argon2WasmData } from 'hash-wasm/wasm/argon2.wasm.json'
import { bindCall, on, compileFetch } from './hash/utils'
import { Blake2b } from './hash/blake2b'
import { Argon2 } from './hash/argon2'
import workerUrl from './pow.worker?url&worker'

const WorkerProto = Worker.prototype
export const postWorker = bindCall(WorkerProto.postMessage)
export const terminate = bindCall(WorkerProto.terminate)

const noop = () => { }
let modules, ready
const compile = async (data, Hash) => {
  const mod = await compileFetch(`data:application/wasm;base64,${data}`)
  Hash.init(mod)
  return mod
}
const load = async () => {
  const [blake2b, argon2] = await Promise.all([
    compile(blake2bWasmData, Blake2b), compile(argon2WasmData, Argon2)
  ])
  modules = { blake2b, argon2 }
}
export class PoW {
  static get ready() {
    return ready ??= load()
  }
  static async create(options) {
    await (ready ??= load())
    return new this(options)
  }
  #onTerminate
  #workers
  constructor({ numberOfThread, numberOfZeroBit, options, onStart, onProgress, onError, onResult, onTerminate }) {
    numberOfThread ??= (typeof navigator === 'object' ? navigator.hardwareConcurrency : null) ?? 4
    numberOfZeroBit ??= 16
    onStart ??= noop
    onProgress ??= noop
    onError ??= noop
    onResult ??= noop
    this.#onTerminate = onTerminate ?? noop
    const message = {
      type: 'init', modules, numberOfZeroBit, options
    }
    const onMessage = e => {
      const { data } = e
      if (typeof data === 'number') { onProgress(data); return }
      if (data == null) { return }
      switch (data.type) {
        case 'error': { onError(data) } break
        case 'result': { onResult(data) } break
        case 'ready': {
          if ((numberOfReadyWorkers += 1) === numberOfThread) {
            for (const worker of workers) {
              postWorker(worker, { type: 'start' })
            }
            onStart()
          }
        } break
        case 'close': {
          if ((numberOfCloseWorkers += 1) === numberOfThread) {
            this.#onTerminate([])
          }
        } break
      }
    }
    const workers = this.#workers = []
    let numberOfReadyWorkers = 0, numberOfCloseWorkers = 0
    let i = 0; for (; i < numberOfThread; i++) {
      const worker = workers[i] = new Worker(workerUrl)
      on(worker, 'message', onMessage)
      on(worker, 'error', onError)
      postWorker(worker, message)
    }
  }
  stop() {
    const message = { type: 'stop' }
    for (const worker of this.#workers) {
      postWorker(worker, message)
    }
  }
  terminate() {
    const errors = []
    for (const worker of this.#workers) {
      try { terminate(worker) }
      catch (e) { errors[errors.length] = e }
    }
    this.#workers = null
    this.#onTerminate(errors)
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Worker.terminate() failed')
    }
  }
}