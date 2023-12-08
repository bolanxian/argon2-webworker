import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFile } from 'node:fs/promises'

const externalAssets = (() => {
  const reg = /\/(ionicons)-[\da-f]{8}\.((?!woff2)\S+)$/
  return {
    renderBuiltUrl(fileName, { type, hostId, hostType }) {
      if (hostType === 'css') {
        const m = fileName.match(reg)
        if (m != null) { return `data:text/plain,${m[1]}.${m[2]}` }
      }
      return { relative: true }
    },
    plugin: {
      name: 'external-assets',
      generateBundle(options, bundle) {
        for (const fileName of Object.keys(bundle)) {
          const m = fileName.match(reg)
          if (m != null) { delete bundle[fileName] }
        }
      }
    }
  }
})()

// https://vitejs.dev/config/
export default defineConfig({
  appType: 'mpa',
  base: './',
  build: {
    target: 'esnext',
    modulePreload: false,
    cssCodeSplit: false,
    minify: false
  },
  resolve: {
    extensions: ['.js', '.ts', '.json', '.vue']
  },
  experimental: { renderBuiltUrl: externalAssets.renderBuiltUrl },
  plugins: [
    vue(),
    externalAssets.plugin,
    {
      name: 'view-ui-plus',
      enforce: 'pre',
      apply: 'build',
      resolveId(source, importer, options) {
        if (source === 'view-ui-plus') { return source }
      },
      load(id) {
        if (id === 'view-ui-plus') {
          return `\
export * from 'view-ui-plus/src/components/index'
export { version } from 'view-ui-plus/package.json'
`
        }
      }
    },
    {
      resolveId(source, importee) {
        let m
        if (importee?.match(/node_modules\/hash-wasm\/lib\/([\w\d]+)\.ts$/) != null
          && (m = source.match(/\.\.\/wasm\/([\w\d]+)\.wasm\.json$/)) != null) {
          return `hash-wasm/wasm/${m[1]}.wasm.json`
        }
        if (source.match(/(?<=hash-wasm\/)wasm\/([\w\d]+)\.wasm\.json$/)) {
          return source
        }
      },
      load(id) {
        const reg = /(?<=hash-wasm\/)wasm\/([\w\d]+)\.wasm\.json$/
        let m
        if ((m = id.match(reg)) != null) {
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