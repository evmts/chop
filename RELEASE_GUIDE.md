# Release Guide

Chop builds an npm-compatible archive named `tevm-chop-<version>.tgz`. The archive contains `chop`, `chop-mcp`, TypeScript declarations, and the bundled compiler and CLI parser with their patched runtime dependencies.

```bash
bun install --frozen-lockfile --ignore-scripts
bun run test:e2e
bun run build
npm pack --ignore-scripts
```

After CI and Security pass on the release commit, tag it with `v<version>`, matching `package.json`. The Release workflow builds the archive, audits a fresh installation at high and critical severity, and attaches it to a GitHub release with generated notes. npm publication is a separate operation requiring access to the `@tevm` scope.

Install a release archive with `npm install -g ./tevm-chop-<version>.tgz`.
