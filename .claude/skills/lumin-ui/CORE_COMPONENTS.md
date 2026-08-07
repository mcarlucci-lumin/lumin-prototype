# Core Components Reference

These components live in `a3-web/web-client/src/app/core/` and are available in every feature module via `CoreCommonModule`. Always check this list before building a custom implementation — these components handle responsive behavior, accessibility, and platform conventions that custom HTML cannot replicate.

---

## Page Structure

### `app-header`
**File:** `core/header/header.component.ts`
**Use for:** Every feature page title. Handles desktop/mobile layout, back navigation, icon, and page action slots automatically.

| Input | Type | Notes |
|---|---|---|
| `title` | `string` | Page title text |
| `icon` | `string` | Material icon name shown on desktop |
| `iconClass` | `string` | Background class for icon circle (default: `bg-brand-secondary`) |
| `backUrl` | `string` | URL for back arrow link |
| `backToPageLabel` | `string` | Label for back link on desktop |
| `fullNavOnly` | `boolean` | Hide from mobile view (keep for screen-reader context) |
| `noBottomMargin` | `boolean` | Remove bottom margin |
| `showGlassBackground` | `boolean` | Enable glass background effect |
| `glassBackgroundLayout` | `string` | `GlassBackgroundLayout` value for glass height |
| `actionsTemplate` | `TemplateRef<any>` | Slot for trailing action buttons |
| `details` | `HeaderDetail[]` | Up to 3 detail rows under title |
| `moreInfo` | `HeaderMoreInfo` | Inline subtext with optional info modal link |
| `isPageLayoutHeader` | `boolean` | Set `true` when inside `<ui-layouts-page>` headerTemplate |

**Output:** `onBack: EventEmitter<void>`

**Example:**
```html
<app-header icon="swap_horiz" title="New Transfer"></app-header>
<app-header icon="money_off" iconClass="bg-brand-secondary" title="Stop Payment"></app-header>
```

---

### `app-glass-background`
**File:** `core/glass-background/glass-background.component.ts`
**Use for:** Decorative glass background behind page headers or modals.

| Input | Type | Notes |
|---|---|---|
| `layout` | `GlassBackgroundLayout` | Preset layout variant |
| `backgroundAccentColorClass` | `string` | Optional accent color CSS class |

---

## Multi-Step Workflows

### `app-wizard`
**File:** `core/wizard/wizard/wizard.component.ts`
**Use for:** Any multi-step flow (edit → review → confirm). Manages progress bar, back/close, and loading state.

| Input | Type | Notes |
|---|---|---|
| `currentStep` | `number` | Active step (0-based) |
| `totalSteps` | `number` | Total number of steps |
| `headerTitle` | `string` | Title at top of wizard |
| `subtitle` | `string` | Optional subtitle |
| `showProgressBar` | `boolean` | Default `true` |
| `showBackButton` | `boolean` | Default `true` |
| `showCloseButton` | `boolean` | Default `true` |
| `showLoadingSpinner` | `boolean` | Loading overlay |

**Outputs:** `onBackButtonClick`, `onClose`

### `app-wizard-buttons`
**File:** `core/wizard/wizard-buttons/wizard-buttons.component.ts`
**Use for:** Action buttons at the bottom of each wizard step.

| Input | Type | Notes |
|---|---|---|
| `primaryButtonText` | `string` | Primary CTA label |
| `secondaryButtonText` | `string` | Secondary action label |
| `tertiaryButtonText` | `string` | Tertiary action label |
| `tertiaryButtonIcon` | `string` | Icon for tertiary button |
| `disableButtons` | `boolean` | Disable all buttons |

**Outputs:** `onPrimaryButtonClick`, `onSecondaryButtonClick`, `onTertiaryButtonClick`

### `app-stepper` / `app-step`
**File:** `core/stepper/stepper.component.ts`, `core/stepper/step.component.ts`
**Use for:** Compact step indicator without a full wizard wrapper.

`app-stepper` inputs: `activeStep: number`, `hideHeader: boolean`
`app-step` inputs: `label: string`, `disabled: boolean`
Output: `stepClicked`

---

## Data Display

### `app-search-sort-filter`
**File:** `core/search-sort-filter/search-sort-filter.component.ts`
**Use for:** Search + sort + filter bar above any data list.

| Input | Type | Notes |
|---|---|---|
| `searchPlaceholder` | `string` | Placeholder text |
| `sortOptions` | `FormLibSelectMenuOption[]` | Sort dropdown items |
| `defaultSortOption` | `string` | Default sort value |
| `searchFilters` | `SearchFilter[]` | Custom filter definitions |
| `multiSelectFilterOptions` | `FormLibMultiSelectOption[]` | Multi-select filter items |
| `hideSearch` | `boolean` | Hide search input |

**Outputs:** `onSearch`, `onSort`, `onFilter`, `onMultiSelectFilter`

### `app-account-display`
**File:** `core/account/account-display/account-display.component.ts`
**Use for:** Displaying a single account with icon, name, number, and balance using the standard template.

| Input | Type | Notes |
|---|---|---|
| `account` | `Account` | Account data object |
| `label` | `string` | Optional label above the display |
| `accountDisplayType` | `AccountDisplayType` | Display format variant |

> **Do not use `app-list`** — it is deprecated. Use `ui-workflows-list` from `@a3-digital/ui-workflows` instead.

---

## Feedback & Loading

### `app-page-loading-spinner`
**File:** `core/page-loading-spinner.component.ts`
**Use for:** Full-page or section loading state.

| Input | Type | Notes |
|---|---|---|
| `message` | `string` | Optional loading message |

### `app-web-banner-notification`
**File:** `core/notification-queue/web-banner-notification.component.ts`
**Use for:** Top-of-page sliding notification banner. Auto-subscribes to `NotificationQueueService` — no inputs needed.

### `app-payment-frequency`
**File:** `core/payment-frequency/payment-frequency.component.ts`
**Use for:** Badge showing one-time / recurring / instant payment type.

| Input | Type | Notes |
|---|---|---|
| `isRecurring` | `boolean` | Mark as recurring |
| `isInstant` | `boolean` | Mark as instant |
| `recurringLabel` | `string` | Custom recurring label |

### `app-confetti`
**File:** `core/confetti/confetti.component.ts`
**Use for:** Success celebration animation on confirmation pages. Controlled via `ConfettiService` — no inputs.

---

## Content & Disclosures

### `web-disclosure`
**File:** `core/disclosure/banking-disclosure-v2.component.ts`
**Use for:** Regulatory disclosure acceptance flows.

| Input | Type | Notes |
|---|---|---|
| `disclosureType` | `DisclosureType \| DisclosureType[]` | Which disclosure(s) to show |
| `modal` | `boolean` | Display in modal vs. inline |
| `modalTitle` | `string` | Modal header text |
| `mustScroll` | `boolean` | Require scroll before accepting |
| `allowDisclosureDecline` | `boolean` | Allow declining |

**Outputs:** `onCompleted`, `onModalClose`

### `app-more-info`
**File:** `core/more-info/more-info.component.ts`
**Use for:** "Learn more" link that opens a modal or document viewer inline.

| Input | Type | Notes |
|---|---|---|
| `message` | `string` | Text before the link |
| `linkText` | `string` | Clickable link text |
| `modalTitle` | `string` | Modal header |
| `modalContent` | `string` | HTML content for modal |
| `documentUrl` | `string` | PDF/document URL (opens viewer) |

### `content-location`
**File:** `core/content-management/content-location.component.ts`
**Use for:** CMS-managed content slots. Input: `locationId: string`.

### `app-need-assistance-subfooter`
**File:** `core/need-assistance-subfooter/`
**Use for:** Help/contact info footer. No inputs needed.

---

## Session (include but do not configure)

These should be present in shell/wrapper components but require no direct inputs:

- **`app-inactivity`** — session timeout monitor
- **`app-timer`** — session timeout warning and auto-logout
