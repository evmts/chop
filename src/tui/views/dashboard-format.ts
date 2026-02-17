/**
 * Pure formatting utilities for dashboard data display.
 *
 * No OpenTUI or Effect dependencies — all functions are pure and synchronous.
 */

// ---------------------------------------------------------------------------
// Address / Hash truncation
// ---------------------------------------------------------------------------

/**
 * Truncate a hex address to "0xABCD...1234" format.
 * Returns short strings unchanged.
 */
export const truncateAddress = (addr: string): string => {
	if (addr.length <= 10) return addr
	return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/**
 * Truncate a hex hash to "0xabcd...ef01" format.
 * Returns short strings unchanged.
 */
export const truncateHash = (hash: string): string => {
	if (hash.length <= 14) return hash
	return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

// ---------------------------------------------------------------------------
// Number formatting (locale-independent)
// ---------------------------------------------------------------------------

/** Add commas as thousands separators (locale-independent). */
const addCommas = (n: bigint): string => {
	const s = n.toString()
	const chars: string[] = []
	for (let i = 0; i < s.length; i++) {
		if (i > 0 && (s.length - i) % 3 === 0) chars.push(",")
		chars.push(s[i]!)
	}
	return chars.join("")
}

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

/** Format a bigint wei value as ETH, gwei, or wei with appropriate units. */
export const formatWei = (wei: bigint): string => {
	if (wei === 0n) return "0 ETH"

	const ETH = 10n ** 18n
	const GWEI = 10n ** 9n

	// ETH range (>= 0.01 ETH)
	if (wei >= ETH / 100n) {
		const whole = wei / ETH
		const fractional = ((wei % ETH) * 100n) / ETH
		return `${addCommas(whole)}.${fractional.toString().padStart(2, "0")} ETH`
	}

	// Gwei range (>= 1 gwei)
	if (wei >= GWEI) {
		const whole = wei / GWEI
		const fractional = ((wei % GWEI) * 100n) / GWEI
		return `${addCommas(whole)}.${fractional.toString().padStart(2, "0")} gwei`
	}

	// Wei
	return `${addCommas(wei)} wei`
}

// ---------------------------------------------------------------------------
// Gas formatting
// ---------------------------------------------------------------------------

/** Format gas as human-readable (0, 21K, 1.2M). */
export const formatGas = (gas: bigint): string => {
	if (gas === 0n) return "0"
	if (gas < 1_000n) return gas.toString()
	if (gas < 1_000_000n) {
		const whole = gas / 1_000n
		const frac = (gas % 1_000n) / 100n
		return `${whole}.${frac}K`
	}
	const whole = gas / 1_000_000n
	const frac = (gas % 1_000_000n) / 100_000n
	return `${whole}.${frac}M`
}

// ---------------------------------------------------------------------------
// Timestamp formatting
// ---------------------------------------------------------------------------

/** Format a Unix timestamp as relative time ("5s ago", "2m ago", "1h ago"). */
export const formatTimestamp = (ts: bigint): string => {
	const now = BigInt(Math.floor(Date.now() / 1000))
	const diff = now - ts
	if (diff < 0n) return "just now"
	if (diff < 60n) return `${diff}s ago`
	if (diff < 3600n) return `${diff / 60n}m ago`
	if (diff < 86400n) return `${diff / 3600n}h ago`
	return `${diff / 86400n}d ago`
}
