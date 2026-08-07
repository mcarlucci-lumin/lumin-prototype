#!/usr/bin/env bash
# Creates a blank lazy-loaded page route in a3-web/web-client or a3-web/admin-web-client.
# Usage: bash scripts/create_blank_route.sh <feature-name> [--client web|admin]
# Example: bash scripts/create_blank_route.sh loan-summary --client admin

set -e

FEATURE="$1"
CLIENT="web"

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --client) CLIENT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ -z "$FEATURE" ]]; then
  echo "Usage: bash create_blank_route.sh <feature-name> [--client web|admin]"
  echo "Example: bash create_blank_route.sh loan-summary --client admin"
  exit 1
fi

if [[ "$CLIENT" != "web" && "$CLIENT" != "admin" ]]; then
  echo "Error: --client must be 'web' or 'admin'"
  exit 1
fi

# Derive PascalCase from kebab-case (e.g. loan-summary -> LoanSummary, test-skill-1 -> TestSkill1)
PASCAL=$(echo "$FEATURE" | python3 -c "
import sys, re
s = sys.stdin.read().strip()
parts = re.split(r'-', s)
print(''.join(p.capitalize() for p in parts))
")
COMPONENT_CLASS="${PASCAL}Component"
MODULE_CLASS="${PASCAL}Module"
SELECTOR="app-${FEATURE}"

if [[ "$CLIENT" == "admin" ]]; then
  APP_DIR="a3-web/admin-web-client/src/app"
  CLIENT_LABEL="admin-web-client"
else
  APP_DIR="a3-web/web-client/src/app"
  CLIENT_LABEL="web-client"
fi

FEATURE_DIR="${APP_DIR}/${FEATURE}"
ROUTING_FILE="${APP_DIR}/app-routing.module.ts"

# --- Validate we're in the repo root ---
if [[ ! -f "$ROUTING_FILE" ]]; then
  echo "Error: $ROUTING_FILE not found. Run this script from the banking repo root."
  exit 1
fi

# --- Guard against overwriting existing work ---
if [[ -d "$FEATURE_DIR" ]]; then
  echo "Error: $FEATURE_DIR already exists."
  exit 1
fi

echo "Creating route: $FEATURE (${CLIENT_LABEL})"
echo "  Component: $COMPONENT_CLASS"
echo "  Module:    $MODULE_CLASS"
echo "  Selector:  $SELECTOR"
echo ""

mkdir -p "$FEATURE_DIR"

# component.ts
cat > "${FEATURE_DIR}/${FEATURE}.component.ts" << EOF
import { Component } from '@angular/core';
import { BaseComponent } from '@a3/core';

@Component({
    standalone: false,
    selector: '${SELECTOR}',
    templateUrl: './${FEATURE}.component.html'
})
export class ${COMPONENT_CLASS} extends BaseComponent {}
EOF

# component.html — plain printf, no heredoc so the hook won't fire during script execution
printf '<!-- empty page -->\n' > "${FEATURE_DIR}/${FEATURE}.component.html"

# module.ts
cat > "${FEATURE_DIR}/${FEATURE}.module.ts" << EOF
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { CoreCommonModule } from '@a3/core';
import { ${COMPONENT_CLASS} } from './${FEATURE}.component';

const routes: Routes = [
    { path: '', component: ${COMPONENT_CLASS} }
];

@NgModule({
    imports: [
        CommonModule,
        CoreCommonModule,
        RouterModule.forChild(routes)
    ],
    declarations: [${COMPONENT_CLASS}]
})
export class ${MODULE_CLASS} {}
EOF

# Register route in app-routing.module.ts — inserted before the ** catch-all
# Guard against duplicate entry (e.g. from a prior failed run)
if grep -q "path: '${FEATURE}'" "$ROUTING_FILE"; then
  echo "Warning: route '${FEATURE}' already exists in $ROUTING_FILE — skipping registration."
else
  ROUTE_LINE="  { path: '${FEATURE}', loadChildren: () => import('app/${FEATURE}/${FEATURE}.module').then(m => m.${MODULE_CLASS}), canActivate: [AccessGuard] },"
  sed -i '' "s|{ path: '\*\*'|${ROUTE_LINE}\n  { path: '\*\*'|" "$ROUTING_FILE"
fi

echo "Done."
echo ""
echo "Files created:"
echo "  ${FEATURE_DIR}/${FEATURE}.component.ts"
echo "  ${FEATURE_DIR}/${FEATURE}.component.html"
echo "  ${FEATURE_DIR}/${FEATURE}.module.ts"
echo ""
echo "Route registered: /${FEATURE}"
echo ""
if [[ "$CLIENT" == "admin" ]]; then
  BASE_URL="https://admin.dev-local.a3-digital.internal"
else
  BASE_URL="https://dev-local.a3-digital.internal"
fi

echo "Next steps:"
echo "  1. cd a3-web/web-server && gulp rebuild --project=${CLIENT_LABEL}"
echo "  2. ${BASE_URL}/${FEATURE}"
