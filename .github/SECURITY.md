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

## Security Scanning

This project uses multiple automated security scanning tools:

### 1. Gosec (Static Security Analysis)

Gosec scans the codebase for common security issues including:
- **G101**: Hardcoded credentials
- **G102**: Binding to all network interfaces
- **G103**: Unsafe block usage
- **G104**: Unhandled errors that could lead to security issues
- **G201-G202**: SQL injection vulnerabilities
- **G301-G304**: File permission and path traversal issues
- **G401-G404**: Weak cryptographic practices
- **G501-G505**: Crypto implementation issues

Results are uploaded to GitHub Security tab as SARIF files.

Configuration: `.gosec.yml`

### 2. Govulncheck (Dependency Vulnerabilities)

Govulncheck scans all dependencies (direct and indirect) against the official Go vulnerability database for known CVEs.

Runs on:
- Every push to main
- Every pull request
- Weekly scheduled scans

### 3. Dependency Review

On pull requests, the dependency-review action:
- Checks for new vulnerabilities in dependencies
- Flags dependencies with invalid licenses
- Fails builds on high/critical severity issues

### 4. Dependabot

Automated dependency updates run weekly to:
- Update Go modules with security patches
- Update GitHub Actions to latest versions
- Create pull requests for review

Configuration: `.github/dependabot.yml`

## Security Workflow

The security workflow (`.github/workflows/security.yml`) runs:
- On every push to main
- On every pull request
- Weekly on Monday at 00:00 UTC (scheduled)

## Running Security Scans Locally

### Gosec

```bash
# Install
go install github.com/securego/gosec/v2/cmd/gosec@latest

# Run scan
gosec ./...

# Generate detailed report
gosec -fmt=json -out=security-report.json ./...
```

### Govulncheck

```bash
# Install
go install golang.org/x/vuln/cmd/govulncheck@latest

# Run scan
govulncheck ./...
```

## Security Best Practices

When contributing to this project:

1. **Never commit secrets**: Use environment variables or secure secret management
2. **Validate all input**: Especially from external sources
3. **Use secure defaults**: File permissions should be 0600 or more restrictive
4. **Handle errors**: All errors should be checked, especially in security-critical code
5. **Use crypto/rand**: Never use math/rand for security-related randomness
6. **Keep dependencies updated**: Regularly update to get security patches

## Current Security Status

As of the last scan:
- **Gosec findings**: 13 issues (10 in cgo build cache, 3 in codebase)
  - 10x G115: Integer overflow conversions (mostly in generated cgo code)
  - 1x G304: File inclusion via variable (state.go)
  - 1x G306: File permissions less restrictive than 0600
  - 1x G104: Unhandled error

- **Govulncheck**: No vulnerabilities found in dependencies

### Known Issues and Mitigations

1. **G304 (File inclusion)**: The `LoadStateFile` function accepts a file path parameter. This is by design for state management, but users should ensure they only pass trusted paths.

2. **G306 (File permissions)**: State files use 0644 permissions for user convenience. This is acceptable for non-sensitive data but should be evaluated if storing sensitive information.

3. **G115 (Integer conversions)**: Most integer overflow warnings are in cgo-generated code from the EVM integration. These require careful review during EVM integration.

## Security Tools Integration

Security scan results are integrated with GitHub:
- **Security tab**: View gosec findings as SARIF reports
- **Pull request checks**: Security scans must pass before merge
- **Dependabot alerts**: Automatic notifications for vulnerable dependencies

## License Compliance

The project enforces license compliance through Dependabot:
- Denied licenses: GPL-3.0, AGPL-3.0
- Pull requests introducing restricted licenses will fail CI

## Contact

For security concerns, please contact the maintainers through GitHub or the repository's contact methods.
