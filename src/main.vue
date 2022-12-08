<script>
import * as Vue from 'vue'
import iview from 'view-ui-plus'
const { createVNode: h } = Vue
const { Row, Col, Input, Button, Checkbox } = iview
import { bufToHex, getBuffer, encodeBase64Async, decodeBase64Async, createChecker } from './hash/utils'
import { parseResult } from './hash/argon2'
import * as hashwasm from 'hash-wasm/lib/argon2'
import { PoW } from './pow'

const { now } = Date
const name = 'Argon2 WebWorker'

export default {
  data() {
    return {
      readyState: 0,
      numberOfThread: navigator.hardwareConcurrency ?? 4,
      message: '你说得对，但是',
      options: '$argon2d$v=19$m=88,t=3,p=1$8$16/32',
      result: '',
      results: ''
    }
  },
  beforeMount() {

  },
  mounted() {
    const vm = this
    document.title = name
  },
  methods: {
    async handleStart() {
      const vm = this, { $refs: { status }, numberOfThread, message, options } = vm
      const prefixOptions = options.split('$', 4).join('$')
      let { hashType, memorySize, iterations, parallelism, outputType, salt, hash } = parseResult(options)
      let [numberOfZeroBit, hashLength] = hash.split('/')
      numberOfZeroBit ??= 16
      const pow = vm.pow = await PoW.create({
        numberOfZeroBit,
        numberOfThread,
        options: {
          hashType, memorySize, iterations, parallelism, hashLength: +hashLength, outputType,
          password: getBuffer(message),
          salt: new Uint8Array(+salt)
        },
        onProgress(i) { total += i },
        onError(e) { console.error(e); pow.terminate() },
        async onResult({ salt, result }) {
          salt = await encodeBase64Async(salt)
          count++
          vm.result = `${prefixOptions}$${salt}$${numberOfZeroBit}/${hashLength}\n${message}`
          vm.results += `$${salt}$${bufToHex(result)}\n`
        },
        onTerminate() {
          clearInterval(timer)
          vm.readyState = 0
          vm.pow = null
          nowTime = now()
          totalTime = (nowTime - startTime) / 1000
          speed = total / totalTime
          setStatus()
        }
      })
      let count = 0, total = 0, startTime = now()
      let lastTotal = 0, lastTime = startTime
      let nowTime, totalTime, speed
      const timer = setInterval(() => {
        nowTime = now()
        totalTime = (nowTime - startTime) / 1000
        speed = (total - lastTotal) / (nowTime - lastTime) * 1000
        lastTime = nowTime
        lastTotal = total
        setStatus()
      }, 500)
      const setStatus = () => {
        status.innerText = `${speed.toFixed(1) + 'H/s'} ${count}/${total} ${totalTime.toFixed(1) + 's'}`
      }
      status.innerText = ''
      vm.readyState = 2
    },
    handleStop() {
      this.pow.terminate()
    },
    async handleCheck() {
      const vm = this, { $refs: { check }, result } = vm
      let isSuccess = !1
      try {
        check.innerText = ''
        let index = result.indexOf('\n')
        let options = result.slice(0, index), message = result.slice(index + 1)
        if (message.length < 1) { return }
        let { hashType, memorySize, iterations, parallelism, salt, hash } = parseResult(options)
        let [numberOfZeroBit, hashLength] = hash.split('/')
        const hashResult = await hashwasm[`argon2${hashType}`]({
          memorySize, iterations, parallelism, hashLength: +hashLength, outputType: 'binary',
          password: getBuffer(message),
          salt: new Uint8Array(await decodeBase64Async(salt))
        })
        isSuccess = createChecker(numberOfZeroBit)(hashResult)
        const hashHex = hashResult.length > 8 ? bufToHex(hashResult.subarray(0, 8)) + '...' : bufToHex(hashResult)
        check.innerText = `${isSuccess ? '成功' : '失败'} ${hashHex}`
      } catch (e) {
        check.innerText = '失败'
        console.error(e)
      }
    }
  },
  render() {
    const vm = this
    return [
      h('div', { style: { margin: '60px auto 30px auto', 'text-align': 'center' } }, [
        h('h2', null, name),
        h('h5', null, 'argon2(...)=0000...')
      ]),
      h(Row, { gutter: 5 }, () => [
        h(Col, { xs: 24, lg: 12 }, () => [
          h(Row, { gutter: 5, style: "margin-bottom:16px" }, () => [
            h(Col, {
              span: 6, style: { 'text-align': 'right', 'line-height': '30px' }
            }, () => '消息：'),
            h(Col, { span: 18 }, () => [
              h(Input, {
                type: "textarea", autosize: { minRows: 2, maxRows: 20 },
                modelValue: vm.message,
                'onUpdate:modelValue': value => { vm.message = value }
              })
            ])
          ]),
          h(Row, { gutter: 5, style: "margin-bottom:16px" }, () => [
            h(Col, {
              span: 6, style: { 'text-align': 'right', 'line-height': '30px' }
            }, () => '选项：'),
            h(Col, { span: 18 }, () => [
              h(Input, {
                modelValue: vm.options,
                'onUpdate:modelValue': value => { vm.options = value }
              })
            ])
          ]),
          h(Row, { gutter: 5, style: "margin-bottom:16px" }, () => [
            h(Col, {
              span: 6, style: { 'text-align': 'right', 'line-height': '30px' }
            }, () => '线程：'),
            h(Col, { span: 6 }, () => [
              h(Input, {
                number: !0,
                modelValue: vm.numberOfThread,
                'onUpdate:modelValue': value => { vm.numberOfThread = value }
              })
            ]),
            h(Col, {
              span: 6, style: { 'text-align': 'right', 'line-height': '30px' }
            }),
            h(Col, { span: 6 }, () => [
              h(Checkbox, {
                disabled: !0
              }, () => '自动停止')
            ])
          ]),
          h(Row, { gutter: 5, style: "margin-bottom:16px" }, () => [
            h(Col, { offset: 6, span: 18 }, () => [
              h(Button, {
                type: "primary",
                disabled: vm.readyState !== 0, onClick: vm.handleStart
              }, () => '启动'),
              h(Button, {
                style: "margin-left:16px",
                disabled: vm.readyState !== 2, onClick: vm.handleStop
              }, () => '停止'),
              h('span', { ref: 'status', style: "margin-left:16px" })
            ])
          ]),
          h(Row, { gutter: 5, style: "margin-bottom:16px" }, () => [
            h(Col, {
              span: 6, style: { 'text-align': 'right', 'line-height': '30px' }
            }, () => '签名：'),
            h(Col, { span: 18 }, () => [
              h(Input, {
                type: "textarea", autosize: { minRows: 2, maxRows: 20 },
                modelValue: vm.result,
                'onUpdate:modelValue': value => { vm.result = value }
              })
            ])
          ]),
          h(Row, { gutter: 5, style: "margin-bottom:16px" }, () => [
            h(Col, { offset: 6, span: 18 }, () => [
              h(Button, { onClick: vm.handleCheck }, () => '验证'),
              h('span', { ref: 'check', style: "margin-left:16px" })
            ])
          ]),
        ]),
        h(Col, { xs: 24, lg: 9 }, () => [
          h(Input, {
            type: "textarea", autosize: { minRows: 20, maxRows: 50 },
            modelValue: vm.results,
            'onUpdate:modelValue': value => { vm.results = value }
          })
        ])
      ])
    ]
  }
}
</script>


<style>

</style>
