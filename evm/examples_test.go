//go:build integration
// +build integration

// Package evm_test contains examples for the EVM package.
// These tests require a working guillotine-mini integration (WASM or native library).
// Run with: go test -tags=integration ./evm/...
//
// See evm/INTEGRATION_NOTES.md for setup instructions.
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
	bytecode := evm.MustParseBytecode("60016002016000526020600​0f3")

	// Set bytecode
	if err := evmInstance.SetBytecode(bytecode); err != nil {
		log.Fatal(err)
	}

	// Set execution context
	ctx := evm.ExecutionContext{
		Gas:      1000000, // 1M gas
		Caller:   evm.ZeroAddress,
		Address:  evm.MustAddressFromHex("0x1000000000000000000000000000000000000000"),
		Value:    evm.ZeroU256,
		Calldata: nil,
	}
	if err := evmInstance.SetExecutionContext(ctx); err != nil {
		log.Fatal(err)
	}

	// Set blockchain context
	blockCtx := evm.BlockContext{
		ChainID:        evm.U256FromUint64(1), // Mainnet
		BlockNumber:    1000000,
		BlockTimestamp: 1234567890,
		Difficulty:     evm.ZeroU256,
		Prevrandao:     evm.ZeroU256,
		Coinbase:       evm.ZeroAddress,
		GasLimit:       30000000,
		BaseFee:        evm.U256FromUint64(1000000000), // 1 gwei
		BlobBaseFee:    evm.U256FromUint64(1),
	}
	evmInstance.SetBlockchainContext(blockCtx)

	// Execute
	result, err := evmInstance.Execute()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Success: %v\n", result.Success)
	fmt.Printf("Gas used: %d\n", result.GasUsed)
	fmt.Printf("Output: 0x%x\n", result.Output)
}

// Example: EVM with pre-loaded state
func ExampleEVM_Execute_withState() {
	evmInstance, err := evm.NewEVM(evm.HardforkCancun.String(), evm.LogLevelError)
	if err != nil {
		log.Fatal(err)
	}
	defer evmInstance.Close()

	// Contract that reads from storage slot 0 and returns it
	// PUSH1 0x00, SLOAD, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
	bytecode := evm.MustParseBytecode("6000546000526020600​0f3")

	contractAddr := evm.MustAddressFromHex("0x1000000000000000000000000000000000000001")

	// Pre-load storage: slot 0 = 42
	slot := evm.ZeroU256
	value := evm.U256FromUint64(42)
	if err := evmInstance.SetStorage(contractAddr, slot, value); err != nil {
		log.Fatal(err)
	}

	// Set bytecode and execute
	if err := evmInstance.SetBytecode(bytecode); err != nil {
		log.Fatal(err)
	}

	ctx := evm.ExecutionContext{
		Gas:     1000000,
		Caller:  evm.ZeroAddress,
		Address: contractAddr,
		Value:   evm.ZeroU256,
	}
	if err := evmInstance.SetExecutionContext(ctx); err != nil {
		log.Fatal(err)
	}

	blockCtx := evm.BlockContext{
		ChainID:     evm.U256FromUint64(1),
		BlockNumber: 1000000,
		GasLimit:    30000000,
	}
	evmInstance.SetBlockchainContext(blockCtx)

	result, err := evmInstance.Execute()
	if err != nil {
		log.Fatal(err)
	}

	// Convert output bytes to U256 and print
	outputU256, _ := evm.U256FromBytes(result.Output)
	fmt.Printf("Output: %d\n", outputU256.Uint64())
	// Output: 42
}

// Example: Async execution with state backend
func ExampleEVM_ExecuteAsync() {
	// Create a simple in-memory state backend
	backend := &SimpleStateBackend{
		storage:  make(map[string]map[string]evm.U256),
		balances: make(map[string]evm.U256),
		code:     make(map[string][]byte),
		nonces:   make(map[string]uint64),
	}

	// Pre-populate some state
	contractAddr := evm.MustAddressFromHex("0x1000000000000000000000000000000000000001")
	backend.SetStorage(contractAddr, evm.ZeroU256, evm.U256FromUint64(100))

	// Create EVM
	evmInstance, err := evm.NewEVM(evm.HardforkCancun.String(), evm.LogLevelError)
	if err != nil {
		log.Fatal(err)
	}
	defer evmInstance.Close()

	// Contract that reads storage and returns it
	bytecode := evm.MustParseBytecode("6000546000526020600​0f3")

	if err := evmInstance.SetBytecode(bytecode); err != nil {
		log.Fatal(err)
	}

	ctx := evm.ExecutionContext{
		Gas:     1000000,
		Caller:  evm.ZeroAddress,
		Address: contractAddr,
		Value:   evm.ZeroU256,
	}
	if err := evmInstance.SetExecutionContext(ctx); err != nil {
		log.Fatal(err)
	}

	blockCtx := evm.BlockContext{
		ChainID:     evm.U256FromUint64(1),
		BlockNumber: 1000000,
		GasLimit:    30000000,
	}
	evmInstance.SetBlockchainContext(blockCtx)

	// Execute with async state loading
	result, err := evmInstance.ExecuteAsync(backend)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Success: %v\n", result.Success)
	outputU256, _ := evm.U256FromBytes(result.Output)
	fmt.Printf("Output value: %d\n", outputU256.Uint64())
}

// SimpleStateBackend is a simple in-memory state backend for testing
type SimpleStateBackend struct {
	storage  map[string]map[string]evm.U256 // address -> slot -> value
	balances map[string]evm.U256
	code     map[string][]byte
	nonces   map[string]uint64
}

func (b *SimpleStateBackend) GetStorage(address evm.Address, slot evm.U256) (evm.U256, error) {
	addrKey := address.Hex()
	slotKey := slot.Hex()

	if slots, ok := b.storage[addrKey]; ok {
		if value, ok := slots[slotKey]; ok {
			return value, nil
		}
	}
	return evm.ZeroU256, nil
}

func (b *SimpleStateBackend) SetStorage(address evm.Address, slot evm.U256, value evm.U256) {
	addrKey := address.Hex()
	slotKey := slot.Hex()

	if _, ok := b.storage[addrKey]; !ok {
		b.storage[addrKey] = make(map[string]evm.U256)
	}
	b.storage[addrKey][slotKey] = value
}

func (b *SimpleStateBackend) GetBalance(address evm.Address) (evm.U256, error) {
	if balance, ok := b.balances[address.Hex()]; ok {
		return balance, nil
	}
	return evm.ZeroU256, nil
}

func (b *SimpleStateBackend) GetCode(address evm.Address) ([]byte, error) {
	if code, ok := b.code[address.Hex()]; ok {
		return code, nil
	}
	return nil, nil
}

func (b *SimpleStateBackend) GetNonce(address evm.Address) (uint64, error) {
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
	evmInstance, err := evm.NewEVM(evm.HardforkBerlin.String(), evm.LogLevelError)
	if err != nil {
		log.Fatal(err)
	}
	defer evmInstance.Close()

	// Create access list
	accessList := &evm.AccessList{
		Addresses: []evm.Address{
			evm.MustAddressFromHex("0x1000000000000000000000000000000000000001"),
			evm.MustAddressFromHex("0x2000000000000000000000000000000000000002"),
		},
		StorageKeys: []evm.StorageKey{
			{
				Address: evm.MustAddressFromHex("0x1000000000000000000000000000000000000001"),
				Slot:    evm.ZeroU256,
			},
		},
	}

	if err := evmInstance.SetAccessList(accessList); err != nil {
		log.Fatal(err)
	}

	// Now execute with the access list set
	// Accessing these addresses/slots will be cheaper (warm access)
	fmt.Println("Access list configured successfully")
}
