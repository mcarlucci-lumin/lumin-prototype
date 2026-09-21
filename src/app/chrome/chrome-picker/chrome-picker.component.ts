import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ChromeService } from '../chrome.service';

/**
 * Compact picker for the chrome of the prototype on screen. Changing it swaps
 * the frame for this session; the pick is not persisted anywhere and resets on
 * the next page load. See ChromeService.
 */
@Component({
    selector: 'app-chrome-picker',
    standalone: false,
    templateUrl: './chrome-picker.component.html',
})
export class ChromePickerComponent {
    /** ui-forms-picker theme — 'white' reads well on both light and dark bars. */
    @Input() theme: 'white' | 'primary' = 'white';

    /** When set, only options whose id is in this list are shown. */
    @Input() allowedIds: string[] | null = null;

    /** Emits the chosen chrome id so the outer shell can forward it to the iframe. */
    @Output() pick = new EventEmitter<string>();

    private readonly allOptions = this.chrome.options.map(o => ({
        id: o.id,
        label: o.name,
        value: o.id,
        e2e: `chrome-${o.id}`,
    }));

    get options() {
        if (!this.allowedIds?.length) return this.allOptions;
        return this.allOptions.filter(o => this.allowedIds!.includes(o.id));
    }

    constructor(private readonly chrome: ChromeService) {}

    get current(): string {
        return this.chrome.activeChrome();
    }

    onChange(value: string): void {
        this.chrome.setChromeForCurrentPrototype(value);
        this.pick.emit(value);
    }
}
