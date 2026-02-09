export default function renderTestCoverage(): string {
  return `TEST COVERAGE — Add comprehensive tests for all implemented code.

STEP 1: Read docs for test requirements:
- docs/engineering.md section 7 (Testing Strategy)
- docs/tasks.md (acceptance criteria — each has specific test expectations)

STEP 2: Assess current coverage:
- Run: bun test --coverage to see current coverage
- Identify files with < 80% coverage
- Identify untested public functions

STEP 3: Add tests for gaps — prioritize:

BOUNDARY CONDITIONS:
- Empty inputs, null/undefined where applicable
- Max values (uint256 max, address max)
- Zero values
- Very long inputs

ERROR CASES:
- Invalid inputs that should produce Data.TaggedError
- Missing dependencies
- Timeout scenarios (where applicable)

EDGE CASES:
- Unicode in string inputs
- Leading zeros in hex
- Checksummed vs. non-checksummed addresses
- BigInt edge cases

INTEGRATION TESTS (if applicable):
- Service A → Service B interaction
- Layer composition with real (not mock) dependencies
- Effect pipeline end-to-end

STEP 4: All test patterns:
- Use @effect/vitest: it.effect() for Effect-returning tests
- Use describe() for grouping
- Use Effect.provide(TestLayer) for DI in tests
- Meaningful assertions (not just "doesn't throw")

STEP 5: Verify:
- Run: bun test — ALL tests pass
- Run: bun test --coverage — target 80%+ per module
- No flaky tests — run twice to confirm

STEP 6: Commit:
- 🧪 test(scope): add comprehensive tests for X
- One commit per logical test group

After adding tests, output:
\`\`\`json
{
  "coveragePercent": 85,
  "testsAdded": 12,
  "summary": "Added 12 tests covering boundary conditions, error cases, and edge cases for shared module...",
  "allPass": true
}
\`\`\``;
}
