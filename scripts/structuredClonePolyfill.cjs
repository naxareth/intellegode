if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = value => JSON.parse(JSON.stringify(value));
}