package evm_test

import (
	"fmt"
	"log"

	"chop/evm"
)

// Example: Simple EVM execution (synchronous)
func ExampleEVM_Execute_simple() {
	// Create EVM instance for Cancun hardfork
	evmInstance, err := evm.NewEVM(evm.HardforkCancun.String(), evm.LogLevelError)
	if err != nil {
		log.Fatal(err)
	}
	defer evmInstance.Close()

	// Simple bytecode: PUSH1 0x01, PUSH1 0x02, ADD, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
	// This adds 1 + 2 and returns the result
	bytecode := guillotine.MustParseBytecode("60016002016000526020600​0f3")

	// Set bytecode
	if err := evm.SetBytecode(bytecode); err != nil {
		log.Fatal(err)
	}

	// Set execution context
	ctx := guillotine.ExecutionContext{
		Gas:      1000000, // 1M gas
		Caller:   guillotine.ZeroAddress,
		Address:  guillotine.MustAddressFromHex("0x1000000000000000000000000000000000000000"),
		Value:    guillotine.ZeroU256,
		Calldata: nil,
	}
	if err := evm.SetExecutionContext(ctx); err != nil {
		log.Fatal(err)
	}

	// Set blockchain context
	blockCtx := guillotine.BlockContext{
		ChainID:        guillotine.U256FromUint64(1), // Mainnet
		BlockNumber:    1000000,
		BlockTimestamp: 1234567890,
		Difficulty:     guillotine.ZeroU256,
		Prevrandao:     guillotine.ZeroU256,
		Coinbase:       guillotine.ZeroAddress,
		GasLimit:       30000000,
		BaseFee:        guillotine.U256FromUint64(1000000000), // 1 gwei
		BlobBaseFee:    guillotine.U256FromUint64(1),
	}
	evm.SetBlockchainContext(blockCtx)

	// Execute
	result, err := evm.Execute()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Success: %v\n", result.Success)
	fmt.Printf("Gas used: %d\n", result.GasUsed)
	fmt.Printf("Output: 0x%x\n", result.Output)
}

// Example: EVM with pre-loaded state
func ExampleEVM_Execute_withState() {
	evm, err := guillotine.NewEVM(guillotine.HardforkCancun.String(), guillotine.LogLevelError)
	if err != nil {
		log.Fatal(err)
	}
	defer evm.Close()

	// Contract that reads from storage slot 0 and returns it
	// PUSH1 0x00, SLOAD, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
	bytecode := guillotine.MustParseBytecode("6000546000526020600​0f3")

	contractAddr := guillotine.MustAddressFromHex("0x1000000000000000000000000000000000000001")

	// Pre-load storage: slot 0 = 42
	slot := guillotine.ZeroU256
	value := guillotine.U256FromUint64(42)
	if err := evm.SetStorage(contractAddr, slot, value); err != nil {
		log.Fatal(err)
	}

	// Set bytecode and execute
	if err := evm.SetBytecode(bytecode); err != nil {
		log.Fatal(err)
	}

	ctx := guillotine.ExecutionContext{
		Gas:     1000000,
		Caller:  guillotine.ZeroAddress,
		Address: contractAddr,
		Value:   guillotine.ZeroU256,
	}
	if err := evm.SetExecutionContext(ctx); err != nil {
		log.Fatal(err)
	}

	blockCtx := guillotine.BlockContext{
		ChainID:     guillotine.U256FromUint64(1),
		BlockNumber: 1000000,
		GasLimit:    30000000,
	}
	evm.SetBlockchainContext(blockCtx)

	result, err := evm.Execute()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Output: %d\n", guillotine.U256FromBig(result.Output).Uint64())
	// Output: 42
}

// Example: Async execution with state backend
func ExampleEVM_ExecuteAsync() {
	// Create a simple in-memory state backend
	backend := &SimpleStateBackend{
		storage:  make(map[string]map[string]guillotine.U256),
		balances: make(map[string]guillotine.U256),
		code:     make(map[string][]byte),
		nonces:   make(map[string]uint64),
	}

	// Pre-populate some state
	contractAddr := guillotine.MustAddressFromHex("0x1000000000000000000000000000000000000001")
	backend.SetStorage(contractAddr, guillotine.ZeroU256, guillotine.U256FromUint64(100))

	// Create EVM
	evm, err := guillotine.NewEVM(guillotine.HardforkCancun.String(), guillotine.LogLevelError)
	if err != nil {
		log.Fatal(err)
	}
	defer evm.Close()

	// Contract that reads storage and returns it
	bytecode := guillotine.MustParseBytecode("6000546000526020600​0f3")

	if err := evm.SetBytecode(bytecode); err != nil {
		log.Fatal(err)
	}

	ctx := guillotine.ExecutionContext{
		Gas:     1000000,
		Caller:  guillotine.ZeroAddress,
		Address: contractAddr,
		Value:   guillotine.ZeroU256,
	}
	if err := evm.SetExecutionContext(ctx); err != nil {
		log.Fatal(err)
	}

	blockCtx := guillotine.BlockContext{
		ChainID:     guillotine.U256FromUint64(1),
		BlockNumber: 1000000,
		GasLimit:    30000000,
	}
	evm.SetBlockchainContext(blockCtx)

	// Execute with async state loading
	result, err := evm.ExecuteAsync(backend)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Success: %v\n", result.Success)
	fmt.Printf("Output value: %d\n", guillotine.U256FromBytes(result.Output).Uint64())
}

// SimpleStateBackend is a simple in-memory state backend for testing
type SimpleStateBackend struct {
	storage  map[string]map[string]guillotine.U256 // address -> slot -> value
	balances map[string]guillotine.U256
	code     map[string][]byte
	nonces   map[string]uint64
}

func (b *SimpleStateBackend) GetStorage(address guillotine.Address, slot guillotine.U256) (guillotine.U256, error) {
	addrKey := address.Hex()
	slotKey := slot.Hex()

	if slots, ok := b.storage[addrKey]; ok {
		if value, ok := slots[slotKey]; ok {
			return value, nil
		}
	}
	return guillotine.ZeroU256, nil
}

func (b *SimpleStateBackend) SetStorage(address guillotine.Address, slot guillotine.U256, value guillotine.U256) {
	addrKey := address.Hex()
	slotKey := slot.Hex()

	if _, ok := b.storage[addrKey]; !ok {
		b.storage[addrKey] = make(map[string]guillotine.U256)
	}
	b.storage[addrKey][slotKey] = value
}

func (b *SimpleStateBackend) GetBalance(address guillotine.Address) (guillotine.U256, error) {
	if balance, ok := b.balances[address.Hex()]; ok {
		return balance, nil
	}
	return guillotine.ZeroU256, nil
}

func (b *SimpleStateBackend) GetCode(address guillotine.Address) ([]byte, error) {
	if code, ok := b.code[address.Hex()]; ok {
		return code, nil
	}
	return nil, nil
}

func (b *SimpleStateBackend) GetNonce(address guillotine.Address) (uint64, error) {
	if nonce, ok := b.nonces[address.Hex()]; ok {
		return nonce, nil
	}
	return 0, nil
}

func (b *SimpleStateBackend) CommitStateChanges(changesJSON []byte) error {
	// In a real implementation, you would parse the JSON and apply changes
	fmt.Printf("Committing state changes: %s\n", string(changesJSON))
	return nil
}

// Example: Using EIP-2930 access lists
func ExampleEVM_SetAccessList() {
	evm, err := guillotine.NewEVM(guillotine.HardforkBerlin.String(), guillotine.LogLevelError)
	if err != nil {
		log.Fatal(err)
	}
	defer evm.Close()

	// Create access list
	accessList := &guillotine.AccessList{
		Addresses: []guillotine.Address{
			guillotine.MustAddressFromHex("0x1000000000000000000000000000000000000001"),
			guillotine.MustAddressFromHex("0x2000000000000000000000000000000000000002"),
		},
		StorageKeys: []guillotine.StorageKey{
			{
				Address: guillotine.MustAddressFromHex("0x1000000000000000000000000000000000000001"),
				Slot:    guillotine.ZeroU256,
			},
		},
	}

	if err := evm.SetAccessList(accessList); err != nil {
		log.Fatal(err)
	}

	// Now execute with the access list set
	// Accessing these addresses/slots will be cheaper (warm access)
}
