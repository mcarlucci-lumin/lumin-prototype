import { NgModule, provideAppInitializer, inject } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ActiveConfiguration, ConfigurableEntityRegistry } from '@a3-digital/configurability';
import { DateProvider, SystemClock } from '@a3-digital/date-utils';
import { UiCoreModule, UI_ANALYTICS_PUBLISHER, ModalService, ModalBridgeService } from '@a3-digital/ui-core';
import { UiFormsModule, UI_BOT_DETECTION_PROVIDER } from '@a3-digital/ui-forms';
import { UiLayoutsModule } from '@a3-digital/ui-layouts';
import { UiManagementModule } from '@a3-digital/ui-management';
import { UiWorkflowsModule, TableStateService } from '@a3-digital/ui-workflows';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { PrototypePreviewComponent } from './home/prototype-preview/prototype-preview.component';
import { DesktopBasicChromeComponent } from './chrome/desktop-basic-chrome/desktop-basic-chrome.component';
import { DesktopSideNavChromeComponent } from './chrome/desktop-side-nav-chrome/desktop-side-nav-chrome.component';
import { MobileChromeComponent } from './chrome/mobile-chrome/mobile-chrome.component';
import { LuminTopNavComponent } from './chrome/lumin-top-nav/lumin-top-nav.component';
import { LuminFooterComponent } from './chrome/lumin-footer/lumin-footer.component';
import { ChromePickerComponent } from './chrome/chrome-picker/chrome-picker.component';
import { TabletChromeComponent } from './chrome/tablet-chrome/tablet-chrome.component';
import { AdminChromeComponent } from './chrome/admin-chrome/admin-chrome.component';
import { ChromeService } from './chrome/chrome.service';

// ─── Claude: add prototype component imports here ───────────────────────────

// Initialize configurability with an empty config before the module loads.
// In production apps this is populated from window['CONFIG'] — prototypes use
// an empty object so all feature flags default to their off/fallback states.
if (typeof window !== 'undefined') {
    const config = ((window as unknown as Record<string, unknown>)['CONFIG'] ?? {}) as ActiveConfiguration;
    ConfigurableEntityRegistry.initialize(config);
}

@NgModule({
    declarations: [
        AppComponent,
        HomeComponent,
        PrototypePreviewComponent,
        DesktopBasicChromeComponent,
        DesktopSideNavChromeComponent,
        MobileChromeComponent,
        LuminTopNavComponent,
        LuminFooterComponent,
        ChromePickerComponent,
        TabletChromeComponent,
        AdminChromeComponent,
        // ─── Claude: add prototype components to declarations here ──────────
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        FormsModule,
        ReactiveFormsModule,
        DragDropModule,
        NgbModule,
        UiCoreModule,
        UiFormsModule,
        UiLayoutsModule,
        UiManagementModule,
        UiWorkflowsModule,
        AppRoutingModule
    ],
    providers: [
        TableStateService,
        ModalService,
        ModalBridgeService,
        {
            provide: DateProvider,
            useFactory: () => new DateProvider(new SystemClock())
        },
        {
            provide: ConfigurableEntityRegistry,
            useFactory: () => ConfigurableEntityRegistry.instance()
        },
        // Stub out optional analytics/bot-detection tokens so components that
        // inject them don't throw NullInjectorError in prototype context.
        { provide: UI_ANALYTICS_PUBLISHER, useValue: null },
        { provide: UI_BOT_DETECTION_PROVIDER, useValue: null },
        provideHttpClient(withInterceptorsFromDi()),
        // Read the landed-on prototype's chrome from its served meta.json before
        // the app boots, so a deep link or reload paints the right frame straight
        // away instead of correcting itself a tick later.
        provideAppInitializer(() => inject(ChromeService).initialize())
    ],
    bootstrap: [AppComponent]
})
export class AppModule {}
