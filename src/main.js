import { createApp } from 'vue'
import 'view-ui-plus/dist/styles/viewuiplus.css'
import './style.css'
import Main from './main.vue'
import { blake2b as _blake2b } from 'hash-wasm/lib/blake2b'
import { argon2d as _argon2d } from 'hash-wasm/lib/argon2'
import { ready } from './pow'
import { Blake2b, blake2b } from './hash/blake2b'
import { Argon2, argon2 } from './hash/argon2'

!1 ? (async () => {
  await ready
  const password = crypto.getRandomValues(new Uint8Array(16)), salt = crypto.getRandomValues(new Uint8Array(16))
  console.log(await argon2({
    hashType: 'd',
    password, salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 64,
    hashLength: 64,
  }), await _argon2d({
    password, salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 64,
    hashLength: 64,
    outputType: 'encoded'
  }))
})() : 0

createApp(Main).mount('#app')

