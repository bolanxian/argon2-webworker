
import { Blake2b } from './hash/blake2b'
import { Argon2 } from './hash/argon2'
import { bindCall, bind, on, off, createChecker } from './hash/utils'

const { now } = Date, { ceil } = Math
const randomValues = bind(Crypto.prototype.getRandomValues, crypto)
const postPort = bindCall(MessagePort.prototype.postMessage)

const receive = type => new Promise((ok, reject) => {
  const fn = e => {
    if (e.data?.type === type) {
      try { off(null, 'message', fn); ok(e) }
      catch (error) { reject(error) }
    }
  }
  on(null, 'message', fn)
})
!(async () => {
  const e = await receive('init')
  const { port1, port2 } = new MessageChannel()
  port2.start()
  try {
    const { data } = e, { modules } = data
    Blake2b.init(modules.blake2b)
    Argon2.init(modules.argon2)
    const { digest, salt } = await Argon2.create(data.options)
    const check = createChecker(data.numberOfZeroBit)
    let i, count = 1, startTime, result, stop = false
    on(port2, 'message', e => {
      try {
        startTime = now()
        for (i = 0; i < count; i++) {
          randomValues(salt)
          result = digest()
          if (check(result)) {
            postMessage({ type: 'result', salt, result })
            i++; break
          }
        }
        count = ceil(100 * i / (now() - startTime))
        postMessage(i)
        stop ? (postMessage({ type: 'close' }), close()) : postPort(port1, null)
      } catch (e) {
        postMessage({ type: 'error', name: e.name, message: e.message })
        throw e
      }
    })
    postMessage({ type: 'ready' })
    await receive('start')
    postPort(port1, null)
    await receive('stop')
    stop = true
  } catch (e) {
    postMessage({ type: 'error', name: e.name, message: e.message })
    throw e
  }
})()