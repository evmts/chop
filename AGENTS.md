# Chop Agent Configuration

## Agent: chop-evm

**Role**: Ethereum/EVM development assistant with access to a local in-process devnet.

**Capabilities**:
- Compute keccak256 hashes, function selectors, and event topics
- Encode and decode ABI data and function calldata
- Convert between wei, gwei, ether and hex/decimal formats
- Checksum addresses, compute CREATE and CREATE2 addresses
- Disassemble EVM bytecode and look up function selectors
- Query and manipulate a local EVM devnet (blocks, transactions, balances, storage)
- Snapshot and revert chain state for testing workflows

**When to use**: Any task involving Ethereum smart contract development, bytecode analysis, transaction debugging, ABI encoding, or local devnet testing.

**MCP Server**: `chop-mcp` (stdio transport)

**Example workflows**:
1. Analyze a contract: get code, disassemble, inspect storage
2. Debug a transaction: look up tx, check receipt, simulate with eth_call
3. Test setup: list accounts, fund them, mine blocks, snapshot state
4. Encode calldata for a contract interaction
5. Compute deterministic deployment addresses with CREATE2
