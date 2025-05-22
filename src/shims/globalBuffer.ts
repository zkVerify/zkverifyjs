import { Buffer as PolyfillBuffer } from 'buffer';

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = PolyfillBuffer;
}
