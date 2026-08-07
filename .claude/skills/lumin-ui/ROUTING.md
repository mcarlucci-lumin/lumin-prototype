# Web Client — Add a New Page Route

Covers adding a new lazy-loaded route to `a3-web/web-client`. The app uses NgModule-based lazy loading with `AccessGuard` for authenticated routes.

---

## Key Files

| File | Purpose |
|---|---|
| `a3-web/web-client/src/app/app-routing.module.ts` | Root route registry — add your route here |
| `a3-web/web-client/src/app/<feature>/` | Feature folder — create all new files here |
| `a3-web/web-client/src/app/core/navbar/navigation.service.ts` | Nav link config — omit your route here to keep it URL-only |

---

## What Controls Visibility vs. Accessibility

| Concern | Where it's set |
|---|---|
| Route exists | `app-routing.module.ts` |
| Requires login | `canActivate: [AccessGuard]` |
| Appears in nav bar | Entry in nav config / `navigation.service.ts` |
| Feature-flag gated | `feature-flag-routes-mapping.ts` |
| Claim gated | `claim-routes-mapping.ts` |

To make a route **URL-only** (not visible in nav), simply do not add it to the nav config. No special guard is needed.

---

## Step 1 — Create the Feature Folder

Create three files under `src/app/<feature-name>/`:

### `<feature-name>.component.ts`
```typescript
import { Component } from '@angular/core';
import { BaseComponent } from '@a3/core';

@Component({
    standalone: false,
    selector: 'app-<feature-name>',
    templateUrl: './<feature-name>.component.html'
})
export class FeatureNameComponent extends BaseComponent {}
```

### `<feature-name>.component.html`

**IMPORTANT:** Use the `Bash` tool to create AND edit this file — do NOT use the `Write` or `Edit` tools on `.component.html` files. Both tools trigger a hook that sends the file to the Claude Desktop Code preview panel, which attempts to render the Angular template as raw HTML — producing a broken, unreadable preview that is not useful.

```bash
# Create
printf '<!-- empty page -->\n' > src/app/<feature-name>/<feature-name>.component.html

# Overwrite with content
cat > src/app/<feature-name>/<feature-name>.component.html << 'EOF'
<div>your template here</div>
EOF
```

### `<feature-name>.module.ts`
```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { CoreCommonModule } from '@a3/core';
import { FeatureNameComponent } from './<feature-name>.component';

const routes: Routes = [
    { path: '', component: FeatureNameComponent }
];

@NgModule({
    imports: [
        CommonModule,
        CoreCommonModule,
        RouterModule.forChild(routes)
    ],
    declarations: [FeatureNameComponent]
})
export class FeatureNameModule {}
```

---

## Step 2 — Register the Route

In `app-routing.module.ts`, add the route **before the `**` catch-all** (the last entry in `appRoutes`):

```typescript
// Authenticated (requires login)
{ path: 'your-path', loadChildren: () => import('app/<feature-name>/<feature-name>.module').then(m => m.FeatureNameModule), canActivate: [AccessGuard] },

// Public (no login required — e.g. registration flows)
{ path: 'your-path', loadChildren: () => import('app/<feature-name>/<feature-name>.module').then(m => m.FeatureNameModule) },
```

`AccessGuard` is already imported at the top of `app-routing.module.ts` — no additional import needed.

---

## Step 3 — Deploy

New files require a Docker image rebuild:

```bash
# from a3-web/web-server
gulp rebuild
```

Use `gulp publish` only for TypeScript-only changes to existing files. New files always require `gulp rebuild`.

---

## Step 4 — Verify

Navigate directly to the new route: `https://dev-local.a3-digital.internal/<your-path>`

For example, if the route path is `prototype`: https://dev-local.a3-digital.internal/prototype

If it redirects to login, `AccessGuard` is working correctly — log in first, then revisit the URL.

---

## Adding Child Routes (Optional)

Define sub-pages in the module's `routes` array:

```typescript
const routes: Routes = [
    {
        path: '',
        component: FeatureNameComponent,
        children: [
            { path: 'list', component: FeatureListComponent },
            { path: 'detail/:id', component: FeatureDetailComponent },
            { path: '**', redirectTo: 'list' }
        ]
    }
];
```

For SDK-extensible child routes, use `CoreRoutingModule.forChildWithSdkRouteSupport()` instead of `RouterModule.forChild()` — see `settings.module.ts` for an example.
