# Foundry Cast & Anvil -- Complete Feature Requirements Specification

> Research document for reimplementation. Every command, subcommand, option, and RPC method
> is catalogued below. Source: local `cast --help` / `anvil --help` (foundry installed at
> `~/.foundry/bin`), Foundry source on GitHub, and Foundry Book documentation.

---

## Table of Contents

1. [Cast -- Overview](#1-cast----overview)
2. [Cast -- ABI Encoding / Decoding](#2-cast----abi-encoding--decoding)
3. [Cast -- Contract Interaction](#3-cast----contract-interaction)
4. [Cast -- Block & Transaction Queries](#4-cast----block--transaction-queries)
5. [Cast -- Account & Address Utilities](#5-cast----account--address-utilities)
6. [Cast -- ENS Operations](#6-cast----ens-operations)
7. [Cast -- Conversion Utilities](#7-cast----conversion-utilities)
8. [Cast -- Cryptographic / Hashing Operations](#8-cast----cryptographic--hashing-operations)
9. [Cast -- RPC & Low-Level Calls](#9-cast----rpc--low-level-calls)
10. [Cast -- Wallet / Signing Operations](#10-cast----wallet--signing-operations)
11. [Cast -- Chain & Network Utilities](#11-cast----chain--network-utilities)
12. [Cast -- Storage Operations](#12-cast----storage-operations)
13. [Cast -- Etherscan / Block Explorer Integration](#13-cast----etherscan--block-explorer-integration)
14. [Cast -- ERC-20 Token Operations](#14-cast----erc-20-token-operations)
15. [Cast -- Bytecode & Disassembly](#15-cast----bytecode--disassembly)
16. [Cast -- Signature Database (4byte)](#16-cast----signature-database-4byte)
17. [Cast -- Bitwise Operations](#17-cast----bitwise-operations)
18. [Cast -- Miscellaneous Utilities](#18-cast----miscellaneous-utilities)
19. [Cast -- Global Options](#19-cast----global-options)
20. [Cast -- Wallet Provider Options (shared)](#20-cast----wallet-provider-options-shared)
21. [Anvil -- Overview](#21-anvil----overview)
22. [Anvil -- Mining Modes](#22-anvil----mining-modes)
23. [Anvil -- Account Management](#23-anvil----account-management)
24. [Anvil -- Fork Configuration](#24-anvil----fork-configuration)
25. [Anvil -- Environment / Gas Configuration](#25-anvil----environment--gas-configuration)
26. [Anvil -- EVM Options](#26-anvil----evm-options)
27. [Anvil -- State Management](#27-anvil----state-management)
28. [Anvil -- Server / Transport Options](#28-anvil----server--transport-options)
29. [Anvil -- Network Modes](#29-anvil----network-modes)
30. [Anvil -- Display Options](#30-anvil----display-options)
31. [Anvil -- Supported RPC Methods (complete)](#31-anvil----supported-rpc-methods-complete)

---

## 1. Cast -- Overview

Cast is a Swiss Army knife CLI for interacting with Ethereum-compatible blockchains.
It performs read calls, sends transactions, encodes/decodes ABI data, converts units,
manages wallets, queries blocks and transactions, and more.

**Binary**: `cast`

---

## 2. Cast -- ABI Encoding / Decoding

| Command | Aliases | Description |
|---------|---------|-------------|
| `abi-encode` | `ae` | ABI encode the given function arguments, excluding the selector. Supports `--packed` for packed encoding. |
| `abi-encode-event` | `aee` | ABI encode an event and its arguments to generate topics and data. |
| `calldata` | `cd` | ABI-encode a function with arguments (includes 4-byte selector). |
| `decode-abi` | `abi-decode`, `--abi-decode`, `ad` | Decode ABI-encoded input or output data. Defaults to output; pass `--input` for input data. Selector must NOT be prefixed when decoding input. |
| `decode-calldata` | `calldata-decode`, `--calldata-decode`, `cdd` | Decode ABI-encoded input data (calldata). |
| `decode-error` | `error-decode`, `--error-decode`, `erd` | Decode custom error data. |
| `decode-event` | `event-decode`, `--event-decode`, `ed` | Decode event data. |
| `decode-string` | `string-decode`, `--string-decode`, `sd` | Decode ABI-encoded string. |
| `decode-transaction` | `dt`, `decode-tx` | Decode a raw signed EIP-2718 typed transaction. |
| `pretty-calldata` | `pc` | Pretty print calldata (human-readable decoding). |

---

## 3. Cast -- Contract Interaction

| Command | Aliases | Description |
|---------|---------|-------------|
| `call` | `c` | Perform a call on an account without publishing a transaction. Supports `--trace` for local fork tracing, `--debug` for interactive debugger, `--decode-internal` for internal function tracing. Subcommand `--create` simulates contract creation. |
| `send` | `s` | Sign and publish a transaction. Supports `--async` (print hash and exit), `--sync` (use `eth_sendTransactionSync`), `--confirmations`, `--unlocked` (use `eth_sendTransaction`), `--timeout`. Subcommand `--create` deploys raw bytecode. |
| `estimate` | `e` | Estimate gas cost of a transaction. Supports `--cost` to calculate cost using network gas price. Subcommand `--create` estimates deployment gas. |
| `mktx` | `m` | Build and sign a transaction without publishing. Subcommand `--create` for deployment bytecode. |
| `publish` | `p` | Publish a raw transaction to the network. |
| `receipt` | `re` | Get the transaction receipt for a transaction. |
| `access-list` | `ac`, `acl` | Create an access list for a transaction (EIP-2930). |
| `interface` | `i` | Generate a Solidity interface from a given ABI. |
| `bind` | `bi` | Generate a Rust binding from a given ABI. |
| `artifact` | `ar` | Generate an artifact file for local contract deployment. |
| `erc20-token` | `erc20` | ERC-20 token operations (see section 14). |

### Transaction Options (shared across call/send/estimate/mktx)

| Option | Description |
|--------|-------------|
| `--gas-limit` | Gas limit for the transaction |
| `--gas-price` | Gas price (legacy) or max fee per gas (EIP-1559). Accepts unit strings like `1ether`, `10gwei`. |
| `--priority-gas-price` | Max priority fee per gas (EIP-1559) |
| `--value` | Ether to send. Accepts unit strings. |
| `--nonce` | Nonce for the transaction |
| `--legacy` | Send legacy transaction instead of EIP-1559 |
| `--blob` | Send EIP-4844 blob transaction |
| `--blob-gas-price` | Gas price for blob transaction |
| `--auth` | EIP-7702 authorization list (hex-encoded signed authorization or address) |
| `--access-list` | EIP-2930 access list (JSON or empty to auto-create via RPC) |

### Call-Specific Options

| Option | Description |
|--------|-------------|
| `--trace` | Fork remote RPC, execute locally, print trace |
| `--debug` | Open interactive debugger (requires `--trace`) |
| `--decode-internal` | Identify internal functions in traces |
| `--labels` | Label addresses in traces (`address:label`) |
| `--evm-version` | EVM version for tracing |
| `--block` / `-b` | Block height to query at (number or tag: earliest, finalized, safe, latest, pending) |
| `--with-local-artifacts` | Use current project artifacts for trace decoding |
| `--override-balance` | Override account balance (`address:balance`) |
| `--override-nonce` | Override account nonce (`address:nonce`) |
| `--override-code` | Override account code (`address:code`) |
| `--override-state` | Override account state entirely (`address:slot:value`) |
| `--override-state-diff` | Override specific slots, preserving rest (`address:slot:value`) |
| `--block.time` | Override block timestamp |
| `--block.number` | Override block number |

---

## 4. Cast -- Block & Transaction Queries

| Command | Aliases | Description |
|---------|---------|-------------|
| `block` | `bl` | Get information about a block. Supports `--field` to get specific fields, `--full` for full block, `--raw` for RLP-encoded header. |
| `block-number` | `bn` | Get the latest block number. |
| `find-block` | `f` | Get the block number closest to the provided timestamp. |
| `age` | `a` | Get the timestamp of a block. |
| `base-fee` | `ba`, `fee`, `basefee` | Get the basefee of a block. |
| `gas-price` | `g` | Get the current gas price. |
| `tx` | `t` | Get information about a transaction. Supports `--field` for specific fields, `--raw` for RLP-encoded tx. Can filter by `--from` and `--nonce`. |
| `receipt` | `re` | Get the transaction receipt for a transaction. |
| `logs` | `l` | Get logs by signature or topic. Supports `--from-block`, `--to-block`, `--address`, `--subscribe` for streaming via `eth_subscribe`. |
| `run` | `r` | Run a published transaction in a local environment and print the trace. Supports `--debug` (interactive debugger), `--decode-internal`, `--trace-printer` (opcode traces), `--quick` (only previous block state), `--label` (`address:label`). |
| `tx-pool` | `tp` | Inspect the TxPool of a node. |
| `da-estimate` | | Estimate the data availability size of a given opstack block. |

---

## 5. Cast -- Account & Address Utilities

| Command | Aliases | Description |
|---------|---------|-------------|
| `balance` | `b` | Get the balance of an account in wei. |
| `nonce` | `n` | Get the nonce for an account. |
| `code` | `co` | Get the runtime bytecode of a contract. |
| `codehash` | | Get the codehash for an account. |
| `codesize` | `cs` | Get the runtime bytecode size of a contract. |
| `address-zero` | `--address-zero`, `az` | Print the zero address. |
| `compute-address` | `ca` | Compute the contract address from a given nonce and deployer address. |
| `create2` | `c2` | Generate a deterministic contract address using CREATE2. |
| `to-check-sum-address` | `--to-checksum-address`, `--to-checksum`, `to-checksum`, `ta`, `2a` | Convert an address to checksummed format (EIP-55). |
| `parse-bytes32-address` | `--parse-bytes32-address` | Parse a checksummed address from bytes32 encoding. |
| `admin` | `adm` | Fetch the EIP-1967 admin account. |
| `implementation` | `impl` | Fetch the EIP-1967 implementation for a contract (reads implementation slot or beacon slot). |

---

## 6. Cast -- ENS Operations

| Command | Aliases | Description |
|---------|---------|-------------|
| `resolve-name` | `rn` | Perform an ENS lookup (name to address). Supports `--verify` for reverse lookup verification. |
| `lookup-address` | `la` | Perform an ENS reverse lookup (address to name). |
| `namehash` | `na`, `nh` | Calculate the ENS namehash of a name. |

---

## 7. Cast -- Conversion Utilities

### Unit Conversions

| Command | Aliases | Description |
|---------|---------|-------------|
| `to-wei` | `--to-wei`, `tw`, `2w` | Convert an ETH amount to wei. |
| `from-wei` | `--from-wei`, `fw` | Convert wei into an ETH amount. |
| `to-unit` | `--to-unit`, `tun`, `2un` | Convert an ETH amount into another unit (ether, gwei, or wei). |
| `parse-units` | `--parse-units`, `pun` | Convert a number from decimal to smallest unit with arbitrary decimals. |
| `format-units` | `--format-units`, `fun` | Format a number from smallest unit to decimal with arbitrary decimals. |

### Base / Radix Conversions

| Command | Aliases | Description |
|---------|---------|-------------|
| `to-base` | `--to-base`, `--to-radix`, `to-radix`, `tr`, `2r` | Convert a number from one base to another. |
| `to-dec` | `--to-dec`, `td`, `2d` | Convert a number of one base to decimal. |
| `to-hex` | `--to-hex`, `th`, `2h` | Convert a number of one base to hex. |

### Data Format Conversions

| Command | Aliases | Description |
|---------|---------|-------------|
| `to-hexdata` | `--to-hexdata`, `thd`, `2hd` | Normalize the input to lowercase, 0x-prefixed hex. |
| `to-bytes32` | `--to-bytes32`, `tb`, `2b` | Right-pad hex data to 32 bytes. |
| `to-int256` | `--to-int256`, `ti`, `2i` | Convert a number to a hex-encoded int256. |
| `to-uint256` | `--to-uint256`, `tu`, `2u` | Convert a number to a hex-encoded uint256. |
| `to-ascii` | `--to-ascii`, `tas`, `2as` | Convert hex data to an ASCII string. |
| `to-utf8` | `--to-utf8`, `tu8`, `2u8` | Convert hex data to a UTF-8 string. |
| `from-utf8` | `--from-ascii`, `--from-utf8`, `from-ascii`, `fu`, `fa` | Convert UTF-8 text to hex. |
| `from-bin` | `--from-bin`, `from-binx`, `fb` | Convert binary data into hex data. |
| `to-fixed-point` | `--to-fix`, `tf`, `2f` | Convert an integer into a fixed point number. |
| `from-fixed-point` | `--from-fix`, `ff` | Convert a fixed point number into an integer. |
| `format-bytes32-string` | `--format-bytes32-string` | Format a string into bytes32 encoding. |
| `parse-bytes32-string` | `--parse-bytes32-string` | Parse a string from bytes32 encoding. |
| `to-rlp` | `--to-rlp` | RLP encode hex data, or an array of hex data. |
| `from-rlp` | `--from-rlp` | Decode RLP hex-encoded data. |
| `concat-hex` | `--concat-hex`, `ch` | Concatenate hex strings. |
| `pad` | `pd` | Pad hex data to a specified length. |
| `b2e-payload` | `b2e` | Convert Beacon payload to execution payload. |

### Integer Bounds

| Command | Aliases | Description |
|---------|---------|-------------|
| `max-int` | `--max-int`, `maxi` | Print the maximum value of the given integer type. |
| `max-uint` | `--max-uint`, `maxu` | Print the maximum value of the given unsigned integer type. |
| `min-int` | `--min-int`, `mini` | Print the minimum value of the given integer type. |

---

## 8. Cast -- Cryptographic / Hashing Operations

| Command | Aliases | Description |
|---------|---------|-------------|
| `keccak` | `k`, `keccak256` | Hash arbitrary data using Keccak-256. |
| `hash-message` | `--hash-message`, `hm` | Hash a message according to EIP-191. |
| `hash-zero` | `--hash-zero`, `hz` | Print the zero hash. |
| `sig` | `si` | Get the 4-byte selector for a function signature. |
| `sig-event` | `se` | Generate event signatures from event string. |

---

## 9. Cast -- RPC & Low-Level Calls

| Command | Aliases | Description |
|---------|---------|-------------|
| `rpc` | `rp` | Perform a raw JSON-RPC request. Arguments: `<METHOD> [PARAMS]...`. Params interpreted as JSON. Supports `--raw` for raw JSON array. |

### Shared Ethereum / RPC Options (used across most commands)

| Option | Env Var | Description |
|--------|---------|-------------|
| `-r, --rpc-url` | `ETH_RPC_URL` | The RPC endpoint (default: `http://localhost:8545`) |
| `-k, --insecure` | | Accept invalid HTTPS certificates |
| `--flashbots` | | Use Flashbots RPC URL (`https://rpc.flashbots.net/fast`) |
| `--jwt-secret` | `ETH_RPC_JWT_SECRET` | JWT Secret for RPC endpoint (engine API) |
| `--rpc-timeout` | `ETH_RPC_TIMEOUT` | Timeout for RPC request in seconds (default: 45) |
| `--rpc-headers` | `ETH_RPC_HEADERS` | Custom headers for RPC requests |
| `-e, --etherscan-api-key` | `ETHERSCAN_API_KEY` | Etherscan (or equivalent) API key |
| `-c, --chain` | `CHAIN` | Chain name or EIP-155 chain ID |

---

## 10. Cast -- Wallet / Signing Operations

### Wallet Subcommand (`cast wallet`)

| Command | Aliases | Description |
|---------|---------|-------------|
| `wallet new` | `n` | Create a new random keypair. |
| `wallet new-mnemonic` | `nm` | Generate a random BIP39 mnemonic phrase. |
| `wallet vanity` | `va` | Generate a vanity address (matching pattern). |
| `wallet address` | `a`, `addr` | Convert a private key to an address. |
| `wallet sign` | `s` | Sign a message or typed data. |
| `wallet sign-auth` | `sa` | EIP-7702 sign authorization. |
| `wallet verify` | `v` | Verify the signature of a message. |
| `wallet import` | `i` | Import a private key into an encrypted keystore. |
| `wallet list` | `ls` | List all accounts in the keystore default directory. |
| `wallet remove` | `rm` | Remove a wallet from the keystore. |
| `wallet private-key` | `pk` | Derive private key from mnemonic. |
| `wallet public-key` | `pubkey` | Get the public key for the given private key. |
| `wallet decrypt-keystore` | `dk` | Decrypt a keystore file to get the private key. |
| `wallet change-password` | `cp` | Change the password of a keystore file. |

### Wallet Provider Options (shared across send/call/estimate/mktx)

**Raw wallet**:
- `-f, --from` -- sender account (env: `ETH_FROM`)
- `-i, --interactive` -- interactive prompt for private key
- `--private-key` -- use provided private key
- `--mnemonic` -- use mnemonic phrase or file
- `--mnemonic-passphrase` -- BIP39 passphrase
- `--mnemonic-derivation-path` -- wallet derivation path
- `--mnemonic-index` -- mnemonic index (default: 0)

**Keystore**:
- `--keystore` -- keystore file/folder (env: `ETH_KEYSTORE`)
- `--account` -- keystore account name from `~/.foundry/keystores` (env: `ETH_KEYSTORE_ACCOUNT`)
- `--password` -- keystore password
- `--password-file` -- keystore password file (env: `ETH_PASSWORD`)

**Hardware wallets**:
- `-l, --ledger` -- Ledger hardware wallet
- `-t, --trezor` -- Trezor hardware wallet

**Remote signers**:
- `--aws` -- AWS Key Management Service (env: `AWS_KMS_KEY_ID`)
- `--gcp` -- Google Cloud KMS (envs: `GCP_PROJECT_ID`, `GCP_LOCATION`, `GCP_KEY_RING`, `GCP_KEY_NAME`, `GCP_KEY_VERSION`)
- `--turnkey` -- Turnkey (envs: `TURNKEY_API_PRIVATE_KEY`, `TURNKEY_ORGANIZATION_ID`, `TURNKEY_ADDRESS`)

**Browser wallet**:
- `--browser` -- use browser wallet
- `--browser-port` -- port for browser wallet server (default: 9545)
- `--browser-disable-open` -- do not auto-open browser

### Standalone Signing Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `hash-message` | `--hash-message`, `hm` | Hash a message per EIP-191 |
| `recover-authority` | `decode-auth` | Recover an EIP-7702 authority from an Authorization JSON string |

---

## 11. Cast -- Chain & Network Utilities

| Command | Aliases | Description |
|---------|---------|-------------|
| `chain` | | Get the symbolic name of the current chain. |
| `chain-id` | `ci`, `cid` | Get the Ethereum chain ID. |
| `client` | `cl` | Get the current client version. |

---

## 12. Cast -- Storage Operations

| Command | Aliases | Description |
|---------|---------|-------------|
| `storage` | `st` | Get the raw value of a contract's storage slot. If no slot given, retrieves full storage layout. Supports `--proxy` for known proxy address, `--block` for historical queries, and `OFFSET` arg for sub-slot offset. |
| `storage-root` | `sr` | Get the storage root for an account. |
| `proof` | `pr` | Generate a storage proof for given storage slots (Merkle proof). |
| `index` | `in` | Compute the storage slot for an entry in a mapping. |
| `index-erc7201` | `index7201`, `in7201` | Compute storage slots as specified by ERC-7201 (Namespaced Storage Layout). |

---

## 13. Cast -- Etherscan / Block Explorer Integration

| Command | Aliases | Description |
|---------|---------|-------------|
| `source` | `et`, `src` | Get the source code of a contract from a block explorer. Supports `--flatten`, `-d` for output directory, `--explorer-api-url` for custom explorer. |
| `creation-code` | `cc` | Download a contract creation code from Etherscan and RPC. |
| `constructor-args` | `cra` | Display constructor arguments used for contract initialization. |

---

## 14. Cast -- ERC-20 Token Operations

Subcommand: `cast erc20-token` (alias: `cast erc20`)

| Command | Aliases | Description |
|---------|---------|-------------|
| `balance` | `b` | Query ERC-20 token balance. |
| `transfer` | `t` | Transfer ERC-20 tokens. |
| `approve` | `a` | Approve ERC-20 token spending. |
| `allowance` | `al` | Query ERC-20 token allowance. |
| `name` | `n` | Query ERC-20 token name. |
| `symbol` | `s` | Query ERC-20 token symbol. |
| `decimals` | `d` | Query ERC-20 token decimals. |
| `total-supply` | `ts` | Query ERC-20 token total supply. |
| `mint` | `m` | Mint ERC-20 tokens (if token supports minting). |
| `burn` | `bu` | Burn ERC-20 tokens. |

---

## 15. Cast -- Bytecode & Disassembly

| Command | Aliases | Description |
|---------|---------|-------------|
| `disassemble` | `da` | Disassemble hex-encoded bytecode into human-readable representation. |
| `selectors` | `sel` | Extract function selectors and arguments from bytecode. |

---

## 16. Cast -- Signature Database (4byte / OpenChain)

| Command | Aliases | Description |
|---------|---------|-------------|
| `4byte` | `4`, `4b` | Get function signatures for a given selector from https://openchain.xyz. |
| `4byte-calldata` | `4c`, `4bc` | Decode ABI-encoded calldata using https://openchain.xyz. |
| `4byte-event` | `4e`, `4be`, `topic0-event`, `t0e` | Get event signature for a given topic 0 from https://openchain.xyz. |
| `upload-signature` | `ups` | Upload given signatures to https://openchain.xyz. |

---

## 17. Cast -- Bitwise Operations

| Command | Aliases | Description |
|---------|---------|-------------|
| `shl` | | Perform a left shifting operation. |
| `shr` | | Perform a right shifting operation. |

---

## 18. Cast -- Miscellaneous Utilities

| Command | Aliases | Description |
|---------|---------|-------------|
| `completions` | `com` | Generate shell completions script. |
| `help` | | Print help message. |

---

## 19. Cast -- Global Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Print help |
| `-V, --version` | Print version |
| `-j, --threads` | Number of threads (0 = logical cores) |
| `--color` | Log message color: `auto`, `always`, `never` |
| `--json` | Format log messages as JSON |
| `--md` | Format log messages as Markdown |
| `-q, --quiet` | Suppress log messages |
| `-v, --verbosity` | Verbosity level (repeat for more: `-vv`, `-vvv`, `-vvvv`, `-vvvvv`) |

---

## 20. Cast -- Wallet Provider Options (shared)

These options are shared across `call`, `send`, `estimate`, `mktx`, and any command
that requires a signer or sender identity. See section 10 for full details.

---

## 21. Anvil -- Overview

Anvil is a fast local Ethereum development node that runs entirely in-memory. It supports
forking from any EVM-compatible chain, multiple mining modes, account impersonation,
state snapshots, time manipulation, and a comprehensive set of standard and custom RPC methods.

**Binary**: `anvil`
**Default port**: 8545
**Default chain ID**: 31337
**Default accounts**: 10 (each with 10,000 ETH)
**Default derivation path**: `m/44'/60'/0'/0/`
**Default CREATE2 deployer**: `0x4e59b44847b379578588920ca78fbf26c0b4956c`
**Supported transports**: HTTP, WebSocket, IPC

---

## 22. Anvil -- Mining Modes

| Mode | Flag | Description |
|------|------|-------------|
| **Auto mining** (default) | *(none)* | A new block is mined immediately when a transaction is submitted. |
| **Interval mining** | `-b, --block-time <SECONDS>` | A new block is mined at the specified interval (in seconds). |
| **No mining (manual)** | `--no-mining` / `--no-mine` | Mining is disabled. Blocks must be mined manually via `evm_mine` or `anvil_mine`. |
| **Mixed mining** | `--mixed-mining` | Combination mode (auto-mine on tx, plus interval mining). |

### Mining RPC Control

| RPC Method | Description |
|------------|-------------|
| `anvil_getAutomine` | Returns whether automine is enabled. |
| `anvil_setAutomine` | Enable or disable automine. |
| `anvil_getIntervalMining` | Returns the current interval mining period. |
| `anvil_setIntervalMining` | Set the interval mining period. |
| `anvil_mine` | Mine a specified number of blocks. |
| `evm_mine` | Mine a single block. |
| `evm_mineDetailed` | Mine a single block and return detailed info. |

---

## 23. Anvil -- Account Management

### CLI Flags

| Flag | Description |
|------|-------------|
| `-a, --accounts <NUM>` | Number of dev accounts to generate (default: 10). |
| `--balance <NUM>` | Balance of every dev account in Ether (default: 10000). |
| `-m, --mnemonic <MNEMONIC>` | BIP39 mnemonic phrase for generating accounts. |
| `--mnemonic-random [<WORDS>]` | Auto-generate a BIP39 mnemonic (default: 12 words). |
| `--mnemonic-seed-unsafe <SEED>` | Generate mnemonic from seed (NOT SAFE -- testing only). |
| `--derivation-path <PATH>` | Child key derivation path (default: `m/44'/60'/0'/0/`). |

### Account RPC Methods

| RPC Method | Description |
|------------|-------------|
| `anvil_impersonateAccount` | Send transactions impersonating any EOA or contract. |
| `anvil_stopImpersonatingAccount` | Stop impersonating an account. |
| `anvil_autoImpersonateAccount` | Enable/disable auto-impersonation for all senders. |
| `anvil_impersonateSignature` | Impersonate a signature for account operations. |
| `anvil_setBalance` | Set the balance of an account. |
| `anvil_addBalance` | Add to the balance of an account. |
| `anvil_setNonce` | Set the nonce of an account. |
| `anvil_setCode` | Set the bytecode of an account. |
| `anvil_setStorageAt` | Set a storage slot of an account. |
| `anvil_dealERC20` | Set ERC-20 token balance for an account. |
| `anvil_setERC20Allowance` | Set ERC-20 token allowance. |
| `anvil_removePoolTransactions` | Remove pending transactions from the pool for an address. |

---

## 24. Anvil -- Fork Configuration

| Flag | Description |
|------|-------------|
| `-f, --fork-url <URL>` | Fetch state from a remote endpoint. Append `@<block>` to URL for specific block. Alias: `--rpc-url`. |
| `--fork-block-number <BLOCK>` | Fork at a specific block number. Negative values subtract from latest. |
| `--fork-transaction-hash <TX>` | Fork after a specific transaction hash. |
| `--fork-chain-id <CHAIN>` | Specify chain ID to skip remote fetch (enables offline-start with cached state). |
| `--fork-header <HEADERS>` | Custom headers for the fork RPC client (e.g., `"User-Agent: test-agent"`). |
| `--fork-retry-backoff <BACKOFF>` | Initial retry backoff on errors. |
| `--no-storage-caching` | Disable RPC storage caching (read all from endpoint). |
| `--no-rate-limit` | Disable rate limiting for the fork provider. |
| `--compute-units-per-second <CUPS>` | Assumed compute units per second (default: 330). |
| `--retries <N>` | Retry count for spurious network errors (default: 5). |
| `--timeout <MS>` | Timeout in ms for fork RPC requests (default: 45000). |

### Fork RPC Methods

| RPC Method | Description |
|------------|-------------|
| `anvil_reset` | Reset the fork to a fresh state or re-fork from a different block/URL. |
| `anvil_setRpcUrl` | Change the fork RPC URL at runtime. |

---

## 25. Anvil -- Environment / Gas Configuration

| Flag | Description |
|------|-------------|
| `--chain-id <CHAIN_ID>` | The chain ID (default: 31337). |
| `--gas-limit <GAS_LIMIT>` | The block gas limit. |
| `--gas-price <GAS_PRICE>` | The gas price. |
| `--block-base-fee-per-gas <FEE>` | The base fee in a block. Alias: `--base-fee`. |
| `--disable-block-gas-limit` | Disable the `call.gas_limit <= block.gas_limit` constraint. |
| `--disable-min-priority-fee` | Disable minimum suggested priority fee. Alias: `--no-priority-fee`. |
| `--code-size-limit <CODE_SIZE>` | EIP-170 contract code size limit in bytes (default: 0x6000 / ~25KB). |
| `--disable-code-size-limit` | Disable EIP-170 code size limit entirely. |
| `--hardfork <HARDFORK>` | EVM hardfork: `prague`, `cancun`, `shanghai`, `paris`, `london`, etc. Default: `latest`. |
| `--number <NUM>` | The genesis block number. |
| `--timestamp <NUM>` | The genesis block timestamp. |
| `--order <ORDER>` | Transaction mempool ordering (default: `fees`). |
| `--slots-in-an-epoch <N>` | Slots in an epoch (default: 32). |
| `--transaction-block-keeper <N>` | Number of blocks with transactions to keep in memory. |

### Gas RPC Methods

| RPC Method | Description |
|------------|-------------|
| `anvil_setMinGasPrice` | Set the minimum gas price. |
| `anvil_setNextBlockBaseFeePerGas` | Set the base fee for the next block. |
| `anvil_setCoinbase` | Set the coinbase address. |
| `evm_setBlockGasLimit` | Set the block gas limit. |

---

## 26. Anvil -- EVM Options

| Flag | Description |
|------|-------------|
| `--auto-impersonate` | Enable automatic impersonation on startup. Alias: `--auto-unlock`. |
| `--steps-tracing` | Enable steps tracing for debug calls (geth-style traces). Alias: `--tracing`. |
| `--print-traces` | Print traces for executed transactions and `eth_call`. Alias: `--enable-trace-printing`. |
| `--disable-console-log` | Disable `console.log` output to stdout. Alias: `--no-console-log`. |
| `--disable-default-create2-deployer` | Disable default CREATE2 deployer. Alias: `--no-create2`. |
| `--disable-pool-balance-checks` | Disable pool balance checks. |
| `--memory-limit <BYTES>` | Memory limit per EVM execution in bytes. |

---

## 27. Anvil -- State Management

### CLI Flags

| Flag | Description |
|------|-------------|
| `--state <PATH>` | Alias for both `--load-state` and `--dump-state`. Loads on start if file exists, dumps on exit. |
| `--load-state <PATH>` | Initialize chain from a previously saved state snapshot. |
| `--dump-state <PATH>` | Dump chain state and block environment on exit. If directory, writes `<PATH>/state.json`. |
| `-s, --state-interval <SECONDS>` | Interval at which state is dumped to disk. |
| `--max-persisted-states <N>` | Max number of states to persist on disk. |
| `--preserve-historical-states` | Preserve historical state snapshots when dumping (save in-memory states at block hashes). |
| `--prune-history [<N>]` | Don't keep full chain history. Optional: max N states in memory. Disables disk persistence. |
| `--init <PATH>` | Initialize genesis block with a `genesis.json` file. |

### State RPC Methods

| RPC Method | Description |
|------------|-------------|
| `anvil_dumpState` | Returns hex string of complete chain state. |
| `anvil_loadState` | Load a previously dumped state into the chain. |
| `evm_snapshot` | Take a snapshot of the current state (returns snapshot ID). |
| `evm_revert` | Revert to a previous snapshot by ID. |
| `anvil_reorg` | Simulate a chain reorganization. |
| `anvil_rollback` | Rollback the chain to a previous block. |

### State Info RPC Methods

| RPC Method | Description |
|------------|-------------|
| `anvil_nodeInfo` | Retrieve configuration params for the running node. |
| `anvil_metadata` | Retrieve metadata about the node. |

---

## 28. Anvil -- Server / Transport Options

| Flag | Description |
|------|-------------|
| `-p, --port <NUM>` | Port number to listen on (default: 8545). |
| `--host <IP_ADDR>` | Host IP to listen on (default: 127.0.0.1). Env: `ANVIL_IP_ADDR`. |
| `--ipc [<PATH>]` | Launch IPC server (default: `/tmp/anvil.ipc`). Alias: `--ipcpath`. |
| `--allow-origin <ORIGIN>` | CORS `allow_origin` header (default: `*`). |
| `--no-cors` | Disable CORS. |
| `--no-request-size-limit` | Disable default request body size limit (default: 2MB). |
| `--config-out <FILE>` | Write `anvil` config output as JSON to file. |
| `--cache-path <PATH>` | Path to cache directory for stored states. |

---

## 29. Anvil -- Network Modes

| Flag | Description |
|------|-------------|
| `--optimism` | Enable Optimism network features. |
| `--celo` | Enable Celo network features. |

---

## 30. Anvil -- Display Options

| Flag | Description |
|------|-------------|
| `--color <COLOR>` | Log color: `auto`, `always`, `never`. |
| `--json` | Format log messages as JSON. |
| `--md` | Format log messages as Markdown. |
| `-q, --quiet` | Suppress log messages. |
| `-v, --verbosity` | Verbosity level (`-v` through `-vvvvv`). |
| `-j, --threads` | Number of threads (0 = logical cores). |
| `-V, --version` | Print version. |

---

## 31. Anvil -- Supported RPC Methods (complete)

This is the exhaustive list of every RPC method implemented by Anvil, extracted from
the Foundry source code (`crates/anvil/src/eth/api.rs`).

### 31.1 Standard Ethereum Methods (`eth_`)

| Method | Description |
|--------|-------------|
| `eth_protocolVersion` | Returns the current Ethereum protocol version. |
| `eth_chainId` | Returns the chain ID. |
| `eth_networkId` | Returns the network ID. |
| `eth_gasPrice` | Returns the current gas price in wei. |
| `eth_maxPriorityFeePerGas` | Returns the max priority fee per gas (EIP-1559). |
| `eth_blobBaseFee` | Returns the blob base fee (EIP-4844). |
| `eth_blockNumber` | Returns the latest block number. |
| `eth_getBalance` | Returns the balance of an account. |
| `eth_getAccount` | Returns account info. |
| `eth_getAccountInfo` | Returns detailed account info. |
| `eth_getStorageAt` | Returns the value of a storage slot. |
| `eth_getCode` | Returns the bytecode at an address. |
| `eth_getProof` | Returns the Merkle proof for account/storage (EIP-1186). |
| `eth_getBlockByHash` | Returns block by hash. |
| `eth_getBlockByNumber` | Returns block by number. |
| `eth_getTransactionCount` | Returns the nonce of an account. |
| `eth_getBlockTransactionCountByHash` | Returns tx count in block by hash. |
| `eth_getBlockTransactionCountByNumber` | Returns tx count in block by number. |
| `eth_getUncleCountByBlockHash` | Returns uncle count by block hash. |
| `eth_getUncleCountByBlockNumber` | Returns uncle count by block number. |
| `eth_getTransactionByHash` | Returns transaction by hash. |
| `eth_getTransactionByBlockHashAndIndex` | Returns tx by block hash and index. |
| `eth_getTransactionByBlockNumberAndIndex` | Returns tx by block number and index. |
| `eth_getTransactionBySenderAndNonce` | Returns tx by sender address and nonce. |
| `eth_getTransactionReceipt` | Returns the receipt of a transaction. |
| `eth_getBlockReceipts` | Returns all receipts for a block. |
| `eth_getUncleByBlockHashAndIndex` | Returns uncle by block hash and index. |
| `eth_getUncleByBlockNumberAndIndex` | Returns uncle by block number and index. |
| `eth_getLogs` | Returns logs matching a filter. |
| `eth_getWork` | Returns proof-of-work info. |
| `eth_syncing` | Returns sync status. |
| `eth_config` | Returns node configuration. |
| `eth_submitWork` | Submit PoW solution. |
| `eth_submitHashrate` | Submit hashrate. |
| `eth_feeHistory` | Returns fee history for a range of blocks (EIP-1559). |
| `eth_sign` | Sign data with an account. |
| `eth_signTransaction` | Sign a transaction. |
| `eth_signTypedData` | Sign typed data (EIP-712). |
| `eth_signTypedData_v3` | Sign typed data v3. |
| `eth_signTypedData_v4` | Sign typed data v4. |
| `eth_sendTransaction` | Send a transaction (requires unlocked account). |
| `eth_sendTransactionSync` | Send transaction and wait for receipt synchronously. |
| `eth_sendRawTransaction` | Send a signed raw transaction. |
| `eth_sendRawTransactionSync` | Send raw transaction and wait for receipt synchronously. |
| `eth_call` | Execute a call without creating a transaction. |
| `eth_simulateV1` | Simulate a transaction (extended call). |
| `eth_createAccessList` | Create an EIP-2930 access list. |
| `eth_estimateGas` | Estimate gas for a transaction. |
| `eth_fillTransaction` | Fill in missing transaction fields. |
| `eth_getRawTransactionByHash` | Returns raw tx bytes by hash. |
| `eth_getRawTransactionByBlockHashAndIndex` | Returns raw tx bytes by block hash and index. |
| `eth_getRawTransactionByBlockNumberAndIndex` | Returns raw tx bytes by block number and index. |
| `eth_sendUnsignedTransaction` | Send an unsigned transaction (for testing). |

### 31.2 Filter Methods (`eth_`)

| Method | Description |
|--------|-------------|
| `eth_newFilter` | Create a new log filter. |
| `eth_newBlockFilter` | Create a new block filter. |
| `eth_newPendingTransactionFilter` | Create a new pending transaction filter. |
| `eth_getFilterChanges` | Poll a filter for new data. |
| `eth_getFilterLogs` | Get all logs for a filter. |
| `eth_uninstallFilter` | Remove a filter. |

### 31.3 Web3 Methods (`web3_`)

| Method | Description |
|--------|-------------|
| `web3_clientVersion` | Returns the client version string. |
| `web3_sha3` | Returns Keccak-256 hash of data. |

### 31.4 Network Methods (`net_`)

| Method | Description |
|--------|-------------|
| `net_listening` | Returns whether the node is listening for connections. |

### 31.5 Debug Methods (`debug_`)

| Method | Description |
|--------|-------------|
| `debug_getRawTransaction` | Returns the raw transaction bytes. |
| `debug_traceTransaction` | Trace a transaction execution (geth-style). |
| `debug_traceCall` | Trace a call without creating a transaction. |
| `debug_codeByHash` | Get code by its hash. |
| `debug_dbGet` | Get a value from the debug database. |

### 31.6 Trace Methods (`trace_`)

| Method | Description |
|--------|-------------|
| `trace_transaction` | Trace a transaction (Parity-style). |
| `trace_block` | Trace all transactions in a block. |
| `trace_filter` | Filter traces by address, from/to block. |
| `trace_replayBlockTransactions` | Replay and trace all transactions in a block. |

### 31.7 Transaction Pool Methods (`txpool_`)

| Method | Description |
|--------|-------------|
| `txpool_status` | Returns the number of pending and queued transactions. |
| `txpool_inspect` | Returns textual summary of pending and queued transactions. |
| `txpool_content` | Returns the full content of the transaction pool. |

### 31.8 Personal Methods

| Method | Description |
|--------|-------------|
| `personal_sign` | Sign data with an account (personal_sign format). |

### 31.9 Anvil Custom Methods (`anvil_`)

#### Impersonation

| Method | Description |
|--------|-------------|
| `anvil_impersonateAccount` | Send transactions impersonating any EOA or contract. |
| `anvil_stopImpersonatingAccount` | Stop impersonating an account. |
| `anvil_autoImpersonateAccount` | Enable/disable auto-impersonation for all senders. |
| `anvil_impersonateSignature` | Impersonate a signature. |

#### Mining Control

| Method | Description |
|--------|-------------|
| `anvil_getAutomine` | Check if automine is enabled. |
| `anvil_setAutomine` | Enable or disable automine. |
| `anvil_getIntervalMining` | Get current interval mining period. |
| `anvil_setIntervalMining` | Set interval mining period. |
| `anvil_mine` | Mine a specified number of blocks. |

#### Transaction Management

| Method | Description |
|--------|-------------|
| `anvil_dropTransaction` | Remove a specific transaction from the pool. |
| `anvil_dropAllTransactions` | Remove all transactions from the pool. |
| `anvil_removePoolTransactions` | Remove all pool transactions for an address. |

#### Account / State Manipulation

| Method | Description |
|--------|-------------|
| `anvil_setBalance` | Set the ETH balance of an account. |
| `anvil_addBalance` | Add to the ETH balance of an account. |
| `anvil_setCode` | Set the bytecode at an address. |
| `anvil_setNonce` | Set the nonce of an account. |
| `anvil_setStorageAt` | Set a specific storage slot value. |
| `anvil_dealERC20` | Set ERC-20 token balance for an account. |
| `anvil_setERC20Allowance` | Set ERC-20 allowance for an account/spender. |

#### Chain / Fork Control

| Method | Description |
|--------|-------------|
| `anvil_reset` | Reset the fork (re-fork from different block/URL, or reset to clean state). |
| `anvil_setChainId` | Set the chain ID. |
| `anvil_setRpcUrl` | Change the fork RPC URL at runtime. |

#### Gas / Fee Control

| Method | Description |
|--------|-------------|
| `anvil_setMinGasPrice` | Set the minimum gas price. |
| `anvil_setNextBlockBaseFeePerGas` | Set the base fee for the next block. |
| `anvil_setCoinbase` | Set the coinbase (miner) address. |

#### State Persistence

| Method | Description |
|--------|-------------|
| `anvil_dumpState` | Dump complete chain state as hex string. |
| `anvil_loadState` | Load a previously dumped state. |

#### Chain Reorganization

| Method | Description |
|--------|-------------|
| `anvil_reorg` | Simulate a chain reorganization. |
| `anvil_rollback` | Rollback the chain to a previous block. |

#### Node Info

| Method | Description |
|--------|-------------|
| `anvil_nodeInfo` | Get configuration parameters for the running node. |
| `anvil_metadata` | Get node metadata. |

#### Blob Methods

| Method | Description |
|--------|-------------|
| `anvil_getBlobByHash` | Get a blob by its hash. |
| `anvil_getBlobsByTransactionHash` | Get all blobs for a transaction. |
| `anvil_getGenesisTime` | Get the genesis block timestamp. |

#### Logging / Tracing Control

| Method | Description |
|--------|-------------|
| `anvil_setLoggingEnabled` | Enable or disable logging. |
| `anvil_enableTraces` | Enable trace collection. |

### 31.10 EVM Methods (`evm_`)

| Method | Description |
|--------|-------------|
| `evm_snapshot` | Take a snapshot of current state (returns snapshot ID). |
| `evm_revert` | Revert to a previous snapshot. |
| `evm_increaseTime` | Increase the block timestamp by a given number of seconds. |
| `evm_setNextBlockTimeStamp` | Set the exact timestamp for the next block. |
| `evm_setTime` | Set the current block timestamp. |
| `evm_setBlockGasLimit` | Set the block gas limit. |
| `evm_setBlockTimeStampInterval` | Set the interval between block timestamps. |
| `evm_removeBlockTimeStampInterval` | Remove the block timestamp interval. |
| `evm_mine` | Mine a single block. |
| `evm_mineDetailed` | Mine a block and return detailed information. |

### 31.11 Erigon Methods (`erigon_`)

| Method | Description |
|--------|-------------|
| `erigon_getHeaderByNumber` | Get a block header by number (Erigon-compatible). |

### 31.12 Otterscan Methods (`ots_`)

| Method | Description |
|--------|-------------|
| `ots_getApiLevel` | Get the Otterscan API level. |
| `ots_getInternalOperations` | Get internal operations for a transaction. |
| `ots_hasCode` | Check if an address has code. |
| `ots_traceTransaction` | Trace a transaction (Otterscan format). |
| `ots_getTransactionError` | Get the error message for a failed transaction. |
| `ots_getBlockDetails` | Get detailed block info. |
| `ots_getBlockDetailsByHash` | Get detailed block info by hash. |
| `ots_getBlockTransactions` | Get transactions in a block with pagination. |
| `ots_searchTransactionsBefore` | Search transactions before a given block. |
| `ots_searchTransactionsAfter` | Search transactions after a given block. |
| `ots_getTransactionBySenderAndNonce` | Get transaction by sender and nonce. |
| `ots_getContractCreator` | Get the creator of a contract. |

---

## Appendix A: Cast Command Quick Reference (alphabetical)

Complete list of all 100+ cast subcommands:

```
4byte                  4byte-calldata         4byte-event
abi-encode             abi-encode-event       access-list
address-zero           admin                  age
artifact               b2e-payload            balance
base-fee               bind                   block
block-number           call                   calldata
chain                  chain-id               client
code                   codehash               codesize
completions            compute-address        concat-hex
constructor-args       create2                creation-code
da-estimate            decode-abi             decode-calldata
decode-error           decode-event           decode-string
decode-transaction     disassemble            erc20-token
estimate               find-block             format-bytes32-string
format-units           from-bin               from-fixed-point
from-rlp               from-utf8              from-wei
gas-price              hash-message           hash-zero
help                   implementation         index
index-erc7201          interface              keccak
logs                   lookup-address         max-int
max-uint               min-int                mktx
namehash               nonce                  pad
parse-bytes32-address  parse-bytes32-string   parse-units
pretty-calldata        proof                  publish
receipt                recover-authority      resolve-name
rpc                    run                    selectors
send                   shl                    shr
sig                    sig-event              source
storage                storage-root           to-ascii
to-base                to-bytes32             to-check-sum-address
to-dec                 to-fixed-point         to-hex
to-hexdata             to-int256              to-rlp
to-uint256             to-unit                to-utf8
to-wei                 tx                     tx-pool
upload-signature       wallet
```

---

## Appendix B: Anvil RPC Method Quick Reference (alphabetical)

```
anvil_addBalance                    anvil_autoImpersonateAccount
anvil_dealERC20                     anvil_dropAllTransactions
anvil_dropTransaction               anvil_dumpState
anvil_enableTraces                  anvil_getBlobByHash
anvil_getBlobsByTransactionHash     anvil_getAutomine
anvil_getGenesisTime                anvil_getIntervalMining
anvil_impersonateAccount            anvil_impersonateSignature
anvil_loadState                     anvil_metadata
anvil_mine                          anvil_nodeInfo
anvil_removePoolTransactions        anvil_reorg
anvil_reset                         anvil_rollback
anvil_setAutomine                   anvil_setBalance
anvil_setChainId                    anvil_setCode
anvil_setCoinbase                   anvil_setERC20Allowance
anvil_setIntervalMining             anvil_setLoggingEnabled
anvil_setMinGasPrice                anvil_setNextBlockBaseFeePerGas
anvil_setNonce                      anvil_setRpcUrl
anvil_setStorageAt

debug_codeByHash                    debug_dbGet
debug_getRawTransaction             debug_traceCall
debug_traceTransaction

erigon_getHeaderByNumber

eth_blobBaseFee                     eth_blockNumber
eth_call                            eth_chainId
eth_config                          eth_createAccessList
eth_estimateGas                     eth_feeHistory
eth_fillTransaction                 eth_gasPrice
eth_getAccount                      eth_getAccountInfo
eth_getBalance                      eth_getBlockByHash
eth_getBlockByNumber                eth_getBlockReceipts
eth_getBlockTransactionCountByHash  eth_getBlockTransactionCountByNumber
eth_getCode                         eth_getFilterChanges
eth_getFilterLogs                   eth_getLogs
eth_getProof                        eth_getRawTransactionByBlockHashAndIndex
eth_getRawTransactionByBlockNumberAndIndex
eth_getRawTransactionByHash         eth_getStorageAt
eth_getTransactionByBlockHashAndIndex
eth_getTransactionByBlockNumberAndIndex
eth_getTransactionByHash            eth_getTransactionBySenderAndNonce
eth_getTransactionCount             eth_getTransactionReceipt
eth_getUncleByBlockHashAndIndex     eth_getUncleByBlockNumberAndIndex
eth_getUncleCountByBlockHash        eth_getUncleCountByBlockNumber
eth_getWork                         eth_maxPriorityFeePerGas
eth_networkId                       eth_newBlockFilter
eth_newFilter                       eth_newPendingTransactionFilter
eth_protocolVersion                 eth_sendRawTransaction
eth_sendRawTransactionSync          eth_sendTransaction
eth_sendTransactionSync             eth_sendUnsignedTransaction
eth_sign                            eth_signTransaction
eth_signTypedData                   eth_signTypedData_v3
eth_signTypedData_v4                eth_simulateV1
eth_submitHashrate                  eth_submitWork
eth_syncing                         eth_uninstallFilter

evm_increaseTime                    evm_mine
evm_mineDetailed                    evm_removeBlockTimeStampInterval
evm_revert                          evm_setBlockGasLimit
evm_setBlockTimeStampInterval       evm_setNextBlockTimeStamp
evm_setTime                         evm_snapshot

net_listening

ots_getApiLevel                     ots_getBlockDetails
ots_getBlockDetailsByHash           ots_getBlockTransactions
ots_getContractCreator              ots_getInternalOperations
ots_getTransactionBySenderAndNonce  ots_getTransactionError
ots_hasCode                         ots_searchTransactionsAfter
ots_searchTransactionsBefore        ots_traceTransaction

personal_sign

trace_block                         trace_filter
trace_replayBlockTransactions       trace_transaction

txpool_content                      txpool_inspect
txpool_status

web3_clientVersion                  web3_sha3
```

---

## Appendix C: Implementation Priority Notes

### High Priority (core functionality)
- ABI encoding/decoding (section 2)
- Contract interaction: call, send, estimate (section 3)
- Block/transaction queries (section 4)
- Unit conversions: to-wei, from-wei, parse-units, format-units (section 7)
- Keccak hashing (section 8)
- Wallet: new, sign, verify, import, list (section 10)
- Anvil: local node, auto-mining, account management (sections 21-23)
- Anvil: core eth_* RPC methods (section 31.1)
- Anvil: state manipulation anvil_* methods (section 31.9)
- Anvil: evm_* time/snapshot methods (section 31.10)

### Medium Priority (developer experience)
- ENS operations (section 6)
- Storage operations (section 12)
- Etherscan integration (section 13)
- ERC-20 operations (section 14)
- 4byte signature database (section 16)
- Fork configuration (section 24)
- Debug/trace methods (sections 31.5, 31.6)
- Filter methods (section 31.2)
- Transaction pool methods (section 31.7)

### Lower Priority (nice-to-have)
- Bytecode disassembly (section 15)
- Bitwise operations (section 17)
- Otterscan methods (section 31.12)
- Erigon compatibility (section 31.11)
- Network modes: Optimism, Celo (section 29)
- Shell completions (section 18)
