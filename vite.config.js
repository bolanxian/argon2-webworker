import { defineConfig, splitVendorChunkPlugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFile } from 'node:fs/promises'

// https://vitejs.dev/config/

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    polyfillModulePreload: false,
    cssCodeSplit: false,
    minify: false
  },
  plugins: [
    vue(),
    //splitVendorChunkPlugin(), 
    {
      resolveId(source, importee) {
        let m
        if (m = importee.match(/node_modules\/hash-wasm\/lib\/([\w\d]+)\.ts$/) && source.match(/\.\.\/wasm\/([\w\d]+)\.wasm\.json$/)) {
          return `hash-wasm/wasm/${m[1]}.wasm.json`
        }
        if (source.match(/(?<=hash-wasm\/)wasm\/([\w\d]+)\.wasm\.json$/)) {
          return source
        }
      },
      load(id) {
        let reg = /(?<=hash-wasm\/)wasm\/([\w\d]+)\.wasm\.json$/, m = id.match(reg)
        if (m != null) {
          return readFile(`node_modules/${id.replace(reg, 'dist/$1.umd.min.js')}`, { encoding: 'utf-8' }).then(js => {
            for (const wasmInfo of js.matchAll(/\{name:"([\w\d]+)",data:"([\d\w+/=]+)",hash:"[\d\w]+"\}/g)) {
              if (wasmInfo[1] === m[1]) {
                return JSON.stringify({
                  name: wasmInfo[1],
                  data: wasmInfo[2]
                })
              }
            }
          })
        }
      }
    }
  ]
})