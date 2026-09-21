import { Component, HostBinding } from '@angular/core';
import { ChromeService } from '../chrome.service';

/**
 * Shared Lumin client-website footer (static visual). Reused by the Desktop
 * Basic and Desktop Side Nav chromes. Fades itself when "Dim chrome" is on.
 * Width/positioning are controlled by the host chrome.
 */
@Component({
    selector: 'app-lumin-footer',
    standalone: false,
    templateUrl: './lumin-footer.component.html',
    styleUrls: ['./lumin-footer.component.scss'],
})
export class LuminFooterComponent {
    constructor(private readonly chrome: ChromeService) {}

    @HostBinding('class.dimmed') get dimmed(): boolean {
        return this.chrome.dimChrome();
    }
}
