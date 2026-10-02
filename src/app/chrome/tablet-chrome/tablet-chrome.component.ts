import { Component } from '@angular/core';
import { ChromeService } from '../chrome.service';

/**
 * "Tablet" chrome — dark top bar with the Lumin Financial logo centered,
 * a gradient-background page with a white content card (no side nav or page
 * header), and a bottom navigation bar fixed to the viewport bottom.
 * Combines the mobile shell pattern with the desktop card layout.
 */
@Component({
    selector: 'app-tablet-chrome',
    standalone: false,
    templateUrl: './tablet-chrome.component.html',
    styleUrls: ['./tablet-chrome.component.scss'],
})
export class TabletChromeComponent {
    readonly bottomNav = [
        { label: 'Accounts', icon: 'account_balance', active: false },
        { label: 'Transfer', icon: 'swap_horiz', active: true },
        { label: 'Pay', icon: 'receipt_long', active: false },
        { label: 'Menu', icon: 'menu', active: false },
    ];

    constructor(public chrome: ChromeService) {}
}
