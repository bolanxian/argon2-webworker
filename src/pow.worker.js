
import { Blake2b } from "./hash/blake2b"
import { Argon2 } from "./hash/argon2"
import { createChecker } from "./hash/utils"

const { port1, port2 } = new MessageChannel(), opts = { once: !0 }
port2.start()
const { now } = Date, { ceil } = Math

self.addEventListener('message', async (e) => {
  try {
    const { data } = e, { modules, numberOfZeroBit, options } = data
    Blake2b.init(modules.blake2b)
    Argon2.init(modules.argon2)
    const { digest, salt } = await Argon2.create(options), check = createChecker(numberOfZeroBit)
    let i, count = 1, startTime, result
    port2.addEventListener('message', e => {
      try {
        startTime = now()
        for (i = 0; i < count; i++) {
          crypto.getRandomValues(salt)
          result = digest()
          if (check(result)) {
            postMessage({ type: 'result', salt, result })
            i++; break
          }
        }
        count = ceil(100 * i / (now() - startTime))
        postMessage(i)
        port1.postMessage(null)
      } catch (e) {
        postMessage({ type: 'error', name: e.name, message: e.message })
        throw e
      }
    })
    port1.postMessage(null)
  } catch (e) {
    postMessage({ type: 'error', name: e.name, message: e.message })
    throw e
  }
}, opts)
