import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PROTOTYPES, PrototypeMeta } from '../prototype-registry';

type DropState = 'idle' | 'dragover' | 'uploading' | 'success' | 'error';

// In StackBlitz WebContainers, localhost process-to-process networking is broken,
// so the ng serve proxy cannot reach the dev-file-server. StackBlitz exposes each
// port via a hostname like "…--4200--….webcontainer.io"; we swap the port segment
// to call the dev-file-server directly from the browser instead.
// Outside StackBlitz, use the ng serve proxy path (/api → localhost:7788).
function resolveFileServer(): string {
    const { hostname, protocol } = window.location;
    if (hostname.includes('.webcontainer.io') || hostname.includes('.webcontainer.local')) {
        return `${protocol}//${hostname.replace(/--\d+--/, '--7788--')}`;
    }
    return '/api';
}

const FILE_SERVER = resolveFileServer();

@Component({
    standalone: false,
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent {
    readonly prototypes: PrototypeMeta[] = PROTOTYPES;

    dropState: DropState = 'idle';
    statusMessage = '';
    removingSlug: string | null = null;

    private dragDepth = 0;

    constructor(private readonly router: Router) {}

    navigate(path: string): void {
        this.router.navigate([path]);
    }

    onDragOver(e: DragEvent): void {
        e.preventDefault();
    }

    onDragEnter(e: DragEvent): void {
        e.preventDefault();
        if (++this.dragDepth === 1) this.dropState = 'dragover';
    }

    onDragLeave(): void {
        if (--this.dragDepth === 0 && this.dropState === 'dragover') {
            this.dropState = 'idle';
        }
    }

    async onDrop(e: DragEvent): Promise<void> {
        e.preventDefault();
        this.dragDepth = 0;

        const items = Array.from(e.dataTransfer?.items ?? []);
        if (!items.length) return;

        this.dropState = 'uploading';
        this.statusMessage = 'Uploading…';

        try {
            let needsFinalize = false;

            for (const item of items) {
                const entry = item.webkitGetAsEntry();
                if (!entry) continue;

                if (entry.isDirectory) {
                    await this.uploadDirectory(entry as FileSystemDirectoryEntry);
                    needsFinalize = true; // wiring happens after all files land
                } else {
                    const file = await fileFromEntry(entry as FileSystemFileEntry);
                    if (!file.name.toLowerCase().endsWith('.zip')) {
                        throw new Error(`Drop a .zip file or a directory — "${file.name}" is not supported.`);
                    }
                    await this.uploadZip(file); // server wires synchronously for zips
                }
            }

            // For directory uploads every file is now on disk — wire once, cleanly.
            if (needsFinalize) await this.finalize();

            this.dropState = 'success';
            this.statusMessage = 'Done — prototype wired automatically.';
            setTimeout(() => {
                if (this.dropState === 'success') this.dropState = 'idle';
            }, 3500);
        } catch (err: unknown) {
            this.dropState = 'error';
            this.statusMessage = err instanceof Error ? err.message : 'Upload failed.';
        }
    }

    dismissError(): void {
        this.dropState = 'idle';
        window.location.reload();
    }

    async removePrototype(e: MouseEvent, proto: PrototypeMeta): Promise<void> {
        e.stopPropagation();
        const slug = proto.path.slice(1); // '/login-form' → 'login-form'
        this.removingSlug = slug;

        try {
            let res: Response;
            try {
                res = await fetch(`${FILE_SERVER}/prototype/${encodeURIComponent(slug)}`, { method: 'DELETE' });
            } catch {
                throw new Error('Could not reach the dev file server — is npm start running?');
            }
            if (!res.ok) throw new Error(`Remove failed: ${await res.text()}`);

            // wire-prototypes.js ran synchronously on the server side;
            // ng serve will hot-reload when it sees the updated files.
            // Force a reload after a short delay as a reliable fallback.
            setTimeout(() => window.location.reload(), 2000);
        } catch (err: unknown) {
            this.removingSlug = null;
            this.dropState = 'error';
            this.statusMessage = err instanceof Error ? err.message : 'Remove failed.';
        }
    }

    // ── private ─────────────────────────────────────────────────────────────

    private async finalize(): Promise<void> {
        try {
            await fetch(`${FILE_SERVER}/finalize`, { method: 'POST' });
        } catch {
            // Watcher will catch up on its own; not fatal.
        }
    }

    private async uploadDirectory(dir: FileSystemDirectoryEntry): Promise<void> {
        const entries = await readAllEntries(dir);
        await this.uploadEntries(entries);
    }

    private async uploadEntries(entries: FileSystemEntry[]): Promise<void> {
        for (const entry of entries) {
            if (entry.isFile) {
                const file = await fileFromEntry(entry as FileSystemFileEntry);
                await this.postFile(entry.fullPath.slice(1), file);
            } else if (entry.isDirectory) {
                const sub = await readAllEntries(entry as FileSystemDirectoryEntry);
                await this.uploadEntries(sub);
            }
        }
    }

    private async postFile(relativePath: string, file: File): Promise<void> {
        let res: Response;
        try {
            res = await fetch(`${FILE_SERVER}/upload`, {
                method: 'POST',
                headers: { 'X-File-Path': relativePath },
                body: file,
            });
        } catch {
            throw new Error('Could not reach the dev file server — is npm start running?');
        }
        if (!res.ok) throw new Error(`Failed to write ${relativePath}: ${await res.text()}`);
    }

    private async uploadZip(file: File): Promise<void> {
        const dirName = file.name.replace(/\.zip$/i, '');
        let res: Response;
        try {
            res = await fetch(`${FILE_SERVER}/upload-zip`, {
                method: 'POST',
                headers: { 'X-Dir-Name': dirName },
                body: file,
            });
        } catch {
            throw new Error('Could not reach the dev file server — is npm start running?');
        }
        if (!res.ok) throw new Error(`Failed to extract zip: ${await res.text()}`);
    }
}

// ── file system helpers (module-level, not class members) ───────────────────

function fileFromEntry(entry: FileSystemFileEntry): Promise<File> {
    return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readAllEntries(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
    return new Promise((resolve, reject) => {
        const reader  = dir.createReader();
        const all: FileSystemEntry[] = [];

        const readBatch = () =>
            reader.readEntries(batch => {
                if (!batch.length) { resolve(all); return; }
                all.push(...batch);
                readBatch();
            }, reject);

        readBatch();
    });
}
