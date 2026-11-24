# Contributing to Chop

The root TypeScript package contains the current CLI, development node, OpenTUI interface, and MCP server. Build and test it with Node.js 22, Bun 1.4.1, Anvil 1.5.1, and Python 3. Anvil and Python are used by the end-to-end tests.

```bash
bun install --frozen-lockfile --ignore-scripts
bun run lint
bun run typecheck
bun run test:coverage --maxWorkers=3
bun run test:property
bun run test:e2e
bun run test:bench
bun audit --audit-level=high
```

Place unit and integration specifications next to their TypeScript modules. The property suite in `tests/properties.test.ts` uses generated inputs with reproducible fast-check seeds. The packaged end-to-end suite starts real CLI and MCP processes and deploys a compiled contract to a disposable Anvil instance. A terminal smoke test drives the packaged TUI through regeneration and compilation. Benchmark tests enforce startup, ABI, hashing, local call, and bundle-size budgets.

Update the CLI golden fixtures after intentional changes to help output or formatting.

```bash
bash scripts/update-golden.sh
bash scripts/test-golden.sh
```

Commit `bun.lock` alongside dependency changes. For release artifacts and workflow details, see [Release Guide](./RELEASE_GUIDE.md) and [CI and security](./.github/CICD.md).
