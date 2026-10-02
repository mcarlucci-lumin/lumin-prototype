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

/** Base URL for the dev-file-server, resolved once per page load. */
export const FILE_SERVER = resolveFileServer();
