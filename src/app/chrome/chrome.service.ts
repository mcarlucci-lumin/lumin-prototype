import { computed, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
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

/**
 * Resolves which chrome the prototype on screen should render inside.
 *
 * Every prototype starts with the default (plain white) chrome. The toolbar's
 * chrome picker changes the current session's choice in memory; it is never
 * persisted and resets on page load.
 *
 * The outer shell always passes ?chrome=<id> to the iframe URL, so the inner
 * app receives the correct chrome from the URL rather than any stored state.
 */
@Injectable({ providedIn: 'root' })
export class ChromeService {
    readonly options = CHROME_OPTIONS;

    /** When true, the chrome frame is dimmed so the prototype section stands out. */
    readonly dimChrome = signal<boolean>(this.loadDim());

    // The outer shell passes ?chrome=<id> in the iframe src for every prototype
    // load, covering both constrained-viewport auto-chrome and user-picked chrome.
    private readonly frameChrome: string | null = (() => {
        const c = new URLSearchParams(window.location.search).get('chrome');
        return CHROME_OPTIONS_DATA.some(o => o.id === c) ? c : null;
    })();

    /** Chrome chosen via the picker in the outer shell. Resets on every navigation. */
    private readonly sessionChrome = signal<string>(DEFAULT_CHROME);

    /** Chrome pushed to the inner iframe via postMessage, overrides frameChrome. */
    private readonly messagedChrome = signal<string | null>(null);

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
        // messagedChrome: live postMessage override from outer shell (frame mode only)
        // frameChrome:    initial chrome from ?chrome= URL param (frame mode only)
        // sessionChrome:  picker choice in the outer shell
        return this.messagedChrome() ?? this.frameChrome ?? this.sessionChrome();
    });

    constructor(private readonly router: Router) {
        window.addEventListener('resize', () => this.viewportWidth.set(window.innerWidth));

        // Reset picker state on every navigation so each prototype opens fresh.
        this.router.events.subscribe(e => {
            if (e instanceof NavigationEnd) {
                this.sessionChrome.set(DEFAULT_CHROME);
                this.messagedChrome.set(null);
            }
        });
    }

    /**
     * Changes the chrome for the prototype currently on screen.
     * The pick lives only until the next navigation.
     */
    setChromeForCurrentPrototype(id: string): void {
        this.sessionChrome.set(this.isValid(id) ? id : DEFAULT_CHROME);
    }

    setDimChrome(dim: boolean): void {
        this.dimChrome.set(dim);
        try {
            localStorage.setItem(DIM_STORAGE_KEY, dim ? '1' : '0');
        } catch {
            // ignore
        }
    }

    /** Sets dim without touching localStorage (called via postMessage from outer shell). */
    overrideDim(dim: boolean): void {
        this.dimChrome.set(dim);
    }

    /** Overrides the displayed chrome via postMessage from the outer shell. */
    overrideChrome(id: string): void {
        if (this.isValid(id)) this.messagedChrome.set(id);
    }

    // ── private ─────────────────────────────────────────────────────────────

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
}
