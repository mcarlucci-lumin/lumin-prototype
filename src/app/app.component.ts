import { Component, HostListener, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    standalone: false,
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {
    isBackBtnVisible = false;

    // The home screen embeds each prototype in an iframe to render its tile
    // thumbnail, and appends ?preview=1 to that URL. In preview mode the shell
    // chrome is dropped so the thumbnail shows the prototype, not a nested copy
    // of the app frame.
    readonly isPreview = new URLSearchParams(window.location.search).has('preview');

    private hideTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(public router: Router) {
        if (this.isPreview) {
            // Belt-and-braces with the iframe's scrolling="no" — keeps scrollbars
            // out of the thumbnail.
            document.documentElement.style.overflow = 'hidden';
        }
    }

    get isPrototypeRoute(): boolean {
        return this.router.url !== '/';
    }

    @HostListener('document:mousemove')
    @HostListener('document:scroll')
    onActivity(): void {
        if (this.isPreview) return;
        this.isBackBtnVisible = true;
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
        }
        this.hideTimer = setTimeout(() => {
            this.isBackBtnVisible = false;
        }, 3000);
    }

    ngOnDestroy(): void {
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
        }
    }
}
