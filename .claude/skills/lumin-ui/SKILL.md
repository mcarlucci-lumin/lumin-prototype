---
name: lumin-ui
description: "Build or modify UI prototypes with the Lumin Design System — screens, pages, components, dashboards — from a Figma link, an image, or a text description, and wire them into the lumin-prototype sandbox so they render in the served app. Also answers how a Lumin component works, which component fits a given pattern, and what inputs/outputs a component accepts."
argument-hint: "[help | figma <url> | image | describe <text> | start | stop | tokens]"
---

# Lumin Design System — UI Prototype Build Skill

> **How this skill is invoked:** This is a local Claude Code skill in the `lumin-prototype` repo (`.claude/skills/lumin-ui/`). Invoke it with the Skill tool or the `/lumin-ui` slash command, which accepts an optional argument (see the `argument-hint` above and the routing table in **Step 1**). You receive this entire document at once: if an argument was passed, use its first token to pick the flow directly; otherwise infer the flow from the user's request. If intent is still unclear, ask.

> **Assumed context:** Designed to run from the `lumin-prototype` repo root. To confirm the repo, check for a `package.json` with `"name": "lumin-prototype"` and a `src/app/prototypes/` directory — both must be true. This repo is a standalone Angular app served by **StackBlitz** (the shared sandbox) or run **locally** (`npm run boot && npm start` → `http://localhost:4200`); most of the time you are working locally. Prototypes live one folder per prototype under `src/app/prototypes/<slug>/`, and a file watcher auto-wires them into the app — there is no banking monorepo, no `a3-web`, no gulp, and no manual route/module editing here. This session is rooted in `lumin-prototype` (it is the primary working directory), so `preview_start {name: "lumin-prototype"}` and `.claude/launch.json` resolve directly.
>
> **Component lookup requires the `lumin-design-mcp` connector** (`search_ui_components` / `get_component_details`), which is provided over HTTP (see `.mcp.json`, e.g. a Claude Desktop connector) and is **not** bundled with this skill. A prototype build cannot succeed without it — verify it is available before building (**Step 2**) and stop if it isn't. The token/utility **search** scripts (`search_tokens.py`, `search_utilities.py`) read committed JSON under `references/` and work with no external dependency; only the **regeneration** maintenance flow needs the separate `banking` monorepo checked out, which may or may not be available.

**Core rules:**
1. **Never hand-roll HTML/CSS from scratch when Lumin Design System components are available.**
2. **When the component includes a form or multi-field user input, ask the user whether to use the Form Renderer before building.** If yes, follow `FORM_RENDERER.md`. If no, use individual Lumin form components directly.
3. **Always build static components.** Never wire up services, inject dependencies, or reference existing repo code. Hard-coded placeholder values are correct — integration is the developer's responsibility.

**File change rule — applies to every flow without exception:**
Before writing, creating, or modifying any file, present a summary listing each file path, whether it will be created/modified/moved, and one sentence describing its contents. Ask "Proceed with these changes?" and wait for explicit confirmation before touching any file.

**Dev server rule — applies whenever a flow needs the running app:**
The local dev server is `npm start` serving `http://localhost:4200`, launched through `preview_start {name: "lumin-prototype"}` (which reads `.claude/launch.json` and runs `npm run boot && npm start` — the `wire-prototypes` watcher, `ng serve` on 4200, and the drop-zone file server on 7788).

**Start early (beginning of a build).** The first compile can take ~60s, so get the server warming as soon as possible. At the **start of the prototype-creation process** — before component research and writing — check whether it's already running (step 1); if it isn't, **ask the user whether to start it now** (e.g. *"The dev server isn't running — start it now so it's warm by the time the prototype is ready?"*). If they say yes, start it and open the pane at the gallery (`http://localhost:4200/`), then keep building while it boots. If they decline, carry on and start it at **Step 5**.

1. **Check first, start if needed — probe the port.** Whenever a step needs the app running, first determine whether anything is already serving on 4200 *regardless of who started it* — this catches a manual `npm start` or a stale `ng serve` that `preview_list` won't know about:
   ```bash
   lsof -nP -iTCP:4200 -sTCP:LISTEN   # or: curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://localhost:4200
   ```
   - **Something is listening →** the server is already up; do **not** run `preview_start {name: …}` — that would spawn a second `ng serve` and collide on 4200. Just show it: `navigate` the pane, or `preview_start {url: "http://localhost:4200/<slug>"}`.
   - **Nothing is listening →** start it with `preview_start {name: "lumin-prototype"}` — it reads `.claude/launch.json` and opens the Claude Desktop Browser pane.
   Also cross-check `preview_list` to learn whether the running server is preview-managed — it matters for stopping (see the **Stopping the dev server** flow). `preview_start` itself reuses a preview-managed server, so it never duplicates one it started; the port probe covers the servers it didn't.
2. **Open the Claude Desktop Browser pane at the right URL — then confirm it actually rendered before saying so.** Starting the server opens the Browser pane, but a fresh `npm run boot && npm start` first installs and compiles, so the pane is blank for a while and `preview_start` returning is *not* proof the app is up. Do this explicitly:
   a. `navigate` the pane to the target URL — `http://localhost:4200/` for the gallery, or `http://localhost:4200/<slug>` for a specific prototype.
   b. Wait for the first compile to finish — it can take up to ~60s — then verify the page is actually visible with a screenshot (or `read_page`), re-navigating until it renders rather than a blank page or an error.
   c. **Only after you have seen it render may you tell the user the server is up / the app is live in the Browser pane.** Never narrate "server started" or "showing in the Browser pane" on the strength of the `preview_start` call alone. If `preview_start` errored, or the pane stays blank/errored after waiting, say so plainly and troubleshoot — do not report success.
3. **Never stop it as part of a build.** Only the explicit `/lumin-ui stop` command (the **Stopping the dev server** flow) may call `preview_stop`. No build or verification step ever stops the server.

This needs the Claude Desktop Browser pane (`preview_start` / `mcp__Claude_Browser__*`), i.e. a local session. On a remote/StackBlitz-only session it isn't available — you can't manage a local server there; defer to the StackBlitz sandbox (see **Step 5C**'s fallback).

---

## Step 1 — Clarify

**If the slash command was invoked with an argument**, its first token selects the flow directly — anything after the first token is that flow's input:

| Argument | Flow | Remainder is… |
|---|---|---|
| `help` | **Explaining the build options** | — |
| `figma <url>` | **Building from a Figma link** | the Figma URL |
| `image` | **Building from an image** | — (wait for the attached image) |
| `describe <text>` / `prompt <text>` | **Building from a description** | the description text |
| `start` | **Starting the dev server** | — |
| `stop` | **Stopping the dev server** | — |
| `tokens` | **Regenerating token/utility data** | — |

An unrecognized first token is not a keyword — treat the whole argument string as a description and use the **Building from a description** flow.

**If no argument was passed**, inspect the user's request and route accordingly:

- **They provided a Figma link** → follow the **Building from a Figma link** flow.
- **They attached an image or screenshot** → follow the **Building from an image** flow.
- **They described what to build in text** → follow the **Building from a description** flow.
- **They asked to start / stop (or serve / kill) the local dev server** → follow the **Starting the dev server** / **Stopping the dev server** flow.
- **They asked to refresh/regenerate the token or utility data** → follow the **Regenerating token/utility data** flow.
- **They asked what this skill can do, or asked to build but gave no Figma link, image, or description** → follow the **Explaining the build options** flow (it lays out the three ways to start).

If the request names a target but leaves the input form ambiguous, ask which they have — skipping any already covered: a Figma link, an image to analyze, or a text description.

---

## Text Analysis Protocol

When the user provides a text description, work through this before touching any code:

1. **Assess completeness** — if the description names regions but gives no layout clues, ask one clarifying question only: *Can you describe the main sections or regions — e.g. is there a header, a list of cards, a sidebar, a table?*
2. **Decompose into named regions** — e.g. "page header", "account summary card row", "transactions table", "action bar"
3. **Infer layout structure** — for each region, state the assumed layout (flex row, flex column, grid, full-width block) as an assumption, not a fact
4. **Match regions to Lumin components** — by purpose and shape, not words used: "a card showing balance" → `container-elevated` wrapping label/value pairs
5. **Flag form fields** — note any user input and ask the Form Renderer question before writing those fields
6. **List open questions** — anything ambiguous; state the assumption you'll use for each

Write this as a brief structured summary before writing any code.

---

## Image Analysis Protocol

When the user provides an image, work through this before touching any code:

1. **Outer container** — identify the container class or confirm it's a full page with no card wrapper
2. **Layout structure** — flex row, flex column, or grid at the top level; note spacing between major regions
3. **Region inventory (top to bottom, left to right)** — every distinct UI region as a candidate for a Lumin component or layout div
4. **Element matching** — closest Lumin component by visual shape, not assumed name: "row of tabs", "pill label", "icon + text row", "data table". For any **icon**, record the glyph and its distinguishing detail as an *icon-name hypothesis* to verify later (see **Choosing & verifying Material icons**) — never assume the name.
5. **Form fields** — note separately; ask the Form Renderer question before writing those fields
6. **Unmatched elements** — anything with no clear Lumin match goes through the Missing Component Protocol before writing custom HTML
7. **Measure absolute dimensions from the saved `source.png`** — for any element whose size is set explicitly (progress-bar height, icon/avatar diameter, fixed widths, gaps), read the real pixel value; do **not** infer it from its ratio to another element (that method is unreliable and repeatedly wrong). Use the stdlib measurer (no installs):
   ```bash
   python3 .claude/skills/lumin-ui/scripts/measure_png.py <_reference/source.png>            # width × height
   python3 .claude/skills/lumin-ui/scripts/measure_png.py <_reference/source.png> --col 0.10  # RLE down a column → a bar's run length IS its pixel height
   python3 .claude/skills/lumin-ui/scripts/measure_png.py <_reference/source.png> --row 0.5   # RLE across a row → widths, fill %
   ```
   **Establish scale before trusting absolute px:** compare a known component against its rendered size (a Lumin `md` icon-shape renders ~32px). If the source's matching element ≈ 32px it's a 1:1 capture and measured px map directly; if it's ~2× that, the capture is retina — halve measured px (or note the DPR). Record the measured values (and the scale) in the summary and feed them straight into the component's size inputs.

Write this as a brief structured summary before writing any code.

---

## Choosing & verifying Material icons

Lumin renders icons from **Material Symbols** — this repo bundles the **Sharp / Filled / Bold** variant (see `MaterialSymbols-Sharp-Filled-Bold` in `src/index.html`) — by name (e.g. a component's `icon="mail"` input). Getting the *name* right is the hard part from an image: look-alikes share a base metaphor and differ only in a small detail. An envelope could be `mail` (**closed** — flat top, downward-V seam), `drafts` (**open** — flap folded open, you see *into* it), `markunread` (closed envelope), `email`, `forward_to_inbox` (arrow), or `mark_email_unread` (notification dot). The base metaphor ("it's an envelope") is **not** the answer — the small detail is, and it is easy to get backwards (an open vs. closed flap flips `drafts` ↔ `mail`). You can read a glyph from an image, never its name — so:

- **Figma source:** first check whether the design gives the name — the icon's layer/component name from `get_design_context` / `get_metadata` is often the Material Symbols name itself. Use it if present.
- **Image or description source:** treat any icon name you infer as a **hypothesis to verify**, not a fact.

**Verify by rendering candidates** (image builds, or any time you're unsure):
1. From the glyph, list 3–6 candidate names by metaphor **and** the distinguishing detail you see (pencil, arrow, dot, checkmark, plus, slash). If you can't name them, enumerate from the Material Symbols catalog — `WebFetch` `https://fonts.google.com/metadata/icons` (each entry has a `name` and synonym `tags`), or browse `fonts.google.com/icons` with **style = Sharp, Fill = on, Weight = bold** so the glyphs match how this app renders them.
2. Render the candidates the way the app does — pass each name to the Lumin icon input you're using, as a labeled row — let the watcher rebuild, and screenshot. This uses the exact bundled font/axes, so the comparison is faithful (a bare element in a different Material variant would mislead). Since this adds candidates via the template, pair it with a `.ts` content change so the rebuild actually fires — `.html`/`.scss`-only edits don't reliably recompile here (see `KNOWN_ISSUES.md` → **`.html` / `.scss`-Only Edits Don't Reliably Rebuild**).
   - **Render them LARGE — `size="xl"` (or the biggest the icon input allows).** The distinguishing detail (open vs. closed flap, a dot, a fold, an arrow) is invisible at a ~24–32px badge size; a small candidate row is *not* a valid comparison and has produced wrong picks. Enlarge until the detail is unmistakable.
   - **Enlarge the *source* glyph to the SAME scale — do not compare a big candidate against a tiny source.** The reference `source.png` icon is usually only ~30px, and big-candidate-vs-tiny-source is an invalid comparison that has flipped `drafts` ↔ `mail`. Crop the icon box out of `source.png` and upscale it (nearest-neighbor, stdlib, no installs) so it reads at candidate size, then `Read` the result:
     ```bash
     python3 .claude/skills/lumin-ui/scripts/crop_scale_png.py \
       <_reference/source.png> <scratch>/icon_source_big.png --region X Y W H --scale 8
     ```
     `--region` takes the icon box as four absolute px (or four fractions in [0,1)); get the box from a `measure_png.py` scan of the icon's extent. If the source glyph is **< ~40px**, upscaling it is mandatory before you may call the icon verified; if the enlarged crop is still blurry/ambiguous, say "ambiguous" and ask the user rather than reporting a match.
3. **Read every glyph off the pixels, never from memory or metaphor — and read the *source* just as carefully as the candidates.** The most common failure is describing the source from the metaphor ("it's an envelope → `mail`") instead of looking, then "confirming" that guess against the candidates. Do the opposite:
   - Compare against the **saved `_reference/source.png`** (image builds always have it from the flow's Step B) — enlarge the icon box with `crop_scale_png.py` (above) and `Read` that at full fidelity. **Never** compare against a low-res inline thumbnail or a downscaled screenshot; if the source icon is tiny, note that the detail may be ambiguous and say so.
   - **Never use a pixel/RLE scan (`measure_png.py`) to decide glyph identity.** That tool is for *dimensions only* (heights, widths, fill %); its column/row runs cannot read glyph topology (open vs. closed flap, fold, dot), and treating an ambiguous scan as proof — then "confirming" the name you already guessed — is exactly how this check has failed. Decide identity only from an enlarged render you have looked at.
   - Describe what **each** glyph actually shows — open flap vs. closed-V crease, folded corner, notification dot, arrow — for the candidates *and* for the source, from the pixels in front of you.
   - **Pick blind, then set the input — do not commit a default name and then look for evidence to confirm it.** When you first write the component, leave the icon input on a neutral placeholder (or the literal candidate list) rather than your best guess; run this verification, choose the winner from the enlarged source-vs-candidates comparison, and only *then* set the icon name. Committing `mail` up front and hunting for confirmation is how the wrong flap got shipped.
   - Pick the candidate that matches the source **detail-for-detail**. "Looks close" or "same metaphor" is **not** a match and may not be reported as verified — if two candidates are indistinguishable at the size you rendered, enlarge and look again. Then set that name and delete the scratch row.
4. This folds into **Step 5C** — confirm the final icon against the source at the matched viewport.

> ⚠️ **Never describe an icon from memory — only from a render you can see.** Your recollection of what a Material Symbols glyph looks like is unreliable and variant-dependent; a name that fits the *metaphor* (e.g. `mail` for "an envelope") is a hypothesis, not a match. This applies to every glyph statement you make: the scratch-row labels, the candidate you pick, and anything you tell the user about how an icon looks. If you have not rendered a glyph and looked at it in this session, do not assert or characterize its appearance — render it first. Asserting an icon name or description without a render you have actually looked at is the same failure as guessing a component selector.

---

## Step 2 — Research Components

**First, confirm the `lumin-design-mcp` connector is available.** Look for the MCP tools `search_ui_components` and `get_component_details` (the tool names may be prefixed by the connector, e.g. `mcp__lumin-design-mcp__search_ui_components`). They are the authoritative source for component selectors, inputs, outputs, and referenced types — do not guess and do not maintain a local component list.

**If those tools are not available, stop and tell the user** — a faithful prototype cannot be built without them:

> ⚠️ The `lumin-design-mcp` connector isn't available in this session, so I can't look up Lumin component APIs. Building a prototype without it means guessing selectors and inputs, which produces code that won't compile. Connect the `lumin-design-mcp` MCP server (it's declared in `.mcp.json` as an HTTP connector) and restart the session, then I can continue.

If available, use them:
  - `search_ui_components(query)` — semantic search by natural-language description; returns brief matches (id, selector, name, kind, library, description)
  - `get_component_details(id)` — full API for a match: selector, import path, standalone flag, NgModule, typed inputs/outputs, referenced type declarations, and example usage/args

The catalog covers the `@a3-digital/ui-*` libraries (`ui-core`, `ui-forms`, `ui-layouts`, `ui-management`, `ui-workflows`, `ui-styles`) — exactly the packages vendored into this repo (see `vendor-config.json`), all of whose `Ui*Module`s are pre-imported in `app.module.ts`. **Banking app-level components (`app-header`, `app-wizard`, `CoreCommonModule`, etc.) are NOT available here** — they live in `a3-web/web-client` and are not vendored, so never emit them in a prototype.

**Catalog presence ≠ availability in the vendored packages.** The catalog is built from banking's `shared/ui` **source**, so it can list components that aren't shipped in the pinned vendored tarballs the sandbox runs against (not exported from the library's `public-api.ts`, added without a version bump, or simply newer). Using one crashes the dev server with an unknown element. For any **unusual, new, or `-v2`** component, confirm the vendored package ships its selector before building on it — `grep -rE "<selector>" node_modules/@a3-digital/<lib>/` — and if it's absent, fall back to the shipped equivalent (e.g. `ui-core-button` instead of `ui-core-button-v2`). See `KNOWN_ISSUES.md` → **Catalog Component Missing From the Vendored Library**.

**Warm up the dev server now.** This is the start of the build and the first compile takes ~60s, so kick the server off early per the **Dev server rule** (*Start early*): probe `http://localhost:4200`, and if nothing is running, **ask the user whether to start it now** so it's ready by the time you navigate to the finished prototype. Then continue researching while it boots.

- Consult `COMPONENT_RULES.md` for NgModule imports, Angular conventions, and known selectors.
- When you fetch a component's API, note its **size / shape / density / state** inputs (e.g. a progress bar's `height`, a button's variant and states) and *consider* whether the design needs a non-default value — but defaults may be theme-driven, so set them only where the design clearly diverges, and ask when unsure (see `COMPONENT_RULES.md` → **Sizing, Shape & State Inputs**).
- For design tokens and layout utilities (no MCP equivalent), use the local Python scripts (paths are relative to the repo root):
  - `python3 .claude/skills/lumin-ui/scripts/search_tokens.py <keyword> [--category <cat>]` — CSS design tokens
  - `python3 .claude/skills/lumin-ui/scripts/search_utilities.py <keyword> [--category <cat>] [--categories]` — layout utility classes from ui-styles
- For any form or multi-field input, ask the user whether to use the Form Renderer before writing input fields. If yes, read `FORM_RENDERER.md` first.

Use exact **selectors**, **import paths**, and **NgModule** entries — never guess.

---

## Step 3 — Write the Component

Write:
- `.component.ts` — component class with `@Component` metadata, `@Input()`s, and static placeholder logic
- `.component.html` — template using Lumin selectors
- `.component.scss` — styles using design tokens and utility classes

**HARD RULE — the prototype component must be `standalone: false`.** The `wire-prototypes` watcher declares every prototype in the generated root `app.module.ts`, which already imports each vendored `Ui*Module`. A `standalone: true` component — the Angular 17+ default, so you must set the flag explicitly — cannot be declared in an NgModule and breaks the build with **NG6008**. In the `@Component` decorator set `standalone: false`, give the component a unique `selector` (e.g. `app-<slug>`), and add **no `imports` array** and **no feature NgModule** of its own — the root module already provides everything.

**HARD RULE — `.component.html` must always be written with the `Bash` tool.** `Write` and `Edit` trigger a hook that sends the file to the Claude Desktop Code preview panel, which renders Angular templates as broken raw HTML. Use a `cat` heredoc instead:

```bash
cat > path/to/file.component.html << 'EOF'
<div>template content here</div>
EOF
```

Follow all rules in `COMPONENT_RULES.md`:
- Do **not** import Lumin component classes or `Ui*Module`s into the prototype `.component.ts` — the generated root `app.module.ts` already imports every vendored `Ui*Module`, so the component needs no module imports of its own
- Use Angular 17+ built-in control flow (`@if`, `@for`, `@switch`) — never `*ngIf`, `*ngFor`
- Never hardcode colors, spacing, or typography — always use CSS variables from the design token system

After writing, run the **Coverage Audit** from `COMPONENT_RULES.md` — every plain HTML element that could be a Lumin component must be checked.

---

## Step 3B — Fidelity Validation Pass

**Applies to Figma and image flows only.** Skip for description-only builds — there is no reference design to compare against.

> **Note:** This pass reviews the generated code against the reference design. A live screenshot comparison is also required — it happens in **Step 5C** and is a hard gate before reporting the build complete. Do not skip Step 5C for Figma or image builds.

After the component files are written, re-examine the source (the Figma screenshot from Step B/B2, or the user's attached image) alongside the generated `.component.html` and `.component.scss`. Work region-by-region, top to bottom, left to right.

### What to check

| Dimension | Standard |
|---|---|
| **Component selection** | Every visual element must use the most specific Lumin component available. Re-run `search_ui_components` for any region that fell back to plain HTML if the first search was inconclusive. |
| **Layout & spacing** | Gaps, padding, column proportions, and alignment must reflect what the design shows. Spacing values must come from design tokens (`var(--spacing-*)`, utility classes), not hard-coded `px`. |
| **Design tokens** | All colors, typography sizes/weights, and border-radius values must use CSS variable tokens — never raw hex or hard-coded `px`. A color already driven by a **branded/theme token** stays as-is even if its shade differs from the source — that difference is theme-driven, not a discrepancy (see `COMPONENT_RULES.md` → **Colors — Leave Branded / Theme Tokens In Place**). |
| **Content & labels** | All visible text, icon names, button labels, and field labels must match the design exactly. |
| **Density & proportions** | Card heights, column widths, and padding ratios should feel proportionally close to the source. |
| **Variants & states** | If the design shows a specific state (loading, error, active tab, filled field), verify the correct component variant or `@Input()` binding is used — not a CSS workaround. |

### How to apply corrections

- Prefer a Lumin component fix over a CSS patch.
- Prefer a design token value over a hardcoded one.
- **Leave branded/theme-token colors alone.** If a color is already a branded/theme token, do not override it to match the source's shade — that is expected theme variance, not a correction (see `COMPONENT_RULES.md` → **Colors — Leave Branded / Theme Tokens In Place**). Only change a token to fix a *wrong-for-its-meaning* semantic token.
- Apply corrections directly — do not defer them as "known limitations" unless no Lumin-compliant fix exists.
- Re-run the **Coverage Audit** from `COMPONENT_RULES.md` if any plain HTML was added or changed during corrections.

### Fidelity summary (for Step 6)

After corrections, prepare a brief delta for inclusion in **Step 6 — Report Back**:

- **Adjusted in validation pass:** what was changed to better match the design (if anything)
- **Gaps remaining:** elements that could not be matched with Lumin components or tokens, and why

---

## Step 4 — Post-Write Checks

**Mobile responsiveness** — apply mobile patterns if: the component owns a route, the template has a multi-field form, it has multi-column rows, or it's a top-level container with no parent providing padding. Skip if: it's a single display-only widget with no layout of its own. If unclear, ask before proceeding. Always tell the user which decision was made and why.

If mobile patterns apply, verify:
- Content wrapper has `px-4 px-md-0`
- Two-column rows use `flex-column flex-md-row`, not `flex-row` alone
- Half-width fields use a responsive SCSS class (`width: 100%` → `calc(50% - 20px)` at `md+`)
- Two-column gaps are reduced on mobile to match the surrounding row gap

Consult `KNOWN_ISSUES.md` for common Angular/TypeScript errors (HTML comments inside opening tags, a missing `standalone: false` flag) and fix any issues before presenting the code.

---

## Step 5 — Wire Up, Show Live & Verify

Runs after Post-Write Checks and before Report Back. Part **C** is a hard gate for **Figma and image** builds — do not report the build complete until the live render matches the source; description-only builds have no reference and skip part C.

### A — Ensure `meta.json` exists

Check whether `src/app/prototypes/<component-name>/meta.json` already exists. If it doesn't, create it:

```bash
cat > src/app/prototypes/<component-name>/meta.json << 'EOF'
{ "name": "<Title-cased component name>", "description": "<One-sentence description of what was built>" }
EOF
```

Derive `name` by title-casing the component slug (e.g. `loan-summary` → `"Loan Summary"`). Write the description from what you built — one sentence, user-facing.

### B — Wire it up and show it live

The files were written straight into `src/app/prototypes/<component-name>/`, so there is nothing to copy — get it wired and on screen:

- **Ensure the dev server is running** per the **Dev server rule**: check `http://localhost:4200`, and if it isn't up, start it with `preview_start {name: "lumin-prototype"}`. Starting it opens the Browser pane — leave it open so the user watches the prototype appear. Do **not** stop the server.
- With the server running, the live watcher (`wire-prototypes --watch`) picks up the new folder on save and regenerates the registry, routes, and module declarations. Confirm via the `[wire-prototypes]` line in the terminal, or that `<component-name>` now appears in `src/app/prototype-registry.ts`. Then navigate the Browser pane to `http://localhost:4200/<component-name>` and **confirm it actually renders** before telling the user it's live (**Dev server rule** step 2).
- **If you can't run a local server** (remote/StackBlitz-only, or no Browser pane), wire it once by hand with `npm run wire` (it also runs automatically the next time the app starts).

**Never hand-edit `app.module.ts` / `app-routing.module.ts` / `prototype-registry.ts`** — they are generated and gitignored.

### C — Visual Render Verification (mandatory for Figma and image builds)

**This is a hard gate before Step 6 (Report Back) for any build sourced from a Figma link or user-provided image.** Do not tell the user the UI is complete until this verification passes. It requires the app running locally (`preview_start` serves `http://localhost:4200`), so it applies to local sessions; on a remote/StackBlitz-only session there is no localhost to render against — use the fallback at the end of this sub-step instead.

Check whether the Claude Desktop Browser pane is available by looking for the `preview_start` tool (part of the `mcp__Claude_Browser__*` tool set). This tool is present in Claude Desktop sessions but not in other surfaces.

**If `preview_start` is available:**
1. Ensure the dev server is running per the **Dev server rule** (usually already up and shown from part B) — `preview_start {name: "lumin-prototype"}` starts it if needed, reuses it if already up, and opens the Browser pane. Never stop it afterward.
2. **Match the preview viewport to the source before comparing.** A prototype is mobile-responsive, so it legitimately looks different at different widths — comparing a phone-width reference against a desktop-width render (or vice versa) produces *false* mismatches. Set the pane to the source's viewport first:
   - **Figma source:** read the frame's dimensions (`get_metadata` / the design context). Frame width ≈ 360–430 → mobile; ≈ 768–1024 → tablet; ≥ ~1280 → desktop.
   - **Image source:** infer from the image's pixel dimensions / aspect ratio — a tall, narrow (portrait) capture is a mobile screen; a wide one is desktop. If it's genuinely ambiguous, ask the user which viewport the image represents.
   - Resize with `resize_window` — presets `mobile` (375×812), `tablet` (768×1024), `desktop` (1280×800), or an explicit `width` closer to the source. The mobile preset also emulates a mobile device, so **re-navigate/reload after resizing** so responsive and device gates re-run.
3. Navigate to `http://localhost:4200/<component-name>` (after the resize) using the `navigate` tool.
4. Take a screenshot with `computer {action: "screenshot"}`.
5. Compare the screenshot region-by-region against the reference **at that matched viewport**. **Ignore the sandbox's own fixed top-left back button** — the sandbox wraps every prototype in it, so it is chrome, not part of your design. A difference that would only appear at a *different* width than the source (responsive reflow — stacked vs. side-by-side, wrapped vs. inline) is expected; do **not** flag it. Flag only true mismatches at the matched viewport. Check every visual dimension:
   - **Icons/avatars:** the glyph must match the source **detail-for-detail**, not just the metaphor — an envelope could be `mail`, `drafts`, `markunread`, `email`, or `forward_to_inbox`. If the rendered glyph differs from the source, disambiguate per **Choosing & verifying Material icons** (render candidates and compare). Also check shape, size, and background/foreground color.
   - **Typography:** all visible text labels, heading copy, type size/weight
   - **Buttons:** correct `theme` and `themeGroup` variant, label text, border/fill color
   - **Progress bars and other components:** correct fill percentage, height, fill color, track color
   - **Layout:** alignment, gaps, padding, column proportions (as they appear at the matched viewport)
   - **Overall density and proportions:** the card or page should feel proportionally close to the reference

   > ⚠️ **Verify every dimension from the render and the source in front of you — never from memory or assumption.** Each item above is a *check*, not a formality: read the actual value off the rendered page (measure heights/sizes with `read_page` or `javascript_tool` — e.g. `getComputedStyle`/`getBoundingClientRect` — rather than eyeballing, and read glyphs off the screenshot per **Choosing & verifying Material icons**) and compare it to what the source actually shows. Do **not** report a dimension as matching because you set an input to a value you *believe* is right, or because it "looks close" — if you did not observe it and compare it this pass, it is unverified, and you may not describe it as verified. Comparing a fixed value (e.g. a `px` height) against a container size or any other non-comparable reference is not a check — compare like against like, at the same scale. For **absolute sizes** (progress-bar height, icon diameter, fixed widths), measure the source's real pixels from the saved `_reference/source.png` with `scripts/measure_png.py`, size the preview viewport to the source's pixel width, then measure the rendered element with `getBoundingClientRect` — the two px values must agree. **Never derive an absolute size from its ratio to another element** (e.g. "the bar is ¼ of the circle"); that shortcut has been wrong in both directions and is not permitted.

6. For every discrepancy found, apply a Lumin-compliant fix — correct the `@Input()` binding or design token value. Never use raw CSS to mask a wrong component state. **Exception — branded/theme-token colors:** a color driven by a branded/theme token that renders a different shade than the source is *expected theme variance, not a discrepancy* — leave it (see `COMPONENT_RULES.md` → **Colors — Leave Branded / Theme Tokens In Place**); only change a token to fix a wrong-for-its-meaning semantic token.
7. After fixes, re-navigate and take a new screenshot to confirm all discrepancies are resolved. If a fix was `.html`/`.scss`-only and the change doesn't show (or the pane's console shows a stale error with a failing `ng-cli-ws` socket), force the rebuild with a trivial `.ts` content change and hard-reload — see `KNOWN_ISSUES.md` → **`.html` / `.scss`-Only Edits Don't Reliably Rebuild**. Confirm the served DOM actually changed (`read_page` / `javascript_tool`) rather than trusting a frozen error.
8. Only after the live render visually matches the reference at the matched viewport: proceed to **Step 6 — Report Back** and share the final screenshot as proof, noting which viewport you verified at. If the source depicts only one viewport, you may sanity-check the other breakpoint isn't broken (content bleeding to the screen edge, overlap) — but don't compare that breakpoint against the single-viewport reference.

**If `preview_start` is not available**, fall back to the code-only fidelity pass in Step 3B and tell the user:
> ⚠️ Browser preview is not available in this session — live visual render verification was skipped. The fidelity check was code-only (Step 3B). To verify yourself, run `npm run boot && npm start` and open `http://localhost:4200/<component-name>`.

---

## Step 6 — Report Back

> **For Figma and image builds:** Do not proceed to this step until **Step 5C visual render verification** has passed — the live screenshot must confirm the render matches the reference before the build is reported complete.

- Component name and what was built
- Lumin components used and their packages
- **If a Figma link or image was the source:** include the fidelity summary from **Step 3B** and the visual verification result from **Step 5C** — what was adjusted and what the final screenshot confirmed
- Any unmatched UI elements and why custom HTML was used (→ Missing Component Protocol in `COMPONENT_RULES.md`)
- Any known limitations or follow-up steps
- Share the final verification screenshot as proof

Then immediately proceed to **Step 7 — Package & Share**.

---

## Step 7 — Package & Share

After reporting back, always create the shareable artifact.

### A — Create the ZIP

Zip the prototype folder into an output directory **outside** the repo tree, so the zip itself is never wired or committed:

```bash
mkdir -p ~/.claude/tmp/lumin-prototype-zips
( cd src/app/prototypes && zip -r ~/.claude/tmp/lumin-prototype-zips/<component-name>.zip <component-name>/ )
```

The zip must contain the folder itself (not just the files inside it), so the `cd src/app/prototypes` + relative path pattern above is required.

### B — Reveal in Finder, and give the user the sandbox link

Select the zip in Finder immediately:

```bash
open -R ~/.claude/tmp/lumin-prototype-zips/<component-name>.zip
```

Derive the StackBlitz sandbox URL from **this repo's own `origin` remote** — never hard-code a fork owner, since each developer may push to their own fork:

```bash
git remote get-url origin 2>/dev/null \
  | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##' \
  | sed -E 's#^#https://stackblitz.com/github/#'
```

That turns `git@github.com:<owner>/lumin-prototype.git` into `https://stackblitz.com/github/<owner>/lumin-prototype`. If `origin` is missing or isn't a GitHub URL, skip the sandbox link and instead tell the user to open their own StackBlitz sandbox of the repo.

Then report what happened and provide a clickable link:

> Prototype files written to `src/app/prototypes/<component-name>/` — the live watcher wires it up automatically when the app is running.
>
> Finder is open with the zip selected. You can also click this link any time:
>
> [<component-name>.zip](file:///Users/<username>/.claude/tmp/lumin-prototype-zips/<component-name>.zip)
>
> Or drag the zip onto the [Lumin Prototype Sandbox](<sandbox-url>) drop zone to add it to a fresh session.

Use the **absolute, expanded path** in the `file://` URL (no `~` — replace it with `/Users/<username>`). The link will not resolve if `~` is left unexpanded. Substitute the derived URL for `<sandbox-url>`.

---

## If a Component Doesn't Exist

If no Lumin component matches after thorough search, follow the **Missing Component Protocol** in `COMPONENT_RULES.md` before writing any custom HTML/CSS.

---

## Quick Reference — design.lumindigital.com

| Topic | URL |
|---|---|
| Component library | https://design.lumindigital.com |
| Colors | https://design.lumindigital.com/iframe.html?globals=&args=&id=global-styles-colors--default-story&viewMode=story |
| Spacing | https://design.lumindigital.com/iframe.html?globals=&args=&id=global-styles-spacing--default-story&viewMode=story |
| Typography | https://design.lumindigital.com/iframe.html?globals=&args=&id=global-styles-typography--default-story&viewMode=story |
| Containers | https://design.lumindigital.com/iframe.html?globals=&args=&id=global-styles-containers--default-story&viewMode=story |

---

## Shared: Build and Deploy

Referenced by the Figma, description, and image build flows. Once component research (Step 2) is complete, follow these steps.

### Build in the prototype folder

Prototypes live one folder per prototype under `src/app/prototypes/`. Write the generated files straight there — there is no temp or staging folder.

Create the folder first: `mkdir -p src/app/prototypes/<component-name>`

Write three files into it: `<component-name>.component.ts`, `<component-name>.component.html` (Bash/cat heredoc only), `<component-name>.component.scss`. Infer the component name from the design source (kebab-case). **The name becomes the prototype's folder name, route slug, and file-name stem — all three files must be named `<component-name>.component.*` and match the folder, or the watcher never wires the prototype.** Follow all rules from `COMPONENT_RULES.md` (including `standalone: false`) and the Post-Write Checks in **Step 4**. If the app is running, saving these files makes the watcher wire the prototype automatically. **If the first render shows the template but the component's SCSS clearly isn't applied** (no scoped styles, layout collapsed), make a trivial `.ts` content change and reload to force a real recompile — see `KNOWN_ISSUES.md` → **`.html` / `.scss`-Only Edits Don't Reliably Rebuild**.

**If the component was built from a Figma link or image**, run **Step 3B — Fidelity Validation Pass** immediately after writing the files, before proceeding.

Show the user a brief summary of what was built and which Lumin components were used.

### Deploy to the prototype sandbox

The files are already in `src/app/prototypes/<component-name>/` — the only destination — so there is nothing to ask. Proceed through the remaining steps in order:
- **Step 5 — Wire Up, Show Live & Verify:** ensure the dev server is running and the prototype renders in the Browser pane; for Figma/image builds, verify the live render against the source at a matched viewport (hard gate).
- **Step 6 — Report Back.**
- **Step 7 — Package & Share:** create the shareable `.zip` and hand the user the sandbox link.

---

## Flow — Explaining the build options

When the user only asks what this skill can do, or asks to build UI but gives nothing to build from, respond with exactly this and nothing else:

---

**Lumin UI Skill — Build Options**

There are three ways to start a build depending on what you have:

**Figma link**
Share a Figma link and I'll pull the design spec and screenshot directly from Figma, then map every element to Lumin components before writing any code.

**Image**
Paste or attach a screenshot or mockup and I'll analyze the layout structure, identify every UI region, and match each one to Lumin components before writing any code.

**Description**
Describe the screen or component — what sections it has, what it displays, what actions are available — and I'll break it into regions, state my layout assumptions, and give you a chance to correct them before writing any code.

All three end the same way: I write the prototype straight into `src/app/prototypes/<name>/`, where the sandbox's watcher wires it up automatically so it shows in the gallery at `/<name>`, and I hand you a shareable `.zip` you can drop into a fresh StackBlitz session.

---

## Flow — Building from a Figma link

Use this flow when the user's request contains a Figma link (a `figma.com` URL).

### Step A — Determine the Figma link

If a URL was included in the user's request, use it directly. Otherwise ask:

> What is the Figma link for the component or screen you want to build?

### Step B — Pull design context from Figma

Before calling any Figma MCP tool, check whether a Figma MCP connector is available — look for any tool whose name contains `figma` (case-insensitive) or tools such as `get_design_context` or `get_screenshot`.

**If unavailable**, stop:

> ⚠️ The Figma MCP isn't accessible in this session — it's usually provided through a connector (e.g. the Figma MCP connector in Claude Desktop or a configured MCP server). Without it, Figma links cannot be read directly.
>
> You can still build using one of these alternatives:
> - **Provide an image** — Export a screenshot or frame from Figma and paste it here.
> - **Provide a description** — Describe the screen or component in text.
>
> To enable the Figma flow, connect a Figma MCP server and restart the session.

If available, call `get_design_context` and `get_screenshot` to identify the component structure, all UI elements, and any text, icons, states, or variants.

### Step B2 — Confirm the design with the user

`get_design_context` / `get_screenshot` usually return an image of the design. **Before doing any component research or writing code, show that image to the user and confirm it's the right design.** Figma links often resolve to a different frame, node, or variant than the user intended (a parent frame, a neighboring artboard, an outdated version).

- If a screenshot/image was returned, display it and ask:
  > Here's the design I pulled from that Figma link. Is this the correct screen/component you want me to build? (If it's the wrong frame, share a link to the specific node/frame.)
- **If the image can't be shown inline** (the host/client surface doesn't render the Figma tool's image output), don't skip the check — fall back to describing the design in enough detail for the user to recognize it (layout, regions top-to-bottom, key text/labels, notable components), then ask the same confirmation question.
- If **no** image was returned at all (some links or permissions yield context without a rendering), tell the user that, briefly summarize the structure you did get, and ask them to confirm before proceeding.

Wait for confirmation. If the user says it's wrong, get a corrected link/node and re-pull (back to **Step B**) — do not proceed to research on an unconfirmed design.

### Step C — Research, build, and deploy

Follow **Step 2 — Research Components** using the confirmed design context from Step B/B2, then follow **Shared: Build and Deploy**.

---

## Flow — Building from a description

Use this flow when the user describes the screen or component in text (no Figma link, no image).

### Step A — Request the description

If the description was already provided — inline in the request, or as the `describe`/`prompt` argument — skip this request and go straight to **Step B**. Otherwise, respond with:

> Describe the screen, component, or UI element you want to build. Include as much detail as you have: what sections are on it, what actions are available, any data it displays, and roughly how it's laid out. I'll break it down into regions, map each one to Lumin components, and show you my interpretation before writing any code.

### Step B — Analyze

Apply the **Text Analysis Protocol** in full and write the analysis as a structured summary before touching any code.

### Step C — Research, build, and deploy

Follow **Step 2 — Research Components** for each element identified in Step B, then follow **Shared: Build and Deploy**.

---

## Flow — Building from an image

Use this flow when the user attaches or pastes a screenshot or mockup.

### Step A — Request the image

If an image is already attached to the request (or arrived via `/lumin-ui image`'s follow-up), skip this request and go straight to **Step B**. Otherwise, respond with:

> I'm ready to analyze your design image. Paste or attach the screenshot or mockup and I'll work through it using the Image Analysis Protocol — identifying the container structure, layout, and every UI element — then look up the matching Lumin components before writing any code.
>
> **For best results, provide the image at 1:1 scale** — a capture at the design's actual pixel size, not zoomed in, scaled down, or resized. I infer the target viewport and element proportions from the image's pixel dimensions, so a rescaled image throws those calculations off.

### Step B — Save the source image to the prototype folder

Before analyzing, get the actual image **bytes onto disk** so every dimension can be *measured, not eyeballed* — inferring a size from its ratio to another element is unreliable and is forbidden (see the Image Analysis Protocol and Step 5C). A pasted/attached image isn't a file you can open, but it is stored as base64 in the current session transcript, so extract it:

1. Derive a provisional kebab-case slug from a first glance at the image (the same name the build will use) and create the folder:
   ```bash
   mkdir -p src/app/prototypes/<slug>/_reference
   ```
2. Extract the user's attached image into that folder with the helper (standard library only — **never install packages**):
   ```bash
   python3 .claude/skills/lumin-ui/scripts/extract_source_image.py \
     src/app/prototypes/<slug>/_reference/source.png
   ```
   It finds this session's transcript (most-recent `*.jsonl` under `~/.claude/projects/<cwd-as-dashes>/`) and writes the **earliest** user-attached image (index `0`; later blocks are your own browser screenshots). Run it with `--list` first if you need to confirm which block is the design, then pass `--index N`.
3. Confirm with `Read` that `source.png` is the design the user meant (same check as the Figma flow's Step B2).
4. **Fallback:** if the helper finds no image, ask the user to save the file to `src/app/prototypes/<slug>/_reference/source.png` (or give a path to copy) — do **not** proceed on ratios or memory.

The saved `source.png` is the reference of record: it stays in the prototype folder, travels in the shareable zip, and is what the Image Analysis Protocol and Step 5C measure against. If the slug changes during analysis, move the folder so `source.png` stays with its prototype.

### Step C — Analyze

Apply the **Image Analysis Protocol** in full and write the analysis as a brief structured summary before touching any code.

### Step D — Research, build, and deploy

Follow **Step 2 — Research Components** for each element identified in Step C, then follow **Shared: Build and Deploy**.

---

## Flow — Starting the dev server

Use this flow for `/lumin-ui start`, or when the user asks to start/serve/run the app locally. Follow the **Dev server rule** and leave the server visible:

1. Check whether it's already serving at `http://localhost:4200` (`preview_list`, or navigate the Browser pane there).
2. If it isn't, start it with `preview_start {name: "lumin-prototype"}` — this reads `.claude/launch.json` and runs `npm run boot && npm start` (watcher + `ng serve` on 4200 + drop-zone file server on 7788). It reuses an already-running server, so it's safe to call either way.
3. Starting opens the Browser pane — leave it open. Navigate it to `http://localhost:4200/` for the gallery, or to `http://localhost:4200/<slug>` if the user named a prototype.

Once you've confirmed the gallery/prototype actually renders in the pane (**Dev server rule** step 2) — not merely that `preview_start` returned — report the URL and that the app is live in the Browser pane. If the Browser pane (`preview_start`) isn't available in this session, say so and tell the user to run `npm run boot && npm start` themselves and open `http://localhost:4200`.

---

## Flow — Stopping the dev server

Use this flow for `/lumin-ui stop`, or when the user explicitly asks to stop/kill the app. **This is the only place the dev server may be stopped** — no build or verification step ever stops it.

1. List preview-managed servers with `preview_list`, and probe the port to catch one preview didn't start: `lsof -nP -iTCP:4200 -sTCP:LISTEN`.
2. **If `preview_list` shows it** — stop it with `preview_stop` for that server's id.
3. **If the port is listening but `preview_list` doesn't show it** — it was started outside the preview mechanism (e.g. a manual `npm start`), so `preview_stop` cannot stop it. Tell the user to stop it in the terminal where they started it (Ctrl-C), quoting the PID from the `lsof` output — do **not** claim it was stopped.
4. **If nothing is running** — tell the user there's nothing to stop.
5. Confirm the final state.

---

## Flow — Regenerating token/utility data

**Maintenance tool — not for normal prototype development, and it depends on a separate repo.** Component/type lookup is owned by the `lumin-design-mcp` connector (`search_ui_components` / `get_component_details`); this flow only refreshes the two skill-only reference files the connector does not cover:
- `references/tokens-registry.json` — parsed from the **banking** monorepo's `shared/ui/projects/ui-styles/styles/partials/` (`_native-css-variables.scss`, `_configuration-v2.scss`, `_base-tokens.scss`)
- `references/utilities-registry.json` — generated from the utility definitions in the script itself

The token/utility source lives in the `banking` monorepo — **not** this repo, but a separate checkout that may or may not be present on the machine. If banking isn't available, this flow can't run; tell the user the committed `references/*.json` stay in use until banking is checked out.

Use only when the user explicitly asks to refresh/regenerate tokens or utilities (e.g. after a `ui-styles` update in banking). Before running, confirm:

> ⚠️ This overwrites `references/tokens-registry.json` (and `references/utilities-registry.json` if the utility definitions changed) with data parsed from the current banking `ui-styles` source. Existing versions are patch-bumped; only files whose content actually changed are rewritten. Proceed?

If confirmed, run the script and point it at the banking checkout with `--repo-root` — its auto-detect looks for the `banking` repo and won't find it from here:

```bash
python3 .claude/skills/lumin-ui/scripts/build_tokens_utilities.py --repo-root <path-to-banking>
```

Report the token/utility counts and version bumps from the output. The script aborts without writing if it finds zero tokens (a sign the `ui-styles` path or file names changed) — surface that to the user rather than committing an empty registry.

---

## Component Deep Links

A component's Storybook page is derived from its selector (from `get_component_details`):

**Base URL:** `https://design.lumindigital.com/?path=/story/<selector>` (e.g. `ui-core-tabs` → `https://design.lumindigital.com/?path=/story/ui-core-tabs`)

To open it with specific inputs pre-filled:

**Format:** `https://design.lumindigital.com/?path=/story/<selector>--default&args=input1:value1;input2:value2`

Use exact `@Input()` property names as keys (see `get_component_details` inputs and its `examples` args for valid values), string values for enums (e.g. `error` not `NotificationTheme.ERROR`), encode spaces as `+`, and only include inputs that differ from defaults. `--default` is the usual first-story slug — if the link lands on the wrong story, copy the real slug from the Storybook sidebar URL.
