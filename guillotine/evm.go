package guillotine

import (
	"encoding/hex"
	"fmt"
)

// Address represents a 20-byte Ethereum address
type Address [20]byte

// U256 represents a 32-byte unsigned integer
type U256 [32]byte

// EVM represents a Guillotine EVM instance
type EVM struct {
	handle evmHandle
}

// ExecutionContext holds the parameters for EVM execution
type ExecutionContext struct {
	Gas      int64
	Caller   Address
	Address  Address
	Value    U256
	Calldata []byte
}

// BlockContext holds blockchain-level parameters
type BlockContext struct {
	ChainID        U256
	BlockNumber    uint64
	BlockTimestamp uint64
	Difficulty     U256
	Prevrandao     U256
	Coinbase       Address
	GasLimit       uint64
	BaseFee        U256
	BlobBaseFee    U256
}

// AccessList represents EIP-2930 access list
type AccessList struct {
	Addresses   []Address
	StorageKeys []StorageKey
}

// StorageKey represents an address+slot pair
type StorageKey struct {
	Address Address
	Slot    U256
}

// ExecutionResult holds the result of EVM execution
type ExecutionResult struct {
	Success      bool
	GasUsed      int64
	GasRemaining int64
	Output       []byte
}

// NewEVM creates a new EVM instance
func NewEVM(hardfork string, logLevel LogLevel) (*EVM, error) {
	handle := evmCreate(hardfork, logLevel)
	if handle == nil {
		return nil, fmt.Errorf("failed to create EVM instance")
	}

	return &EVM{handle: handle}, nil
}

// Close destroys the EVM instance and frees resources
func (e *EVM) Close() {
	if e.handle != nil {
		evmDestroy(e.handle)
		e.handle = nil
	}
}

// SetBytecode sets the contract bytecode to execute
func (e *EVM) SetBytecode(bytecode []byte) error {
	if !evmSetBytecode(e.handle, bytecode) {
		return fmt.Errorf("failed to set bytecode")
	}
	return nil
}

// SetExecutionContext sets the execution parameters
func (e *EVM) SetExecutionContext(ctx ExecutionContext) error {
	if !evmSetExecutionContext(
		e.handle,
		ctx.Gas,
		ctx.Caller,
		ctx.Address,
		ctx.Value,
		ctx.Calldata,
	) {
		return fmt.Errorf("failed to set execution context")
	}
	return nil
}

// SetBlockchainContext sets blockchain-level parameters
func (e *EVM) SetBlockchainContext(ctx BlockContext) {
	evmSetBlockchainContext(
		e.handle,
		ctx.ChainID,
		ctx.BlockNumber,
		ctx.BlockTimestamp,
		ctx.Difficulty,
		ctx.Prevrandao,
		ctx.Coinbase,
		ctx.GasLimit,
		ctx.BaseFee,
		ctx.BlobBaseFee,
	)
}

// SetAccessList sets the EIP-2930 access list
func (e *EVM) SetAccessList(accessList *AccessList) error {
	if accessList == nil {
		evmSetAccessListAddresses(e.handle, nil)
		evmSetAccessListStorageKeys(e.handle, nil, nil)
		return nil
	}

	// Pack addresses
	if len(accessList.Addresses) > 0 {
		addresses := make([]byte, len(accessList.Addresses)*20)
		for i, addr := range accessList.Addresses {
			copy(addresses[i*20:(i+1)*20], addr[:])
		}
		if !evmSetAccessListAddresses(e.handle, addresses) {
			return fmt.Errorf("failed to set access list addresses")
		}
	}

	// Pack storage keys
	if len(accessList.StorageKeys) > 0 {
		addresses := make([]byte, len(accessList.StorageKeys)*20)
		slots := make([]byte, len(accessList.StorageKeys)*32)
		for i, key := range accessList.StorageKeys {
			copy(addresses[i*20:(i+1)*20], key.Address[:])
			copy(slots[i*32:(i+1)*32], key.Slot[:])
		}
		if !evmSetAccessListStorageKeys(e.handle, addresses, slots) {
			return fmt.Errorf("failed to set access list storage keys")
		}
	}

	return nil
}

// SetBlobHashes sets the EIP-4844 blob versioned hashes
func (e *EVM) SetBlobHashes(hashes [][32]byte) error {
	if len(hashes) == 0 {
		evmSetBlobHashes(e.handle, nil)
		return nil
	}

	packed := make([]byte, len(hashes)*32)
	for i, hash := range hashes {
		copy(packed[i*32:(i+1)*32], hash[:])
	}

	if !evmSetBlobHashes(e.handle, packed) {
		return fmt.Errorf("failed to set blob hashes")
	}
	return nil
}

// SetStorage sets a storage slot value
func (e *EVM) SetStorage(address Address, slot U256, value U256) error {
	if !evmSetStorage(e.handle, address, slot, value) {
		return fmt.Errorf("failed to set storage")
	}
	return nil
}

// GetStorage retrieves a storage slot value
func (e *EVM) GetStorage(address Address, slot U256) (U256, error) {
	value, ok := evmGetStorage(e.handle, address, slot)
	if !ok {
		return U256{}, fmt.Errorf("failed to get storage")
	}
	return value, nil
}

// SetBalance sets an account balance
func (e *EVM) SetBalance(address Address, balance U256) error {
	if !evmSetBalance(e.handle, address, balance) {
		return fmt.Errorf("failed to set balance")
	}
	return nil
}

// SetCode sets contract code for an address
func (e *EVM) SetCode(address Address, code []byte) error {
	if !evmSetCode(e.handle, address, code) {
		return fmt.Errorf("failed to set code")
	}
	return nil
}

// Execute runs the EVM with the configured context (synchronous)
func (e *EVM) Execute() (*ExecutionResult, error) {
	if !evmExecute(e.handle) {
		return nil, fmt.Errorf("execution failed")
	}

	return &ExecutionResult{
		Success:      evmIsSuccess(e.handle),
		GasUsed:      evmGetGasUsed(e.handle),
		GasRemaining: evmGetGasRemaining(e.handle),
		Output:       evmGetOutput(e.handle),
	}, nil
}

// String returns a human-readable representation of the execution result
func (r *ExecutionResult) String() string {
	status := "FAILURE"
	if r.Success {
		status = "SUCCESS"
	}
	return fmt.Sprintf("ExecutionResult{Status: %s, GasUsed: %d, GasRemaining: %d, Output: 0x%s}",
		status, r.GasUsed, r.GasRemaining, hex.EncodeToString(r.Output))
}

// StateBackend defines the interface for providing state to the EVM asynchronously
type StateBackend interface {
	GetStorage(address Address, slot U256) (U256, error)
	GetBalance(address Address) (U256, error)
	GetCode(address Address) ([]byte, error)
	GetNonce(address Address) (uint64, error)
	CommitStateChanges(changesJSON []byte) error
}

// ExecuteAsync runs the EVM with async state loading from the backend
func (e *EVM) ExecuteAsync(backend StateBackend) (*ExecutionResult, error) {
	// Enable storage injector
	if !evmEnableStorageInjector(e.handle) {
		return nil, fmt.Errorf("failed to enable storage injector")
	}

	// Start execution
	req, ok := evmCallFFI(e.handle)
	if !ok {
		return nil, fmt.Errorf("failed to start async execution")
	}

	// Process requests until completion
	for req.OutputType != AsyncRequestResult && req.OutputType != AsyncRequestReadyToCommit {
		if req.OutputType == AsyncRequestError {
			return nil, fmt.Errorf("execution error")
		}

		var continueData []byte
		var continueType uint8

		switch req.OutputType {
		case AsyncRequestNeedStorage:
			// Fetch storage from backend
			value, err := backend.GetStorage(req.Address, req.Slot)
			if err != nil {
				return nil, fmt.Errorf("failed to get storage: %w", err)
			}

			// Pack response: address(20) + slot(32) + value(32) = 84 bytes
			continueData = make([]byte, 84)
			copy(continueData[0:20], req.Address[:])
			copy(continueData[20:52], req.Slot[:])
			copy(continueData[52:84], value[:])
			continueType = 1

		case AsyncRequestNeedBalance:
			// Fetch balance from backend
			balance, err := backend.GetBalance(req.Address)
			if err != nil {
				return nil, fmt.Errorf("failed to get balance: %w", err)
			}

			// Pack response: address(20) + balance(32) = 52 bytes
			continueData = make([]byte, 52)
			copy(continueData[0:20], req.Address[:])
			copy(continueData[20:52], balance[:])
			continueType = 2

		case AsyncRequestNeedCode:
			// Fetch code from backend
			code, err := backend.GetCode(req.Address)
			if err != nil {
				return nil, fmt.Errorf("failed to get code: %w", err)
			}
			// TODO: Handle code response
			_ = code
			return nil, fmt.Errorf("code requests not yet implemented")

		case AsyncRequestNeedNonce:
			// Fetch nonce from backend
			nonce, err := backend.GetNonce(req.Address)
			if err != nil {
				return nil, fmt.Errorf("failed to get nonce: %w", err)
			}
			// TODO: Handle nonce response
			_ = nonce
			return nil, fmt.Errorf("nonce requests not yet implemented")

		default:
			return nil, fmt.Errorf("unknown request type: %d", req.OutputType)
		}

		// Continue execution with response
		req, ok = evmContinueFFI(e.handle, continueType, continueData)
		if !ok {
			return nil, fmt.Errorf("failed to continue async execution")
		}
	}

	// Handle completion
	if req.OutputType == AsyncRequestReadyToCommit {
		// Get state changes JSON
		changesJSON := req.JSONData[:req.JSONLen]

		// Commit state changes via backend
		if err := backend.CommitStateChanges(changesJSON); err != nil {
			return nil, fmt.Errorf("failed to commit state changes: %w", err)
		}

		// Continue after commit
		req, ok = evmContinueFFI(e.handle, 5, nil)
		if !ok {
			return nil, fmt.Errorf("failed to continue after commit")
		}

		// Should now be at result
		if req.OutputType != AsyncRequestResult {
			return nil, fmt.Errorf("expected result after commit, got type %d", req.OutputType)
		}
	}

	// Return final result
	return &ExecutionResult{
		Success:      evmIsSuccess(e.handle),
		GasUsed:      evmGetGasUsed(e.handle),
		GasRemaining: evmGetGasRemaining(e.handle),
		Output:       evmGetOutput(e.handle),
	}, nil
}
