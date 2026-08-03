import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ActiveConfiguration, ConfigurableEntityRegistry } from '@a3-digital/configurability';
import { DateProvider, SystemClock } from '@a3-digital/date-utils';
import { UiCoreModule, UI_ANALYTICS_PUBLISHER } from '@a3-digital/ui-core';
import { UiFormsModule, UI_BOT_DETECTION_PROVIDER } from '@a3-digital/ui-forms';
import { UiLayoutsModule } from '@a3-digital/ui-layouts';
import { UiManagementModule } from '@a3-digital/ui-management';
import { UiWorkflowsModule, TableStateService } from '@a3-digital/ui-workflows';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';

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
        // ─── Claude: add prototype components to declarations here ──────────
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        FormsModule,
        ReactiveFormsModule,
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
        provideHttpClient(withInterceptorsFromDi())
    ],
    bootstrap: [AppComponent]
})
export class AppModule {}
