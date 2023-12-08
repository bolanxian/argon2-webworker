import { createApp } from 'vue'
import Main from './main.vue'
import { blake2b as _blake2b } from 'hash-wasm/lib/blake2b'
import { argon2d as _argon2d } from 'hash-wasm/lib/argon2'
import { PoW } from './pow'
import { Blake2b, blake2b } from './hash/blake2b'
import { Argon2, argon2 } from './hash/argon2'

!1 ? (async () => {
  await PoW.ready
  const opts = {
    password: crypto.getRandomValues(new Uint8Array(16)),
    salt: crypto.getRandomValues(new Uint8Array(16)),
    parallelism: 1,
    iterations: 3,
    memorySize: 64,
    hashLength: 64,
  }
  console.log(
    await argon2({ hashType: 'd', ...opts }),
    await _argon2d({ ...opts, outputType: 'encoded' })
  )
})() : 0

const vm = createApp(Main).mount('#app')
window.vm = vm
