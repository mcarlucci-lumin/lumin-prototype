/**
 * Browser stub for `node-forge`.
 *
 * Same reason as the `jwk-to-pem` stub in this directory: it is a server-only
 * dependency that `@a3-digital/validation` imports at module scope, pulling
 * `safe-buffer` (and node's `buffer`) into the browser bundle.
 *
 * Property access is deliberately permissive so that any top-level namespace
 * walking inside `validators.js` (`forge.pki`, `forge.md`, ...) stays harmless
 * at import time. Only actually calling or constructing something throws.
 */
const message =
  "[lumin-prototype] 'node-forge' is a server-only dependency of " +
  '@a3-digital/validation and is stubbed out in the browser build. ' +
  'If a prototype genuinely needs it, add a real browser polyfill instead.';

function createStub() {
  return new Proxy(function () {}, {
    get(_target, prop) {
      // Let the module system and console inspection probe the stub safely.
      if (prop === Symbol.toPrimitive || prop === Symbol.toStringTag) {
        return undefined;
      }
      return createStub();
    },
    apply() {
      throw new Error(message);
    },
    construct() {
      throw new Error(message);
    },
  });
}

export default createStub();
