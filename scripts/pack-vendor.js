#!/usr/bin/env node
const { execSync } = require('child_process');
const { readFileSync, renameSync } = require('fs');

const config = JSON.parse(readFileSync('vendor-config.json', 'utf8'));

for (const [pkg, ver] of Object.entries(config)) {
  const ref = `${pkg}@${ver}`;
  console.log(`Packing ${ref}...`);
  const packed = execSync(`npm pack "${ref}" --pack-destination vendor/ --quiet`).toString().trim();
  const renamed = packed.replace(/-\d+\.\d+\.\d+(?:-[^.]+)?\.tgz$/, '.tgz');
  renameSync(`vendor/${packed}`, `vendor/${renamed}`);
}
