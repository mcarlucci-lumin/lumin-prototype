import { Component, HostBinding } from '@angular/core';
import { ChromeService } from '../chrome.service';

/**
 * "Admin" chrome — static visual of the admin portal nav bar: Lumin
 * Financial logo row + dark top nav with admin section links.
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
