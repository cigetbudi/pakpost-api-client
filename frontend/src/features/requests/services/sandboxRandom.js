/** Narrow, synchronous entropy capability for the isolated QuickJS runtime.
 * CryptoJS 4.x calls crypto.getRandomValues(new Uint32Array(1)).
 * Only random uint32 values cross the boundary; no host object is exposed.
 */
export const MAX_RANDOM_WORDS = 16384; // 64 KiB per script phase.

export function installSandboxRandom(vm, hostCrypto = globalThis.crypto) {
  let remaining = MAX_RANDOM_WORDS;
  const word = new Uint32Array(1);
  const bridge = vm.newFunction('pakpostRandomWord', () => {
    if (remaining <= 0) return vm.newNumber(-1);
    remaining--;
    try {
      // Always use the worker's native cryptographic RNG. Never Math.random.
      hostCrypto.getRandomValues(word);
      return vm.newNumber(word[0]);
    } catch {
      // Return an out-of-range sentinel, never a predictable random value.
      return vm.newNumber(-1);
    }
  });
  try {
    vm.setProp(vm.global, '__pakpostRandomWord', bridge);
  } finally {
    bridge.dispose();
  }
  const result = vm.evalCode(`(function(randomWord){
    delete globalThis.__pakpostRandomWord;
    const getRandomValues = function(target) {
      if (!(target instanceof Uint32Array)) {
        throw new TypeError('PakPost crypto supports Uint32Array only');
      }
      if (target.length > ${MAX_RANDOM_WORDS}) throw new RangeError('Random value limit exceeded');
      for (let i = 0; i < target.length; i++) {
        const value = randomWord();
        if (value === -1) throw new Error('Secure random unavailable or quota exhausted');
        target[i] = value;
      }
      return target;
    };
    Object.defineProperty(globalThis, 'crypto', {
      value: Object.freeze({getRandomValues}), writable: false, configurable: false
    });
  })(globalThis.__pakpostRandomWord);`, 'pakpost-random.js');
  if (result.error) {
    let message;
    try { message = vm.dump(result.error); }
    finally { result.error.dispose(); }
    throw new Error('Cannot initialize sandbox random: ' + JSON.stringify(message));
  }
  result.value.dispose();
}
