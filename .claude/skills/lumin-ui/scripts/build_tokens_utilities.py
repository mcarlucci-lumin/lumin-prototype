#!/usr/bin/env python3
"""
Regenerate the skill's two design-system reference files by parsing the
@a3-digital/ui-styles source directly:

  references/tokens-registry.json     - CSS design tokens (search_tokens.py)
  references/utilities-registry.json  - layout utility classes (search_utilities.py)

Component/type data is NOT produced here - that lives in the lumin-design-mcp
catalog (search_ui_components / get_component_details). This script only rebuilds
the token + utility data the MCP does not cover.

Run from anywhere - the script detects the banking repo root automatically, or
accepts an explicit --repo-root argument.

Usage:
  python3 scripts/build_tokens_utilities.py [--repo-root <path>]
"""

import re
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

# Shared helpers
def read_file(path: Path) -> str | None:
    try:
        return path.read_text(encoding='utf-8')
    except Exception:
        return None


# Tokens
SECTION_CATEGORY_MAP = {
    'media query variables': 'layout', 'page layout variables': 'layout',
    'scrollbox variables': 'layout', 'microapp variables': 'layout',
    'focus variables': 'focus', 'color variables': 'color',
    'stroke variables': 'color', 'colors': 'color',
    'font variables': 'typography', 'typography': 'typography',
    'form variables': 'form', 'choice element variables': 'form',
    'container variables': 'shadow', 'backdrop variables': 'overlay',
    'spacer variables': 'spacing', 'transition variables': 'animation',
    'z-index variables': 'z-index', 'graphical elements': 'border',
    'misc variables': 'misc',
    # _base-tokens.scss section banners
    'brand color ramps': 'color', 'neutral / gray': 'color',
    'messaging ramps': 'color', 'account ramps': 'color',
    'chart colors': 'color', 'backgrounds': 'color',
    'density': 'layout', 'spacing': 'spacing', 'size scale': 'layout',
    'elevation': 'shadow', 'opacity': 'opacity', 'shape': 'border',
    'motion': 'animation',
    'buttons - primary': 'button', 'buttons - secondary': 'button',
    'buttons - tertiary': 'button', 'forms': 'form',
    'link': 'link', 'main navigation': 'navigation', 'brand imagery': 'image',
}

def infer_token_category(name: str) -> str:
    if re.match(r'^--(?:font-|line-height-|font-weight-|font-family-|font-size|font-scale|text-color)', name): return 'typography'
    if re.match(r'^--(?:brand-|accent-|gray-|success$|info$|warning$|danger$|success-|info-|warning-|danger-|positive-|negative-)', name): return 'color'
    if re.match(r'^--(?:stroke-|neutral-(?:color|bg))', name): return 'color'
    if re.match(r'^--(?:btn-|button-)', name): return 'button'
    if re.match(r'^--box-shadow-', name): return 'shadow'
    if re.match(r'^--(?:bg-glass-|glass-ui-|modal-|backdrop-)', name): return 'overlay'
    if re.match(r'^--(?:border-|.*-radius)', name): return 'border'
    if re.match(r'^--z-index-', name): return 'z-index'
    if re.match(r'^--spacer', name): return 'spacing'
    if re.match(r'^--(?:forms-|ui-forms-)', name): return 'form'
    if re.match(r'^--(?:transition-|drag-)', name): return 'animation'
    if re.match(r'^--(?:navbar-|footer-|.*-width$|.*-height$|rem-scale|desktop-)', name): return 'layout'
    if re.match(r'^--focus-', name): return 'focus'
    return 'misc'

def build_tokens(ui_styles_dir: Path) -> list:
    partials_dir = ui_styles_dir / 'styles' / 'partials'
    if not partials_dir.exists():
        return []
    tokens = []
    seen = set()
    for fname in ['_native-css-variables.scss', '_configuration-v2.scss', '_base-tokens.scss']:
        fpath = partials_dir / fname
        if not fpath.exists():
            continue
        source = read_file(fpath)
        if not source:
            continue
        rel_file = str(fpath.relative_to(ui_styles_dir))
        is_branding = fname == '_configuration-v2.scss'
        current_section = ''
        pending_description = ''
        in_section_border = False
        for line in source.split('\n'):
            trimmed = line.strip()
            if re.match(r'^//\*+//$', trimmed):
                in_section_border = not in_section_border
                continue
            if in_section_border:
                m = re.match(r'^//\s+(.+?)\s+//$', trimmed)
                if m:
                    current_section = SECTION_CATEGORY_MAP.get(m.group(1).lower(), '')
                continue
            if trimmed.startswith('//') and not trimmed.startswith('//*'):
                text = re.sub(r'^/+\s*', '', trimmed).strip()
                pending_description = text if text and not text.startswith('TODO') and len(text) < 120 else ''
                continue
            m = re.match(r'^\s*(--[\w-]+)\s*:\s*(.+);', line)
            if m:
                name = m.group(1)
                raw_value = m.group(2)
                comment_idx = raw_value.find('//')
                value = (raw_value[:comment_idx] if comment_idx >= 0 else raw_value).strip()
                inline = raw_value[comment_idx+2:].strip() if comment_idx >= 0 else ''
                if name not in seen:
                    seen.add(name)
                    tokens.append({
                        'name': name, 'value': value,
                        'category': current_section or infer_token_category(name),
                        'description': inline or pending_description,
                        'branding': is_branding,
                        'sourceFile': rel_file,
                        'cssClasses': [],
                    })
                pending_description = ''
                continue
            if trimmed and not trimmed.startswith('//') and not trimmed.startswith('/*') and not trimmed.startswith('*'):
                pending_description = ''
    return tokens


# Repo detection
def detect_repo_root() -> Path | None:
    for candidate in [Path.cwd(), *Path.cwd().parents]:
        pkg = candidate / 'package.json'
        a3web = candidate / 'a3-web'
        if pkg.exists() and a3web.exists():
            try:
                if json.loads(pkg.read_text()).get('name') == 'banking':
                    return candidate
            except Exception:
                pass
    return None


# Utilities
_BREAKPOINTS = ['', '-xs', '-sm', '-md', '-lg', '-xl']
_BP_LABELS = {
    '':    'all (xxs+)',
    '-xs': 'xs+ (360px+)',
    '-sm': 'sm+ (480px+)',
    '-md': 'md+ (768px+)',
    '-lg': 'lg+ (1080px+)',
    '-xl': 'xl+ (1200px+)',
}
_SPACER_SIZES = ['0', 'half', '1', '2', '3', '4', '5', '6', '7', '8']
_SPACER_VALUES = {
    '0':    '0',
    'half': 'var(--space-xxs) ~4px',
    '1':    'var(--space-xs) ~8px',
    '2':    'var(--space-sm) ~12px',
    '3':    'var(--space-md) ~16px',
    '4':    'var(--space-lg) ~20px',
    '5':    'var(--space-xl) ~24px',
    '6':    'var(--space-xxl) ~32px',
    '7':    'var(--space-xxxl) ~40px',
    '8':    'var(--space-xxxxl) ~64px',
}

def _css_val(v: str) -> str:
    return v.replace('start', 'flex-start').replace('end', 'flex-end').replace('between', 'space-between').replace('around', 'space-around')

def build_utilities() -> list:
    out = []

    def add(cls: str, cat: str, desc: str, responsive: bool = False, bp: str | None = None):
        out.append({'class': cls, 'category': cat, 'description': desc, 'responsive': responsive, 'breakpoint': bp})

    # Flexbox (responsive)
    for infix in _BREAKPOINTS:
        label = _BP_LABELS[infix]
        resp = infix != ''
        bpk = infix.lstrip('-') or None
        for val in ['row', 'column', 'row-reverse', 'column-reverse']:
            add(f'flex{infix}-{val}', 'flex', f'flex-direction: {val} ({label})', resp, bpk)
        for val in ['wrap', 'nowrap', 'wrap-reverse']:
            add(f'flex{infix}-{val}', 'flex', f'flex-wrap: {val} ({label})', resp, bpk)
        add(f'flex{infix}-fill', 'flex', f'flex: 1 1 auto — fill available space ({label})', resp, bpk)
        for val in ['grow-0', 'grow-1', 'shrink-0', 'shrink-1']:
            prop, v = val.split('-')
            add(f'flex{infix}-{val}', 'flex', f'flex-{prop}: {v} ({label})', resp, bpk)
        for val in ['start', 'end', 'center', 'between', 'around']:
            add(f'justify-content{infix}-{val}', 'flex', f'justify-content: {_css_val(val)} ({label})', resp, bpk)
        for val in ['start', 'end', 'center', 'baseline', 'stretch']:
            add(f'align-items{infix}-{val}', 'flex', f'align-items: {_css_val(val)} ({label})', resp, bpk)
        for val in ['start', 'end', 'center', 'between', 'around', 'stretch']:
            add(f'align-content{infix}-{val}', 'flex', f'align-content: {_css_val(val)} ({label})', resp, bpk)
        for val in ['auto', 'start', 'end', 'center', 'baseline', 'stretch']:
            add(f'align-self{infix}-{val}', 'flex', f'align-self: {_css_val(val)} ({label})', resp, bpk)
    add('flex-align-center', 'flex', 'display: flex + align-items: center shorthand')

    # Spacing (responsive)
    for infix in _BREAKPOINTS:
        label = _BP_LABELS[infix]
        resp = infix != ''
        bpk = infix.lstrip('-') or None
        for size in _SPACER_SIZES:
            v = _SPACER_VALUES[size]
            for abbrev, prop in [('m', 'margin'), ('p', 'padding')]:
                add(f'{abbrev}{infix}-{size}',  'spacing', f'{prop}: {v} ({label})', resp, bpk)
                add(f'{abbrev}t{infix}-{size}', 'spacing', f'{prop}-top: {v} ({label})', resp, bpk)
                add(f'{abbrev}r{infix}-{size}', 'spacing', f'{prop}-right: {v} ({label})', resp, bpk)
                add(f'{abbrev}b{infix}-{size}', 'spacing', f'{prop}-bottom: {v} ({label})', resp, bpk)
                add(f'{abbrev}l{infix}-{size}', 'spacing', f'{prop}-left: {v} ({label})', resp, bpk)
                add(f'{abbrev}x{infix}-{size}', 'spacing', f'{prop} left+right: {v} ({label})', resp, bpk)
                add(f'{abbrev}y{infix}-{size}', 'spacing', f'{prop} top+bottom: {v} ({label})', resp, bpk)
        for size in _SPACER_SIZES[1:]:  # skip 0
            v = _SPACER_VALUES[size]
            add(f'm{infix}-n{size}',  'spacing', f'margin: -{v} ({label})', resp, bpk)
            add(f'mt{infix}-n{size}', 'spacing', f'margin-top: -{v} ({label})', resp, bpk)
            add(f'mr{infix}-n{size}', 'spacing', f'margin-right: -{v} ({label})', resp, bpk)
            add(f'mb{infix}-n{size}', 'spacing', f'margin-bottom: -{v} ({label})', resp, bpk)
            add(f'ml{infix}-n{size}', 'spacing', f'margin-left: -{v} ({label})', resp, bpk)
            add(f'mx{infix}-n{size}', 'spacing', f'margin left+right: -{v} ({label})', resp, bpk)
            add(f'my{infix}-n{size}', 'spacing', f'margin top+bottom: -{v} ({label})', resp, bpk)
        add(f'm{infix}-auto',  'spacing', f'margin: auto ({label})', resp, bpk)
        add(f'mt{infix}-auto', 'spacing', f'margin-top: auto ({label})', resp, bpk)
        add(f'mr{infix}-auto', 'spacing', f'margin-right: auto ({label})', resp, bpk)
        add(f'mb{infix}-auto', 'spacing', f'margin-bottom: auto ({label})', resp, bpk)
        add(f'ml{infix}-auto', 'spacing', f'margin-left: auto ({label})', resp, bpk)
        add(f'mx{infix}-auto', 'spacing', f'margin left+right: auto ({label})', resp, bpk)
        add(f'my{infix}-auto', 'spacing', f'margin top+bottom: auto ({label})', resp, bpk)
    for cls, desc in [
        ('mt-nsm', 'margin-top: -0.25rem (-4px)'),
        ('mt-sm',  'margin-top: 0.25rem (4px)'),
        ('mr-sm',  'margin-right: 0.25rem (4px)'),
        ('mb-sm',  'margin-bottom: 0.25rem (4px)'),
        ('ml-sm',  'margin-left: 0.25rem (4px)'),
        ('microapp-mt', 'margin-top: var(--container-spacing) — microapp layouts'),
        ('microapp-mr', 'margin-right: var(--container-spacing) — microapp layouts'),
        ('microapp-mb', 'margin-bottom: var(--container-spacing) — microapp layouts'),
        ('microapp-ml', 'margin-left: var(--container-spacing) — microapp layouts'),
        ('microapp-mx', 'margin left+right: var(--container-spacing) — microapp layouts'),
    ]:
        add(cls, 'spacing', desc)

    # Display (responsive)
    for infix in _BREAKPOINTS:
        label = _BP_LABELS[infix]
        resp = infix != ''
        bpk = infix.lstrip('-') or None
        for val in ['none', 'inline', 'inline-block', 'block', 'flex', 'inline-flex']:
            add(f'd{infix}-{val}', 'display', f'display: {val} ({label})', resp, bpk)

    # Float (responsive)
    for infix in _BREAKPOINTS:
        label = _BP_LABELS[infix]
        resp = infix != ''
        bpk = infix.lstrip('-') or None
        for val in ['left', 'right', 'none']:
            add(f'float{infix}-{val}', 'float', f'float: {val} ({label})', resp, bpk)

    # Grid (responsive)
    add('container',       'grid', 'Bootstrap container — max-width at each breakpoint, centered')
    add('container-fluid', 'grid', 'Full-width container at all breakpoints')
    for bp_name in ['sm', 'md', 'lg', 'xl']:
        add(f'container-{bp_name}', 'grid', f'100% wide until {bp_name} breakpoint, then max-width')
    add('row',        'grid', 'Flex row wrapper for grid columns')
    add('no-gutters', 'grid', 'Remove gutter padding from row and its columns')
    for infix in _BREAKPOINTS:
        label = _BP_LABELS[infix]
        resp = infix != ''
        bpk = infix.lstrip('-') or None
        add(f'col{infix}',      'grid', f'Equal-width flex column ({label})', resp, bpk)
        add(f'col{infix}-auto', 'grid', f'Auto-width column ({label})', resp, bpk)
        for i in range(1, 13):
            add(f'col{infix}-{i}', 'grid', f'{i}/12 width column ({label})', resp, bpk)
        for i in range(1, 7):
            add(f'row-cols{infix}-{i}', 'grid', f'Force {i} equal-width columns per row ({label})', resp, bpk)
        add(f'order{infix}-first', 'grid', f'order: -1 — visually first ({label})', resp, bpk)
        add(f'order{infix}-last',  'grid', f'order: 13 — visually last ({label})', resp, bpk)
        for i in range(0, 13):
            add(f'order{infix}-{i}', 'grid', f'order: {i} ({label})', resp, bpk)
        for i in range(1, 12):
            add(f'offset{infix}-{i}', 'grid', f'Left margin offset {i}/12 ({label})', resp, bpk)

    # Position
    for val in ['static', 'relative', 'absolute', 'fixed', 'sticky']:
        add(f'position-{val}', 'position', f'position: {val}')
    add('fixed-bottom',    'position', 'position: fixed to bottom edge of viewport')
    add('overlay-wrapper', 'position', 'position: relative + display: block — wrapper for absolute overlays')

    # Sizing
    for pct in ['25', '50', '75', '100']:
        add(f'w-{pct}', 'sizing', f'width: {pct}%')
    add('w-auto',     'sizing', 'width: auto')
    add('full-width', 'sizing', 'width: 100%')
    for pct in ['25', '50', '75', '100']:
        add(f'h-{pct}', 'sizing', f'height: {pct}%')
    add('h-auto',      'sizing', 'height: auto')
    add('full-height', 'sizing', 'height: 100%')
    add('mw-100',      'sizing', 'max-width: 100%')
    add('mh-100',      'sizing', 'max-height: 100%')
    add('min-vw-100',  'sizing', 'min-width: 100vw')
    add('min-vh-100',  'sizing', 'min-height: 100vh')

    # Overflow
    add('overflow-auto',   'overflow', 'overflow: auto')
    add('overflow-hidden', 'overflow', 'overflow: hidden')

    # Visibility
    add('hidden',       'visibility', 'display: none — hide element completely')
    add('invisible',    'visibility', 'visibility: hidden — hide but preserve space')
    add('unselectable', 'visibility', 'user-select: none — prevent text selection')

    # Z-index
    for i in range(1, 21):
        add(f'z-{i}', 'z-index', f'z-index: {i}')

    # Cursor
    add('cursor-default', 'cursor', 'cursor: default')
    add('cursor-grab',    'cursor', 'cursor: grab')
    add('cursor-pointer', 'cursor', 'cursor: pointer')

    # Containers (visual appearance)
    for cls, desc in [
        ('container-transparent',          'Padded container — transparent background, no border (layout spacing only)'),
        ('container-active',               'Active/hover background color container'),
        ('container-bordered',             'White background with subtle border'),
        ('container-bordered-interactive', 'Bordered container with hover and focus states — use for clickable cards'),
        ('container-default',              'Default white background container'),
        ('container-elevated',             'Elevated container with drop shadow'),
        ('container-elevated-interactive', 'Elevated container with hover and focus states — use for clickable cards'),
        ('container-sunken',               'Sunken/inset background container'),
        ('container-form',                 'Form-field style container with focus ring — use for chip editors, JSON editors'),
        ('container-min-height',           'Minimum height of 300px'),
        ('container-brand',                'Primary brand color tinted border and background'),
        ('container-danger',               'Danger/error tinted border and background'),
        ('container-warning',              'Warning tinted border and background'),
        ('container-info',                 'Info tinted border and background'),
        ('container-success',              'Success tinted border and background'),
    ]:
        add(cls, 'container', desc)

    # Typography
    for infix in _BREAKPOINTS:
        label = _BP_LABELS[infix]
        resp = infix != ''
        bpk = infix.lstrip('-') or None
        for val in ['left', 'right', 'center']:
            add(f'text{infix}-{val}', 'typography', f'text-align: {val} ({label})', resp, bpk)
    for cls, desc in [
        ('text-justify',        'text-align: justify'),
        ('text-wrap',           'white-space: normal'),
        ('text-nowrap',         'white-space: nowrap'),
        ('text-truncate',       'Truncate overflowing text with ellipsis'),
        ('text-break',          'word-break: break-word + overflow-wrap: break-word'),
        ('text-lowercase',      'text-transform: lowercase'),
        ('text-uppercase',      'text-transform: uppercase'),
        ('text-capitalize',     'text-transform: capitalize'),
        ('text-display',        'Display size text — largest heading style'),
        ('text-heading1',       'Heading 1 size + bold weight'),
        ('text-heading2',       'Heading 2 size + semibold weight'),
        ('text-heading3',       'Heading 3 size + semibold weight'),
        ('text-heading4',       'Heading 4 / subheading size + semibold weight'),
        ('text-heading5',       'Heading 5 / secondary size + semibold weight'),
        ('text-heading6',       'Heading 6 / caption size + semibold weight'),
        ('text-second',         'Body 2 / secondary text size'),
        ('text-subheading',     'Subheading size (alias for heading4)'),
        ('text-caption',        'Caption size text'),
        ('text-caption-bold',   'Caption size + bold weight'),
        ('text-caption-italic', 'Caption size + italic style'),
        ('text-base',           'Reset to base body size and line-height'),
        ('text-bold',           'font-weight: bold'),
        ('text-semibold',       'font-weight: semibold'),
        ('text-strong',         'font-weight: bold (alias for font-weight-bold)'),
        ('text-italic',         'font-style: italic'),
        ('text-compact',        'Tighter line-height (20px)'),
        ('text-monospace',      'font-family: monospace'),
        ('text-max-width',      'max-width: 750px with word-wrap'),
        ('font-weight-bold',    'font-weight: bold'),
        ('font-weight-normal',  'font-weight: normal'),
        ('font-italic',         'font-style: italic'),
        ('text-clamp-1',        'Clamp text to 1 line with ellipsis'),
        ('text-clamp-2',        'Clamp text to 2 lines with ellipsis'),
        ('text-clamp-3',        'Clamp text to 3 lines with ellipsis'),
        ('confirmation-text',   'Bold weight with tighter line-height — use for confirmation messages'),
    ]:
        add(cls, 'typography', desc)

    # Color — backgrounds
    for cls, desc in [
        ('bg-brand',           'background-color: var(--color-sunken) — brand background'),
        ('bg-pending',         'background-color: var(--color-background-pending)'),
        ('bg-gray-100',        'background-color: var(--color-gray-100)'),
        ('bg-gray-200',        'background-color: var(--color-gray-200)'),
        ('bg-gray-500',        'background-color: var(--color-gray-500)'),
        ('bg-gray-800',        'background-color: var(--color-gray-800)'),
        ('bg-danger',          'background: var(--color-danger)'),
        ('bg-danger-light',    'background: 5% tint of danger color'),
        ('bg-info',            'background: var(--color-info)'),
        ('bg-info-light',      'background: 5% tint of info color'),
        ('bg-warning',         'background: var(--color-warning)'),
        ('bg-warning-light',   'background: 5% tint of warning color'),
        ('bg-success',         'background: var(--color-success)'),
        ('bg-success-light',   'background: 5% tint of success color'),
        ('bg-brand-primary',   'background: var(--color-primary)'),
        ('bg-brand-secondary', 'background: var(--color-secondary)'),
        ('bg-brand-neutral',   'background: var(--color-content-primary)'),
        ('bg-positive',        'background: var(--color-positive) — use for positive amounts only'),
        ('bg-positive-light',  'background: 5% tint of positive color'),
        ('bg-negative',        'background: var(--color-negative) — use for negative amounts only'),
        ('bg-negative-light',  'background: 5% tint of negative color'),
        ('bg-hover',           'background: var(--color-hover)'),
        ('bg-transparent',     'background: transparent'),
        ('bg-white',           'background: var(--color-default)'),
        ('bg-backdrop',        'background: frosted glass backdrop with blur'),
    ]:
        add(cls, 'color', desc)
    for i in range(1, 8):
        add(f'bg-accent-color-{i}', 'color', f'background-color: var(--color-account-{i}) — account accent color {i}')

    # Color — text
    for shade in [100, 200, 300, 400, 500, 600, 700, 800, 900]:
        add(f'color-gray-{shade}', 'color', f'color: var(--color-gray-{shade})')
    for cls, desc in [
        ('color-brand-primary',    'color: var(--color-primary)'),
        ('color-brand-secondary',  'color: var(--color-secondary)'),
        ('color-white',            'color: var(--color-content-neutral)'),
        ('color-warning',          'color: var(--color-warning)'),
        ('color-info',             'color: var(--color-info)'),
        ('color-success',          'color: var(--color-success)'),
        ('color-danger',           'color: var(--color-danger) — deprecated, prefer color-error'),
        ('color-error',            'color: var(--color-danger)'),
        ('text-color-primary',     'color: var(--color-content-primary) — primary text color'),
        ('text-color-secondary',   'color: var(--color-content-secondary) — secondary/muted text color'),
        ('text-color-tertiary',    'color: var(--color-content-tertiary) — tertiary/subtle text color'),
        ('is-positive',            'color: var(--color-positive) — use for positive amounts only'),
        ('is-negative',            'color: var(--color-negative) — use for negative amounts only'),
        ('is-pending',             'color: var(--color-content-pending)'),
    ]:
        add(cls, 'color', desc)
    for i in range(1, 8):
        add(f'accent-color-{i}', 'color', f'color: var(--color-account-{i}) — account accent color {i}')

    # Color — borders
    for cls, desc in [
        ('border-danger-light',   'border-color: 20% tint of danger color'),
        ('border-warning-light',  'border-color: 20% tint of warning color'),
        ('border-success-light',  'border-color: 20% tint of success color'),
        ('border-info-light',     'border-color: 20% tint of info color'),
        ('border-positive-light', 'border-color: 20% tint of positive color'),
        ('border-negative-light', 'border-color: 20% tint of negative color'),
        ('border-neutral-light',  'border-color: 20% tint of neutral/primary content color'),
    ]:
        add(cls, 'color', desc)

    # Borders
    for cls, desc in [
        ('border',                'border: 1px solid var(--color-stroke-1) on all sides'),
        ('border-top',            'border-top: 1px solid var(--color-stroke-1)'),
        ('border-right',          'border-right: 1px solid var(--color-stroke-1)'),
        ('border-bottom',         'border-bottom: 1px solid var(--color-stroke-1)'),
        ('border-left',           'border-left: 1px solid var(--color-stroke-1)'),
        ('border-radius',         'border-radius: var(--containers-shape) — standard container radius'),
        ('border-radius-top',     'border-radius on top-left and top-right corners only'),
        ('border-radius-bottom',  'border-radius on bottom-left and bottom-right corners only'),
        ('border-left-flat',      'Remove border-radius from left side — use when attached to another element on the left'),
        ('border-right-flat',     'Remove border-radius from right side — use when attached to another element on the right'),
        ('border-left-info-text', 'Left border rule with matching padding — use for indented supplemental text'),
        ('left-pipe-separator',   'border-left: solid 1px var(--color-gray-300) — vertical pipe separator'),
        ('no-border-top',         'Remove top border'),
        ('round',                 'border-radius: 50% — circular shape'),
        ('rounded',               'border-radius: 0.25rem — small rounded corners'),
        ('rounded-lg',            'border-radius: 0.3rem — slightly larger rounded corners'),
    ]:
        add(cls, 'border', desc)

    # Accessibility
    for cls, desc in [
        ('sr-only',                  'Visually hidden but accessible to screen readers'),
        ('sr-only-focusable',        'Visually hidden until focused — use for skip links'),
        ('visually-hidden',          'Visually hidden but accessible to screen readers (modern alias for sr-only)'),
        ('visually-hidden-focusable','Visually hidden until focused or focus is within the element'),
    ]:
        add(cls, 'accessibility', desc)

    # Animation
    for cls, desc in [
        ('fade',              'opacity transition (0.15s) — pair with .show to toggle visibility'),
        ('fade-in-out-slow',  'opacity transition (0.5s ease-in-out) — pair with .show to toggle visibility'),
        ('collapse',          'Hide element (display: none) when .show is absent'),
    ]:
        add(cls, 'animation', desc)
    for color in ['brand-primary', 'brand-primary-dark', 'brand-primary-light', 'brand-secondary', 'brand-secondary-light', 'brand-neutral']:
        add(f'{color}-fill',   'animation', f'SVG path fill: var(--{color}) — apply to SVG wrapper')
        add(f'{color}-stroke', 'animation', f'SVG path stroke: var(--{color}) — apply to SVG wrapper')

    # Layout (page-level structure)
    for cls, desc in [
        ('main-wrapper',   'Root page layout — flex column, full height, default background'),
        ('no-menu',        'Page layout variant for unauthenticated/menuless pages'),
        ('page-width-890', 'Constrain content width to 890px at md+ breakpoints'),
    ]:
        add(cls, 'layout', desc)

    # Misc
    for cls, desc in [
        ('align-middle',       'vertical-align: middle'),
        ('clearfix',           'Clear floats via ::after pseudo-element'),
        ('shadow',             'box-shadow: var(--box-shadow-md)'),
        ('shadow-lg',          'box-shadow: var(--box-shadow-xl)'),
        ('line-height-1',      'line-height: 1'),
        ('object-fit-contain', 'object-fit: contain'),
        ('object-fit-cover',   'object-fit: cover'),
        ('link-gray',          'Gray link color with hover transition — use for secondary/muted links'),
    ]:
        add(cls, 'misc', desc)

    return out

def write_utilities_registry(output_path: Path) -> None:
    utilities = build_utilities()
    categories = sorted(set(u['category'] for u in utilities))

    new_content = {
        'totalUtilities': len(utilities),
        'categories': categories,
        'utilities': utilities,
    }

    existing_version = '0.1.0'
    existing_content = None
    if output_path.exists():
        try:
            existing = json.loads(output_path.read_text())
            existing_version = existing.get('version', '0.1.0')
            existing_content = {k: v for k, v in existing.items() if k not in ('version', 'generatedAt')}
        except Exception:
            pass

    if existing_content is not None and existing_content == new_content:
        print(f'✓ {len(utilities)} utilities ({len(categories)} categories)')
        print(f'  No changes detected — utilities registry not updated (version {existing_version})')
        return

    parts = existing_version.split('.')
    try:
        parts[-1] = str(int(parts[-1]) + 1)
    except (ValueError, IndexError):
        parts = ['0', '1', '1']
    new_version = '.'.join(parts)

    registry = {
        'version': new_version,
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        **new_content,
    }
    output_path.write_text(json.dumps(registry, indent=2))
    version_note = f'(bumped {existing_version} → {new_version})' if existing_content is not None else f'(initial {new_version})'
    print(f'✓ {len(utilities)} utilities ({len(categories)} categories)')

def write_tokens_registry(ui_styles_dir: Path, output_path: Path) -> None:
    tokens = build_tokens(ui_styles_dir)
    if not tokens:
        print('Error: build_tokens found no tokens - check the ui-styles path '
              f'({ui_styles_dir}/styles/partials). Registry NOT overwritten.', file=sys.stderr)
        sys.exit(1)

    new_content = {'totalTokens': len(tokens), 'tokens': tokens}

    existing_version = '0.1.0'
    existing_content = None
    if output_path.exists():
        try:
            existing = json.loads(output_path.read_text())
            existing_version = existing.get('version', '0.1.0')
            existing_content = {k: v for k, v in existing.items() if k not in ('version', 'generatedAt')}
        except Exception:
            pass

    if existing_content is not None and existing_content == new_content:
        print(f'{len(tokens)} tokens - no changes (version {existing_version})')
        return

    parts = existing_version.split('.')
    try:
        parts[-1] = str(int(parts[-1]) + 1)
    except (ValueError, IndexError):
        parts = ['0', '1', '1']
    new_version = '.'.join(parts)

    registry = {'version': new_version, 'generatedAt': datetime.now(timezone.utc).isoformat(), **new_content}
    output_path.write_text(json.dumps(registry, indent=2))
    note = f'(bumped {existing_version} -> {new_version})' if existing_content is not None else f'(initial {new_version})'
    print(f'{len(tokens)} tokens - written to {output_path} {note}')


if __name__ == '__main__':
    args = sys.argv[1:]
    if '--repo-root' in args:
        idx = args.index('--repo-root')
        repo_root = Path(args[idx + 1]).resolve()
    else:
        repo_root = detect_repo_root()

    if not repo_root:
        print('Error: could not detect banking repo root.\n'
              'Run from within the repo or pass --repo-root <path>.', file=sys.stderr)
        sys.exit(1)

    ui_styles_dir = repo_root / 'shared' / 'ui' / 'projects' / 'ui-styles'
    tokens_path = Path(__file__).parent.parent / 'references' / 'tokens-registry.json'
    utilities_path = Path(__file__).parent.parent / 'references' / 'utilities-registry.json'

    print(f'Repo root:  {repo_root}')
    print(f'ui-styles:  {ui_styles_dir}')
    print()
    write_tokens_registry(ui_styles_dir, tokens_path)
    write_utilities_registry(utilities_path)
