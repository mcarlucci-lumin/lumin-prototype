#!/usr/bin/env node
const { execSync } = require('child_process');
const { readFileSync, renameSync, mkdtempSync, rmSync, readdirSync, statSync, writeFileSync, unlinkSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify: terserMinify } = require('terser');

// Used for plain .js files (CommonJS/ESM).
// simplify:false is required — it would otherwise convert method names to
// computed bracket notation (`['method']()`), which breaks Angular's Babel loader.
// String arrays + base64 encoding + number expressions give strong obfuscation.
const OBFUSCATE_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  numbersToExpressions: true,
  renameGlobals: false,
  renameProperties: false,
  selfDefending: false,
  simplify: false,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.75,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersType: 'function',
  unicodeEscapeSequence: false,
};

// Used for Angular ESM bundles (.mjs). javascript-obfuscator cannot be used here
// because it converts every class member name to computed bracket notation, which
// triggers Angular's Babel plugin to throw "Expected value to have a symbol name"
// for any Angular metadata field it encounters.
// Terser safely mangles unexported top-level names (classes/functions become
// single-letter identifiers) and performs deep expression compression.
const TERSER_OPTIONS = {
  module: true,
  mangle: { properties: false, toplevel: true },
  compress: { passes: 3, toplevel: true },
  format: { comments: false },
};

async function obfuscateDir(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      await obfuscateDir(fullPath);
      continue;
    }

    // Remove source maps — they would expose original source
    if (entry.endsWith('.js.map') || entry.endsWith('.mjs.map')) {
      unlinkSync(fullPath);
      continue;
    }

    if (!entry.endsWith('.js') && !entry.endsWith('.mjs')) continue;

    let code = readFileSync(fullPath, 'utf8');
    code = code.replace(/\/\/# sourceMappingURL=\S+/g, '');

    if (entry.endsWith('.mjs')) {
      // Angular ESM bundles: use terser to avoid computed-key transforms
      // that break Angular's Babel loader
      const result = await terserMinify(code, TERSER_OPTIONS);
      writeFileSync(fullPath, result.code, 'utf8');
    } else {
      const result = JavaScriptObfuscator.obfuscate(code, OBFUSCATE_OPTIONS);
      writeFileSync(fullPath, result.getObfuscatedCode(), 'utf8');
    }
  }
}

const config = JSON.parse(readFileSync('vendor-config.json', 'utf8'));

(async () => {
  for (const [pkg, ver] of Object.entries(config)) {
    const ref = `${pkg}@${ver}`;
    console.log(`Packing ${ref}...`);
    const packed = execSync(`npm pack "${ref}" --pack-destination vendor/ --quiet`).toString().trim();

    console.log(`Obfuscating ${ref}...`);
    const tmpDir = mkdtempSync(join(tmpdir(), 'vendor-obfuscate-'));
    try {
      execSync(`tar -xzf "vendor/${packed}" -C "${tmpDir}"`);
      await obfuscateDir(tmpDir);
      execSync(`tar -czf "vendor/${packed}" -C "${tmpDir}" package`);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }

    const renamed = packed.replace(/-\d+\.\d+\.\d+(?:-[^.]+)?\.tgz$/, '.tgz');
    renameSync(`vendor/${packed}`, `vendor/${renamed}`);
  }
})();
