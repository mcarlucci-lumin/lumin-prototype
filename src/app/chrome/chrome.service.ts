import { computed, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { FILE_SERVER } from '../file-server';
import CHROME_OPTIONS_DATA from './chrome-options.json';

export interface ChromeOption {
    /** Stable id — matches the @switch case in app.component.html. */
    id: string;
    /** Human-readable name shown in the picker. */
    name: string;
}

/**
 * The available "chrome" options — the visual frame a prototype is presented
 * inside. To add a future chrome:
 *   1. add an entry to src/app/chrome/chrome-options.json,
 *   2. build a `*-chrome` component under src/app/chrome/,
 *   3. add a matching `@case` in app.component.html.
 * Each option stays fully segmented from the others.
 *
 * The list lives in JSON rather than here because scripts/wire-prototypes.js and
 * scripts/dev-file-server.js validate meta.json against the same ids — one source
 * of truth for TypeScript and Node alike.
 */
export const CHROME_OPTIONS: ChromeOption[] = CHROME_OPTIONS_DATA;

const DEFAULT_CHROME = 'default';
const DIM_STORAGE_KEY = 'prototype-chrome-dim';

// Fallback storage for chrome picks that could not be written to the prototype's
// meta.json — i.e. a static `ng build` deployment with no dev-file-server behind
// it. A slug → chrome-id map, per-viewer. See setChromeForCurrentPrototype.
const LOCAL_STORAGE_KEY = 'prototype-chrome-local';

/**
 * Resolves which chrome the prototype on screen should render inside.
 *
 * The choice belongs to the prototype, not the viewer: it lives in the
 * prototype's own meta.json, so it travels through the download zip and into git.
 *
 * meta.json is read at *runtime*, from the copy the Angular build serves at
 * assets/prototypes/<slug>/meta.json, rather than being compiled into
 * prototype-registry.ts. That is deliberate: a value baked into the registry
 * would change the bundle on every save, and ng serve would rebuild and reload
 * the page each time a chrome was picked. Fetching it instead leaves the bundle
 * byte-identical, so saving is invisible.
 */
@Injectable({ providedIn: 'root' })
export class ChromeService {
    readonly options = CHROME_OPTIONS;

    /** When true, the chrome frame is dimmed so the prototype section stands out. */
    readonly dimChrome = signal<boolean>(this.loadDim());

    /** Set when a pick could not be written to meta.json, so the bar can say so. */
    readonly saveError = signal<string | null>(null);

    // Home-page tiles render each prototype in an iframe with ?preview=1, and that
    // mode drops all chrome — so those iframes must never fetch a meta.json. With
    // one iframe per tile, doing so would turn N prototypes into N² requests.
    private readonly isPreview = new URLSearchParams(window.location.search).has('preview');

    /** Route slug currently on screen, e.g. 'sample-page'. '' on the home route. */
    private readonly slug = signal<string>('');

    /** Chrome per slug, as last read from (or written to) meta.json. */
    private readonly chromeBySlug = signal<Record<string, string>>({});

    /** Slugs whose meta.json has been resolved, so rendering need not wait again. */
    private readonly resolved = signal<Record<string, true>>({});

    /** Picks that only reached localStorage because no dev server was reachable. */
    private readonly localOnly = signal<Record<string, string>>(this.readLocalOnly());

    /** In-flight fetches, so concurrent navigations share one request per slug. */
    private readonly inFlight = new Map<string, Promise<void>>();

    /** Tracks viewport width so responsive mode can pick the right layout. */
    private readonly viewportWidth = signal<number>(window.innerWidth);

    /** Which fixed chrome the current viewport maps to for responsive mode. */
    private readonly viewportChrome = computed(() => {
        const w = this.viewportWidth();
        if (w < 768) return 'mobile';
        if (w < 1080) return 'tablet';
        return 'desktop-side-nav';
    });

    /**
     * The chrome that should actually render on screen.
     * When the prototype's chrome is 'responsive' this resolves to the
     * appropriate layout for the current viewport; otherwise it matches
     * activeChrome() directly.
     */
    readonly displayChrome = computed(() => {
        const active = this.activeChrome();
        return active === 'responsive' ? this.viewportChrome() : active;
    });

    /** The chrome to render for the prototype on screen. */
    readonly activeChrome = computed(() => {
        const slug = this.slug();
        const candidates = [this.localOnly()[slug], this.chromeBySlug()[slug]];
        return candidates.find(c => this.isValid(c)) ?? DEFAULT_CHROME;
    });

    /**
     * False only while the current prototype's meta.json is still being read.
     * The shell holds the frame back until this is true, so a prototype never
     * flashes in the default frame before its real one arrives.
     */
    readonly ready = computed(() => {
        const slug = this.slug();
        if (!slug || this.isPreview) return true; // home and previews need no chrome
        return this.resolved()[slug] === true;
    });

    constructor(private readonly router: Router) {
        window.addEventListener('resize', () => this.viewportWidth.set(window.innerWidth));

        this.router.events.subscribe(e => {
            if (e instanceof NavigationEnd) {
                const slug = toSlug(e.urlAfterRedirects);
                this.slug.set(slug);
                // A failed save belongs to the attempt, not to the new route.
                this.saveError.set(null);
                void this.ensureResolved(slug);
            }
        });
    }

    /**
     * Reads the chrome for whatever prototype the browser landed on, before the
     * app bootstraps. Wired up as an app initializer, so a deep link or a reload
     * renders in the right frame on the first paint rather than correcting itself.
     *
     * Uses window.location because the router has not navigated yet at this point.
     */
    async initialize(): Promise<void> {
        if (this.isPreview) return;
        const slug = toSlug(window.location.pathname);
        this.slug.set(slug);
        await this.ensureResolved(slug);
    }

    /**
     * Records `id` as the chrome for the prototype on screen: the frame swaps at
     * once and meta.json is rewritten underneath.
     *
     * No rebuild follows, because nothing compiled changes — see the class comment.
     * If the write cannot land (no dev server, e.g. a static build) the pick is
     * kept in localStorage instead and saveError says so.
     */
    async setChromeForCurrentPrototype(id: string): Promise<void> {
        const slug = this.slug();
        if (!slug) return; // home route has no prototype to frame

        const chrome = this.isValid(id) ? id : DEFAULT_CHROME;
        this.saveError.set(null);
        this.chromeBySlug.update(m => ({ ...m, [slug]: chrome }));

        try {
            const res = await fetch(`${FILE_SERVER}/prototype/${encodeURIComponent(slug)}/chrome`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chrome }),
            });
            if (!res.ok) throw new Error(await res.text());
            // meta.json is authoritative now, so drop any local-only leftover.
            this.forgetLocalOnly(slug);
        } catch {
            this.rememberLocalOnly(slug, chrome);
            this.saveError.set('Saved locally only — no dev server');
        }
    }

    setDimChrome(dim: boolean): void {
        this.dimChrome.set(dim);
        try {
            localStorage.setItem(DIM_STORAGE_KEY, dim ? '1' : '0');
        } catch {
            // ignore
        }
    }

    // ── private ─────────────────────────────────────────────────────────────

    /** Fetches a prototype's meta.json once, and marks the slug renderable. */
    private ensureResolved(slug: string): Promise<void> {
        if (!slug || this.isPreview || this.resolved()[slug]) return Promise.resolve();

        const existing = this.inFlight.get(slug);
        if (existing) return existing;

        const run = this.fetchChrome(slug)
            .then(chrome => {
                if (this.isValid(chrome)) {
                    this.chromeBySlug.update(m => ({ ...m, [slug]: chrome }));
                    // The file has a value of its own, so a local-only pick for
                    // this prototype is stale and must stop shadowing it.
                    this.forgetLocalOnly(slug);
                }
            })
            .catch(() => {
                // No meta.json, malformed, or offline — the default frame is right.
            })
            .finally(() => {
                this.inFlight.delete(slug);
                this.resolved.update(r => ({ ...r, [slug]: true }));
            });

        this.inFlight.set(slug, run);
        return run;
    }

    /** Reads `chrome` out of the meta.json the Angular build serves for `slug`. */
    private async fetchChrome(slug: string): Promise<string | undefined> {
        const res = await fetch(`assets/prototypes/${encodeURIComponent(slug)}/meta.json`, {
            cache: 'no-store', // it changes underneath us whenever a chrome is saved
        });
        if (!res.ok) return undefined; // prototypes need not have a meta.json
        const meta = await res.json();
        return (meta && typeof meta === 'object' && !Array.isArray(meta)) ? meta.chrome : undefined;
    }

    private isValid(id: string | null | undefined): id is string {
        return !!id && this.options.some(o => o.id === id);
    }

    private loadDim(): boolean {
        try {
            return localStorage.getItem(DIM_STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    }

    private rememberLocalOnly(slug: string, chrome: string): void {
        this.localOnly.update(l => ({ ...l, [slug]: chrome }));
        this.writeLocalOnly({ ...this.readLocalOnly(), [slug]: chrome });
    }

    private forgetLocalOnly(slug: string): void {
        if (!(slug in this.localOnly())) return;
        this.localOnly.update(l => omit(l, slug));
        this.writeLocalOnly(omit(this.readLocalOnly(), slug));
    }

    private readLocalOnly(): Record<string, string> {
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, string>;
            }
        } catch {
            // Private mode / storage disabled / malformed — start clean.
        }
        return {};
    }

    private writeLocalOnly(next: Record<string, string>): void {
        try {
            if (Object.keys(next).length) {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
            } else {
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        } catch {
            // ignore
        }
    }
}

/** '/sample-page?preview=1' → 'sample-page'; '/' → ''. */
function toSlug(url: string): string {
    return url.split('?')[0].split('#')[0].replace(/^\/+/, '');
}

function omit(map: Record<string, string>, key: string): Record<string, string> {
    const { [key]: _dropped, ...rest } = map;
    return rest;
}
