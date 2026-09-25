import { Component, computed, ElementRef, signal, untracked, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ChromeService } from './chrome/chrome.service';

interface ViewportPreset {
    id: string;
    label: string;
    icon: string;
    width: number | null;
    height: number | null;
}

const VIEWPORT_PRESETS: ViewportPreset[] = [
    { id: 'full',    label: 'Full',    icon: 'crop_free',       width: null, height: null },
    { id: 'desktop', label: 'Desktop', icon: 'desktop_windows', width: 1440, height: null },
    { id: 'tablet',  label: 'Tablet',  icon: 'tablet',          width: 900,  height: null },
    { id: 'mobile',  label: 'Mobile',  icon: 'smartphone',      width: 390,  height: 852  },
];

// Desktop viewport shows the picker but limits it to these options.
const DESKTOP_CHROME_IDS = ['desktop-basic', 'desktop-side-nav', 'admin'];
const DESKTOP_CHROME_DEFAULT = 'desktop-side-nav';
const DEFAULT_CHROME = 'default';

@Component({
    standalone: false,
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {
    // The home screen embeds each prototype in an iframe to render its tile
    // thumbnail, and appends ?preview=1 to that URL. In preview mode the shell
    // chrome is dropped so the thumbnail shows the prototype, not a nested copy
    // of the app frame.
    readonly isPreview = new URLSearchParams(window.location.search).has('preview');

    // In frame mode the outer shell has placed this page inside an <iframe>.
    // Frame mode renders only the chrome + prototype content — no back-bar.
    readonly isFrame = new URLSearchParams(window.location.search).has('frame');

    readonly viewportPresets = VIEWPORT_PRESETS;
    readonly viewportPreset = signal<string>('full');
    readonly desktopChromeIds = DESKTOP_CHROME_IDS;

    // Remembered chrome for full-viewport mode — saved when leaving full so it
    // can be restored on return. Reset when leaving the prototype entirely.
    private lastFullChrome = DEFAULT_CHROME;

    @ViewChild('protoFrame') protoFrameRef?: ElementRef<HTMLIFrameElement>;

    private readonly currentPath = signal<string>(
        window.location.pathname.split('?')[0] || '/'
    );

    readonly safeFrameUrl = computed<SafeResourceUrl>(() => {
        const path = this.currentPath();
        // Read viewport untracked — the URL only changes on path change, not on
        // viewport or chrome changes (those go via postMessage to avoid iframe reloads).
        const preset = untracked(() => this.viewportPreset());
        let chrome: string;
        if (preset === 'desktop') chrome = DESKTOP_CHROME_DEFAULT;
        else if (preset === 'tablet') chrome = 'tablet';
        else if (preset === 'mobile') chrome = 'mobile';
        else chrome = DEFAULT_CHROME;
        const params = new URLSearchParams({ frame: '1', chrome });
        return this.sanitizer.bypassSecurityTrustResourceUrl(`${path}?${params}`);
    });

    readonly frameWidth = computed<string>(() => {
        const preset = VIEWPORT_PRESETS.find(p => p.id === this.viewportPreset());
        return preset?.width ? `${preset.width}px` : '100%';
    });

    readonly frameHeight = computed<string | null>(() => {
        const preset = VIEWPORT_PRESETS.find(p => p.id === this.viewportPreset());
        return preset?.height ? `${preset.height}px` : null;
    });

    // The chrome that will actually display in the iframe — drives the dim checkbox
    // visibility (it should track what the iframe shows, not what the picker says).
    readonly effectiveChrome = computed(() => {
        const preset = this.viewportPreset();
        if (preset === 'full') return this.chrome.displayChrome();
        if (preset === 'desktop') {
            const active = this.chrome.activeChrome();
            return DESKTOP_CHROME_IDS.includes(active) ? active : DESKTOP_CHROME_DEFAULT;
        }
        return preset === 'tablet' ? 'tablet' : 'mobile';
    });

    constructor(
        public router: Router,
        public chrome: ChromeService,
        private readonly sanitizer: DomSanitizer,
    ) {
        if (this.isPreview) {
            // Belt-and-braces with the iframe's scrolling="no" — keeps scrollbars
            // out of the thumbnail.
            document.documentElement.style.overflow = 'hidden';
        }

        // Track the current path so the iframe URL stays in sync with navigation.
        // Reset viewport and chrome picks when returning to the home page.
        this.router.events.subscribe(e => {
            if (e instanceof NavigationEnd) {
                const path = e.urlAfterRedirects.split('?')[0] || '/';
                this.currentPath.set(path);
                if (path === '/') {
                    // Leaving the prototype — full reset.
                    this.viewportPreset.set('full');
                    this.lastFullChrome = DEFAULT_CHROME;
                } else {
                    // Entering a (new) prototype — reset saved state and re-sync
                    // sessionChrome to match what the iframe URL will load with.
                    this.lastFullChrome = DEFAULT_CHROME;
                    const preset = this.viewportPreset();
                    if (preset === 'desktop') {
                        this.chrome.setChromeForCurrentPrototype(DESKTOP_CHROME_DEFAULT);
                    }
                }
            }
        });

        // Frame mode: listen for control messages posted by the outer shell.
        if (this.isFrame) {
            window.addEventListener('message', (e: MessageEvent) => {
                if (e.origin !== window.location.origin) return;
                if (e.data?.type === 'SET_DIM') {
                    this.chrome.overrideDim(e.data.dim as boolean);
                } else if (e.data?.type === 'SET_CHROME') {
                    this.chrome.overrideChrome(e.data.chrome as string);
                }
            });
        }
    }

    get isPrototypeRoute(): boolean {
        return this.router.url !== '/';
    }

    onViewportChange(id: string): void {
        // Save the full-mode chrome before leaving it so it can be restored on return.
        if (this.viewportPreset() === 'full') {
            this.lastFullChrome = this.chrome.activeChrome();
        }

        this.viewportPreset.set(id);
        let chrome: string;
        if (id === 'desktop') {
            const active = this.chrome.activeChrome();
            chrome = DESKTOP_CHROME_IDS.includes(active) ? active : DESKTOP_CHROME_DEFAULT;
            this.chrome.setChromeForCurrentPrototype(chrome);
        } else if (id === 'tablet') {
            chrome = 'tablet';
        } else if (id === 'mobile') {
            chrome = 'mobile';
        } else {
            // Returning to full — restore the last full-mode pick.
            chrome = this.lastFullChrome;
            this.chrome.setChromeForCurrentPrototype(chrome);
        }
        this.sendToFrame({ type: 'SET_CHROME', chrome });
    }

    onChromePick(id: string): void {
        this.chrome.setChromeForCurrentPrototype(id);
        this.sendToFrame({ type: 'SET_CHROME', chrome: id });
    }

    onDimChange(value: unknown): void {
        // ui-forms-checkbox emits the new checked value; fall back to toggling
        // if a non-boolean payload ever comes through.
        const checked = typeof value === 'boolean' ? value : !this.chrome.dimChrome();
        this.chrome.setDimChrome(checked);
        // Forward to the iframe immediately — dim is cosmetic so no reload needed.
        this.sendToFrame({ type: 'SET_DIM', dim: checked });
    }

    private sendToFrame(msg: object): void {
        const iframe = this.protoFrameRef?.nativeElement;
        iframe?.contentWindow?.postMessage(msg, window.location.origin);
    }
}
