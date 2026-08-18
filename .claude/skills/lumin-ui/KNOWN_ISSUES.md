# Known Issues & Troubleshooting

---

## HTML Comments Inside Element Opening Tags (template parse failure)

**Symptom:** Angular template parse error at compile time — often cryptic, pointing to the line with the comment.

**Cause:** Comments inside element attribute positions are invalid Angular template syntax.

```html
<!-- ❌ Invalid — comments cannot appear between attributes -->
<ui-forms-datepicker
  [maxDate]="maxDate"
  <!-- optional: [actionButtonIcon], [actionButtonLabel] -->
></ui-forms-datepicker>

<!-- ✅ Remove all such comments; keep only valid attribute bindings -->
<ui-forms-datepicker [maxDate]="maxDate"></ui-forms-datepicker>
```

**Fix:** Strip every `<!-- ... -->` comment that appears inside an element's opening tag (between attributes). Comments outside of tags (between elements) are fine to leave.

---

## Component Is Standalone, Can't Be Declared (NG6008)

**Symptom:** The build fails the moment the watcher wires a new prototype:
```
NG6008: Component <Name>Component is standalone, and cannot be declared in an NgModule. Did you mean to import it instead?
```

**Cause:** The prototype component omitted `standalone: false` (or set `standalone: true`). Angular 17+ makes components standalone by default, but the `wire-prototypes` watcher declares every prototype in the generated root `app.module.ts` — a standalone component cannot be declared there.

**Fix:** Set `standalone: false` in the `@Component` decorator. Do not add an `imports: []` to the component and do not create a feature module — see `COMPONENT_RULES.md`.

---

## `halfWidth = true` Makes Fields Too Narrow

**Symptom:** Fields set with `halfWidth = true` render at roughly 25% of the row width instead of 50%, looking far too narrow for a two-column layout.

**Cause:** The form renderer uses a 12-column grid with `column-gap: 40px`. Field widths map as follows:
- Default (no `halfWidth`): `grid-column: span 6` → 50% of row → ~352px in a 744px container
- `halfWidth = true` → `half-col` → `grid-column: span 3` → 25% of row → ~156px ❌

**Fix:** Do **not** set `halfWidth = true` when placing two fields side by side in a `FormRendererRow`. The default `span 6` already produces a two-column layout. Only use `halfWidth = true` when you intentionally need a narrow (quarter-row) field alongside other fields.

```typescript
// ✅ Two equal-width fields per row — do NOT set halfWidth
const field1 = new TextInputField('field1', 'Label', '', true);
const field2 = new TextInputField('field2', 'Label', '', true);
new FormRendererRow([field1, field2]);

// ❌ This makes both fields 25% wide — visually too narrow
field1.halfWidth = true;
field2.halfWidth = true;
```

---

## Lumin Selectors Render As Unknown Elements

**Symptom:** Build succeeds but Lumin components render as unknown elements; selectors like `<ui-core-button>` produce no output.

**Cause:** The generated root `app.module.ts` is missing — or was hand-edited to drop — a vendored `Ui*Module`. Prototype components import no Lumin modules themselves; every `Ui*Module` is imported once, centrally, in that root module.

**Fix:** Do **not** add module imports to the prototype component. Confirm the root `src/app/app.module.ts` still imports the `Ui*Module` whose selector you're using (`UiCoreModule`, `UiFormsModule`, `UiLayoutsModule`, `UiManagementModule`, `UiWorkflowsModule`); if it was edited, restore it, otherwise restart the app so the module reloads. Never make the prototype `standalone: true` or add `schemas: [NO_ERRORS_SCHEMA]` to work around it — see `COMPONENT_RULES.md`.

---

## Catalog Component Missing From the Vendored Library (unknown element / dev-server crash)

**Symptom:** A component that the `lumin-design-mcp` catalog returns (via `search_ui_components` / `get_component_details`) fails at build time — its selector is an unknown element and `ng serve` errors or the dev server crashes. Seen with newer or `-v2` components, e.g. `ui-core-button-v2`.

**Cause:** The catalog is generated from banking's `shared/ui` **source** (Compodoc), so it can include components that are **not shipped in the vendored package** the sandbox actually runs against — because they aren't exported from the library's `public-api.ts`, or were added to source without a version bump, or are simply newer than the pinned tarball in `vendor-config.json`. The version number is not a reliable tell: source and the vendored package can share a version (e.g. both `4.0.67`) while only source has the component. **So catalog membership ≠ availability in this repo.** `ui-core-button-v2` is a real example — present and documented in source, absent from the vendored `@a3-digital/ui-core`.

**Fix:** Before relying on an unusual, new, or `-v2` component, confirm the vendored package actually ships its selector:
```bash
grep -rE "<selector-or-ComponentName>" node_modules/@a3-digital/<lib>/ | head
```
If it isn't there, **do not use it** — fall back to the shipped equivalent (e.g. `ui-core-button` instead of `ui-core-button-v2`) and tell the user the catalog lists a component the vendored library doesn't yet include. (Upstream this needs the component exported + republished, or the catalog ingestion to exclude non-public-API components — outside this skill.)

---

## `ui-workflows-table` Renders Empty Rows (cells blank)

**Symptom:** The table renders the correct number of `<tr>` rows, but every cell is empty. No error is thrown.

**Cause:** Two mistakes, usually together:
1. Building custom cells with a component-local `@ViewChild` `TemplateRef` passed to `TableColumn.columnTemplate`. The table registers cell templates through an internal `TableTemplatesService` (gated on a `templatesReady` flag); a custom TemplateRef is not part of that registry.
2. Assigning `columns` in `ngOnInit`/`ngAfterViewInit`. The table processes `data` against `columns` during change detection; if columns aren't present as a stable input when data is first processed, the per-row cell data (`_tData`) is never built and all cells come back blank.

**Fix:** Use the built-in `TableTemplateType` enum (`ICON`, `BADGES`, `TAGS`) for `columnTemplate`, driven by `templateContextFn`, and define `columns` as a **plain field initializer** (this is the pattern used by the working app tables `alert-history`, `balance-sweeps`, `yodlee-spending-summary-details`).

```typescript
import { TableColumn, TableTemplateType } from '@a3-digital/ui-workflows';

// ✅ Field initializer + built-in ICON template (icon + text)
readonly columns: TableColumn[] = [
  { propertyName: 'requirement', displayName: 'Requirement' },
  { propertyName: 'lastUpdated', displayName: 'Last updated' },
  {
    propertyName: 'status',
    displayName: 'Status',
    columnTemplate: TableTemplateType.ICON,
    templateContextFn: (status: string) => ({
      icon: 'check_circle', colorClass: 'color-success', size: 'sm', text: status
    })
  }
];
```

`TableTemplateType.ICON` context: `{ icon, colorClass, size, text, subtext, iconPosition }`. Plain object literals are valid `TableColumn`s (it is just a type). Default `pageSize` is 20.

---

## Missing Utility Classes Fail Silently

**Symptom:** Spacing or layout that looks correct in the template has no effect at runtime — e.g. flex children have no gap, or a "fill" element doesn't push its sibling aside.

**Cause:** Bootstrap/Tailwind class names that do **not** exist in `ui-styles` were used. A nonexistent utility produces no error and no style, so the layout silently fails. Common offenders:
- **`gap-*`** (`gap-2`, `gap-3`, `gap-md-4`, …) — there are **no** flex/grid gap utilities at all.
- **`flex-1`** — the fill utility is **`flex-fill`** (`flex-grow-1` also exists).
- **`ms-auto` / `me-auto`** — not present.

**Fix:** Verify every class with `python3 .claude/skills/lumin-ui/scripts/search_utilities.py <class>` before relying on it. For flex/grid gaps, set `gap` in the component SCSS with a spacing token: `gap: var(--spacing-3, 12px)`.

---

## `ui-core-micro-notification` Text Not Showing

**Symptom:** Projected text placed between `<ui-core-micro-notification>...</ui-core-micro-notification>` tags does not render.

**Cause:** This component does **not** project `ng-content`. It renders text via the `message` (and optional bold `boldText`) `@Input`s. (The `get_component_details` entry for it may omit these inputs — verify against the package `.d.ts`/`.mjs` when a component's text doesn't appear.)

**Fix:**
```html
<ui-core-micro-notification
  containerTheme="framed"
  [theme]="notificationThemeNeutral"
  icon="email"
  boldText="Message:"
  message="You have no new messages.">
</ui-core-micro-notification>
```

---

## Reactive / Template-Driven Forms — No NG8002 Here

**Both forms APIs work with no per-prototype setup.** The generated root `app.module.ts` imports both `ReactiveFormsModule` and `FormsModule`, so `[formGroup]`, `formControlName`, `[formControl]`, `formGroupName`, `[formArray]`, and `ngModel` all bind without adding anything. (In banking these had to be added to each feature module — hence the old `NG8002: Can't bind to 'formGroup'` failure; it does not occur in this repo.)

**Still prefer static or the Form Renderer.** Per core rule 3, prototypes are static — usually you don't need a hand-rolled `FormGroup` at all. Prefer the **Form Renderer** (`ui-forms-form-renderer` with `FormRendererRow`/`*Field` models) or individual Lumin form components with static placeholder values, and reach for a reactive `FormGroup` only when the prototype genuinely demonstrates form logic.

---

## Model Type Declared But Not Exported (TS2459)

**Symptom:** Compile fails with `TS2459: Module '"@a3-digital/ui-*"' declares 'SomeType' locally, but it is not exported` when importing a component's data-model type (the type named in `get_component_details` under `types` / an input's type). Seen repeatedly with `TreeViewListItem` from `@a3-digital/ui-management`.

**Cause:** The type is declared in the package `.d.ts` but is **not** in the barrel's `export { ... }` list. `get_component_details` surfaces the type's shape (so it can describe the input), but that does not guarantee the symbol is publicly exported. Only the component and its NgModule are reliably exported (e.g. `TreeViewComponent`, `UiManagementModule` are exported; `TreeViewListItem` is not).

**Fix:** Do not import the model type. The `[listItems]`-style input is structurally typed, so declare a **local interface** of the same shape and type the component's data with it. Keep the component/NgModule imports.

```typescript
// ❌ Fails — TreeViewListItem is declared but not exported
import { TreeViewListItem } from '@a3-digital/ui-management';

// ✅ Local interface mirroring the shape from get_component_details
interface NavTreeItem {
  id: string | number;
  title: string;
  icon?: string;
  level?: number;
  children?: NavTreeItem[];
}
readonly treeItems: NavTreeItem[] = [ /* ... */ ];
// Binding still works: <ui-management-tree-view [listItems]="treeItems">
```

**Prevention:** Before importing any type named only in a component's `types`/input signature, confirm it appears in the package's `export { ... }` block (`grep "export {" node_modules/@a3-digital/<lib>/index.d.ts`). If it is not exported, use a local interface instead — never import from a deep `.d.ts` path.

---

## `.html` / `.scss`-Only Edits Don't Reliably Rebuild

**Symptom:** You edit a prototype's `.component.html` or `.component.scss`, wait, and reload — but the change doesn't appear. In the worst case the change *silently never compiled*: e.g. a brand-new `.scss` was written after the component first compiled, so its scoped styles never applied and the component rendered with no encapsulation attributes at all. The preview pane may also freeze showing a **stale** `ng serve` compile error (referencing a line or symbol you already removed) with a repeating `WebSocket connection to 'ws://localhost:4200/ng-cli-ws' failed` — the pane's HMR socket has dropped, so it never received the "compiled successfully" that cleared the error.

**Cause:** In this local setup, `ng serve`'s watch does **not** reliably rebuild the component on a template- or style-only change; a **`.ts` content change** is what forces a real recompile (which then re-reads the current `.html`/`.scss`). An mtime-only `touch` of the `.ts` is **not** enough — the file's *content* must change. Separately, the Claude Desktop Browser pane can't hold the `ng-cli-ws` HMR socket, so its console can freeze on the last error it received; that frozen error is **not** proof the current code is broken.

**Fix:**
1. After any `.html`/`.scss` edit, make a trivial **`.ts` content change** to force a rebuild — e.g. add/adjust a one-line comment, or bind the value through a new `@Input()` so future tweaks are `.ts` edits (as the progress-bar `height` was turned into `@Input() barHeight`). Then hard-reload the pane (`navigate` to the URL again, or `window.location.reload()`).
2. **Don't trust the pane's console error at face value** — confirm the *served* code instead: check the actual DOM/computed styles with `read_page` / `javascript_tool` (`getComputedStyle`, `getBoundingClientRect`), or make a **visibly** different `.ts` change (e.g. a progress value 45 → 80), reload, and verify the DOM reflects it. If the visible change lands, the server is rebuilding fine and the console error is stale.
3. A brand-new component whose `.scss` isn't applying (no `_ngcontent-*` attribute on its elements, no matching rules in any stylesheet) is the same problem — a `.ts` content change and reload fixes it.

**Prevention:** Prefer driving tunable values (sizes, counts, colors-as-inputs) through `@Input()`s in the `.ts` so iteration edits land in the file that reliably rebuilds. When you must edit only `.html`/`.scss`, always pair it with a `.ts` content change in the same pass.
