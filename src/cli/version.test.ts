import { describe, expect, it } from "vitest"
import { VERSION } from "./version.js"

describe("VERSION", () => {
	it("matches package.json version", () => {
		// VERSION should match the version in package.json (0.1.0 at time of writing)
		expect(VERSION).toBe("0.1.0")
	})

	it("is a valid semver string", () => {
		expect(VERSION).toMatch(/^\d+\.\d+\.\d+/)
	})

	it("is not empty", () => {
		expect(VERSION.length).toBeGreaterThan(0)
	})
})
