# Quick Release Guide

This is a quick reference for maintainers creating releases of the Chop project.

## TL;DR - Creating a Release

```bash
# 1. Ensure you're on main with latest changes
git checkout main
git pull origin main

# 2. Create and push a version tag
git tag -a v0.1.0 -m "Release v0.1.0: Initial public release"
git push origin v0.1.0

# 3. Watch the release workflow
# Visit: https://github.com/evmts/chop/actions

# 4. Release is live!
# Visit: https://github.com/evmts/chop/releases
```

That's it! GitHub Actions will automatically:
- Run all tests
- Build binaries for Linux, macOS, Windows (amd64 + arm64)
- Generate checksums
- Create a GitHub Release with release notes
- Upload all artifacts

## Pre-Release Checklist

Before creating a release tag, verify:

- [ ] All tests pass: `go test ./...`
- [ ] Binary builds: `CGO_ENABLED=0 go build -o chop .`
- [ ] Documentation is up to date (README.md)
- [ ] Commit messages follow conventional format (for good release notes)
- [ ] No uncommitted changes: `git status`

## Version Numbers

Follow [Semantic Versioning](https://semver.org/):

- **v1.0.0** - Major: Breaking changes, incompatible API changes
- **v0.1.0** - Minor: New features, backwards-compatible
- **v0.0.1** - Patch: Bug fixes, backwards-compatible

## Example Tag Messages

```bash
# Feature release
git tag -a v0.1.0 -m "Release v0.1.0: Add interactive TUI and state persistence"

# Bug fix release
git tag -a v0.1.1 -m "Release v0.1.1: Fix clipboard support on Linux"

# Major release
git tag -a v1.0.0 -m "Release v1.0.0: First stable release with full EVM support"
```

## Testing Before Release

Test the release process locally without publishing:

```bash
# Install goreleaser (if not already installed)
brew install goreleaser

# Run in snapshot mode (doesn't publish)
goreleaser release --snapshot --clean

# Check the built artifacts
ls -la dist/

# Test the binary
./dist/chop_darwin_amd64_v1/chop --version
```

## What Gets Built

Each release includes binaries for:

| Platform | Architecture | Binary Name |
|----------|-------------|-------------|
| Linux | amd64 | chop_VERSION_linux_amd64.tar.gz |
| Linux | arm64 | chop_VERSION_linux_arm64.tar.gz |
| macOS | amd64 (Intel) | chop_VERSION_darwin_amd64.tar.gz |
| macOS | arm64 (Apple Silicon) | chop_VERSION_darwin_arm64.tar.gz |
| Windows | amd64 | chop_VERSION_windows_amd64.zip |
| Windows | arm64 | chop_VERSION_windows_arm64.zip |

Plus a `checksums.txt` file with SHA256 checksums for verification.

## Troubleshooting

### "Tests are failing"
- Fix the tests before releasing
- CI will block the release if tests fail

### "Build is failing"
- Check that `CGO_ENABLED=0 go build -o chop .` works locally
- Verify all dependencies are in `go.mod`

### "Release workflow failed"
- Check the [Actions tab](https://github.com/evmts/chop/actions)
- View the workflow logs for error details
- Common issues:
  - `.goreleaser.yml` syntax error: Run `goreleaser check`
  - Missing files referenced in config
  - GitHub token permissions issue

### "Need to delete a release"
```bash
# Delete the GitHub release (via web UI or gh CLI)
gh release delete v0.1.0

# Delete the local tag
git tag -d v0.1.0

# Delete the remote tag
git push --delete origin v0.1.0

# Now you can create the tag again
```

## After Release

1. **Verify the release** - Check the [Releases page](https://github.com/evmts/chop/releases)
2. **Test a download** - Download a binary and verify it works
3. **Update documentation** - If needed, update installation instructions
4. **Announce** - Share the release on social media, Discord, etc.

## Getting Help

- Full CI/CD documentation: See `.github/CICD.md`
- GoReleaser docs: https://goreleaser.com/
- GitHub Actions docs: https://docs.github.com/en/actions

## Useful Commands

```bash
# View recent tags
git tag -l | tail -5

# View tag details
git show v0.1.0

# List releases (requires gh CLI)
gh release list

# View release details
gh release view v0.1.0
```
