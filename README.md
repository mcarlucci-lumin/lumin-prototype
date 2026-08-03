# Lumin Prototype Template

A StackBlitz-ready Angular app for building and sharing UI prototypes using the Lumin Design System — no local dev environment, no Docker, no npm auth required for non-developers.

A developer sets this up once. After that, non-devs open a StackBlitz link and see a live, interactive prototype built with real Lumin components.

---

## How it works

The `@a3-digital/ui-*` packages are private npm packages. Rather than requiring StackBlitz to authenticate with the private registry at runtime, this repo stores pre-built package tarballs in `vendor/`. The `package.json` references them as `file:./vendor/*.tgz`, so `npm install` unpacks local files instead of hitting the registry.

A GitHub Action (using an `NPM_TOKEN` secret) refreshes those tarballs whenever `vendor-config.json` changes, on a weekly schedule, or on demand.

---

## Part 1 — For developers (setup & maintenance)

### One-time setup

**1. Create the GitHub repo**

Create a new **private** GitHub repository (the `vendor/` tarballs contain compiled private library code) and push this directory to it.

**2. Add the npm token secret**

In the repo: **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|---|---|
| `NPM_TOKEN` | A read-only npm token with access to the `@a3-digital` scope. Generate one with `npm token create --read-only`. |

**3. Run the vendor workflow**

Go to **Actions → Refresh vendor packages → Run workflow**.

This packs each `@a3-digital` package listed in `vendor-config.json`, updates `package.json` to use `file:./vendor/` references, and commits both back to `main`. After it completes, the repo is ready to use.

**4. Smoke-test in StackBlitz**

Open `https://stackblitz.com/github/<org>/<repo>` in a browser. StackBlitz clones the repo, runs `npm install` (unpacking the vendor tarballs + installing public Angular deps), and boots `ng serve`. You should see a blank page at `/` — the template is working.

---

### Updating package versions

Edit `vendor-config.json` and bump the version number(s). Pushing to `main` triggers the workflow automatically.

```json
{
  "@a3-digital/ui-core": "4.1.0",
  ...
}
```

---

### Adding a prototype (manual path)

Each prototype is a standard Angular component placed in `src/app/prototypes/`. After adding the files:

1. Import and declare the component in [`src/app/app.module.ts`](src/app/app.module.ts)
2. Add the route in [`src/app/app-routing.module.ts`](src/app/app-routing.module.ts)
3. Add a root redirect so StackBlitz opens directly on the prototype: `{ path: '', redirectTo: 'my-prototype', pathMatch: 'full' }`
4. Push to a new branch (e.g. `prototype/loan-application-2025-08-03`)
5. Share the StackBlitz URL: `https://stackblitz.com/github/<org>/<repo>/tree/prototype/loan-application-2025-08-03`

The non-dev just opens the link — no setup needed on their end.

---

### Claude auto-push (recommended path)

When using the `lumin-ui` skill in Claude Code with the `lumin-design-mcp` connected, Claude generates prototype components and can push them to this repo automatically, then share a ready-to-open StackBlitz link.

> **Status:** see `lumin-design-mcp` for the `publish_prototype` tool or the SKILL.md placement option that implements this flow.

---

## Part 2 — For non-developers (using a prototype)

You will receive a link from a developer or from Claude. It looks like:

```
https://stackblitz.com/github/<org>/<repo>/tree/prototype/some-name
```

1. Click the link
2. Wait ~60 seconds for StackBlitz to install dependencies and start the app
3. The prototype opens in the preview pane on the right

You do not need to install anything. You do not need a GitHub account, npm, Node, or the banking codebase. The link is everything.

### If the preview pane is blank after loading

Click the refresh icon in the StackBlitz preview pane, or open the preview URL in a new tab (the "Open in new tab" icon in the top-right of the preview).

### If you see an error in the terminal pane

The prototype branch may be missing a component declaration or route. Send the error text to the developer who created the prototype.

---

## Repository structure

```
lumin-prototype/
├── .github/workflows/
│   └── update-vendor.yml        # Packs @a3-digital tarballs, commits to vendor/
├── scripts/
│   └── update-vendor-refs.js    # Updates package.json to file:./vendor/ refs
├── src/
│   ├── app/
│   │   ├── app.module.ts        # Imports all Ui*Modules — prototypes need nothing extra
│   │   ├── app-routing.module.ts
│   │   ├── app.component.*
│   │   ├── styles/fonts.scss
│   │   └── prototypes/          # Generated prototype components land here
│   ├── index.html
│   ├── main.ts
│   └── styles.scss              # Lumin design tokens + global styles
├── vendor/                      # Pre-built @a3-digital tarballs (committed by GHA)
├── vendor-config.json           # Pinned @a3-digital package versions — edit to upgrade
├── angular.json
├── package.json                 # @a3-digital refs are file:./vendor/ after first GHA run
├── tsconfig.json
└── stackblitz.json
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails on StackBlitz with "Cannot find package" | The vendor tarballs may be missing or outdated. Run the **Refresh vendor packages** workflow, then re-open the StackBlitz link. |
| `ng serve` fails with a module import error | A new `@a3-digital` package was added to the component but not to `vendor-config.json`. Add it there and re-run the workflow. |
| StackBlitz takes more than 3 minutes to load | Close and re-open the link. StackBlitz occasionally stalls on first clone of a new branch. |
| Fonts or icons look wrong (text instead of icons) | Cosmetic only — the icon font file path may differ from what `fonts.scss` expects. Does not affect layout accuracy. |
