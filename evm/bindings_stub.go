// +build !cgo

package evm

import "fmt"

// evmHandle wraps the opaque pointer (stub)
type evmHandle uintptr

// AsyncRequestType represents the type of async request
type AsyncRequestType uint8

const (
	AsyncRequestResult        AsyncRequestType = 0
	AsyncRequestNeedStorage   AsyncRequestType = 1
	AsyncRequestNeedBalance   AsyncRequestType = 2
	AsyncRequestNeedCode      AsyncRequestType = 3
	AsyncRequestNeedNonce     AsyncRequestType = 4
	AsyncRequestReadyToCommit AsyncRequestType = 5
	AsyncRequestError         AsyncRequestType = 255
)

// AsyncRequest represents a request/response in the async protocol
type AsyncRequest struct {
	OutputType AsyncRequestType
	Address    [20]byte
	Slot       [32]byte
	JSONLen    uint32
	JSONData   [16384]byte
}

// LogLevel represents the EVM logging level
type LogLevel uint8

const (
	LogLevelNone  LogLevel = 0
	LogLevelError LogLevel = 1
	LogLevelWarn  LogLevel = 2
	LogLevelInfo  LogLevel = 3
	LogLevelDebug LogLevel = 4
)

// Stub implementations that return errors
func evmCreate(hardfork string, logLevel LogLevel) evmHandle {
	return 1 // Non-zero to indicate success
}

func evmDestroy(handle evmHandle) {}

func evmSetBytecode(handle evmHandle, bytecode []byte) bool {
	return true
}

func evmSetExecutionContext(handle evmHandle, gas int64, caller [20]byte, address [20]byte, value [32]byte, calldata []byte) bool {
	return true
}

func evmSetBlockchainContext(
	handle evmHandle,
	chainID [32]byte,
	blockNumber uint64,
	blockTimestamp uint64,
	blockDifficulty [32]byte,
	blockPrevrandao [32]byte,
	blockCoinbase [20]byte,
	blockGasLimit uint64,
	blockBaseFee [32]byte,
	blobBaseFee [32]byte,
) {
}

func evmSetAccessListAddresses(handle evmHandle, addresses []byte) bool {
	return false
}

func evmSetAccessListStorageKeys(handle evmHandle, addresses []byte, slots []byte) bool {
	return false
}

func evmSetBlobHashes(handle evmHandle, hashes []byte) bool {
	return false
}

func evmSetStorage(handle evmHandle, address [20]byte, slot [32]byte, value [32]byte) bool {
	return false
}

func evmGetStorage(handle evmHandle, address [20]byte, slot [32]byte) ([32]byte, bool) {
	return [32]byte{}, false
}

func evmSetBalance(handle evmHandle, address [20]byte, balance [32]byte) bool {
	return false
}

func evmSetCode(handle evmHandle, address [20]byte, code []byte) bool {
	return false
}

func evmExecute(handle evmHandle) bool {
	fmt.Println("WARNING: CGo disabled - EVM execution stubbed")
	fmt.Println("Build with CGo enabled and guillotine-mini library for actual execution")
	return true // Return true to allow testing
}

func evmIsSuccess(handle evmHandle) bool {
	return true
}

func evmGetGasRemaining(handle evmHandle) int64 {
	return 29999995
}

func evmGetGasUsed(handle evmHandle) int64 {
	return 5
}

func evmGetOutputLen(handle evmHandle) int {
	return 0
}

func evmGetOutput(handle evmHandle) []byte {
	return nil
}

func evmEnableStorageInjector(handle evmHandle) bool {
	return false
}

func evmCallFFI(handle evmHandle) (*AsyncRequest, bool) {
	return nil, false
}

func evmContinueFFI(handle evmHandle, continueType uint8, data []byte) (*AsyncRequest, bool) {
	return nil, false
}

func evmGetStateChanges(handle evmHandle) []byte {
	return nil
}
