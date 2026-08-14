import {
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    ElementRef,
    Input,
    OnDestroy,
    ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

// Every prototype is rendered at the same fixed desktop viewport and then scaled
// down to whatever the tile happens to be, so thumbnails stay consistent across
// the grid's breakpoints instead of reflowing to a ~290px-wide mobile layout.
// Wide enough to trigger desktop layouts, narrow enough that the content is
// still legible once scaled into a ~250px tile.
const VIEWPORT_WIDTH = 1024;
const VIEWPORT_RATIO = 0.625; // 16:10 — matches the tile's reserved preview area
const VIEWPORT_HEIGHT = Math.round(VIEWPORT_WIDTH * VIEWPORT_RATIO);

// Each preview iframe boots a second copy of the whole app (Angular + the design
// system), so letting a full grid start at once stalls the page — badly in
// StackBlitz WebContainers. Previews queue and load a couple at a time instead.
const MAX_CONCURRENT_LOADS = 2;

class PreviewLoadQueue {
    private active = 0;
    private readonly waiting: Array<() => void> = [];

    request(start: () => void): void {
        if (this.active < MAX_CONCURRENT_LOADS) {
            this.active++;
            start();
        } else {
            this.waiting.push(start);
        }
    }

    /** Called once per started load, on success, failure, or teardown. */
    release(): void {
        const next = this.waiting.shift();
        if (next) {
            next();
        } else {
            this.active = Math.max(0, this.active - 1);
        }
    }

    /** Drop a load that was queued but never started. */
    cancel(start: () => void): void {
        const i = this.waiting.indexOf(start);
        if (i !== -1) this.waiting.splice(i, 1);
    }
}

const loadQueue = new PreviewLoadQueue();

@Component({
    standalone: false,
    selector: 'app-prototype-preview',
    templateUrl: './prototype-preview.component.html',
    styleUrls: ['./prototype-preview.component.scss'],
})
export class PrototypePreviewComponent implements AfterViewInit, OnDestroy {
    /** Route of the prototype to preview, e.g. '/decision-status-card'. */
    @Input({ required: true }) path!: string;

    src: SafeResourceUrl | null = null;
    state: 'idle' | 'loading' | 'loaded' | 'error' = 'idle';

    readonly viewportWidth = VIEWPORT_WIDTH;
    readonly viewportHeight = VIEWPORT_HEIGHT;

    @ViewChild('stage', { static: true }) private stage!: ElementRef<HTMLElement>;

    private intersection?: IntersectionObserver;
    private resize?: ResizeObserver;
    private queued?: () => void;
    private started = false;
    private startTimer?: ReturnType<typeof setTimeout>;

    constructor(
        private readonly sanitizer: DomSanitizer,
        private readonly cdr: ChangeDetectorRef,
    ) {}

    ngAfterViewInit(): void {
        this.trackSize();
        // Deferred a tick: an already-visible tile would otherwise start its load
        // — and call detectChanges — from inside the parent's change detection.
        this.startTimer = setTimeout(() => this.loadWhenVisible());
    }

    ngOnDestroy(): void {
        if (this.startTimer) clearTimeout(this.startTimer);
        this.intersection?.disconnect();
        this.resize?.disconnect();
        if (this.queued && !this.started) loadQueue.cancel(this.queued);
        if (this.started && this.state === 'loading') loadQueue.release();
    }

    onLoad(): void {
        this.settle('loaded');
    }

    onError(): void {
        this.settle('error');
    }

    // ── private ─────────────────────────────────────────────────────────────

    /**
     * Keeps the iframe scaled to the tile. The iframe itself always lays out at
     * VIEWPORT_WIDTH; only the CSS transform changes, so no reflow happens
     * inside it when the grid resizes.
     */
    private trackSize(): void {
        const el = this.stage.nativeElement;
        const apply = () => {
            const width = el.clientWidth;
            if (width > 0) {
                el.style.setProperty('--preview-scale', String(width / VIEWPORT_WIDTH));
            }
        };

        apply();
        if (typeof ResizeObserver !== 'undefined') {
            this.resize = new ResizeObserver(apply);
            this.resize.observe(el);
        } else {
            window.addEventListener('resize', apply);
        }
    }

    private loadWhenVisible(): void {
        if (typeof IntersectionObserver === 'undefined') {
            this.enqueueLoad();
            return;
        }

        this.intersection = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) {
                this.intersection?.disconnect();
                this.enqueueLoad();
            }
        }, { rootMargin: '200px' });

        this.intersection.observe(this.stage.nativeElement);
    }

    private enqueueLoad(): void {
        if (this.state !== 'idle') return;
        this.state = 'loading';

        // `preview=1` tells AppComponent to strip the shell chrome so the tile
        // shows the prototype itself rather than a nested copy of the app frame.
        const url = `${this.path}?preview=1`;

        this.queued = () => {
            this.started = true;
            this.src = this.sanitizer.bypassSecurityTrustResourceUrl(url);
            this.cdr.detectChanges();
        };
        loadQueue.request(this.queued);
    }

    private settle(state: 'loaded' | 'error'): void {
        if (this.state !== 'loading') return;
        this.state = state;
        loadQueue.release();
    }
}
