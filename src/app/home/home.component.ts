import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PROTOTYPES, PrototypeMeta } from '../prototype-registry';

@Component({
    standalone: false,
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
    readonly prototypes: PrototypeMeta[] = PROTOTYPES;

    constructor(private readonly router: Router) {}

    ngOnInit(): void {
        if (this.prototypes.length === 1) {
            this.router.navigate([this.prototypes[0].path]);
        }
    }

    navigate(path: string): void {
        this.router.navigate([path]);
    }
}
