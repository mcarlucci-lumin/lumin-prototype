import { Component } from '@angular/core';
import { ChromeService } from '../chrome.service';

/**
 * "Mobile" chrome — a static visual of a mobile app: a dark top bar, a page
 * title with tabs, the routed prototype in the scrollable body, and a bottom
 * navigation bar fixed to the bottom of the viewport. Placeholder text only.
 */
@Component({
    selector: 'app-mobile-chrome',
    standalone: false,
    templateUrl: './mobile-chrome.component.html',
    styleUrls: ['./mobile-chrome.component.scss'],
})
export class MobileChromeComponent {
    readonly tabs = [
        { label: 'Tab One', active: true },
        { label: 'Tab Two', active: false },
        { label: 'Tab Three', active: false },
    ];

    // Bottom navigation (placeholder). One item marked active.
    readonly bottomNav = [
        { label: 'Nav One', icon: 'grid_view', active: false },
        { label: 'Nav Two', icon: 'grid_view', active: false },
        { label: 'Nav Three', icon: 'grid_view', active: true },
        { label: 'Nav Four', icon: 'grid_view', active: false },
    ];

    constructor(public chrome: ChromeService) {}
}

