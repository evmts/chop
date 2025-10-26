# Differential Testing with Ethereum Execution Specs

This package implements differential testing for the Chop EVM debugger against the official Ethereum execution-spec-tests.

## Overview

The differential testing system allows you to:

1. **Test against official Ethereum specs**: Run test fixtures from the [ethereum/execution-spec-tests](https://github.com/ethereum/execution-spec-tests) repository
2. **Compare execution results**: Validate that Chop's EVM implementation matches expected behavior
3. **Identify divergences**: Get detailed reports when behavior differs from specs

## Architecture

### Core Components

```
diff/
├── engine.go       # Test execution engine
├── specs.go        # Fixture loading and discovery
├── parsers.go      # Hex parsing utilities
├── report.go       # Divergence reporting
└── README.md       # This file

types/
└── spec_fixture.go # Ethereum spec fixture data structures
```

### Data Flow

```
1. Load fixture JSON → Parse into SpecFixture structs
2. Setup EVM state → Pre-state, block context, transaction
3. Execute transaction → Run EVM with configured parameters
4. Compare results → Check success, gas, return data, post-state
5. Report divergence → Print detailed failure information
```

## Usage

### Test a Single Fixture

```bash
# Test a specific fixture file
chop diff --fixture path/to/fixture.json

# Verbose output
chop diff --fixture path/to/fixture.json --verbose

# Test specific fork
chop diff --fixture path/to/fixture.json --fork Cancun
```

### Test a Category

```bash
# Test all fixtures in a category
chop diff --category homestead/coverage

# Verbose output
chop diff --category homestead/coverage --verbose
```

### Configuration

The system looks for fixtures in the following order:

1. `CHOP_FIXTURES_DIR` environment variable
2. `guillotine/test/official/fixtures` (relative to working directory)
3. `/Users/williamcory/chop/guillotine/test/official/fixtures` (absolute path)
4. `~/.chop/fixtures` (user directory)

Set the environment variable to use a custom location:

```bash
export CHOP_FIXTURES_DIR=/path/to/execution-spec-tests/fixtures
chop diff --category homestead/coverage
```

## Test Results

### Output Format

```
Running X fixture(s) in category 'category-name'...

Loaded Y test case(s) from fixture.json

.........  # Dots for passing tests (non-verbose mode)

FAIL: test-name
  Divergence in: field-name
  Expected: expected-value
  Actual:   actual-value
  Context: additional-context

==================================================
Results: X/Y passed (Z failed)
Pass rate: W%
==================================================
```

### Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed

## Implementation Details

### Fixture Format

The system supports the official Ethereum execution-spec-tests fixture format:

```json
{
  "test-name": {
    "env": {
      "currentCoinbase": "0x...",
      "currentGasLimit": "0x...",
      "currentNumber": "0x...",
      "currentTimestamp": "0x...",
      "currentDifficulty": "0x...",
      "currentBaseFee": "0x...",
      "currentRandom": "0x..."
    },
    "pre": {
      "0xaddress": {
        "balance": "0x...",
        "code": "0x...",
        "nonce": "0x...",
        "storage": {
          "0xslot": "0xvalue"
        }
      }
    },
    "transaction": {
      "data": ["0x..."],
      "gasLimit": ["0x..."],
      "gasPrice": "0x...",
      "nonce": "0x...",
      "to": "0x...",
      "value": ["0x..."],
      "sender": "0x..."
    },
    "post": {
      "ForkName": [
        {
          "hash": "0x...",
          "logs": "0x...",
          "indexes": {
            "data": 0,
            "gas": 0,
            "value": 0
          },
          "state": {
            "0xaddress": {
              "balance": "0x...",
              "code": "0x...",
              "nonce": "0x...",
              "storage": {}
            }
          }
        }
      ]
    }
  }
}
```

### Fork Mapping

The system automatically maps Ethereum fork names to Chop's hardfork identifiers:

- Cancun → cancun
- Shanghai → shanghai
- Paris/Merge → paris
- London → london
- Berlin → berlin
- Istanbul → istanbul
- Petersburg/ConstantinopleFix → petersburg
- Constantinople → constantinople
- Byzantium → byzantium
- SpuriousDragon → spuriousdragon
- TangerineWhistle → tangerinewhistle
- Homestead → homestead
- Frontier → frontier

### Transaction Variants

Fixtures often include multiple transaction variants (different data, gas limits, or values). The system uses the `indexes` field in the post-state to select the correct variant:

```json
"indexes": {
  "data": 0,    // Use transaction.data[0]
  "gas": 0,     // Use transaction.gasLimit[0]
  "value": 0    // Use transaction.value[0]
}
```

### Pre-State Setup

The system configures the EVM with:

1. **Account balances**: Set initial ETH balances
2. **Contract code**: Deploy contract bytecode
3. **Storage slots**: Initialize contract storage
4. **Nonces**: Account nonces (not yet supported by EVM API)

### Block Context

The system configures blockchain environment:

1. **Chain ID**: Network identifier
2. **Block number**: Current block height
3. **Block timestamp**: Current block time
4. **Difficulty**: Block difficulty (pre-merge)
5. **Prevrandao**: Random value (post-merge)
6. **Coinbase**: Miner address
7. **Gas limit**: Block gas limit
8. **Base fee**: EIP-1559 base fee per gas

### Execution

The system executes transactions in two modes:

1. **Contract Call**: Calls existing contract at address
2. **Contract Creation**: Deploys new contract (when `to` is empty)

### Result Validation

The system validates:

1. **Success**: Transaction succeeded or reverted as expected
2. **Gas Used**: Amount of gas consumed
3. **Return Data**: Output bytes from execution
4. **Post-State**: Account balances, code, storage (MVP: basic validation)

## Current Status

### ✅ Implemented

- [x] Fixture loading from JSON files
- [x] Category-based test discovery
- [x] Pre-state setup (balance, code, storage)
- [x] Block context configuration
- [x] Transaction execution (calls and creation)
- [x] Success/failure validation
- [x] Gas usage tracking
- [x] Return data capture
- [x] Fork-specific testing
- [x] Divergence reporting
- [x] Verbose and compact output modes

### 🚧 Limitations

- ⚠️ **Nonce not settable**: EVM API doesn't expose SetNonce
- ⚠️ **Post-state validation**: Basic implementation, needs enhancement
- ⚠️ **Blob gas**: EIP-4844 blob base fee calculation not implemented
- ⚠️ **Assembly code**: Tests with assembly syntax (`:asm`) are skipped
- ⚠️ **State root**: Not validated against expected hash

### 📋 Future Work

1. **Complete post-state validation**: Validate all account states, storage, logs
2. **State root hashing**: Implement Merkle Patricia Trie for state root validation
3. **Nonce support**: Add SetNonce to EVM API
4. **Blob gas pricing**: Implement EIP-4844 blob base fee calculation
5. **Assembly parsing**: Support tests with assembly code syntax
6. **Parallel execution**: Run tests in parallel for faster execution
7. **Test filtering**: Filter by test name patterns
8. **Progress bar**: Visual progress indicator for long test runs
9. **JSON output**: Machine-readable test results
10. **Comparison mode**: Compare results against other EVMs (revme, geth)

## Testing with CGO

The current build uses stub EVM bindings (CGO disabled). To test with the actual Guillotine EVM:

1. **Build Guillotine Go bindings**:
   ```bash
   cd guillotine
   zig build go
   ```

2. **Build Chop with CGO**:
   ```bash
   cd ..
   CGO_ENABLED=1 go build -o chop
   ```

3. **Run tests**:
   ```bash
   ./chop diff --category homestead/coverage
   ```

## Examples

### Test Single Fixture

```bash
$ chop diff --fixture guillotine/test/official/fixtures/state_tests/homestead/coverage/coverage/coverage.json --verbose

Loaded 9 test case(s) from coverage.json

PASS: tests/homestead/coverage/test_coverage.py::test_coverage[fork_Cancun-state_test]
PASS: tests/homestead/coverage/test_coverage.py::test_coverage[fork_Berlin-state_test]
FAIL: tests/homestead/coverage/test_coverage.py::test_coverage[fork_London-state_test]
  Divergence in: gas
  Expected: 21000
  Actual:   21042
  Context: tests/homestead/coverage/test_coverage.py::test_coverage[fork_London-state_test]

==================================================
Results: 8/9 passed (1 failed)
Pass rate: 88.9%
==================================================
```

### Test Category

```bash
$ chop diff --category homestead/coverage

Running 1 fixture(s) in category 'homestead/coverage'...

.........

==================================================
Results: 9/9 passed
Pass rate: 100.0%
==================================================
```

## Integration with Guillotine

This implementation is designed to work alongside the Guillotine specs infrastructure:

- **Fixtures**: Uses the same fixtures downloaded from ethereum/execution-spec-tests
- **Format**: Compatible with official test format
- **Reference**: Can compare against Guillotine's Zig/TypeScript implementations

### Comparison with Guillotine Specs

| Feature | Chop (Go) | Guillotine (Zig) | Guillotine (TypeScript) |
|---------|-----------|------------------|-------------------------|
| Language | Go | Zig | TypeScript/Bun |
| Execution | Synchronous | Synchronous | Synchronous |
| Pre-state | ✅ | ✅ | ✅ |
| Post-state | 🚧 Basic | ✅ Full | ✅ Full |
| Gas validation | ✅ | ✅ | ✅ |
| Fork support | ✅ | ✅ | ✅ |
| Parallel tests | ❌ | ❌ | ❌ |
| Status | MVP | Production | Production |

## Contributing

When adding new features:

1. **Update tests**: Add test cases for new functionality
2. **Update docs**: Document new flags and options
3. **Update status**: Mark features as implemented in this README
4. **Maintain compatibility**: Keep fixture format compatible with official specs

## References

- [ethereum/execution-spec-tests](https://github.com/ethereum/execution-spec-tests) - Official test suite
- [Guillotine specs runner (Zig)](../guillotine/test/official/state_smoke_test.zig) - Reference implementation
- [Guillotine specs runner (TypeScript)](../guillotine/specs/bun-runner/ethereum-specs.test.ts) - Reference implementation
- [Ethereum Yellow Paper](https://ethereum.github.io/yellowpaper/paper.pdf) - EVM specification
