# CI/CD Documentation for Chop

This document provides an overview of the CI/CD pipeline configuration for the Chop project.

## Overview

The Chop project uses GitHub Actions for continuous integration and automated releases:

- **CI Pipeline** (`.github/workflows/ci.yml`): Runs on every push and pull request
- **Release Pipeline** (`.github/workflows/release.yml`): Triggers on version tags

## CI Pipeline

### Triggers
- Push to `main` branch
- Pull requests targeting `main` branch

### Jobs

#### 1. Test Job
Runs tests across multiple Go versions and operating systems.

**Matrix:**
- Go versions: 1.22, 1.24
- Operating systems: Ubuntu (Linux), macOS

**Steps:**
1. Checkout code with submodules
2. Set up Go environment with caching
3. Download Go module dependencies
4. Verify `go.mod` and `go.sum` are up to date
5. Run `go vet` to check for common issues
6. Run tests with race detector and coverage
7. Upload coverage reports as artifacts

#### 2. Build Job
Verifies the binary can be built successfully.

**Steps:**
1. Checkout code
2. Set up Go environment
3. Build binary with `CGO_ENABLED=0`
4. Verify binary exists and can be executed
5. Upload binary as artifact

#### 3. Lint Job (Optional)
Runs golangci-lint if `.golangci.yml` exists.

**Note:** Currently set to `continue-on-error: true` to not block CI on linting issues.

## Release Pipeline

### Triggers
Version tags matching pattern `v*.*.*` (e.g., `v0.1.0`, `v1.2.3`)

### Process
1. Checkout code with full history (for changelog generation)
2. Set up Go environment
3. Run GoReleaser to:
   - Build binaries for all platforms and architectures
   - Generate checksums
   - Create GitHub Release with release notes
   - Upload release artifacts

### Supported Platforms
GoReleaser builds binaries for:
- **Linux**: amd64, arm64
- **macOS**: amd64 (Intel), arm64 (Apple Silicon)
- **Windows**: amd64, arm64

### Version Information
Binaries are built with version information injected via ldflags:
- `version`: Git tag (e.g., `v0.1.0`)
- `commit`: Short commit hash
- `date`: Build date
- `builtBy`: Builder name (goreleaser)

View version info with: `chop --version`

## Creating a Release

### Prerequisites
- All changes committed and pushed to `main`
- Tests passing
- Documentation up to date

### Steps

1. **Create a version tag:**
   ```bash
   git tag -a v0.1.0 -m "Release v0.1.0: Initial release"
   ```

2. **Push the tag:**
   ```bash
   git push origin v0.1.0
   ```

3. **Monitor the release:**
   - Go to [Actions](https://github.com/evmts/chop/actions)
   - Watch the "Release" workflow
   - Once complete, check [Releases](https://github.com/evmts/chop/releases)

### Version Numbering (Semantic Versioning)

- **Major (v1.0.0)**: Breaking changes, incompatible API changes
- **Minor (v0.1.0)**: New features, backwards-compatible
- **Patch (v0.0.1)**: Bug fixes, backwards-compatible

## Testing Locally

### Test CI Locally (Docker)
You can use [act](https://github.com/nektos/act) to test GitHub Actions locally:

```bash
brew install act

# Test the CI workflow
act -j test

# Test the build workflow
act -j build
```

### Test Release Process
Use GoReleaser in snapshot mode:

```bash
# Install goreleaser
brew install goreleaser

# Run in snapshot mode (doesn't publish)
goreleaser release --snapshot --clean

# Check built artifacts
ls -la dist/
```

## Troubleshooting

### CI Failures

**Tests fail on specific Go version:**
- Check if dependencies are compatible with that Go version
- Update `go.mod` if necessary

**Build fails:**
- Ensure `CGO_ENABLED=0` is compatible with all dependencies
- Check for platform-specific code

**Lint failures:**
- Run `golangci-lint run` locally
- Fix issues or update `.golangci.yml` configuration

### Release Failures

**GoReleaser fails:**
- Check `.goreleaser.yml` syntax: `goreleaser check`
- Ensure all required files exist (README.md, LICENSE, etc.)
- Verify GitHub token has correct permissions

**Missing platforms:**
- Check `goos` and `goarch` lists in `.goreleaser.yml`
- Verify no platform combinations are in the `ignore` list

**Version not injected:**
- Verify `ldflags` in `.goreleaser.yml` match variable names in `main.go`
- Check that variables are declared as `var` not `const`

## Configuration Files

### `.github/workflows/ci.yml`
Main CI pipeline configuration. Defines jobs for testing and building.

### `.github/workflows/release.yml`
Release automation workflow. Triggers on version tags.

### `.goreleaser.yml`
GoReleaser configuration. Defines build targets, archives, checksums, and release notes.

## Secrets and Permissions

### Required Permissions
- `contents: write` - For creating releases and uploading assets

### GitHub Token
The workflows use `${{ secrets.GITHUB_TOKEN }}`, which is automatically provided by GitHub Actions. No manual configuration needed.

## Monitoring

### CI Status
View CI status at: https://github.com/evmts/chop/actions

### Coverage Reports
Coverage artifacts are uploaded for each test run and retained for 7 days.

### Release Status
View all releases at: https://github.com/evmts/chop/releases

## Future Improvements

Potential enhancements to consider:

1. **Add Windows to test matrix** - Currently only Linux and macOS
2. **Code coverage reporting** - Integrate with Codecov or Coveralls
3. **Security scanning** - Add CodeQL or similar
4. **Performance benchmarks** - Run benchmarks in CI
5. **Docker images** - Build and push Docker images on release
6. **Pre-release tags** - Support alpha/beta releases
7. **Changelog automation** - Generate CHANGELOG.md from commits
8. **Notification on failure** - Slack/Discord notifications

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GoReleaser Documentation](https://goreleaser.com/)
- [Semantic Versioning](https://semver.org/)
- [Go Modules](https://go.dev/blog/using-go-modules)
