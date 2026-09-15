/**
 * Browser stub for `jwk-to-pem`.
 *
 * `@a3-digital/validation` statically imports this server-only crypto package at
 * the top of `validators.js`, and `@a3-digital/ui-core` imports a phone
 * validator from that same module. That drags `jwk-to-pem` -> `asn1.js` ->
 * `safer-buffer` into the browser bundle, where webpack 5 fails to resolve
 * node's `buffer` core module.
 *
 * None of the validators used by the UI packages touch JWK parsing, so the
 * import is dead weight in a prototype. Throw loudly if that ever changes.
 */
const message =
  "[lumin-prototype] 'jwk-to-pem' is a server-only dependency of " +
  '@a3-digital/validation and is stubbed out in the browser build. ' +
  'If a prototype genuinely needs it, add a real browser polyfill instead.';

export default function jwkToPem() {
  throw new Error(message);
}
