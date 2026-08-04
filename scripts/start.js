#!/usr/bin/env node
'use strict';

/**
 * Startup orchestrator.
 *
 * Manages three child processes:
 *   1. wire-prototypes --watch   (file-system watcher, always running)
 *   2. ng serve                  (Angular dev server, stdout scanned for errors)
 *   3. dev-file-server           (upload API, started only after ng serve is ready)
 *
 * Auto-restart: if ng serve emits "Failed to compile." the entire group is
 * killed and restarted so wire-prototypes re-scans with whatever is on disk.
 * A minimum gap between restarts prevents loops when the error is persistent.
 */

const { spawn } = require('child_process');
const http      = require('http');

const NG_PORT        = 4200;
const POLL_MS        = 800;
const RESTART_DELAY    = 2000;  // ms to wait before restarting after a compile error
const RESTART_MIN_GAP  = 10000; // min ms between successive auto-restarts

let allChildren   = [];
let restartTimer  = null;
let lastRestart   = 0;
let restarting    = false;

// ── helpers ──────────────────────────────────────────────────────────────────

function sh(cmd, args, opts = {}) {
    const proc = spawn(cmd, args, {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        ...opts,
    });
    proc.on('error', err => console.error(`[start] ${cmd}: ${err.message}`));
    return proc;
}

function killAll() {
    for (const c of allChildren) {
        try { c.kill('SIGTERM'); } catch {}
    }
    allChildren = [];
}

// ── restart logic ─────────────────────────────────────────────────────────────

function scheduleRestart() {
    if (restarting) return;
    const now = Date.now();
    if (now - lastRestart < RESTART_MIN_GAP) {
        console.log(`[start] Restart suppressed — minimum gap of ${RESTART_MIN_GAP / 1000}s between restarts`);
        return;
    }
    if (restartTimer) return;

    console.log(`[start] "Failed to compile." detected — restarting in ${RESTART_DELAY / 1000}s…`);
    restartTimer = setTimeout(() => {
        restartTimer  = null;
        lastRestart   = Date.now();
        restarting    = true;
        killAll();
        setTimeout(() => {
            restarting = false;
            startAll();
        }, 500); // brief pause so ports are released
    }, RESTART_DELAY);
}

// ── startup ───────────────────────────────────────────────────────────────────

function startAll() {
    // 1. Wire-prototypes watcher — runs run() at startup so routing is correct
    //    from the first compile even after a restart.
    const wire = sh('node', ['scripts/wire-prototypes.js', '--watch']);
    allChildren.push(wire);

    // 2. ng serve — stdout piped so we can detect "Failed to compile."
    const ng = spawn('ng', ['serve', '--proxy-config', 'proxy.conf.json'], {
        shell: process.platform === 'win32',
        stdio: ['inherit', 'pipe', 'pipe'],
    });
    allChildren.push(ng);

    let ngBuf = '';
    ng.stdout.on('data', chunk => {
        process.stdout.write(chunk);
        ngBuf += chunk.toString();
        if (ngBuf.includes('Failed to compile.')) {
            ngBuf = '';
            scheduleRestart();
        }
        if (ngBuf.length > 4_000) ngBuf = ngBuf.slice(-2_000); // bound buffer
    });
    ng.stderr.on('data', chunk => process.stderr.write(chunk));

    // 3. dev-file-server — started only once ng serve is accepting connections
    //    so StackBlitz always detects port 4200 first.
    console.log(`[start] ng serve starting — waiting for port ${NG_PORT}…`);

    let fileServer = null;
    const pollId = { id: null };
    pollId.id = setInterval(() => {
        if (restarting) { clearInterval(pollId.id); return; }
        const req = http.get(`http://localhost:${NG_PORT}`, res => {
            res.resume();
            if (fileServer || restarting) return;
            clearInterval(pollId.id);
            console.log(`[start] Port ${NG_PORT} ready — starting dev-file-server`);
            fileServer = sh('node', ['scripts/dev-file-server.js']);
            allChildren.push(fileServer);
        });
        req.on('error', () => {});
        req.setTimeout(POLL_MS, () => req.destroy());
    }, POLL_MS);
    allChildren.push({ kill: () => clearInterval(pollId.id) });
}

// ── entry point ───────────────────────────────────────────────────────────────

process.on('SIGINT',  () => { killAll(); process.exit(0); });
process.on('SIGTERM', () => { killAll(); process.exit(0); });

startAll();
