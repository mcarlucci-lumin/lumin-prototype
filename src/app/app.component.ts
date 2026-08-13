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
    private hideTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(public router: Router) {}

    get isPrototypeRoute(): boolean {
        return this.router.url !== '/';
    }

    @HostListener('document:mousemove')
    @HostListener('document:scroll')
    onActivity(): void {
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
