import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HomeComponent } from './home/home.component';

// ─── Claude: add prototype component imports here ───────────────────────────

const routes: Routes = [
    { path: '', component: HomeComponent },
    // ─── Claude: add prototype routes here ──────────────────────────────────
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule {}
