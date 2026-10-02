import { Component, HostBinding } from '@angular/core';
import { ChromeService } from '../chrome.service';

/**
 * "Admin Side Nav" chrome — static visual of an admin portal section page:
 * the shared admin top nav (see AdminTopNavComponent), then a light side menu
 * of section links beside the prototype content.
 */
@Component({
    selector: 'app-admin-side-nav-chrome',
    standalone: false,
    templateUrl: './admin-side-nav-chrome.component.html',
    styleUrls: ['./admin-side-nav-chrome.component.scss'],
})
export class AdminSideNavChromeComponent {
    readonly sideMenuTitle = 'Content';

    readonly sideMenuItems = [
        { label: 'Marketing', active: false },
        { label: 'Insights', active: false },
        { label: 'Campaign Performance', active: false },
        { label: 'Featured Actions', active: false },
        { label: 'Next Best Actions', active: false },
        { label: 'Disclosures', active: false },
        { label: 'FAQs', active: true },
        { label: 'Channel Art', active: false },
        { label: 'Animation Art', active: false },
        { label: 'LevelUp', active: false },
        { label: 'Spotlights', active: false },
    ];

    constructor(private readonly chrome: ChromeService) {}

    @HostBinding('class.dimmed') get dimmed(): boolean {
        return this.chrome.dimChrome();
    }
}
