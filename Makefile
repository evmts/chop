.PHONY: build build-cgo run test clean help

# Default build without CGo (doesn't require guillotine-mini library)
build:
	CGO_ENABLED=0 go build -o chop .

# Build with CGo (requires guillotine-mini library to be built)
build-cgo:
	go build -o chop .

# Run without CGo
run:
	CGO_ENABLED=0 go run .

# Run TUI
tui:
	CGO_ENABLED=0 go run .

# Run tests
test:
	CGO_ENABLED=0 go test ./...

# Clean build artifacts
clean:
	rm -f chop
	rm -rf zig-out zig-cache

help:
	@echo "Available targets:"
	@echo "  build      - Build without CGo (default, no library needed)"
	@echo "  build-cgo  - Build with CGo (requires guillotine-mini library)"
	@echo "  run        - Run without CGo"
	@echo "  tui        - Launch TUI interface"
	@echo "  test       - Run tests"
	@echo "  clean      - Remove build artifacts"
	@echo ""
	@echo "Example usage:"
	@echo "  make build"
	@echo "  ./chop call"
	@echo "  make run -- call --bytecode 0x60806040"
