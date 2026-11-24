# Security Policy

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| latest release | :white_check_mark: |
| < latest | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it by emailing the maintainers. **Do not open a public GitHub issue.**

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to respond to security reports within 48 hours.

## Security checks

The [Security workflow](./workflows/security.yml) runs a Bun lockfile audit and TypeScript CodeQL analysis on main pushes, pull requests, and weekly. The audit fails on high and critical advisories. CodeQL findings appear in the repository's Security tab. Dependabot checks Bun packages and GitHub Actions for updates.

Run the dependency audit locally with `bun audit --audit-level=high`.

## Development keys

Chop's default accounts use publicly known development keys. The development RPC binds to loopback by default and rejects browser-originated requests. Use a dedicated local Anvil instance for compiler deployment tests.
