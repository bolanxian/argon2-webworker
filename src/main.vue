<script>
const name = 'Argon2 WebWorker'
import { createVNode as h } from 'vue'
import { Row, Col, Input, Button, Checkbox } from 'view-ui-plus'
import * as hashwasm from 'hash-wasm/lib/argon2'
import { bindCall, hexToBuf, bufToHex, getBuffer, createChecker, getNumberOfZeroByte } from './hash/utils'
import { parseResult } from './hash/argon2'
import { PoW } from './pow'
const { now } = Date
const toFixed = bindCall(Number.prototype.toFixed)

export default {
  name,
  data() {
    return {
      readyState: 0,
      numberOfThread: navigator.hardwareConcurrency ?? 4,
      message: '你说得对，但是',
      options: '$argon2d$v=19$m=88,t=3,p=1$8$16///32',
      autoStop: false,
      result: '',
      results: ''
    }
  },
  mounted() {
    document.title = name
  },
  methods: {
    async handleStart() {
      const vm = this, { $refs: { status }, numberOfThread, message, options, autoStop } = vm
      let { hashType, memorySize, iterations, parallelism, outputType, salt, hash } = parseResult(options)
      let [numberOfZeroBit, hashLength] = hash.split('///')
      numberOfZeroBit ??= 16
      const pow = vm.pow = await PoW.create({
        numberOfZeroBit,
        numberOfThread,
        options: {
          hashType, memorySize, iterations, parallelism, hashLength: +hashLength, outputType,
          password: getBuffer(message),
          salt: new Uint8Array(+salt)
        },
        onStart() {
          count = 0, total = 0, startTime = now()
          lastTotal = 0, lastTime = startTime
          vm.readyState = 2
        },
        onProgress(i) { total += i },
        onError(e) { console.error(e); pow.terminate() },
        onResult({ salt, result }) {
          salt = bufToHex(salt)
          count++
          const pre = `::${getNumberOfZeroByte(result)}:${salt}:`
          vm.result = `${pre}\n${message}`
          vm.results += `${pre}${bufToHex(result)}\n`
          if (autoStop) { pow.stop() }
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
        status.innerText = `${toFixed(speed, 1)}H/s ${count}/${total} ${toFixed(totalTime, 1)}s`
      }
      status.innerText = ''
      vm.readyState = 1
    },
    handleStop() {
      vm.readyState = 3
      this.pow.stop()
    },
    async handleCheck() {
      const vm = this, { $refs: { check }, result } = vm
      let isSuccess = !1
      try {
        check.innerText = ''
        let index = result.indexOf('\n')
        let options = result.slice(0, index), message = result.slice(index + 1)
        if (message.length < 1) { return }
        let { hashType, memorySize, iterations, parallelism, hash } = parseResult(vm.options)
        let [, hashLength] = hash.split('///')
        let [, numberOfZeroBit, salt] = options.match(/^::(\d+):([0-9a-f]+):$/)
        const hashResult = await hashwasm[`argon2${hashType}`]({
          memorySize, iterations, parallelism, hashLength: +hashLength, outputType: 'binary',
          password: getBuffer(message),
          salt: hexToBuf(salt)
        })
        isSuccess = createChecker(+numberOfZeroBit)(hashResult)
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
      h('div', { style: 'margin:60px auto 30px auto;text-align:center' }, [
        h('h2', null, [name]),
        h('h5', null, ['argon2(...)=0000...'])
      ]),
      h(Row, { gutter: 5 }, () => [
        h(Col, { xs: 24, lg: 12 }, () => [
          h(Row, { gutter: 5, style: 'margin-bottom:16px' }, () => [
            h(Col, {
              span: 6, style: 'text-align:right;line-height:30px'
            }, () => '消息：'),
            h(Col, { span: 18 }, () => [
              h(Input, {
                type: 'textarea', autosize: { minRows: 2, maxRows: 20 },
                disabled: vm.readyState !== 0,
                modelValue: vm.message,
                'onUpdate:modelValue': value => { vm.message = value }
              })
            ])
          ]),
          h(Row, { gutter: 5, style: 'margin-bottom:16px' }, () => [
            h(Col, {
              span: 6, style: 'text-align:right;line-height:30px'
            }, () => '选项：'),
            h(Col, { span: 18 }, () => [
              h(Input, {
                disabled: vm.readyState !== 0,
                modelValue: vm.options,
                'onUpdate:modelValue': value => { vm.options = value }
              })
            ])
          ]),
          h(Row, { gutter: 5, style: 'margin-bottom:16px' }, () => [
            h(Col, {
              span: 6, style: 'text-align:right;line-height:30px'
            }, () => '线程：'),
            h(Col, { span: 6 }, () => [
              h(Input, {
                number: !0,
                disabled: vm.readyState !== 0,
                modelValue: vm.numberOfThread,
                'onUpdate:modelValue': value => { vm.numberOfThread = value }
              })
            ]),
            h(Col, {
              span: 6, style: 'text-align:right;line-height:30px'
            }),
            h(Col, { span: 6 }, () => [
              h(Checkbox, {
                disabled: vm.readyState !== 0,
                modelValue: vm.autoStop,
                'onUpdate:modelValue': value => { vm.autoStop = value }
              }, () => '自动停止')
            ])
          ]),
          h(Row, { gutter: 5, style: 'margin-bottom:16px' }, () => [
            h(Col, { offset: 6, span: 18 }, () => [
              h(Button, {
                type: 'primary',
                style: vm.readyState === 1 ? 'margin-left:-18px' : null,
                disabled: vm.readyState !== 0, loading: vm.readyState === 1,
                onClick: vm.handleStart
              }, () => '启动'),
              h(Button, {
                style: 'margin-left:16px',
                disabled: vm.readyState !== 2,
                onClick: vm.handleStop
              }, () => '停止'),
              h('span', { ref: 'status', style: 'margin-left:16px' })
            ])
          ]),
          h(Row, { gutter: 5, style: 'margin-bottom:16px' }, () => [
            h(Col, {
              span: 6, style: 'text-align:right;line-height:30px'
            }, () => '签名：'),
            h(Col, { span: 18 }, () => [
              h(Input, {
                type: 'textarea', autosize: { minRows: 2, maxRows: 20 },
                disabled: vm.readyState !== 0,
                modelValue: vm.result,
                'onUpdate:modelValue': value => { vm.result = value }
              })
            ])
          ]),
          h(Row, { gutter: 5, style: 'margin-bottom:16px' }, () => [
            h(Col, { offset: 6, span: 18 }, () => [
              h(Button, {
                disabled: vm.readyState !== 0,
                onClick: vm.handleCheck
              }, () => '验证'),
              h('span', { ref: 'check', style: 'margin-left:16px' })
            ])
          ]),
        ]),
        h(Col, { xs: 24, lg: 9 }, () => [
          h(Input, {
            type: 'textarea', autosize: { minRows: 20, maxRows: 50 },
            modelValue: vm.results,
            'onUpdate:modelValue': value => { vm.results = value }
          })
        ])
      ])
    ]
  }
}
</script>