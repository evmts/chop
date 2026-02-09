#!/usr/bin/env node
import { NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"

const program = Effect.gen(function* () {
	yield* Effect.log("chop - Ethereum Swiss Army knife")
	yield* Effect.log("Run with --help for usage")
})

NodeRuntime.runMain(program)
