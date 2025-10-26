# Guillotine Integration Notes

## Current Status

The Go bindings have been created but require a **native shared library** to work with CGO. Currently, guillotine-mini only builds as WASM.

**Working Solution:** The package includes stub implementations that allow building and testing without the native library. Build with `CGO_ENABLED=0` to use the stubs. Integration tests are tagged with `//go:build integration` and can be run once the native library is available.

## Two Integration Approaches

### Approach 1: WASM Runtime (Recommended for Now)

Use a WASM runtime like [wazero](https://wazero.io/) to run the guillotine WASM directly from Go.

**Pros:**
- Works with existing WASM build
- No CGO complexity
- Cross-platform (pure Go)
- Well-isolated execution

**Cons:**
- Requires WASM runtime dependency
- Slightly more overhead than CGO

**Implementation:**
```go
import "github.com/tetratelabs/wazero"

// Load and instantiate WASM module
wasmBytes, _ := os.ReadFile("lib/guillotine-mini/zig-out/bin/guillotine_mini.wasm")
runtime := wazero.NewRuntime(ctx)
defer runtime.Close(ctx)

module, _ := runtime.InstantiateWithConfig(ctx, wasmBytes, wazero.NewModuleConfig())

// Call exported functions
evmCreate := module.ExportedFunction("evm_create")
result, _ := evmCreate.Call(ctx, ...)
```

### Approach 2: Native Shared Library (Future)

Build guillotine-mini as a native `.so`/`.dylib`/`.dll` for CGO linking.

**Requirements:**
- Modify `lib/guillotine-mini/build.zig` to add a native library target
- Build as `addSharedLibrary()` instead of WASM
- Link crypto libraries (BLST, C-KZG, BN254) for native target

**Pros:**
- Direct FFI, minimal overhead
- CGO bindings already written

**Cons:**
- Requires modifying submodule build
- Platform-specific builds
- CGO portability issues

## Recommended Path Forward

### Option A: Use WASM Runtime (Quickest)

1. Add wazero dependency:
   ```bash
   go get github.com/tetratelabs/wazero
   ```

2. Create WASM wrapper in `internal/guillotine/wasm.go`:
   ```go
   package guillotine

   import (
       "context"
       "github.com/tetratelabs/wazero"
   )

   type WASMEngine struct {
       runtime wazero.Runtime
       module  wazero.Module
   }

   func NewWASMEngine(ctx context.Context, wasmPath string) (*WASMEngine, error) {
       // Load WASM, instantiate module
       // Wrap exported functions
   }
   ```

3. Use existing high-level `EVM` API with WASM backend

### Option B: Fork & Build Native Library

1. Fork guillotine-mini or add native build target
2. Create `lib/guillotine-mini/build.zig` addition:
   ```zig
   // Native C library for CGO
   const native_lib = b.addSharedLibrary(.{
       .name = "guillotine",
       .root_module = b.createModule(.{
           .root_source_file = b.path("src/root_c.zig"),
           .target = target,
           .optimize = optimize,
       }),
   });

   // Link crypto libs
   native_lib.root_module.linkLibrary(blst_lib);
   native_lib.root_module.linkLibrary(c_kzg_lib);
   if (bn254_lib) |lib| {
       native_lib.root_module.linkLibrary(lib);
   }

   b.installArtifact(native_lib);

   const native_step = b.step("native", "Build native shared library");
   native_step.dependOn(&native_lib.step);
   ```

3. Build: `cd lib/guillotine-mini && zig build native`
4. Update `bindings.go` LDFLAGS to link against `.so`/`.dylib`

## Current File Status

### ✅ Complete
- `bindings.go` - CGO bindings (ready for native library)
- `evm.go` - High-level Go wrapper
- `types.go` - Address, U256, helper functions
- `examples_test.go` - Usage examples
- `README.md` - Documentation

### ⏸️ Blocked (Awaiting Native Library)
- Cannot compile Go code with CGO until native library exists
- LDFLAGS currently point to non-existent `.so` file

### 🔧 Next Steps

1. **Decision**: Choose WASM runtime (Option A) or native library (Option B)

2. **If WASM (recommended)**:
   - Add wazero dependency
   - Create `wasm.go` wrapper
   - Update examples to use WASM backend
   - Test with existing WASM build

3. **If Native**:
   - Add native build target to guillotine-mini
   - Test native build on macOS/Linux/Windows
   - Verify CGO bindings work
   - Update build system integration

## Building and Testing

### Building Without Native Library

The package includes stub implementations for development without the native library:

```bash
# Build with stub implementations (no CGO required)
CGO_ENABLED=0 go build ./...

# Run tests with stub implementations
CGO_ENABLED=0 go test ./...
```

The stubs are defined in `bindings_stub.go` with the build tag `// +build !cgo`.

### Building With Native Library

Once the native library is available:

```bash
# Build with CGO enabled (default)
go build ./...

# Run integration tests
go test -tags=integration ./evm/...
```

### Why Two Build Modes?

- **Stub mode (CGO_ENABLED=0)**: For development and CI without native dependencies
- **Native mode (CGO_ENABLED=1)**: For actual EVM execution with the guillotine-mini library
- **Integration tests**: Tagged separately to run only when native library is available

## Resources

- [Wazero Go WASM Runtime](https://github.com/tetratelabs/wazero)
- [Guillotine-mini](https://github.com/evmts/guillotine-mini)
- [Zig Shared Libraries](https://ziglang.org/documentation/master/#Shared-Libraries)
- [CGO Documentation](https://pkg.go.dev/cmd/cgo)

## Questions?

- **Q**: Why not use wasmer-go or wasmtime-go?
  **A**: Wazero is pure Go (no CGO), simpler deployment

- **Q**: What's the performance difference?
  **A**: WASM overhead ~10-20%, negligible for EVM workloads

- **Q**: Can we use both?
  **A**: Yes! WASM for dev/testing, native for production

- **Q**: Which does REVM use?
  **A**: REVM is Rust with native FFI bindings (like our Option B)
