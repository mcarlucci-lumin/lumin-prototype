#!/usr/bin/env node
'use strict';

/**
 * Regenerates package-lock.json so StackBlitz can boot without re-resolving
 * the dependency tree. Run this whenever vendor/ or package.json changes.
 *
 * Two non-obvious things this handles.
 *
 * 1. It generates the lockfile in a scratch directory.
 *    `npm install --package-lock-only` reuses an existing node_modules tree
 *    when one is present, and the lockfile it writes then omits `resolved`
 *    for most packages — 870 of 972 entries, in practice. Such a lockfile
 *    pins versions but still forces npm to fetch registry metadata for
 *    almost every package on install, which is most of what we are trying
 *    to avoid. Generating against an empty directory produces a complete
 *    lockfile with `resolved` + `integrity` on every registry entry.
 *
 * 2. It strips `integrity` from the `file:` vendor entries.
 *    npm computes that hash over a *repack* of the tarball rather than its
 *    raw bytes, and the repack is not byte-reproducible between npm runs.
 *    A lockfile that keeps those hashes installs fine on the machine that
 *    generated it (warm cache) and then fails everywhere else with:
 *
 *        npm error code EINTEGRITY
 *        npm error sha512-... integrity checksum failed when using sha512
 *
 *    which is precisely a fresh StackBlitz WebContainer. Both `npm ci` and
 *    `npm install` fail this way. Dropping integrity for the 13 vendor
 *    entries makes npm read them straight off disk, so vendor refreshes also
 *    always propagate. The ~960 registry entries keep their integrity.
 */

const { execFileSync } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const lockPath = path.join(repoRoot, 'package-lock.json');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lumin-lock-'));

try {
    // A pristine tree — no node_modules — so npm records `resolved` for everything.
    for (const entry of ['package.json', '.npmrc']) {
        const from = path.join(repoRoot, entry);
        if (fs.existsSync(from)) fs.copyFileSync(from, path.join(scratch, entry));
    }
    fs.cpSync(path.join(repoRoot, 'vendor'), path.join(scratch, 'vendor'), { recursive: true });

    console.log('[refresh-lock] Resolving dependency tree…');
    execFileSync('npm', ['install', '--package-lock-only', '--no-audit', '--no-fund'], {
        cwd: scratch,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });

    const lock = JSON.parse(fs.readFileSync(path.join(scratch, 'package-lock.json'), 'utf8'));

    let stripped = 0;
    for (const entry of Object.values(lock.packages ?? {})) {
        if ((entry.resolved ?? '').startsWith('file:') && entry.integrity) {
            delete entry.integrity;
            stripped++;
        }
    }

    const total    = Object.keys(lock.packages ?? {}).length;
    const resolved = Object.values(lock.packages ?? {}).filter(e => e.resolved).length;

    // A lockfile missing `resolved` on most entries would still "work" while
    // quietly giving back the slow boot this script exists to prevent.
    if (resolved < total * 0.9) {
        throw new Error(`Only ${resolved}/${total} entries have a resolved URL — lockfile is incomplete.`);
    }

    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    console.log(`[refresh-lock] Wrote package-lock.json — ${total} packages, ${resolved} resolved, integrity stripped from ${stripped} vendor entries.`);
} finally {
    fs.rmSync(scratch, { recursive: true, force: true });
}
