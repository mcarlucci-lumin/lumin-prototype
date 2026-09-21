import { Component } from '@angular/core';
import { ChromeService } from '../chrome.service';

/**
 * "Desktop Side Nav" chrome — the shared top nav, then a bordered page card
 * with a left side navigation and a right side (page header + body + footer).
 * The routed prototype renders in the ".PageBody" slot. Static visual only;
 * placeholder text matches the Figma design.
 */
@Component({
    selector: 'app-desktop-side-nav-chrome',
    standalone: false,
    templateUrl: './desktop-side-nav-chrome.component.html',
    styleUrls: ['./desktop-side-nav-chrome.component.scss'],
})
export class DesktopSideNavChromeComponent {
    // Side-nav items (placeholder text from the design). First item is selected.
    readonly menuItems = [
        { label: 'Level 3 Nav Title', active: true },
        { label: 'Level 3 Nav Title', active: false },
        { label: 'Level 3 Nav Title', active: false },
        { label: 'Level 3 Nav Title', active: false },
        { label: 'Level 3 Nav Title', active: false },
    ];

    constructor(public chrome: ChromeService) {}
}




