/**
 * Reads vendor-config.json to get the canonical @a3-digital package versions,
 * constructs the expected tarball filenames (matching npm pack's output format),
 * and updates package.json dependencies to use file:./vendor/<tarball> references.
 *
 * Run: node scripts/update-vendor-refs.js
 * Called by the update-vendor GHA workflow after packing tarballs.
 */

const { readFileSync, writeFileSync } = require('fs');

const config = JSON.parse(readFileSync('vendor-config.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

let updated = 0;

for (const [packageName, version] of Object.entries(config)) {
    // npm pack converts @scope/name → scope-name (drops @, replaces / with -)
    // e.g. @a3-digital/ui-core@4.0.59 → a3-digital-ui-core-4.0.59.tgz
    const tarballName = packageName.replace('@', '').replace('/', '-') + `-${version.replace('^', '')}.tgz`;
    const fileRef = `file:./vendor/${tarballName}`;

    if (pkg.dependencies?.[packageName] !== undefined) {
        pkg.dependencies[packageName] = fileRef;
        updated++;
    }
}

writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`Updated ${updated} @a3-digital package references to file:./vendor/ paths.`);
