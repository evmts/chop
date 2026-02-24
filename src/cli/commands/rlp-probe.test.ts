import { it } from "@effect/vitest"
import { Effect } from "effect"
import { Hex, Rlp } from "voltaire-effect"

it.effect("probe BrandedRlp structure", () =>
	Effect.gen(function* () {
		const b1 = Hex.toBytes("0x01")
		const b2 = Hex.toBytes("0x02")
		const encoded = yield* Rlp.encode([b1, b2])
		const decoded = yield* Rlp.decode(encoded)
		const data = decoded.data as any
		console.log("type:", typeof data)
		console.log("constructor:", data?.constructor?.name)
		console.log("isArray:", Array.isArray(data))
		console.log("isUint8Array:", data instanceof Uint8Array)
		console.log("keys:", Object.keys(data))
		console.log("has type:", "type" in data)
		if ("type" in data) {
			console.log("type value:", data.type)
			console.log("items:", data.items)
			console.log("items isArray:", Array.isArray(data.items))
			if (data.items) {
				for (const item of data.items) {
					console.log("  item type:", typeof item, "constructor:", item?.constructor?.name)
					console.log("  item keys:", Object.keys(item))
					if ("type" in item) console.log("  item.type:", item.type, "item.value:", item.value)
				}
			}
		}
		try {
			console.log("JSON:", JSON.stringify(data))
		} catch (e) {
			console.log("JSON err:", (e as Error).message)
		}
		console.log("String:", String(data))
	}),
)
