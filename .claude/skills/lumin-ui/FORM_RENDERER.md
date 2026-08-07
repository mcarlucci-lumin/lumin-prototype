# Form Renderer & Form Field Rules

Read this file any time the screen includes user input fields of any kind — text, dropdowns, date fields, amounts, toggles, checkboxes.

---

## Form Renderer — Ask First

When a screen includes one or more user-input fields, **ask the user whether to use the Form Renderer before building.** Do not assume either way.

> "This screen has input fields. Should I use the Form Renderer component, or wire the fields individually?"

### If the user says yes — use Form Renderer

1. Look up the Form Renderer selector and package with `search_ui_components` (query e.g. `"form renderer"`), then `get_component_details` on the match.
2. Review all required inputs (`fields`, `formGroup`, etc.) from the `get_component_details` `inputs`.
3. Define your fields as a `FormRendererField[]` array in the component class.
4. Pass the field config and the reactive `FormGroup` to Form Renderer — let it generate the fields.

### If the user says no — use individual components

Proceed with individual `ui-forms-*` components using correct inputs per `get_component_details`. Note in your response that Form Renderer was skipped per the user's preference.

---

## Form Renderer Field Construction Rules

- Always use **concrete field subclasses** (`TextInputField`, `DropdownField`, `AmountInputField`, `DateInputField`, `HtmlField`, `HeaderField`, etc.).
- **Never instantiate `FormRendererField` directly** — it is abstract and will throw TS2511.
- **Never pass `null` as `initValue`** to any field constructor. Use `''` for string fields, `0` for numeric fields.
- **`DropdownOption` is a class, not a plain object.** Always use `new DropdownOption(label, value)` — never `{ label: 'Foo', value: 'foo' }`. Plain object literals cause TS2740. Import from `@a3-digital/ui-forms`.

---

## Date Fields — Mandatory Rules

**HARD RULE — never use `TextInputField` for a date field** unless following the MM/DD/YYYY prototype workaround below. Any field whose purpose involves a date must use a proper date field type.

### Which date field to use

| Date format needed | Form Renderer field class | Notes |
|---|---|---|
| Full date — MM/DD/YYYY | `DatepickerField` | |
| Expiration date — MM/YYYY | `DateInputField` with default `fieldType` (`DateInputFieldType.EXPIRATION_DATE`) | |
| Year only — YYYY | `DateInputField` with `fieldType = DateInputFieldType.YEAR` | |

**`DateInputField` does not support MM/DD/YYYY.** `DateInputFieldType` only has `EXPIRATION_DATE` and `YEAR` — do not invent a `FULL_DATE` value.

---

## Known Component Property Names

Always verify against `get_component_details` on first use. This table covers the most common gotchas.

| Component | ❌ Wrong | ✅ Correct | Note |
|---|---|---|---|
| `ui-core-button` | `label="..."` | `message="..."` | The button text input is `message`, not `label` |
| `DropdownField` | `new DropdownField('name', 'Label', null, true)` | `new DropdownField('name', 'Label', '', true)` | `initValue` is `string \| number`, never `null` — use `''` for empty dropdowns |
| `DropdownField` | `new DropdownField('name', 'Label', 'optionA', true)` | `new DropdownField<string>('name', 'Label', 'optionA', true)` | TypeScript infers `T` from `initValue` as a string literal, making other option values type errors. Always pass an explicit `<string>` or `<number>` generic. |
| `DropdownOption` | `{ label: 'Foo', value: 'foo' }` | `new DropdownOption('Foo', 'foo')` | `DropdownOption` is a class, not a plain object. Plain object literals cause TS2740. Import from `@a3-digital/ui-forms`. |
| Standalone `ui-core-button` outside Form Renderer | `(click)="onNext(null)"` with `onNext(form: UntypedFormGroup)` | `(click)="onNext()"` with `onNext(): void` | When placing a button manually (not through Form Renderer), there is no `UntypedFormGroup` to pass. Only use the `UntypedFormGroup` signature when receiving the `(onPrimaryButtonClick)` output from Form Renderer itself. |
| Any `FormRendererField` subtype | `new FormRendererField(FormRendererFieldType.HTML)` | `new HtmlField('<p>...</p>')` | `FormRendererField` is abstract — never instantiate directly; always use a concrete subclass. |

**Rule:** Before using `ui-core-button` or any button variant for the first time in a build, look it up with `get_component_details` to confirm current input names.
