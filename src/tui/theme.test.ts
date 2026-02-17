import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { DRACULA, SEMANTIC } from "./theme.js"

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

describe("theme", () => {
	describe("DRACULA palette", () => {
		it.effect("has all expected color keys", () =>
			Effect.sync(() => {
				const expectedKeys = [
					"background",
					"currentLine",
					"foreground",
					"comment",
					"cyan",
					"green",
					"orange",
					"pink",
					"purple",
					"red",
					"yellow",
				]
				for (const key of expectedKeys) {
					expect(DRACULA).toHaveProperty(key)
				}
			}),
		)

		it.effect("all colors are valid 7-char hex strings (#RRGGBB)", () =>
			Effect.sync(() => {
				for (const [key, value] of Object.entries(DRACULA)) {
					expect(value, `DRACULA.${key} should be a valid hex color`).toMatch(HEX_COLOR_RE)
				}
			}),
		)

		it.effect("has exactly 11 colors", () =>
			Effect.sync(() => {
				expect(Object.keys(DRACULA)).toHaveLength(11)
			}),
		)
	})

	describe("SEMANTIC palette", () => {
		it.effect("has all expected semantic keys", () =>
			Effect.sync(() => {
				const expectedKeys = [
					"primary",
					"secondary",
					"success",
					"error",
					"warning",
					"muted",
					"text",
					"bg",
					"bgHighlight",
					"address",
					"hash",
					"value",
					"gas",
				]
				for (const key of expectedKeys) {
					expect(SEMANTIC).toHaveProperty(key)
				}
			}),
		)

		it.effect("all values reference DRACULA palette values", () =>
			Effect.sync(() => {
				const draculaValues = new Set(Object.values(DRACULA))
				for (const [key, value] of Object.entries(SEMANTIC)) {
					expect(draculaValues.has(value), `SEMANTIC.${key} = "${value}" should be a DRACULA color`).toBe(true)
				}
			}),
		)

		it.effect("all values are valid hex colors", () =>
			Effect.sync(() => {
				for (const [key, value] of Object.entries(SEMANTIC)) {
					expect(value, `SEMANTIC.${key} should be a valid hex color`).toMatch(HEX_COLOR_RE)
				}
			}),
		)
	})
})
