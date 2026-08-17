# Component Rules

Read this file before writing any template code. It covers NgModule imports, Angular conventions, the coverage audit, and the missing component protocol.

---

## Component & Module Rules

**A prototype is a single component file — you never write an NgModule.** The `wire-prototypes` watcher declares every prototype in the generated root `app.module.ts`, which already imports everything a prototype needs. Do not create a feature module, and do not add an `imports` array to the prototype component.

**HARD RULE — set `standalone: false` explicitly.** Angular 17+ defaults components to `standalone: true`. A standalone component cannot be declared in an NgModule, so when the watcher adds the prototype to `app.module.ts` the build fails with **NG6008** (_"Component X is standalone, and cannot be declared in an NgModule"_). Always set the flag.

**HARD RULE — never import a Lumin `*Component` class, and never place one in an `imports: []`.** Lumin UI components are not standalone; importing `ButtonComponent`, `TableComponent`, or any other `@a3-digital` component class directly triggers _"appears in 'imports' but is not standalone."_ You never need to — the modules that export them are already imported centrally (see below).

```typescript
// ✅ Correct — a prototype component. No imports array, no feature module.
import { Component } from '@angular/core';

@Component({
    standalone: false,
    selector: 'app-my-feature',
    templateUrl: './my-feature.component.html',
    styleUrls: ['./my-feature.component.scss'],
})
export class MyFeatureComponent {}
```

**What the generated root `app.module.ts` already imports** — available to every prototype with zero setup:
- Every vendored Lumin module — `UiCoreModule`, `UiFormsModule`, `UiLayoutsModule`, `UiManagementModule`, `UiWorkflowsModule`
- `FormsModule` **and** `ReactiveFormsModule` — both template-driven and reactive (`[formGroup]`, `formControlName`) forms work with no extra imports
- `BrowserModule` / `BrowserAnimationsModule` (so built-in control flow and Lumin animations work), plus `DragDropModule` and `NgbModule`

Use any Lumin selector or either forms API directly in the template — do not add or "wire up" modules yourself. Do not invent per-component NgModule names (e.g. `UiCoreButtonModule`) — they don't exist.

---

## General Composition Rules

- Use the exact **selectors** from `get_component_details` (e.g., `<ui-core-button>`, `<ui-workflows-table>`), not generic HTML equivalents.
- Use exact **import paths** and `NgModule` entries from `get_component_details` — never guess.
- Look up component inputs, outputs, and types with `get_component_details` before using them. Never assume property shapes or constructor signatures. Each record has typed `inputs`, `outputs`, and referenced type declarations.
- **Never carry Figma Code Connect prop values directly into Angular input bindings.** Figma Code Connect snippets use Figma component property names and values (e.g. `theme="Neutral" variant="Secondary"`), which do not necessarily match the Angular component's input names or string values. Always verify against `get_component_details` or the package's `index.d.ts`. A wrong value causes no error — the component just silently ignores it and renders with defaults.
- Use Angular 17+ built-in control flow (`@if`, `@for`, `@switch`) — never structural directives (`*ngIf`, `*ngFor`, `*ngSwitch`), which are deprecated.
- Never use components with `ds-only` or `demo` in their names — these are examples, not for production use.
- **Before concluding a component doesn't exist, run `search_ui_components` with at least two keyword angles** — different natural-language descriptions of the need. The library is large and a component often exists under a name you didn't expect.

---

## Sizing, Shape & State Inputs — Match the Design

Picking the right *component* is only half of fidelity; getting its **size, shape, density, and state** right is the other half. Many Lumin components expose inputs that control these, and leaving them at their defaults is a top source of "right component, wrong look" — a progress bar too thick or thin, a button the wrong size or shape.

When `get_component_details` lists a component's inputs, scan for ones whose **purpose** is dimensional or stateful, and *consider* whether the design calls for a non-default value:

- **Size / dimension** — e.g. a progress bar's `height` (bar thickness), `size` (`sm`/`md`/`lg`), `width`, `diameter`, `strokeWidth`, `thickness`. Read the design's measured or relative dimension and bind the matching input.
- **Shape** — `rounded`, `pill`, `shape`, `radius` — pill vs. square button, rounded vs. sharp corners.
- **Density** — `dense`, `compact`, padding-related inputs — tight vs. roomy.
- **State / variant that changes size or shape** — a button's `theme` / `themeGroup` (fill vs. outline vs. text shifts its visual weight and sometimes footprint), `fullWidth` / `block`, `disabled`, `loading` (a spinner may replace the label and change width), and active/selected/error states. If the design depicts a specific state, set the input that produces it — never fake it with CSS.

**Consider, don't force — defaults may be theme-driven.** A component's default size/shape/density is often set by the active theme and may already match the design; a visual difference you see could come from a custom theme rather than an unset input. So set a sizing/shape/state input only when the design **clearly** diverges from how the component renders by default — don't override reflexively. **When you're unsure whether a difference is an input to set, a theme effect, or the intended default, ask the user** rather than guessing.

**Match the input's purpose to the visual property.** When you *do* decide to set one: the same input name can mean different things on different components, and the property you're reproducing may map to a non-obvious input — so read each input's type and description in `get_component_details` and pick the one whose *purpose* matches. Example: to reproduce a bar's thickness, use the progress bar's `height` input, not a wrapper `style="height: …"`.

**For absolute sizes, measure — don't estimate a ratio.** When the design is an image, get the real pixel value from the saved `_reference/source.png` with `scripts/measure_png.py` (establish 1:1-vs-retina scale first) rather than judging a size by its proportion to another element ("this bar is ~⅓ of that one") — that shortcut is unreliable and repeatedly wrong. For choosing between *discrete* options (`sm`/`md`/`lg`, pill vs. square) where there's no measurable px, pick the closest provided option or token. Always prefer a provided sizing input over a hardcoded `px`. These are confirmed against the source in **Step 5C**.

---

## Colors — Leave Branded / Theme Tokens In Place

When a component's color is already driven by a **branded or theme token** — its default, or a token you set such as `bg-brand-primary` / `bg-brand-secondary` / `bg-brand-neutral`, or any `--brand-*` / `--color-*` CSS variable the active brand theme resolves — **leave that token as-is, even if it renders a different shade than the source image shows.** Brand colors are theme-driven: the mockup was almost certainly captured under a *different* brand theme, so the **token is the source of truth, not the mockup's literal hex**. Do not override a branded/theme token to chase the pixel color — neither by hardcoding the source's hex nor by swapping to a different token.

A shade difference under a correct branded/theme token is therefore **expected, not a discrepancy** — don't flag it in the fidelity pass or Step 5C, and don't "fix" it.

The one exception is a **semantic** correction: change the token only when the component is using the *wrong token for its meaning* — e.g. a status element rendered with a neutral/brand token when a status token (`success` / `danger` / `warning` / `info`) is clearly intended. That's fixing meaning, not matching color. When unsure whether a shade difference is a wrong token or just this theme's rendering of the right one, **leave the token** and note it in the fidelity summary.

---

## CSS Utility Classes

Before writing any custom CSS, check whether a utility class already covers the need. The full set of utility classes from `ui-styles` is catalogued in `references/utilities-registry.json` and is searchable via:

```bash
python3 .claude/skills/lumin-ui/scripts/search_utilities.py <keyword>
python3 .claude/skills/lumin-ui/scripts/search_utilities.py --category <category>
python3 .claude/skills/lumin-ui/scripts/search_utilities.py --categories
```

**These categories are available:** `flex`, `spacing`, `grid`, `display`, `position`, `sizing`, `overflow`, `visibility`, `z-index`, `cursor`, `container`, `float`, `typography`, `color`, `border`, `accessibility`, `animation`, `layout`, `misc`.

### When to use a utility class

- Layout and spacing — always check `flex`, `spacing`, `grid`, `display`, `position` first. Nearly every layout need is covered.
- Typography — `text-heading1` through `text-caption`, alignment, weight, transform, clamp, truncate.
- Color — `bg-*` backgrounds, `color-*` and `text-color-*` text colors, `is-positive`/`is-negative`/`is-pending` for amounts.
- Borders — `border`, `border-top/right/bottom/left`, `border-radius`, `round`, `rounded`.
- Visibility / accessibility — `hidden`, `invisible`, `sr-only`, `visually-hidden`.

### Gotchas — utility classes that do NOT exist

Do not assume Bootstrap/Tailwind conventions carry over. Some common class names (`gap-*`, `flex-1`, `ms-auto`) are **not** in `ui-styles` and silently do nothing. Always confirm a class exists with `search_utilities.py` before relying on it — a nonexistent utility produces no error and no effect, so the layout just silently fails. See **"Missing Utility Classes Fail Silently"** in `KNOWN_ISSUES.md` for the specific classes and their replacements.

### When to write custom CSS instead

- A value is not available as a utility class (e.g. a specific `calc()` width, a Figma-specified gap not in the spacing scale).
- A responsive variant is needed that doesn't exist in the utility set.
- A compound rule applies to a specific component's internal structure.

In these cases, use design tokens (CSS variables) — never hardcode pixel, hex, or font values. See **Design Token Reference** below.

### Utility classes and responsive variants

Most layout utility classes have responsive variants using breakpoint infixes: `xs`, `sm`, `md`, `lg`, `xl`. For example:
- `.d-none .d-md-block` — hidden on mobile, block at md+
- `.flex-column .flex-md-row` — stacked on mobile, row at md+
- `.p-3 .p-md-5` — different padding per breakpoint

Use `--base-only` with `search_utilities.py` to see base classes without responsive variants:
```bash
python3 .claude/skills/lumin-ui/scripts/search_utilities.py --category flex --base-only
```

---

## Mobile Responsiveness

A prototype renders on both mobile and desktop. Apply these patterns whenever a template contains a form, layout container, or multi-column row — failure to do so causes content to bleed to the screen edge on mobile.

### Form wrapper padding

Wrap all form content with `px-4 px-md-0` — 16px horizontal padding on mobile, removed at `md+` (768px) where the wider viewport gives the content room to breathe.

```html
<form [formGroup]="form" class="d-flex flex-column px-4 px-md-0">
  ...
</form>
```

This applies to any top-level content container, not just `<form>` elements.

### Two-column rows

Never use `d-flex flex-row` alone for side-by-side form fields. Use `flex-column flex-md-row` so fields stack on mobile and sit side-by-side on desktop.

```html
<!-- ✅ Stacks on mobile, row on desktop -->
<div class="d-flex flex-column flex-md-row" style="gap: ...">
  <ui-forms-text-input ...></ui-forms-text-input>
  <ui-forms-dropdown ...></ui-forms-dropdown>
</div>

<!-- ❌ Always a row — broken on mobile -->
<div class="d-flex flex-row">...</div>
```

### Half-width fields

Fields that are desktop-only half-width must go full-width on mobile. Use a SCSS class with a responsive `width`:

```scss
.my-half-col {
  width: 100%;

  @media (min-width: 768px) {
    width: calc(50% - 20px);
  }
}
```

### Responsive gap

When a two-column row has a design-specified gap (e.g. 40px from Figma), reduce it on mobile to match the surrounding form row gap:

```scss
.my-two-col {
  gap: 28px;                    // matches form row gap on mobile

  @media (min-width: 768px) {
    gap: 40px;                  // Figma desktop spec
  }
}
```

---

## Accessibility

Every component built with this skill must meet a baseline of accessibility. Lumin components handle their own internal a11y (focus trapping, keyboard navigation, ARIA roles) — the rules below apply to the structural and custom code written around them.

### Semantic HTML

Use semantic elements wherever the content warrants it. Do not default to `<div>` for structural regions.

| Region | Element to use |
|---|---|
| Top-level page content area | `<main>` |
| Page or section heading group | `<header>` |
| Navigation links | `<nav>` |
| Standalone content section | `<section>` with an `aria-label` or heading |
| Complementary sidebar content | `<aside>` |
| Self-contained article/card content | `<article>` |
| Page footer | `<footer>` |

Use `<button>` for any element the user activates; use `<a>` for any element that navigates. Never use a `<div>` or `<span>` as a click target without explicit ARIA and keyboard handling.

### Form labels

Every Lumin form input must have an associated visible label. Placeholder text is not a label — it disappears on input and is not announced reliably by screen readers.

```html
<!-- ✅ Label wired to input -->
<ui-forms-text-input
  [label]="'Account nickname'"
  [formControl]="nicknameControl">
</ui-forms-text-input>

<!-- ❌ Placeholder only — not accessible -->
<ui-forms-text-input
  [placeholder]="'Account nickname'"
  [formControl]="nicknameControl">
</ui-forms-text-input>
```

If a Lumin input component does not expose a `label` input, add a `<label>` element associated via `for`/`id`, or use `aria-label` directly on the input element.

### Images

Every `<img>` must have an `alt` attribute.

- **Meaningful image** — describe what the image conveys: `alt="Account summary chart showing upward trend"`
- **Decorative image** — empty string: `alt=""` (screen readers skip it)
- Never omit `alt` entirely — missing `alt` causes screen readers to read the file name.

### Screen reader utilities

Use `sr-only` or `visually-hidden` (from the `accessibility` utility category) when content must be communicated to screen readers but is redundant or noisy visually.

Common cases:
- Icon-only buttons: add a visually hidden label alongside the icon
- Supplemental context that the visual design conveys through layout or color alone
- "Skip to main content" links: use `sr-only-focusable` so they appear only on keyboard focus

```html
<!-- Icon-only button — screen reader gets the label -->
<button type="button" aria-label="Close">
  <span class="material-icons" aria-hidden="true">close</span>
</button>

<!-- Or with sr-only text -->
<button type="button">
  <span class="material-icons" aria-hidden="true">close</span>
  <span class="sr-only">Close</span>
</button>
```

### Interactive container classes

`container-bordered-interactive` and `container-elevated-interactive` style a clickable card visually, but a bare `<div>` with these classes is not keyboard-accessible. Use one of these patterns:

**Preferred — wrap in a native element:**
```html
<button class="container-elevated-interactive" type="button">
  <!-- card content -->
</button>
```

**If a `<div>` is required — add explicit keyboard support:**
```html
<div
  class="container-elevated-interactive"
  role="button"
  tabindex="0"
  (click)="onSelect()"
  (keydown.enter)="onSelect()"
  (keydown.space)="onSelect()">
  <!-- card content -->
</div>
```

Never use interactive container classes on a non-interactive element — if the container is not clickable, use a non-interactive variant (`container-bordered`, `container-elevated`).

### Focus states and the `using-keyboard` pattern

Lumin's focus-ring styles are scoped to a `.using-keyboard` class on `<body>`, toggled on when the user navigates by keyboard and off on mouse interaction — so focus rings show for keyboard users but not on mouse click.

When writing custom interactive elements, scope custom focus styles the same way:

```scss
.my-interactive-element {
  &:focus {
    .using-keyboard & {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
  }
}
```

Never suppress `outline` globally (`outline: none`) — this breaks keyboard navigation entirely.

### ARIA attributes on Lumin components

Some Lumin components accept ARIA inputs. Populate them when there is no visible label already providing the context:

- `aria-label` — when a component has no visible text label (icon buttons, icon-only inputs)
- `aria-describedby` — when supplemental help text elsewhere on the page describes the input
- `aria-live` — on regions that update dynamically without a page navigation

Check `get_component_details` for a component's available inputs before adding ARIA attributes manually — the component may already wire them through internally.

---

## Coverage Audit

**This step is mandatory after writing every template.** Before finalising, audit every visual element.

### How to audit

1. Review the written `.html` file.
2. For each distinct UI element (buttons, inputs, cards, badges, progress indicators, navigation, tables, charts, modals, etc.), confirm it maps to a real Lumin component.
3. For any element rendered with plain HTML (a `<div>`, `<span>`, `<p>`, a custom class) that *could* be a UI component, run `search_ui_components` with at least **two keyword variations** (different natural-language descriptions of the element) before concluding no component exists.

### Keyword angles by element type

| Element you see | Keywords to search |
|---|---|
| Progress / step indicator | `progress bar`, `step indicator`, `stepper` |
| Status badge | `badge`, `tag`, `label`, `chip`, `status` |
| Alert / notification | `alert`, `notification`, `banner`, `inline notification` |
| Avatar / initials circle | `avatar`, `profile`, `initials` |
| Breadcrumb | `breadcrumb`, `navigation`, `trail` |
| Tabs | `tab`, `navigation`, `segmented control` |
| Tooltip | `tooltip`, `popover`, `hint` |

### What to do with findings

- **Component exists → swap it in.** Replace the hand-rolled element with the correct `<ui-*>` selector and update imports. Do not leave a custom `<div>` when a real component is available.
- **No component found after thorough `search_ui_components` queries → follow the Missing Component Protocol below.**

### Accessibility checklist

Run this after the component audit, before finalising:

- [ ] All structural regions use semantic HTML (`<main>`, `<section>`, `<nav>`, `<header>`, `<footer>`, `<aside>`) where appropriate — no `<div>` for layout regions that have a semantic equivalent
- [ ] Every form input has a visible label wired to it — no inputs relying on placeholder text alone
- [ ] Every `<img>` has an `alt` attribute — empty string for decorative, descriptive text for meaningful images
- [ ] Icon-only buttons have `aria-label` or a `.sr-only` text label — the icon itself has `aria-hidden="true"`
- [ ] Any interactive container class (`container-bordered-interactive`, `container-elevated-interactive`) is on a `<button>`, `<a>`, or a `<div>` with `role`, `tabindex`, and keyboard event handlers
- [ ] No `outline: none` in custom SCSS — focus styles scoped to `.using-keyboard` instead
- [ ] Any region that updates dynamically has `aria-live` if the update should be announced to screen readers

---

## Missing Component Protocol

If `search_ui_components` returns no match after trying multiple keyword angles, **stop and surface it before writing any custom code.**

### Step A — Notify the user

> "I couldn't find a Lumin Design System component for **[element name]** (searched: _[keywords tried]_). Before I hand-roll this with custom HTML/CSS, I want to flag it — there may be a component in progress or a preferred pattern the UI team uses."

### Step B — Draft a Slack message for #ui

Present this for user review (post directly only if the Slack MCP is connected and the user says to proceed):

```
*Missing Lumin component — input needed*

Hi team! While building a prototype I couldn't find a design system component for the following:

*Element needed:* [clear description of the UI element and its purpose]
*Prototype/context:* [what screen or feature it's being built for]
*Searched for:* [list the search_ui_components queries tried]

Does a component already exist for this under a different name? If not, is one planned, or should I hand-roll it for now?
```

Post target: **#ui**

### Step C — Wait for user direction

Do not write custom HTML/CSS for the missing element until the user explicitly says to proceed. The user may:

- Know the correct component name → use it instead
- Confirm no component exists and say to hand-roll it → use minimal custom CSS that defers to design tokens (see **Design Token Reference** below — never hardcode a color, spacing, or typography value)
- Want to wait for the UI team's response before building

**The worst outcome is polished-looking custom UI the team later has to rip out and redo.**

---

## Design Token Reference — Use These Before Hardcoding Any Value

**Any time you write custom CSS** — whether for a missing component or any other hand-rolled element — look up the relevant token category first. Use the CSS variable it provides instead of a hardcoded pixel, hex, or font value.

| Topic | URL |
|---|---|
| Colors | https://design.lumindigital.com/iframe.html?globals=&args=&id=global-styles-colors--default-story&viewMode=story |
| Containers | https://design.lumindigital.com/iframe.html?globals=&args=&id=global-styles-containers--default-story&viewMode=story |
| Spacing | https://design.lumindigital.com/iframe.html?globals=&args=&id=global-styles-spacing--default-story&viewMode=story |
| Typography | https://design.lumindigital.com/iframe.html?globals=&args=&id=global-styles-typography--default-story&viewMode=story |

**The preference:**

```css
/* ❌ Never hardcode */
margin: 16px;
color: #1a1a2e;
font-size: 14px;

/* ✅ Use a token */
margin: var(--spacing-md);
color: var(--text-color-primary);
font-size: var(--font-size-body);
```

If you are unsure of the exact variable name, look it up with `python3 .claude/skills/lumin-ui/scripts/search_tokens.py <keyword> [--category <cat>]`, or fetch the relevant URL above from `design.lumindigital.com` — it lists available tokens for that category.
