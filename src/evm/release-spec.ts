import { Context, Layer } from "effect"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Hardfork feature flags — used by transaction processing and gas calculation. */
export interface ReleaseSpecShape {
	/** Hardfork name (e.g. "prague", "cancun", "shanghai"). */
	readonly hardfork: string
	/** EIP-2028: Calldata gas reduction (16→4 gas per non-zero byte). */
	readonly isEip2028Enabled: boolean
	/** EIP-2930: Optional access lists. */
	readonly isEip2930Enabled: boolean
	/** EIP-3860: Initcode size limit (49152 bytes). */
	readonly isEip3860Enabled: boolean
	/** EIP-7623: Floor calldata cost. */
	readonly isEip7623Enabled: boolean
	/** EIP-7702: Account code delegation (set EOA code). */
	readonly isEip7702Enabled: boolean
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/** Context tag for the ReleaseSpec service. */
export class ReleaseSpecService extends Context.Tag("ReleaseSpec")<ReleaseSpecService, ReleaseSpecShape>() {}

// ---------------------------------------------------------------------------
// Hardfork configurations
// ---------------------------------------------------------------------------

const PRAGUE: ReleaseSpecShape = {
	hardfork: "prague",
	isEip2028Enabled: true,
	isEip2930Enabled: true,
	isEip3860Enabled: true,
	isEip7623Enabled: true,
	isEip7702Enabled: true,
}

const HARDFORK_CONFIGS: Record<string, ReleaseSpecShape> = {
	prague: {
		hardfork: "prague",
		isEip2028Enabled: true,
		isEip2930Enabled: true,
		isEip3860Enabled: true,
		isEip7623Enabled: true,
		isEip7702Enabled: true,
	},
	cancun: {
		hardfork: "cancun",
		isEip2028Enabled: true,
		isEip2930Enabled: true,
		isEip3860Enabled: true,
		isEip7623Enabled: false,
		isEip7702Enabled: false,
	},
	shanghai: {
		hardfork: "shanghai",
		isEip2028Enabled: true,
		isEip2930Enabled: true,
		isEip3860Enabled: true,
		isEip7623Enabled: false,
		isEip7702Enabled: false,
	},
}

// ---------------------------------------------------------------------------
// Layer — factory function
// ---------------------------------------------------------------------------

/**
 * Create a ReleaseSpec layer for a given hardfork.
 * Defaults to "prague". Unknown hardforks fall back to "prague".
 */
export const ReleaseSpecLive = (hardfork = "prague"): Layer.Layer<ReleaseSpecService> =>
	Layer.succeed(ReleaseSpecService, HARDFORK_CONFIGS[hardfork] ?? PRAGUE)
