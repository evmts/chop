# CI and security

CI runs on main pushes, pull requests, and manual dispatch. The Ubuntu and macOS 15 jobs use Node.js 22, Bun 1.4.1, Anvil 1.5.1, and the frozen lockfile. They check lint and types, unit/integration coverage, generated properties, CLI and MCP end-to-end behavior, deployment to Anvil, benchmark budgets, and an audit of the dependencies in a fresh package installation. Each job uploads LCOV coverage.

Security runs on pushes, pull requests, weekly, and on demand. Bun audits the dependency graph at high and critical severity, and CodeQL scans TypeScript source.

See [Contributing](../CONTRIBUTING.md) for equivalent local checks and the [Release Guide](../RELEASE_GUIDE.md) for version tags and assets.
