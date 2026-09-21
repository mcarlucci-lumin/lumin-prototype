import { Component, Input } from '@angular/core';
import { ChromeService } from '../chrome.service';

/**
 * Compact picker for the chrome of the prototype on screen. Changing it swaps the
 * frame and writes the pick to that prototype's meta.json, so the next load — by
 * anyone — comes up in it. No rebuild or reload follows; see ChromeService.
 */
@Component({
    selector: 'app-chrome-picker',
    standalone: false,
    templateUrl: './chrome-picker.component.html',
})
export class ChromePickerComponent {
    /** ui-forms-picker theme — 'white' reads well on both light and dark bars. */
    @Input() theme: 'white' | 'primary' = 'white';

    readonly options = this.chrome.options.map(o => ({
        id: o.id,
        label: o.name,
        value: o.id,
        e2e: `chrome-${o.id}`,
    }));

    constructor(private readonly chrome: ChromeService) {}

    get current(): string {
        return this.chrome.activeChrome();
    }

    onChange(value: string): void {
        // Fire-and-forget: the frame swaps at once and ChromeService surfaces any
        // write failure through its saveError signal.
        void this.chrome.setChromeForCurrentPrototype(value);
    }
}
