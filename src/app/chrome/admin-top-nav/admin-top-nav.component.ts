import { Component, HostBinding } from '@angular/core';
import { ChromeService } from '../chrome.service';

/**
 * Shared admin portal top navigation (static visual): Lumin Financial logo row
 * + dark admin nav bar. Reused by the Admin Basic and Admin Side Nav chromes.
 * Fades itself when "Dim chrome" is on, since it is part of the chrome frame.
 */
@Component({
    selector: 'app-admin-top-nav',
    standalone: false,
    templateUrl: './admin-top-nav.component.html',
    styleUrls: ['./admin-top-nav.component.scss'],
})
export class AdminTopNavComponent {
    constructor(private readonly chrome: ChromeService) {}

    @HostBinding('class.dimmed') get dimmed(): boolean {
        return this.chrome.dimChrome();
    }
}
