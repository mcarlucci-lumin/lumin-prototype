# Lumin Prototype Sandbox

A live, shareable sandbox for viewing and demoing UI prototypes built with the Lumin Design System.

Open one link in your browser and you get a working app with real Lumin components — real buttons, cards, forms, layouts and styling. Nothing to install.

---

## Open the sandbox

[https://stackblitz.com/github/mcarlucci-lumin/lumin-prototype](https://stackblitz.com/~/github.com/mcarlucci-lumin/lumin-prototype)

Click the link and wait roughly 60 seconds the first time. StackBlitz downloads the project, installs everything, and starts the app in the preview pane on the right.

When it's ready you'll land on the **Prototypes** page — a gallery of every prototype currently in the sandbox. Click any tile to open that prototype full screen. Use your browser's back button to return to the gallery.

---

## Add a prototype

You don't need to edit any code. The Prototypes page has a drop zone at the top.

**Drag a prototype folder onto it**, or drag a `.zip` of that folder. The app uploads the files, wires the prototype up for you, and it appears as a new tile in the gallery a few seconds later.

A prototype folder looks like this:

```
example-prototype/
├── example-prototype.component.ts     (required)
├── example-prototype.component.html   (optional)
└── example-prototype.component.scss   (optional)
```

Three rules worth knowing:

- **The folder name becomes the address.** A folder named `loan-application` shows up at `/loan-application` in the gallery, and its tile is titled "Loan Application."
- **The file names must match the folder name.** `loan-application/loan-application.component.ts`, not `loan-application/main.component.ts`.
- **Only `.component.ts`, `.component.html` and `.component.scss` files are accepted.** Anything else in the folder is quietly ignored. The `.ts` file is the only one that's required.

If you drop a `.zip`, the zip's file name (minus `.zip`) becomes the folder name.

Typically Claude or a developer hands you the folder and you just drop it in.

---

## Remove a prototype

Hover over a tile in the gallery and click the trash icon in its corner. The prototype is deleted and the page refreshes on its own.

---

## Important: changes are temporary

A StackBlitz session is your own private, disposable copy. Prototypes you add or remove live only in that browser tab.

- **Closing the tab discards your changes.** Reopening the link gives you a fresh copy of the shared sandbox.
- **Other people don't see your uploads.** To share a prototype you added, either send them the prototype folder so they can drop it in themselves, or ask a developer to commit it to the repo so it's in the gallery for everyone.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| Preview pane is blank after it finishes loading | Click the refresh icon in the preview pane, or open the preview in its own browser tab using the "Open in new tab" icon at its top-right. |
| Still loading after 3 minutes | Close the tab and open the link again. StackBlitz occasionally stalls on the first load. |
| Red error text in the terminal pane at the bottom | Something in the prototype code doesn't compile. Copy the error text and send it to whoever gave you the prototype. |
| "Could not reach the dev file server" after a drop | The sandbox is still starting up, or it went to sleep. Reload the page and try the drop again. |
| Dropped a folder and nothing appeared | Check the folder name matches the `.component.ts` file name, and that you dropped the folder itself rather than the files inside it. |
| Icons show as words like `arrow_forward` instead of symbols | Cosmetic only — the icon font didn't load. Layout and behavior are still accurate. |

---
---

# For developers

Everything below is setup and maintenance. Non-developers don't need any of it.

## How the sandbox works

The `@a3-digital/*` packages are private. Rather than making StackBlitz authenticate against the private registry at runtime, this repo commits pre-built tarballs to `vendor/` and points `package.json` at them via `file:./vendor/*.tgz`, so `npm install` unpacks local files instead of hitting the registry. That's why **the repo must stay private** — the tarballs contain compiled private library code.

`npm start` runs [`scripts/start.js`](scripts/start.js), which supervises three processes:

| Process | Role |
|---|---|
| `wire-prototypes --watch` | Watches `src/app/prototypes/` and regenerates the registry, routes and module declarations on change |
| `ng serve` (port 4200) | The Angular dev server; its output is scanned for `Failed to compile.` and the group is restarted when that appears |
| `dev-file-server` (port 7788) | Local HTTP API backing the drop zone — upload, unzip, delete, re-wire. Started only after 4200 is up, so StackBlitz opens the app and not the API in its preview. |

Auto-wiring means prototypes never require manual edits to `app.module.ts` or `app-routing.module.ts`. Those three generated files are gitignored:

- [`src/app/prototype-registry.ts`](src/app/prototype-registry.ts) — powers the gallery
- [`src/app/app-routing.module.ts`](src/app/app-routing.module.ts) — `/` → home, `/<slug>` → prototype
- [`src/app/app.module.ts`](src/app/app.module.ts) — imports and declarations

Run the wiring by hand with `npm run wire` if you ever need to.

In StackBlitz's WebContainers, process-to-process localhost networking doesn't work, so the `ng serve` proxy (`/api` → `:7788`) can't reach the file server. The home component detects a webcontainer hostname and calls port 7788 directly by rewriting the `--4200--` segment of the URL. See [`home.component.ts:12-18`](src/app/home/home.component.ts#L12-L18).

## Running locally

```bash
npm install          # requires npm auth for @a3-digital, or an existing vendor/
npm start            # http://localhost:4200
```

To rebuild the vendor tarballs from the private registry (needs npm auth):

```bash
npm run vendor:install
```

## One-time repo setup

1. **Private GitHub repo** — required; the vendor tarballs are private code.
2. **Add the npm token secret** — Settings → Secrets and variables → Actions → New repository secret:

   | Name | Value |
   |---|---|
   | `NPM_TOKEN` | Read-only npm token with `@a3-digital` scope access. Create with `npm token create --read-only`. |

3. **Run the vendor workflow** — Actions → *Refresh vendor packages* → Run workflow. It packs each package in `vendor-config.json`, rewrites `package.json` to `file:./vendor/` references, and commits both to `main`.
4. **Smoke test** — open the StackBlitz link and confirm the Prototypes page renders.

## Updating package versions

Edit [`vendor-config.json`](vendor-config.json) and bump the version(s). Pushing to `main` triggers [`update-vendor.yml`](.github/workflows/update-vendor.yml) automatically. The workflow also runs weekly (Mondays, 02:00 UTC) to pick up patch releases within the configured ranges, and can be dispatched manually.

## Adding a prototype from the command line

Create `src/app/prototypes/<slug>/<slug>.component.ts` (plus optional `.html` / `.scss`). The watcher wires it on save. Every `Ui*Module` is already imported in `app.module.ts`, so prototype components need no extra module setup.

Optionally add a `meta.json` next to the component to control how the tile reads:

```json
{ "name": "Loan Application", "description": "Multi-step application flow" }
```

Note that `meta.json` only applies to prototypes added on disk or committed to the repo — the drop zone filters out everything that isn't a `.component.*` file, so a dropped `meta.json` is discarded and the tile falls back to the title-cased folder name.

To share a prototype with everyone, commit it and push to `main`. To share a one-off variant, push a branch and send its StackBlitz URL:

```
https://stackblitz.com/github/mcarlucci-lumin/lumin-prototype/tree/prototype/loan-application
```

## Repository structure

```
lumin-prototype/
├── .github/workflows/
│   └── update-vendor.yml         # Packs @a3-digital tarballs, commits to vendor/
├── scripts/
│   ├── start.js                  # Supervises watcher + ng serve + file server
│   ├── wire-prototypes.js        # Generates registry, routes, module declarations
│   ├── dev-file-server.js        # Upload / unzip / delete API on :7788
│   ├── pack-vendor.js            # npm pack each @a3-digital package
│   └── update-vendor-refs.js     # Rewrites package.json to file:./vendor/ refs
├── src/app/
│   ├── home/                     # Prototype gallery + drop zone
│   ├── prototypes/               # One directory per prototype
│   ├── prototype-registry.ts     # generated
│   ├── app-routing.module.ts     # generated
│   ├── app.module.ts             # generated regions
│   └── styles/fonts.scss
├── vendor/                       # Pre-built @a3-digital tarballs (committed by CI)
├── vendor-config.json            # Pinned @a3-digital versions — edit to upgrade
├── proxy.conf.json               # /api → localhost:7788 (local dev only)
└── stackblitz.json               # startCommand: npm start
```

## Developer troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails on StackBlitz with "Cannot find package" | Vendor tarballs are missing or stale. Run *Refresh vendor packages*, then reopen the link. |
| Import error for a `@a3-digital` package | The package isn't in `vendor-config.json`. Add it and re-run the workflow. |
| Prototype dropped but never appears | The component file name must match its folder name. Check the `[wire-prototypes]` line in the terminal for the count of wired prototypes. |
| Dev server restart loop | `start.js` restarts on `Failed to compile.` with a 10s minimum gap. A persistent compile error will log "Restart suppressed" — fix the error in the prototype source. |
| Local drop zone requests 404 | The file server only runs under `npm start`; `ng serve` alone doesn't start it. |
