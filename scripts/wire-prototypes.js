#!/usr/bin/env node
'use strict';

/**
 * Scans src/app/prototypes/ for subdirectories that contain a
 * *.component.ts file (any name — it doesn't need to match the directory
 * name) and auto-wires them into:
 *   - src/app/prototype-registry.ts  (home-screen index)
 *   - src/app/app-routing.module.ts  (import + route)
 *   - src/app/app.module.ts          (import + declaration)
 *
 * Usage:
 *   node scripts/wire-prototypes.js           # one-shot
 *   node scripts/wire-prototypes.js --watch   # re-run on any change in prototypes/
 *
 * Optional meta.json alongside the component:
 *   { "name": "Human-Readable Name", "description": "Short description",
 *     "chrome": "desktop-side-nav" }
 *
 * `chrome` names the visual frame the prototype renders inside — one of the ids
 * in src/app/chrome/chrome-options.json. Omitted means the plain 'default' frame.
 * It is deliberately NOT written into prototype-registry.ts: the app fetches it
 * from the served meta.json so changing it never rebuilds a compiled file.
 *
 * Managed regions in app.module.ts are bounded by:
 *   - Imports:      the "Claude: add prototype component imports here" comment
 *                   → terminated by the "// Initialize" comment below it
 *   - Declarations: the "Claude: add prototype components to declarations here" comment
 *                   → terminated by the closing "    ]," of the declarations array
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const PROTOS_DIR = path.join(ROOT, 'src/app/prototypes');
const ROUTING    = path.join(ROOT, 'src/app/app-routing.module.ts');
const MODULE     = path.join(ROOT, 'src/app/app.module.ts');
const REGISTRY   = path.join(ROOT, 'src/app/prototype-registry.ts');

// Same list ChromeService reads, so a meta.json chrome id means the same thing
// to this script, the dev-file-server and the app.
const CHROME_IDS = require('../src/app/chrome/chrome-options.json').map(o => o.id);
const DEFAULT_CHROME = 'default';

// ─── helpers ────────────────────────────────────────────────────────────────

const toPascal = s => s.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join('');
const toTitle  = s => s.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join(' ');

/**
 * In `content`, find the line containing `markerSubstr`, keep it, discard
 * every subsequent line until `terminatorRe` matches, insert `newLines`
 * between the marker and the terminator. Idempotent.
 */
function replaceBetween(content, markerSubstr, terminatorRe, newLines) {
    const lines   = content.split('\n');
    const out     = [];
    let inZone    = false;
    const zoneBuf = []; // previous-run lines held in case terminator never appears

    for (const line of lines) {
        if (!inZone) {
            out.push(line);
            if (line.includes(markerSubstr)) {
                inZone = true;
                out.push(...newLines);
                zoneBuf.length = 0;
            }
        } else if (terminatorRe.test(line)) {
            inZone = false;
            zoneBuf.length = 0;
            out.push(line);
        } else {
            zoneBuf.push(line); // collect — restored below if terminator never found
        }
    }

    // If zone never closed, preserve its original lines to avoid data loss.
    if (inZone) out.push(...zoneBuf);

    return out.join('\n');
}

// ─── discovery ──────────────────────────────────────────────────────────────

/**
 * Finds the component file inside a prototype directory. Any *.component.ts
 * file qualifies — its name doesn't need to match the directory name, since
 * the directory name comes from whatever the user named their dropped zip
 * or folder. If more than one is found, the alphabetically-first one wins
 * and the rest are logged as ignored.
 */
function findComponentFile(dir) {
    const candidates = fs.readdirSync(dir, { withFileTypes: true })
        .filter(f => f.isFile() && f.name.endsWith('.component.ts'))
        .map(f => f.name)
        .sort();

    if (candidates.length > 1) {
        console.warn(`[wire-prototypes] Multiple *.component.ts files in ${path.basename(dir)}/ — using ${candidates[0]}, ignoring ${candidates.slice(1).join(', ')}`);
    }

    return candidates[0] ?? null;
}

/**
 * The chrome id is read at runtime from the served meta.json, not from the
 * generated registry — that is what keeps changing it from rewriting a compiled
 * file and reloading the browser. So nothing is emitted here; this only reports a
 * value the app would silently ignore, since wiring is what runs on every save
 * and every boot.
 */
function warnOnBadChrome(value, slug) {
    if (value === undefined || value === null || value === '') return;
    if (typeof value !== 'string' || !CHROME_IDS.includes(value)) {
        console.warn(`[wire-prototypes] ${slug}/meta.json: unknown chrome ${JSON.stringify(value)} — the app will use '${DEFAULT_CHROME}'. Valid ids: ${CHROME_IDS.join(', ')}`);
    }
}

function discover() {
    if (!fs.existsSync(PROTOS_DIR)) return [];

    return fs.readdirSync(PROTOS_DIR, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .flatMap(e => {
            const slug    = e.name;
            const dir     = path.join(PROTOS_DIR, slug);
            const compName = findComponentFile(dir);
            if (!compName) return [];

            const compFile = path.join(dir, compName);
            const baseName = compName.replace(/\.ts$/, '');

            const src   = fs.readFileSync(compFile, 'utf8');
            const match = src.match(/export\s+class\s+(\w+)/);
            const className = match ? match[1] : `${toPascal(slug)}Component`;

            let meta = {};
            const metaFile = path.join(dir, 'meta.json');
            if (fs.existsSync(metaFile)) {
                try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch {}
            }
            warnOnBadChrome(meta.chrome, slug);

            return [{
                slug,
                className,
                importPath:  `./prototypes/${slug}/${baseName}`,
                displayName: meta.name        ?? toTitle(slug),
                description: meta.description ?? '',
            }];
        });
}

// ─── writers ────────────────────────────────────────────────────────────────

function updateRegistry(prototypes) {
    const lines = [
        `export interface PrototypeMeta {`,
        `    name: string;`,
        `    path: string;`,
        `    description?: string;`,
        `}`,
        ``,
        `// ─── Claude: add one entry per prototype here ────────────────────────────────`,
        `export const PROTOTYPES: PrototypeMeta[] = [`,
    ];

    for (const p of prototypes) {
        const desc = p.description ? `, description: ${JSON.stringify(p.description)}` : '';
        lines.push(`    { name: ${JSON.stringify(p.displayName)}, path: '/${p.slug}'${desc} },`);
    }

    lines.push(`];`, ``);
    const next = lines.join('\n');
    if (!fs.existsSync(REGISTRY) || fs.readFileSync(REGISTRY, 'utf8') !== next) {
        fs.writeFileSync(REGISTRY, next);
    }
}

function updateRouting(prototypes) {
    const lines = [
        `import { NgModule } from '@angular/core';`,
        `import { RouterModule, Routes } from '@angular/router';`,
        ``,
        `import { HomeComponent } from './home/home.component';`,
        ``,
        `// ─── Claude: add prototype component imports here ───────────────────────────`,
    ];

    if (prototypes.length > 0) {
        lines.push(...prototypes.map(p => `import { ${p.className} } from '${p.importPath}';`));
    }
    lines.push('');

    lines.push(
        `const routes: Routes = [`,
        `    { path: '', component: HomeComponent },`,
        `    // ─── Claude: add prototype routes here ──────────────────────────────────`,
    );

    if (prototypes.length > 0) {
        lines.push(...prototypes.map(p => `    { path: '${p.slug}', component: ${p.className} },`));
    }

    lines.push(
        `];`,
        ``,
        `@NgModule({`,
        `    imports: [RouterModule.forRoot(routes)],`,
        `    exports: [RouterModule]`,
        `})`,
        `export class AppRoutingModule {}`,
        ``,
    );

    const next = lines.join('\n');
    if (!fs.existsSync(ROUTING) || fs.readFileSync(ROUTING, 'utf8') !== next) {
        fs.writeFileSync(ROUTING, next);
    }
}

function updateModule(prototypes) {
    const original = fs.readFileSync(MODULE, 'utf8');
    let content = original;

    const importLines = [
        ...prototypes.map(p => `import { ${p.className} } from '${p.importPath}';`),
        '',
    ];

    const declarationLines = prototypes.map(p => `        ${p.className},`);

    content = replaceBetween(
        content,
        '─── Claude: add prototype component imports here',
        /\/\/ Initialize/,
        importLines
    );

    content = replaceBetween(
        content,
        '─── Claude: add prototype components to declarations here',
        /^\s+\],/,
        declarationLines
    );

    if (!content.includes('export class AppModule')) {
        throw new Error('updateModule produced invalid output — write aborted to prevent data loss');
    }
    if (content !== original) {
        fs.writeFileSync(MODULE, content);
    }
}

// ─── main ───────────────────────────────────────────────────────────────────

function run() {
    const protos = discover();
    updateRegistry(protos);
    updateRouting(protos);
    updateModule(protos);
    const names = protos.map(p => p.slug).join(', ') || '(none)';
    console.log(`[wire-prototypes] ${protos.length} prototype(s) wired: ${names}`);
}

if (require.main === module) {
    if (process.argv.includes('--watch')) {
        console.log('[wire-prototypes] Watching src/app/prototypes for changes…');
        run();

        let debounce;
        fs.watch(PROTOS_DIR, { recursive: true }, (_, filename) => {
            if (!filename) return;
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                console.log(`[wire-prototypes] Change detected: ${filename}`);
                try { run(); } catch (e) { console.error('[wire-prototypes] Error:', e.message); }
            }, 3000);
        });
    } else {
        run();
    }
}

module.exports = { run };
