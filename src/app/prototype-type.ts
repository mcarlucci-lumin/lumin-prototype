import { FILE_SERVER } from './file-server';

/**
 * Whether a prototype is a retail or admin design. Stored as `type` in its
 * meta.json; a missing key means retail. Not in the generated registry, so it's
 * read from the dev file server and changing it never rebuilds the bundle.
 */
export type PrototypeType = 'retail' | 'admin';

export const DEFAULT_PROTOTYPE_TYPE: PrototypeType = 'retail';

/** Reads a prototype's type from its meta.json, falling back to the default. */
export async function fetchPrototypeType(slug: string): Promise<PrototypeType> {
    try {
        const res = await fetch(`${FILE_SERVER}/prototype/${encodeURIComponent(slug)}/meta`);
        if (!res.ok) return DEFAULT_PROTOTYPE_TYPE;
        const meta: { type?: string } = await res.json();
        return meta.type === 'admin' || meta.type === 'retail' ? meta.type : DEFAULT_PROTOTYPE_TYPE;
    } catch {
        // File server unreachable — treat as the default.
        return DEFAULT_PROTOTYPE_TYPE;
    }
}
