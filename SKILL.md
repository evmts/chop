---
name: chop
triggers:
  - ethereum
  - evm
  - solidity
  - keccak
  - abi encode
  - abi decode
  - calldata
  - wei
  - gwei
  - checksum address
  - create2
  - bytecode
  - disassemble
  - selector
  - devnet
  - anvil
---

# Chop - Ethereum Swiss Army Knife

Chop is a local MCP server providing EVM development tools. It runs an in-process EVM devnet (no external node required) and exposes pure utility functions for Ethereum development.

## Available Tools

### Cryptographic
- `keccak256` - Hash data with keccak256 (hex bytes or UTF-8 string)
- `function_selector` - Compute 4-byte function selector from Solidity signature
- `event_topic` - Compute 32-byte event topic from event signature

### Data Conversion
- `from_wei` / `to_wei` - Convert between wei and ether (or gwei, etc.)
- `to_hex` / `to_dec` - Convert between decimal and hexadecimal

### ABI Encoding
- `abi_encode` / `abi_decode` - Encode/decode ABI parameters
- `encode_calldata` / `decode_calldata` - Encode/decode full function calldata

### Address Utilities
- `to_checksum` - EIP-55 checksum an address
- `compute_address` - Predict CREATE deployment address
- `create2` - Predict CREATE2 deployment address

### Bytecode Analysis
- `disassemble` - Disassemble EVM bytecode into opcodes
- `four_byte` - Look up function selector in openchain.xyz database

### Chain Queries (local devnet)
- `eth_blockNumber` / `eth_chainId` - Current block and chain info
- `eth_getBlockByNumber` - Block details
- `eth_getTransactionByHash` / `eth_getTransactionReceipt` - Transaction lookup
- `eth_call` / `eth_getBalance` / `eth_getCode` / `eth_getStorageAt` - State queries

### Devnet Control
- `anvil_mine` - Mine blocks
- `evm_snapshot` / `evm_revert` - Save and restore chain state
- `anvil_setBalance` / `anvil_setCode` / `anvil_setNonce` / `anvil_setStorageAt` - Modify state
- `eth_accounts` - List pre-funded test accounts

## Resources

- `chop://node/status` - Block number and chain ID
- `chop://node/accounts` - Pre-funded test accounts
- `chop://account/{address}/balance` - ETH balance
- `chop://account/{address}/storage/{slot}` - Storage slot value
- `chop://block/{numberOrTag}` - Block details
- `chop://tx/{hash}` - Transaction details

## Prompts

- `analyze-contract` - Guided contract analysis workflow
- `debug-tx` - Guided transaction debugging workflow
- `inspect-storage` - Guided storage inspection workflow
- `setup-test-env` - Set up a local testing environment
