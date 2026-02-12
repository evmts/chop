import { describe, it } from "vitest"
import { expect } from "vitest"
import { NodeInitError } from "./errors.js"

describe("NodeInitError", () => {
	it("has correct tag", () => {
		const err = new NodeInitError({ message: "failed" })
		expect(err._tag).toBe("NodeInitError")
	})

	it("stores message", () => {
		const err = new NodeInitError({ message: "genesis failed" })
		expect(err.message).toBe("genesis failed")
	})

	it("stores optional cause", () => {
		const cause = new Error("underlying")
		const err = new NodeInitError({ message: "failed", cause })
		expect(err.cause).toBe(cause)
	})
})
