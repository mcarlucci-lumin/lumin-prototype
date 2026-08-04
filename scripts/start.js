#!/usr/bin/env node
'use strict';

/**
 * Startup orchestrator for StackBlitz + local dev.
 *
 * Problem: dev-file-server starts in milliseconds; ng serve takes 10–15 s to
 * compile. StackBlitz pins its preview to the FIRST port it detects. If we
 * start dev-file-server first, StackBlitz previews it (blank/Not found) and
 * never shows the Angular app.
 *
 * Solution: start ng serve and the watcher immediately, then poll port 4200
 * until ng serve is accepting connections, and only THEN start dev-file-server.
 * By that point StackBlitz has already detected port 4200 and won't switch.
 */

const { spawn } = require('child_process');
const http      = require('http');

const NG_PORT   = 4200;
const POLL_MS   = 800;

function sh(cmd, args, opts = {}) {
    const proc = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
    proc.on('error', err => console.error(`[start] Failed to start ${cmd}:`, err.message));
    return proc;
}

// ── 1. Start ng serve and watcher immediately ────────────────────────────────
sh('node', ['scripts/wire-prototypes.js', '--watch']);
sh('ng',   ['serve', '--proxy-config', 'proxy.conf.json']);

console.log(`[start] ng serve starting — waiting for port ${NG_PORT}…`);

// ── 2. Poll until ng serve accepts connections ───────────────────────────────
let fileServer;
const poll = setInterval(() => {
    const req = http.get(`http://localhost:${NG_PORT}`, res => {
        res.resume(); // drain to avoid memory leak
        if (fileServer) return; // already started
        clearInterval(poll);
        console.log(`[start] Port ${NG_PORT} ready — starting dev-file-server`);
        fileServer = sh('node', ['scripts/dev-file-server.js']);
    });
    req.on('error', () => {}); // still compiling — ignore and retry
    req.setTimeout(POLL_MS, () => req.destroy());
}, POLL_MS);
