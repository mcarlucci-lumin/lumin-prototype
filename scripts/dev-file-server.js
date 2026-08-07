#!/usr/bin/env node
'use strict';

/**
 * Tiny local HTTP server that lets the Angular dev app write/delete files in
 * src/app/prototypes/ and keeps wiring in sync.
 *
 * Endpoints:
 *   POST   /upload            X-File-Path: <relative>   body: raw bytes
 *   POST   /upload-zip        X-Dir-Name:  <slug>       body: raw zip bytes
 *   DELETE /prototype/<slug>                            removes dir + re-wires
 *
 * Accepted files: <slug>.component.{ts,html,scss} and meta.json. Everything
 * else in a dropped folder or zip is ignored.
 *
 * Path traversal is rejected. Only called from localhost — no auth needed.
 */

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const zlib   = require('zlib');
const { spawnSync } = require('child_process');

const PORT        = 7788;
const PROTOS      = path.resolve(__dirname, '../src/app/prototypes');
const WIRE_SCRIPT = path.join(__dirname, 'wire-prototypes.js');

// Uploads are restricted to the files wire-prototypes.js actually consumes.
// meta.json must be exactly that — wire-prototypes.js looks it up by exact
// name, so accepting "Meta.json" would silently write a file it never reads.
const ALLOWED       = /(?:\.component\.(ts|html|scss)|(?:^|\/)meta\.json)$/;
const ALLOWED_HUMAN = '.component.ts, .component.html, .component.scss and meta.json';
const IS_META       = /(?:^|\/)meta\.json$/;

// OS bookkeeping files ride along in any dropped folder. These are skipped with
// a 200 rather than rejected: the client aborts the whole upload batch on the
// first non-OK response, so a single .DS_Store would fail an entire folder drop.
const IGNORED = /(?:^|\/)(?:\.DS_Store|Thumbs\.db|desktop\.ini)$|(?:^|\/)__MACOSX(?:\/|$)/;

async function wireWithRetry() {
    const MAX = 3;
    let lastErr;
    for (let i = 1; i <= MAX; i++) {
        const r = spawnSync(process.execPath, [WIRE_SCRIPT], { stdio: 'inherit' });
        if (!r.error && r.status === 0) return;
        lastErr = r.error ?? new Error(`wire-prototypes exited ${r.status}`);
        console.error(`[dev-file-server] wire attempt ${i}/${MAX} failed: ${lastErr.message}`);
        if (i < MAX) await new Promise(resolve => setTimeout(resolve, 600 * i)); // 600 ms, 1200 ms
    }
    throw lastErr;
}

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'X-File-Path, X-Dir-Name, Content-Type',
};

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end',  () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

/**
 * Returns a human-readable problem with a meta.json payload, or null if it is
 * usable. Only `name` and `description` are read by wire-prototypes.js; other
 * keys are allowed through so the format can grow without breaking uploads.
 */
function validateMeta(buffer) {
    let parsed;
    try {
        parsed = JSON.parse(buffer.toString('utf8'));
    } catch (e) {
        return `not valid JSON (${e.message})`;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return 'must contain a JSON object, e.g. { "name": "Loan Application" }';
    }
    for (const key of ['name', 'description']) {
        if (key in parsed && typeof parsed[key] !== 'string') {
            return `"${key}" must be a string`;
        }
    }
    return null;
}

function safePath(relative) {
    const resolved = path.resolve(PROTOS, relative);
    if (!resolved.startsWith(PROTOS + path.sep) && resolved !== PROTOS) {
        throw new Error('Path traversal rejected');
    }
    return resolved;
}

/**
 * Pure-Node ZIP extractor — no native binaries required (works in WebContainers).
 * Supports stored (method 0) and DEFLATE (method 8) entries.
 */
function extractZip(buffer, destDir) {
    // Walk backwards to find the End of Central Directory record (signature PK\x05\x06)
    let eocd = -1;
    for (let i = buffer.length - 22; i >= 0; i--) {
        if (buffer[i] === 0x50 && buffer[i+1] === 0x4b &&
            buffer[i+2] === 0x05 && buffer[i+3] === 0x06) {
            eocd = i;
            break;
        }
    }
    if (eocd === -1) throw new Error('Invalid zip file (no EOCD record)');

    const cdCount  = buffer.readUInt16LE(eocd + 10);
    const cdOffset = buffer.readUInt32LE(eocd + 16);

    let pos = cdOffset;
    for (let i = 0; i < cdCount; i++) {
        if (buffer.readUInt32LE(pos) !== 0x02014b50) break; // central dir signature

        const method      = buffer.readUInt16LE(pos + 10);
        const compSize    = buffer.readUInt32LE(pos + 20);
        const fnLen       = buffer.readUInt16LE(pos + 28);
        const extraLen    = buffer.readUInt16LE(pos + 30);
        const commentLen  = buffer.readUInt16LE(pos + 32);
        const localOff    = buffer.readUInt32LE(pos + 42);
        const filename    = buffer.toString('utf8', pos + 46, pos + 46 + fnLen);
        pos += 46 + fnLen + extraLen + commentLen;

        if (filename.endsWith('/')) continue; // directory entry — created on demand
        if (!ALLOWED.test(filename)) continue; // skip non-component files

        // Jump to local file header to find actual data offset
        const lfhFnLen    = buffer.readUInt16LE(localOff + 26);
        const lfhExtraLen = buffer.readUInt16LE(localOff + 28);
        const dataStart   = localOff + 30 + lfhFnLen + lfhExtraLen;
        const compressed  = buffer.subarray(dataStart, dataStart + compSize);

        let data;
        if (method === 0)      data = compressed;                      // stored
        else if (method === 8) data = zlib.inflateRawSync(compressed); // deflate
        else throw new Error(`Zip entry "${filename}" uses unsupported compression ${method}`);

        if (IS_META.test(filename)) {
            const problem = validateMeta(data);
            if (problem) throw new Error(`${filename}: ${problem}`);
        }

        const dest = path.join(destDir, filename);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, data);
    }
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
    }
}

const server = http.createServer(async (req, res) => {
    Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = req.url?.split('?')[0];

    // ── GET / — redirect preview to the Angular app (port 4200) ───────────
    // StackBlitz opens the first ready port in its preview pane. Since this
    // server starts faster than ng serve, redirect any browser landing here
    // to port 4200 by swapping the port in the URL (works for both StackBlitz
    // webcontainer hostnames and plain localhost).
    if (req.method === 'GET' && (url === '/' || url === '')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html><html><head>
<script>
var u = location.href.replace(/--${PORT}--/, '--4200--').replace(':${PORT}', ':4200');
if (u !== location.href) location.replace(u);
</script>
</head><body>Redirecting to app…</body></html>`);
        return;
    }

    // ── POST /upload ───────────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/upload') {
        const filePath = req.headers['x-file-path'];
        if (!filePath) { res.writeHead(400); res.end('Missing X-File-Path'); return; }
        if (IGNORED.test(filePath)) { res.writeHead(200); res.end('Ignored'); return; }
        if (!ALLOWED.test(filePath)) { res.writeHead(400); res.end(`Only ${ALLOWED_HUMAN} files are allowed`); return; }

        try {
            const dest = safePath(filePath);
            const body = await readBody(req);

            // wire-prototypes.js swallows unparseable meta.json and silently falls
            // back to the title-cased folder name. Reject it here instead, so the
            // drop zone can tell the user rather than leaving them to wonder why
            // their tile is named wrong.
            if (IS_META.test(filePath)) {
                const problem = validateMeta(body);
                if (problem) { res.writeHead(400); res.end(`${filePath}: ${problem}`); return; }
            }

            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, body);
            console.log(`[dev-file-server] + ${filePath}`);
            res.writeHead(200); res.end('OK');
        } catch (e) {
            console.error('[dev-file-server] Error:', e.message);
            res.writeHead(500); res.end(e.message);
        }
        return;
    }

    // ── POST /upload-zip ───────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/upload-zip') {
        const raw     = req.headers['x-dir-name'] ?? '';
        const dirName = raw.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
        if (!dirName) { res.writeHead(400); res.end('Missing X-Dir-Name'); return; }

        let tmpDir;
        try {
            const body   = await readBody(req);
            tmpDir       = fs.mkdtempSync(path.join(os.tmpdir(), 'lumin-proto-'));
            const unzipD = path.join(tmpDir, 'out');

            fs.mkdirSync(unzipD);
            extractZip(body, unzipD);

            // If zip had a single top-level directory, unwrap it
            const topLevel = fs.readdirSync(unzipD, { withFileTypes: true });
            const src = (topLevel.length === 1 && topLevel[0].isDirectory())
                ? path.join(unzipD, topLevel[0].name)
                : unzipD;

            const dest = safePath(dirName);
            copyDir(src, dest);
            console.log(`[dev-file-server] + ${dirName}/ (from zip)`);
            await wireWithRetry();
            res.writeHead(200); res.end('OK');
        } catch (e) {
            console.error('[dev-file-server] Error:', e.message);
            res.writeHead(500); res.end(e.message);
        } finally {
            if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        return;
    }

    // ── POST /finalize ─────────────────────────────────────────────────────
    // Called by the Angular app after all files in a directory upload are done.
    // Runs wire-prototypes synchronously so every file is on disk before wiring.
    if (req.method === 'POST' && url === '/finalize') {
        try {
            await wireWithRetry();
            res.writeHead(200); res.end('OK');
        } catch (e) {
            res.writeHead(500); res.end(e.message);
        }
        return;
    }

    // ── DELETE /prototype/:slug ────────────────────────────────────────────
    const deleteMatch = url?.match(/^\/prototype\/([a-z0-9_-]+)$/i);
    if (req.method === 'DELETE' && deleteMatch) {
        const slug = deleteMatch[1];
        const dir  = path.join(PROTOS, slug);

        try {
            if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
                res.writeHead(404); res.end('Prototype not found'); return;
            }
            fs.rmSync(dir, { recursive: true, force: true });
            console.log(`[dev-file-server] - ${slug}/`);
            // Re-wire synchronously so the caller can reload once files are settled
            await wireWithRetry();
            res.writeHead(200); res.end('OK');
        } catch (e) {
            console.error('[dev-file-server] Error:', e.message);
            res.writeHead(500); res.end(e.message);
        }
        return;
    }

    res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
    // Log port number as plain text so StackBlitz does NOT parse it as a
    // server URL and open it in the preview pane instead of ng serve (4200).
    console.log(`[dev-file-server] ready on port ${PORT}`);
});
