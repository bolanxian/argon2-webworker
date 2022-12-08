(function () {
  'use strict';

  const { instantiate: instantiate$1 } = WebAssembly, { isInteger: isInteger$1 } = Number;
  const MAX_HEAP = 16 * 1024;
  let module$1;
  class Blake2b {
    static init(data) { module$1 = data; }
    static async create(bits = 512, key = null) {
      if (!(isInteger$1(bits) && bits >= 8 && bits <= 512 && bits % 8 === 0)) {
        throw new DOMException("The operation failed for an operation-specific reason", "OperationError")
      }
      if (key != null) {
        throw new DOMException("Operation is not supported", "NotSupportedError")
      }
      return new this(await instantiate$1(module$1), bits, key)
    }
    #memoryU8
    #init; get init() { return this.#init }
    #updateHeap; get updateHeap() { return this.#updateHeap }
    #update; get update() { return this.#update }
    #digest; get digest() { return this.#digest }
    get blockSize() { return 128 }
    #digestSize; get digestSize() { return this.#digestSize }
    constructor({ exports: { memory, Hash_GetBuffer, Hash_Init, Hash_Update, Hash_Final } }, bits) {
      const memoryBuffer = memory.buffer;
      const memoryOffset = Hash_GetBuffer();
      const digestSize = this.#digestSize = bits / 8;

      const memoryU8 = this.#memoryU8 = new Uint8Array(memoryBuffer, memoryOffset, MAX_HEAP);
      const digestU8 = new Uint8Array(memoryBuffer, memoryOffset, digestSize);
      this.#init = () => {
        Hash_Init(bits);
      };
      this.#updateHeap = (data) => {
        memoryU8.set(data);
        Hash_Update(data.length);
      };
      this.#update = (data) => {
        const dataLength = data.length;
        if (dataLength <= MAX_HEAP) {
          memoryU8.set(data);
          Hash_Update(dataLength);
        } else {
          let read = 0; while (read < dataLength) {
            const chunk = data.subarray(read, read + MAX_HEAP);
            const { length } = chunk;
            read += length;
            memoryU8.set(chunk);
            Hash_Update(length);
          }
        }
      };
      this.#digest = () => {
        Hash_Final(0);
        return digestU8
      };
    }
  }

  const { apply } = Reflect, { floor: floor$1 } = Math;
  const { bind: _bind, call: _call } = Function.prototype;
  apply(_bind, _call, [Number.prototype.toString]);
  apply(_bind, _call, [String.prototype.padStart]);
  apply(_bind, _call, [RegExp.prototype[Symbol.match]]);
  apply(_bind, _call, [RegExp.prototype[Symbol.replace]]);

  const encoder = new TextEncoder();
  const getBuffer = (data) => {
    if (typeof data === "string") { return encoder.encode(data) }
    encoder.encodeInto('', data);
    return data
  };

  const createChecker = (numberOfZeroBit) => {
    const numberOfZeroByte = floor$1(numberOfZeroBit / 8), max = 0x100 >> (numberOfZeroBit % 8);
    let i;
    return (result) => {
      for (i = 0; i < numberOfZeroByte; i++) {
        if (result[i] !== 0) { return !1 }
      }
      return result[i] < max
    }
  };

  function getGlobal() {
    if (typeof globalThis !== "undefined")
      return globalThis;
    if (typeof self !== "undefined")
      return self;
    if (typeof window !== "undefined")
      return window;
    return global;
  }
  const globalObject = getGlobal();
  globalObject.Buffer ?? null;
  globalObject.TextEncoder ? new globalObject.TextEncoder() : null;
  const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const base64Lookup = new Uint8Array(256);
  for (let i = 0; i < base64Chars.length; i++) {
    base64Lookup[base64Chars.charCodeAt(i)] = i;
  }

  const { floor, ceil: ceil$1 } = Math;
  const uint32U8 = new Uint8Array(4);
  const uint32View = new DataView(uint32U8.buffer);
  const int32LE = (x) => {
    uint32View.setInt32(0, x, true);
    return uint32U8
  };
  // ret1024 = new Uint8Array(1024)
  const vp = new Uint8Array(64), vp32 = vp.subarray(0, 32);
  const createHashFunc = async (blake512, len = 1024) => {
    if (len <= 64) {
      const { init, update, digest } = await Blake2b.create(len * 8);
      return (data, result) => {
        init();
        update(int32LE(len));
        update(data);
        result.set(digest());
      }
    }
    const r = ceil$1(len / 32) - 2, r32 = r * 32;
    const partialBytesNeeded = len - r32;
    const {
      init: initShort, update: updateShort, digest: digestShort
    } = await (partialBytesNeeded === 64 ? blake512 : Blake2b.create(partialBytesNeeded * 8));
    const { init, update, digest } = await blake512;
    const vpPartial = vp.subarray(0, partialBytesNeeded);
    return (data, result) => {
      init();
      update(int32LE(len));
      update(data);
      vp.set(digest());
      result.set(vp32, 0);
      let i; for (i = 32; i < r32; i += 32) {
        init();
        update(vp);
        vp.set(digest());
        result.set(vp32, i);
      }
      initShort();
      updateShort(vp);
      vp.set(digestShort());
      result.set(vpPartial, r32);
    }
  };

  const { instantiate } = WebAssembly;
  let module, blake512, hash1024;
  class Argon2 {
    static init(data) { module = data; }
    static async create(options) {
      if (blake512 == null) {
        blake512 = Blake2b.create(512);
        hash1024 = createHashFunc(blake512, 1024);
      }
      let { hashType, password, salt, memorySize, iterations, parallelism, hashLength } = options;
      hashType = getHashType(hashType);
      password = getPassword(password);
      salt = getSalt(salt);
      validateOptions(memorySize, iterations, parallelism, hashLength);
      return new this(await Promise.all([
        instantiate(module),
        blake512,
        hash1024,
        createHashFunc(blake512, hashLength)
      ]), {
        hashType, password, salt, memorySize, iterations, parallelism, hashLength
      })
    }
    #salt; get salt() { return this.#salt }
    #digest; get digest() { return this.#digest }
    constructor([{ exports }, { init, update, digest }, hash1024, hashFunc], options) {
      const { memory, Hash_SetMemorySize, Hash_GetBuffer, Hash_Calculate } = exports;
      const { hashType, memorySize, iterations, parallelism, hashLength } = options;
      const version = 0x13;

      Hash_GetBuffer();
      const memoryByteSize = memorySize * 1024;
      Hash_SetMemorySize(memoryByteSize + 1024);
      const arrayOffset = Hash_GetBuffer();
      const memoryBuffer = memory.buffer;
      const memoryU8 = new Uint8Array(memoryBuffer, arrayOffset, memoryByteSize + 1024);
      const memoryResult = new Uint8Array(memoryBuffer, arrayOffset, 1024);

      const initVector = new ArrayBuffer(24);
      const initVectorU8 = new Uint8Array(initVector, 0, 24);
      const initVectorView = new DataView(initVector, 0, 24);
      initVectorView.setInt32(0, parallelism, true);
      initVectorView.setInt32(4, hashLength, true);
      initVectorView.setInt32(8, memorySize, true);
      initVectorView.setInt32(12, iterations, true);
      initVectorView.setInt32(16, version, true);
      initVectorView.setInt32(20, hashType, true);
      memoryU8.set(initVectorU8, memoryByteSize);

      let { password, salt } = options;
      let passwordLength = password.length, saltLength = salt.length;
      let beginData = new Uint8Array(24 + 4 + 4 + 8 + passwordLength + saltLength);
      beginData.set(initVectorU8, 0);
      beginData.set(int32LE(passwordLength), 24);
      let pos = 24 + 4;
      beginData.set(password, pos);
      beginData.set(int32LE(saltLength), pos += passwordLength);
      beginData.set(salt, pos += 4);
      this.#salt = new Uint8Array(beginData.buffer, pos, saltLength);

      const segments = floor(memorySize / (parallelism * 4));// length of each lane
      const lanes = segments * 4;
      const param = new Uint8Array(72), chunk = new Uint8Array(1024), result = new Uint8Array(hashLength);
      this.#digest = () => {
        init();
        update(beginData);
        param.set(digest());

        memoryU8.fill(0, 0, memoryByteSize);
        let lane, position; for (lane = 0; lane < parallelism; lane++) {
          param.set(int32LE(0), 64);
          param.set(int32LE(lane), 68);
          position = lane * lanes * 1024;
          hash1024(param, chunk);
          memoryU8.set(chunk, position);
          position += 1024;
          param.set(int32LE(1), 64);
          hash1024(param, chunk);
          memoryU8.set(chunk, position);
        }

        Hash_Calculate(0, memorySize);
        hashFunc(memoryResult, result);
        return result
      };
    }
  }
  const getHashType = (type) => {
    switch (type) {
      case 'd': case 0: return 0
      case 'i': case 1: return 1
      case 'id': case 2: return 2
      default: return 2
    }
  };
  const getPassword = (password) => {
    if (password == null) { throw new TypeError('Password must be specified') }
    password = getBuffer(password);
    if (password.length < 1) { throw new TypeError('Password must be specified') }
    return password
  };
  const getSalt = (salt) => {
    if (salt == null) { throw new TypeError('Salt must be specified') }
    salt = getBuffer(salt);
    if (salt.length < 8) { throw new TypeError('Salt should be at least 8 bytes long') }
    return salt
  };
  const { isInteger } = Number;
  const validateOptions = (memorySize, iterations, parallelism, hashLength) => {
    if (!isInteger(iterations) || iterations < 1) { throw new TypeError('Iterations should be a positive number') }
    if (!isInteger(parallelism) || parallelism < 1) { throw new TypeError('Parallelism should be a positive number') }
    if (!isInteger(hashLength) || hashLength < 4) { throw new TypeError('Hash length should be at least 4 bytes.') }
    if (!isInteger(memorySize)) { throw new TypeError('Memory size should be specified.') }
    if (memorySize < 8 * parallelism) { throw new TypeError('Memory size should be at least 8 * parallelism.') }
  };

  const { port1, port2 } = new MessageChannel(), opts = { once: !0 };
  port2.start();
  const { now } = Date, { ceil } = Math;

  self.addEventListener('message', async (e) => {
    try {
      const { data } = e, { modules, numberOfZeroBit, options } = data;
      Blake2b.init(modules.blake2b);
      Argon2.init(modules.argon2);
      const { digest, salt } = await Argon2.create(options), check = createChecker(numberOfZeroBit);
      let i, count = 1, startTime, result;
      port2.addEventListener('message', e => {
        try {
          startTime = now();
          for (i = 0; i < count; i++) {
            crypto.getRandomValues(salt);
            result = digest();
            if (check(result)) {
              postMessage({ type: 'result', salt, result });
              i++; break
            }
          }
          count = ceil(100 * i / (now() - startTime));
          postMessage(i);
          port1.postMessage(null);
        } catch (e) {
          postMessage({ type: 'error', name: e.name, message: e.message });
          throw e
        }
      });
      port1.postMessage(null);
    } catch (e) {
      postMessage({ type: 'error', name: e.name, message: e.message });
      throw e
    }
  }, opts);

})();
