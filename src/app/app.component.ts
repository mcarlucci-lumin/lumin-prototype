import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ChromeService } from './chrome/chrome.service';

@Component({
    standalone: false,
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {
    // The home screen embeds each prototype in an iframe to render its tile
    // thumbnail, and appends ?preview=1 to that URL. In preview mode the shell
    // chrome is dropped so the thumbnail shows the prototype, not a nested copy
    // of the app frame.
    readonly isPreview = new URLSearchParams(window.location.search).has('preview');

    constructor(public router: Router, public chrome: ChromeService) {
        if (this.isPreview) {
            // Belt-and-braces with the iframe's scrolling="no" — keeps scrollbars
            // out of the thumbnail.
            document.documentElement.style.overflow = 'hidden';
        }
    }

    get isPrototypeRoute(): boolean {
        return this.router.url !== '/';
    }

    onDimChange(value: unknown): void {
        // ui-forms-checkbox emits the new checked value; fall back to toggling
        // if a non-boolean payload ever comes through.
        const checked = typeof value === 'boolean' ? value : !this.chrome.dimChrome();
        this.chrome.setDimChrome(checked);
    }
}
