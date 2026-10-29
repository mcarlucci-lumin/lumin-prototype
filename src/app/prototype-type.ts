import { FILE_SERVER } from './file-server';

/**
 * Whether a prototype is a retail or admin design. Stored as `type` in its
 * meta.json; a missing key means retail. Neither `type` nor `chrome` is in the
 * generated registry, so both are read from the dev file server and changing
 * them never rebuilds the bundle.
 */
export type PrototypeType = 'retail' | 'admin';

export const DEFAULT_PROTOTYPE_TYPE: PrototypeType = 'retail';

/** The meta.json values the app reads at runtime. */
export interface PrototypeSettings {
    type: PrototypeType;
    /** Raw `chrome` id as written in meta.json (null when absent); the caller checks it against the type. */
    chrome: string | null;
}

/** Reads a prototype's type and chrome from its meta.json, falling back to the defaults. */
export async function fetchPrototypeSettings(slug: string): Promise<PrototypeSettings> {
    const fallback: PrototypeSettings = { type: DEFAULT_PROTOTYPE_TYPE, chrome: null };
    try {
        const res = await fetch(`${FILE_SERVER}/prototype/${encodeURIComponent(slug)}/meta`);
        if (!res.ok) return fallback;
        const meta: { type?: string; chrome?: string } = await res.json();
        return {
            type: meta.type === 'admin' || meta.type === 'retail' ? meta.type : DEFAULT_PROTOTYPE_TYPE,
            chrome: typeof meta.chrome === 'string' && meta.chrome ? meta.chrome : null,
        };
    } catch {
        // File server unreachable — treat as the defaults.
        return fallback;
    }
}

/** Reads a prototype's type from its meta.json, falling back to the default. */
export async function fetchPrototypeType(slug: string): Promise<PrototypeType> {
    return (await fetchPrototypeSettings(slug)).type;
}
