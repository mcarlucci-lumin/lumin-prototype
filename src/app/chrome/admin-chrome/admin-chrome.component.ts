import { Component, HostBinding } from '@angular/core';
import { ChromeService } from '../chrome.service';

/**
 * "Admin Basic" chrome — static visual of an admin portal page: the shared
 * admin top nav (see AdminTopNavComponent) above the prototype content.
 */
@Component({
    selector: 'app-admin-chrome',
    standalone: false,
    templateUrl: './admin-chrome.component.html',
    styleUrls: ['./admin-chrome.component.scss'],
})
export class AdminChromeComponent {
    constructor(private readonly chrome: ChromeService) {}

    @HostBinding('class.dimmed') get dimmed(): boolean {
        return this.chrome.dimChrome();
    }
}
