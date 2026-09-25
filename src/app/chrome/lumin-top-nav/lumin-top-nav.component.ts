import { Component, HostBinding } from '@angular/core';
import { ChromeService } from '../chrome.service';

/**
 * Shared Lumin desktop top navigation bar (static visual). Reused by the
 * Desktop Basic and Desktop Side Nav chromes. Fades itself when "Dim chrome"
 * is on, since it is part of the chrome frame.
 */
@Component({
    selector: 'app-lumin-top-nav',
    standalone: false,
    templateUrl: './lumin-top-nav.component.html',
    styleUrls: ['./lumin-top-nav.component.scss'],
})
export class LuminTopNavComponent {
    constructor(private readonly chrome: ChromeService) {}

    @HostBinding('class.dimmed') get dimmed(): boolean {
        return this.chrome.dimChrome();
    }
}
