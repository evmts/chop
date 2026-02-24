import { describe, it } from "@effect/vitest"
import { expect } from "vitest"
import { type IntrinsicGasParams, calculateIntrinsicGas } from "./intrinsic-gas.js"
import type { ReleaseSpecShape } from "./release-spec.js"

// ---------------------------------------------------------------------------
// Test release spec configs
// ---------------------------------------------------------------------------

const PRAGUE: ReleaseSpecShape = {
	hardfork: "prague",
	isEip2028Enabled: true,
	isEip2930Enabled: true,
	isEip3860Enabled: true,
	isEip7623Enabled: true,
	isEip7702Enabled: true,
}

const CANCUN: ReleaseSpecShape = {
	hardfork: "cancun",
	isEip2028Enabled: true,
	isEip2930Enabled: true,
	isEip3860Enabled: true,
	isEip7623Enabled: false,
	isEip7702Enabled: false,
}

const FRONTIER: ReleaseSpecShape = {
	hardfork: "frontier",
	isEip2028Enabled: false,
	isEip2930Enabled: false,
	isEip3860Enabled: false,
	isEip7623Enabled: false,
	isEip7702Enabled: false,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateIntrinsicGas", () => {
	// -----------------------------------------------------------------------
	// Base cost: simple transfer (no data, no create)
	// -----------------------------------------------------------------------

	it("simple transfer costs 21000 gas", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array(0),
			isCreate: false,
		}
		expect(calculateIntrinsicGas(params, PRAGUE)).toBe(21000n)
	})

	// -----------------------------------------------------------------------
	// Contract creation adds 32000
	// -----------------------------------------------------------------------

	it("contract creation adds 32000 gas", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array(0),
			isCreate: true,
		}
		// 21000 + 32000 = 53000
		expect(calculateIntrinsicGas(params, PRAGUE)).toBe(53000n)
	})

	// -----------------------------------------------------------------------
	// Calldata costs — zero bytes vs non-zero bytes (EIP-2028)
	// -----------------------------------------------------------------------

	it("charges 4 gas per zero byte (EIP-2028)", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array([0x00, 0x00, 0x00, 0x00]), // 4 zero bytes
			isCreate: false,
		}
		// Use CANCUN to isolate calldata cost (no EIP-7623 floor)
		// 21000 + 4 * 4 = 21016
		expect(calculateIntrinsicGas(params, CANCUN)).toBe(21016n)
	})

	it("charges 16 gas per non-zero byte (EIP-2028)", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array([0x01, 0x02, 0xff]), // 3 non-zero bytes
			isCreate: false,
		}
		// Use CANCUN to isolate calldata cost (no EIP-7623 floor)
		// 21000 + 3 * 16 = 21048
		expect(calculateIntrinsicGas(params, CANCUN)).toBe(21048n)
	})

	it("charges 68 gas per non-zero byte pre-EIP-2028", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array([0x01, 0x02]), // 2 non-zero bytes
			isCreate: false,
		}
		// 21000 + 2 * 68 = 21136
		expect(calculateIntrinsicGas(params, FRONTIER)).toBe(21136n)
	})

	it("handles mixed zero and non-zero bytes", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array([0x00, 0x01, 0x00, 0xff]), // 2 zero + 2 non-zero
			isCreate: false,
		}
		// Use CANCUN to isolate calldata cost (no EIP-7623 floor)
		// 21000 + 2*4 + 2*16 = 21040
		expect(calculateIntrinsicGas(params, CANCUN)).toBe(21040n)
	})

	// -----------------------------------------------------------------------
	// Access list costs (EIP-2930)
	// -----------------------------------------------------------------------

	it("charges 2400 per access list entry + 1900 per storage key", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array(0),
			isCreate: false,
			accessList: [{ address: `0x${"aa".repeat(20)}`, storageKeys: [`0x${"01".repeat(32)}`, `0x${"02".repeat(32)}`] }],
		}
		// 21000 + 2400 + 2*1900 = 27200
		expect(calculateIntrinsicGas(params, PRAGUE)).toBe(27200n)
	})

	it("handles multiple access list entries", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array(0),
			isCreate: false,
			accessList: [
				{ address: `0x${"aa".repeat(20)}`, storageKeys: [`0x${"01".repeat(32)}`] },
				{ address: `0x${"bb".repeat(20)}`, storageKeys: [] },
			],
		}
		// 21000 + 2400 + 1900 + 2400 = 27700
		expect(calculateIntrinsicGas(params, PRAGUE)).toBe(27700n)
	})

	it("ignores access list when EIP-2930 is disabled", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array(0),
			isCreate: false,
			accessList: [{ address: `0x${"aa".repeat(20)}`, storageKeys: [`0x${"01".repeat(32)}`] }],
		}
		// Access list ignored → 21000
		expect(calculateIntrinsicGas(params, FRONTIER)).toBe(21000n)
	})

	// -----------------------------------------------------------------------
	// Initcode word cost (EIP-3860)
	// -----------------------------------------------------------------------

	it("charges 2 gas per 32-byte word of initcode (EIP-3860)", () => {
		// 64 bytes of initcode = 2 words
		const params: IntrinsicGasParams = {
			data: new Uint8Array(64).fill(0x01), // non-zero to keep things clear
			isCreate: true,
		}
		// 21000 + 32000 + 64*16 (calldata) + 2*2 (initcode word cost) = 54028
		expect(calculateIntrinsicGas(params, PRAGUE)).toBe(54028n)
	})

	it("rounds up initcode word cost for partial words", () => {
		// 33 bytes of initcode = ceil(33/32) = 2 words
		const params: IntrinsicGasParams = {
			data: new Uint8Array(33).fill(0x01),
			isCreate: true,
		}
		// 21000 + 32000 + 33*16 (calldata) + 2*2 (initcode) = 53532
		expect(calculateIntrinsicGas(params, PRAGUE)).toBe(53532n)
	})

	it("does not charge initcode word cost when EIP-3860 is disabled", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array(64).fill(0x01),
			isCreate: true,
		}
		// 21000 + 32000 + 64*68 (pre-EIP-2028 calldata) = 57352
		expect(calculateIntrinsicGas(params, FRONTIER)).toBe(57352n)
	})

	// -----------------------------------------------------------------------
	// EIP-7623 floor cost
	// -----------------------------------------------------------------------

	it("applies EIP-7623 floor cost when it exceeds standard cost", () => {
		// EIP-7623 floor = 21000 + 10 * total_calldata_cost
		// For 100 zero bytes: standard calldata cost = 100*4 = 400, floor = 21000 + 10*400 = 25000
		// Standard = 21000 + 400 = 21400
		// Floor (25000) > standard (21400), so floor applies
		const params: IntrinsicGasParams = {
			data: new Uint8Array(100), // all zero bytes
			isCreate: false,
		}
		// Standard: 21000 + 100*4 = 21400
		// Floor: 21000 + 10 * 100*4 = 25000
		// max(21400, 25000) = 25000
		expect(calculateIntrinsicGas(params, PRAGUE)).toBe(25000n)
	})

	it("does not apply EIP-7623 floor when standard is higher", () => {
		// Small calldata — standard cost already exceeds floor
		const params: IntrinsicGasParams = {
			data: new Uint8Array([0xff]), // 1 non-zero byte
			isCreate: false,
		}
		// Standard: 21000 + 16 = 21016
		// Floor: 21000 + 10*16 = 21160
		// max(21016, 21160) = 21160
		expect(calculateIntrinsicGas(params, PRAGUE)).toBe(21160n)
	})

	it("does not apply EIP-7623 floor when disabled", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array(100), // all zero bytes
			isCreate: false,
		}
		// Standard: 21000 + 100*4 = 21400 (no floor applied)
		expect(calculateIntrinsicGas(params, CANCUN)).toBe(21400n)
	})

	// -----------------------------------------------------------------------
	// EIP-7702 authorization cost
	// -----------------------------------------------------------------------

	it("charges 12500 per authorization tuple (EIP-7702)", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array(0),
			isCreate: false,
			authorizationCount: 2,
		}
		// 21000 + 2 * 12500 = 46000
		expect(calculateIntrinsicGas(params, PRAGUE)).toBe(46000n)
	})

	it("ignores authorization count when EIP-7702 is disabled", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array(0),
			isCreate: false,
			authorizationCount: 2,
		}
		// EIP-7702 disabled → 21000
		expect(calculateIntrinsicGas(params, CANCUN)).toBe(21000n)
	})

	// -----------------------------------------------------------------------
	// Combined scenario
	// -----------------------------------------------------------------------

	it("handles combined create + data + access list + authorization", () => {
		const params: IntrinsicGasParams = {
			data: new Uint8Array([0x00, 0x01]), // 1 zero + 1 non-zero
			isCreate: true,
			accessList: [{ address: `0x${"aa".repeat(20)}`, storageKeys: [`0x${"01".repeat(32)}`] }],
			authorizationCount: 1,
		}
		// Base: 21000
		// Create: 32000
		// Calldata: 1*4 + 1*16 = 20
		// Access list: 2400 + 1900 = 4300
		// Initcode (EIP-3860): ceil(2/32) * 2 = 1*2 = 2
		// Authorization (EIP-7702): 1 * 12500 = 12500
		// Standard: 21000 + 32000 + 20 + 4300 + 2 + 12500 = 69822
		// Floor (EIP-7623): 21000 + 10 * 20 = 21200
		// max(69822, 21200) = 69822
		expect(calculateIntrinsicGas(params, PRAGUE)).toBe(69822n)
	})
})
