---
name: lumin-ui
description: "Build or modify UI in the banking web client with the Lumin Design System — screens, pages, components, dashboards, and prototypes — from a Figma link, an image, or a text description. Also answers how a Lumin component works, which component fits a given pattern, and what inputs/outputs a component accepts."
---

# Lumin Design System — UI Build Skill

> **How this skill is invoked:** These instructions are served as an MCP resource by the `lumin-design-mcp` server. There is no slash command and no argument string — you receive this entire document at once and choose the right flow from the user's request. Read the user's message to decide which flow below applies (Figma link, image, description, or a maintenance request); if their intent is unclear, ask.

> **Assumed context:** Designed to run from the `banking` monorepo root. To confirm the repo, check for a `package.json` with `"name": "banking"` and an `a3-web/` directory — both must be true. Component lookup uses the MCP tools (`search_ui_components` / `get_component_details`) and works from any location; the token/utility scripts (`search_tokens.py`, `search_utilities.py`) run from the skill directory. Anything that touches the codebase directly (route creation, file edits, `app-routing.module.ts`) requires the banking repo as the working directory — note it to the user if that's not the case.

**Core rules:**
1. **Never hand-roll HTML/CSS from scratch when Lumin Design System components are available.**
2. **When the component includes a form or multi-field user input, ask the user whether to use the Form Renderer before building.** If yes, follow `FORM_RENDERER.md`. If no, use individual Lumin form components directly.
3. **Always build static components.** Never wire up services, inject dependencies, or reference existing repo code. Hard-coded placeholder values are correct — integration is the developer's responsibility.

**File change rule — applies to every flow without exception:**
Before writing, creating, or modifying any file, present a summary listing each file path, whether it will be created/modified/moved, and one sentence describing its contents. Ask "Proceed with these changes?" and wait for explicit confirmation before touching any file.

---

## Step 1 — Clarify

Inspect the user's request and route accordingly:

- **They provided a Figma link** → follow the **Building from a Figma link** flow.
- **They attached an image or screenshot** → follow the **Building from an image** flow.
- **They described what to build in text** → follow the **Building from a description** flow.
- **They asked to create a blank route/page** → follow the **Creating a blank route** flow.
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
4. **Element matching** — closest Lumin component by visual shape, not assumed name: "row of tabs", "pill label", "icon + text row", "data table"
5. **Form fields** — note separately; ask the Form Renderer question before writing those fields
6. **Unmatched elements** — anything with no clear Lumin match goes through the Missing Component Protocol before writing custom HTML

Write this as a brief structured summary before writing any code.

---

## Step 2 — Research Components

- **Consult `CORE_COMPONENTS.md` first** for shared app-level components (`app-header`, `app-wizard`, `app-wizard-buttons`, `app-search-sort-filter`, etc.) via `CoreCommonModule` — always prefer these over custom implementations.
- Consult `COMPONENT_RULES.md` for NgModule imports, Angular conventions, and known selectors.
- Look up components with the **MCP tools** (this skill is served by the `lumin-design-mcp` server, so they are available whenever the skill is loaded). These are the authoritative source for component selectors, inputs, outputs, and referenced types — do not guess and do not maintain a local component list:
  - `search_ui_components(query)` — semantic search by natural-language description; returns brief matches (id, selector, name, kind, library, description)
  - `get_component_details(id)` — full API for a match: selector, import path, standalone flag, NgModule, typed inputs/outputs, referenced type declarations, and example usage/args

- For design tokens and layout utilities (no MCP equivalent), use the local Python scripts:
  - `python3 scripts/search_tokens.py <keyword> [--category <cat>]` — CSS design tokens
  - `python3 scripts/search_utilities.py <keyword> [--category <cat>] [--categories]` — layout utility classes from ui-styles

- For any form or multi-field input, ask the user whether to use the Form Renderer before writing input fields. If yes, read `FORM_RENDERER.md` first.

Use exact **selectors**, **import paths**, and **NgModule** entries — never guess.

---

## Step 3 — Write the Component

Write:
- `.component.ts` — component class with imports, inputs, and logic
- `.component.html` — template using Lumin selectors
- `.component.scss` — styles using design tokens and utility classes

**HARD RULE — `.component.html` must always be written with the `Bash` tool.** `Write` and `Edit` trigger a hook that sends the file to the Claude Desktop Code preview panel, which renders Angular templates as broken raw HTML. Use a `cat` heredoc instead:

```bash
cat > path/to/file.component.html << 'EOF'
<div>template content here</div>
EOF
```

Follow all rules in `COMPONENT_RULES.md`:
- Use `UiCoreModule` and `UiFormsModule` barrel imports — never import component classes directly
- Use Angular 17+ built-in control flow (`@if`, `@for`, `@switch`) — never `*ngIf`, `*ngFor`
- Never hardcode colors, spacing, or typography — always use CSS variables from the design token system

After writing, run the **Coverage Audit** from `COMPONENT_RULES.md` — every plain HTML element that could be a Lumin component must be checked.

---

## Step 4 — Post-Write Checks

**Mobile responsiveness** — apply mobile patterns if: the component owns a route, the template has a multi-field form, it has multi-column rows, or it's a top-level container with no parent providing padding. Skip if: it's a single display-only widget with no layout of its own. If unclear, ask before proceeding. Always tell the user which decision was made and why.

If mobile patterns apply, verify:
- Content wrapper has `px-4 px-md-0`
- Two-column rows use `flex-column flex-md-row`, not `flex-row` alone
- Half-width fields use a responsive SCSS class (`width: 100%` → `calc(50% - 20px)` at `md+`)
- Two-column gaps are reduced on mobile to match the surrounding row gap

Consult `KNOWN_ISSUES.md` for common Angular/TypeScript errors (HTML comments inside opening tags, missing NgModule imports) and fix any issues before presenting the code.

---

## Step 5 — Report Back

- Component name and what was built
- Lumin components used and their packages
- Any unmatched UI elements and why custom HTML was used (→ Missing Component Protocol in `COMPONENT_RULES.md`)
- Any known limitations or follow-up steps

Then immediately proceed to **Step 6 — Package as Prototype ZIP**.

---

## Step 6 — Package and Deploy Prototype

After reporting back, always run all three sub-steps below.

### A — Ensure `meta.json` exists

Check whether `<temp-folder>/<component-name>/meta.json` already exists. If it doesn't, create it:

```bash
cat > <temp-folder>/<component-name>/meta.json << 'EOF'
{ "name": "<Title-cased component name>", "description": "<One-sentence description of what was built>" }
EOF
```

Derive `name` by title-casing the component slug (e.g. `loan-summary` → `"Loan Summary"`). Write the description from what you built — one sentence, user-facing.

### B — Copy into the prototype sandbox (if present)

Check whether `src/app/prototypes/` exists in the current working directory:

```bash
[ -d src/app/prototypes ] && echo "exists"
```

If it exists, copy the built folder there:

```bash
cp -r <temp-folder>/<component-name> src/app/prototypes/
```

**Do not wire anything up** — the live watcher (`wire-prototypes --watch`) detects the new folder and regenerates the registry, routes, and module declarations automatically. Just copy; the sandbox handles the rest.

### C — Create the ZIP

```bash
cd <temp-folder> && zip -r <component-name>.zip <component-name>/
```

The zip must contain the folder itself (not just the files inside it), so the `cd` + relative path pattern above is required.

### D — Reveal in Finder and tell the user

Run this to select the zip in Finder immediately:

```bash
open -R <temp-folder>/<component-name>.zip
```

Then report what happened and provide a clickable link:

> Prototype files copied to `src/app/prototypes/<component-name>/` — the live watcher will wire it up automatically.
>
> Finder is open with the zip selected. You can also click this link any time:
>
> [<component-name>.zip](file://<temp-folder>/<component-name>.zip)
>
> Or drag the zip onto the [Lumin Prototype Sandbox](https://stackblitz.com/~/github.com/mcarlucci-lumin/lumin-prototype) drop zone to add it to a fresh session.

If `src/app/prototypes/` was not found, omit the first line and note that only the zip was created.

Use the **absolute, expanded path** in the `file://` URL (no `~` — replace it with `/Users/<username>`). The link will not resolve if `~` is left unexpanded.

### E — Open preview in Claude Desktop (if available)

**Only run this sub-step if `src/app/prototypes/` was found** (the files were copied to the sandbox).

Check whether the Claude Desktop Browser pane is available by looking for the `preview_start` tool (part of the `mcp__Claude_Browser__*` tool set). This tool is present in Claude Desktop sessions but not in other surfaces.

**If `preview_start` is available:**
1. Call `preview_start` with `{name: "lumin-prototype"}` — this starts the dev server via `npm run boot && npm start` (or reuses it if already running) and opens a preview tab at `http://localhost:4200`.
2. Wait for the server to be ready, then navigate the preview pane to `http://localhost:4200/<component-name>` using the `navigate` tool so the user sees the result immediately.
3. Take a screenshot with `computer {action: "screenshot"}` and share it as proof the prototype is live.

**If `preview_start` is not available**, skip silently — the user can run the preview manually:
```bash
npm run boot && npm start
```
Then open `http://localhost:4200/<component-name>` in a browser.

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

For new page routes, see `ROUTING.md`.

---

## Shared: Build, Place, and Deploy

Referenced by the Figma, description, and image build flows. Once component research (Step 2) is complete, follow these steps.

### Build to temp folder

| Flow | Temp folder |
|---|---|
| Figma link | `~/.claude/tmp/lumin-figma-build/<component-name>/` |
| Description | `~/.claude/tmp/lumin-describe-build/<component-name>/` |
| Image | `~/.claude/tmp/lumin-image-build/<component-name>/` |

Create first: `mkdir -p <temp-folder>/<component-name>`

Write three files: `.component.ts`, `.component.html` (Bash/cat heredoc only), `.component.scss`. Infer the component name from the design source (kebab-case). Follow all rules from `COMPONENT_RULES.md` and Post-Write Checks from **Step 4**.

Show the user a summary of what was built and which Lumin components were used before asking the next question. After placement is complete and reported, always run **Step 6 — Package as Prototype ZIP**.

### Ask where to place the files

> Where should these files go?
> 1. **test-app sandbox** *(recommended for a quick look)* — the Lumin `shared/ui` demo app. Fastest to view (`ng serve`, no Docker, no auth), isolated from the real apps.
> 2. **`/ui-tools` sandbox** — the banking app's sanctioned UI sandbox. Renders inside the **real app shell** (header, footer, theme, layouts) in **web-client** or **admin-web-client**. (web-client adds it as a new Layout-picker option; admin-web-client renders it inline.)
> 3. **Existing banking path** — drop the files into a path you provide (e.g. `a3-web/web-client/src/app/my-feature/`).
> 4. **New blank route** — I'll run the **Creating a blank route** flow and place the files there.

### Place the files

**test-app sandbox:** the demo app lives at `shared/ui/projects/test-app`.
1. Create a folder for the component under `shared/ui/projects/test-app/src/app/<component-name>/` and move the three files there (`mv`).
2. Declare the component in `shared/ui/projects/test-app/src/app/app.module.ts` — add the `import` and add the class to the `declarations` array.
3. Add a route in `shared/ui/projects/test-app/src/app/app-routing.module.ts` — import the component and add `{ path: '<component-name>', component: <ClassName> }` to the `routes` array (keep the existing `{ path: '**', redirectTo: '' }` last).
4. Report the final locations and tell the user how to view it:
   > To see it, run `npm start` (i.e. `ng serve`) from `shared/ui`, then open `http://localhost:4200/<component-name>`.
   Note: test-app imports the libraries from source (`projects/ui-*/src/public-api`), so no package publish or Docker build is needed — but it does **not** reflect the real banking app shell/theme.

**`/ui-tools` sandbox:** ask which client (**web-client** or **admin-web-client**) if not specified. The host lives at `a3-web/<client>/src/app/ui-tools/`. **The two clients have different `/ui-tools` structures — always read the client's `ui-tools.component.html` and `ui-tools.component.ts` first to confirm the pattern before editing.**

Common steps (both clients):
1. Create a folder under `a3-web/<client>/src/app/ui-tools/<component-name>/` and move the three files there (`mv`). Give the component a unique `selector` (e.g. `app-<component-name>`).
2. In `ui-tools.module.ts`, add the `import` and add the class to `declarations`. **If the built template uses reactive forms (`[formGroup]`, `formControlName`), also add `ReactiveFormsModule` to the module's `imports` array — `UIToolsModule` does not import it by default** (see `KNOWN_ISSUES.md` → NG8002).
3. Edit `ui-tools.component.html` with the **Bash/cat heredoc** rule (never Write/Edit — see **Step 3**).

**web-client** — it has a Layout picker (`mode`/`modeOptions` + `@switch (mode)`), so add a selectable view:
- In `ui-tools.component.ts`, add a `PickerOption` to the `modeOptions` array — `new PickerOption('<Label>', '<component-name>')` (`PickerOption` is already imported from `@a3-digital/ui-forms`).
- In `ui-tools.component.html`, add a `@case ('<component-name>')` branch inside the `@switch (mode)` block that renders your component (mirror the existing `@case ('wizard')` / `#wizardContent` pattern, or point an `<ng-container [ngTemplateOutlet]>` at a new `<ng-template>`).
- View: open `/ui-tools` and choose **<Label>** from the Layout picker.

**admin-web-client** — it is a plain page (`<div class="container">`, no `mode`/`modeOptions`/`@switch`), so there is no picker to extend:
- Do **not** touch `modeOptions`/`@switch` — they don't exist here.
- Add your component's selector directly inside the existing container in `ui-tools.component.html` (append it after the existing content).
- View: open `/ui-tools` — the component renders inline with the rest of the page.

Then report the final locations and tell the user how to view it:
> To see it, run `ng build --watch` from `a3-web/<client>` (or `gulp rebuild` from `a3-web/web-server` for a full rebuild), then open `/ui-tools`.
The route is `AccessGuard`-gated, so the user must be logged in. `/ui-tools` is a sanctioned sandbox (not production code) — no throwaway route to clean up.

**Existing banking path:** verify it exists, move files with `Bash` (`mv`), report final locations.

**New blank route:** ask for route name if not provided, and ask which client (**web-client** or **admin-web-client**) if not specified → run `create_blank_route.sh <name> --client <web|admin>` per the **Creating a blank route** flow → replace the generated `.component.html` with the built template (`mv` or `printf`) → move `.component.ts` and `.component.scss` into the route folder, overwriting stubs → report final locations and remind the user to run `gulp rebuild` from `a3-web/web-server`, specifying **web-client** or **admin-web-client** based on where the files were placed.

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

All three end the same way: a built component in a temp folder, then a prompt asking where to place it — the `shared/ui` **test-app sandbox**, the **`/ui-tools`** sandbox in the real app shell, an existing banking path, or a new blank route.

---

## Flow — Creating a blank route

Use this flow when the user asks to create a new blank route/page, or when the build placement step (in **Shared: Build, Place, and Deploy**) needs a new route created.

### Step A — Determine the feature name and client

If the feature name was included in the user's request, use it directly. Otherwise ask:

> What should the feature be named? (folder name, selector, class name, and route path — e.g. `loan-summary`)

If the client (web vs admin) was not specified in the user's prompt, ask:

> Which client should this route be created in?
> 1. **web-client** — the member-facing web app
> 2. **admin-web-client** — the admin/management interface

### Step B — Run the script

```bash
bash scripts/create_blank_route.sh <feature-name> --client <web|admin>
```

### Step C — Report back

Relay the script output. Remind the user to run `gulp rebuild` from `a3-web/web-server`, specifying the correct client (**web-client** or **admin-web-client**). The verification URL depends on the client:
- **web-client:** `https://dev-local.a3-digital.internal/<feature-name>`
- **admin-web-client:** `https://admin.dev-local.a3-digital.internal/<feature-name>`

Also include this notice:

> ⚠️ **Prototype only.** The route and component created by this skill are intended for rapid prototyping and visual exploration — not production use. The generated code uses static placeholder data, has no service integration, and does not follow all production conventions. Before shipping, a developer should review and rewrite the component properly.

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

### Step C — Research, build, and place

Follow **Step 2 — Research Components** using the confirmed design context from Step B/B2, then follow **Shared: Build, Place, and Deploy**.

---

## Flow — Building from a description

Use this flow when the user describes the screen or component in text (no Figma link, no image).

### Step A — Request the description

Respond with:

> Describe the screen, component, or UI element you want to build. Include as much detail as you have: what sections are on it, what actions are available, any data it displays, and roughly how it's laid out. I'll break it down into regions, map each one to Lumin components, and show you my interpretation before writing any code.

### Step B — Analyze

Apply the **Text Analysis Protocol** in full and write the analysis as a structured summary before touching any code.

### Step C — Research, build, and place

Follow **Step 2 — Research Components** for each element identified in Step B, then follow **Shared: Build, Place, and Deploy**.

---

## Flow — Building from an image

Use this flow when the user attaches or pastes a screenshot or mockup.

### Step A — Request the image

Respond with:

> I'm ready to analyze your design image. Paste or attach the screenshot or mockup and I'll work through it using the Image Analysis Protocol — identifying the container structure, layout, and every UI element — then look up the matching Lumin components before writing any code.

### Step B — Analyze

Apply the **Image Analysis Protocol** in full and write the analysis as a brief structured summary before touching any code.

### Step C — Research, build, and place

Follow **Step 2 — Research Components** for each element identified in Step B, then follow **Shared: Build, Place, and Deploy**.

---

## Flow — Regenerating token/utility data

**Maintenance tool — not for normal component development.** Component/type lookup is owned by the MCP (`search_ui_components` / `get_component_details`); this flow only refreshes the two skill-only reference files the MCP does not cover:
- `references/tokens-registry.json` — parsed from `shared/ui/projects/ui-styles/styles/partials/` (`_native-css-variables.scss`, `_configuration-v2.scss`, `_base-tokens.scss`)
- `references/utilities-registry.json` — generated from the utility definitions in the script itself

Use only when the user explicitly asks to refresh/regenerate tokens or utilities (e.g. after a `ui-styles` update). Before running, confirm:

> ⚠️ This overwrites `references/tokens-registry.json` (and `references/utilities-registry.json` if the utility definitions changed) with data parsed from the current `ui-styles` source. Existing versions are patch-bumped; only files whose content actually changed are rewritten. Proceed?

If confirmed, run from the skill directory (or anywhere in the banking repo — it auto-detects the repo root):

```bash
python3 scripts/build_tokens_utilities.py [--repo-root <path>]
```

Report the token/utility counts and version bumps from the output. The script aborts without writing if it finds zero tokens (a sign the `ui-styles` path or file names changed) — surface that to the user rather than committing an empty registry.

---

## Component Deep Links

A component's Storybook page is derived from its selector (from `get_component_details`):

**Base URL:** `https://design.lumindigital.com/?path=/story/<selector>` (e.g. `ui-core-tabs` → `https://design.lumindigital.com/?path=/story/ui-core-tabs`)

To open it with specific inputs pre-filled:

**Format:** `https://design.lumindigital.com/?path=/story/<selector>--default&args=input1:value1;input2:value2`

Use exact `@Input()` property names as keys (see `get_component_details` inputs and its `examples` args for valid values), string values for enums (e.g. `error` not `NotificationTheme.ERROR`), encode spaces as `+`, and only include inputs that differ from defaults. `--default` is the usual first-story slug — if the link lands on the wrong story, copy the real slug from the Storybook sidebar URL.
