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

## All `@a3-digital` Imports Stripped

**Symptom:** Build succeeds but all Lumin components render as unknown elements; selectors like `<ui-core-button>` produce no output.

**Cause:** An auto-fix tool or linter may strip all `@a3-digital` imports without adding replacements when it encounters certain error patterns.

**Fix:** Verify the **NgModule's** `imports: []` array still contains `UiCoreModule` and/or `UiFormsModule`. If missing, add them back manually. The banking repo is NgModule-based — the modules go on the `@NgModule`, never on the `@Component` decorator, and the component stays `standalone: false`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { UiCoreModule } from '@a3-digital/ui-core';
import { UiFormsModule } from '@a3-digital/ui-forms';
import { MyFeatureComponent } from './my-feature.component';

@NgModule({
  imports: [CommonModule, ReactiveFormsModule, UiCoreModule, UiFormsModule],
  declarations: [MyFeatureComponent]
})
export class MyFeatureModule {}
```

Do **not** convert the component to `standalone: true` or add an `imports: []` / `schemas: [NO_ERRORS_SCHEMA]` array to the `@Component` decorator — that contradicts the repo's NgModule architecture. See `COMPONENT_RULES.md` for the full NgModule rules.

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

**Fix:** Verify every class with `python3 scripts/search_utilities.py <class>` before relying on it. For flex/grid gaps, set `gap` in the component SCSS with a spacing token: `gap: var(--spacing-3, 12px)`.

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

## `Can't bind to 'formGroup'` (NG8002) — missing `ReactiveFormsModule`

**Symptom:** Build fails with:
```
NG8002: Can't bind to 'formGroup' since it isn't a known property of 'form'.
  <form [formGroup]="form">
```
Also appears for `formControlName`, `[formControl]`, `formGroupName`, and `[formArray]`.

**Cause:** The component's template uses Angular **reactive forms** directives, but the owning **NgModule** does not import `ReactiveFormsModule`. This bites hardest when placing a prototype into an **existing** module that happens not to import it — notably `UIToolsModule` (`a3-web/<client>/src/app/ui-tools/ui-tools.module.ts`), which imports `UiCoreModule`/`UiFormsModule`/`UiLayoutsModule`/`UiStylesModule` but **not** `ReactiveFormsModule`. (`ngModel` template-driven forms need `FormsModule` instead — same failure mode, different module.)

**Fix (preferred):** Prefer the **Form Renderer** (`ui-forms-form-renderer` with `FormRendererRow`/`*Field` models) or individual Lumin form components with static placeholder values — per core rule 3, prototypes are static and usually don't need a hand-rolled `FormGroup` at all. Reach for reactive forms only when the prototype genuinely demonstrates form logic.

**Fix (if reactive forms are needed):** Add `ReactiveFormsModule` to the NgModule that declares the component:
```typescript
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  imports: [CommonModule, ReactiveFormsModule, UiCoreModule, UiFormsModule /* ... */],
  declarations: [HelocApplicationComponent]
})
export class UIToolsModule {}
```
Add it to the existing `imports` array — do **not** make the component `standalone` or add `schemas: [NO_ERRORS_SCHEMA]` (see `COMPONENT_RULES.md`).

**Prevention:** When placing into any existing module (especially `/ui-tools`), check that module's `imports` array first. If the built template uses `[formGroup]`/`formControlName`, ensure `ReactiveFormsModule` is present before running `gulp rebuild` / `ng build`.

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
