package guillotine

// #cgo LDFLAGS: -L${SRCDIR}/../../lib/guillotine-mini/zig-out/bin -lwasm
// #include <stdint.h>
// #include <stdbool.h>
// #include <stdlib.h>
//
// // Opaque handle for EVM instance
// typedef void* EvmHandle;
//
// // Async request structure
// typedef struct {
//     uint8_t output_type;
//     uint8_t address[20];
//     uint8_t slot[32];
//     uint32_t json_len;
//     uint8_t json_data[16384];
// } AsyncRequest;
//
// // Lifecycle
// extern EvmHandle evm_create(const uint8_t* hardfork_name, size_t hardfork_len, uint8_t log_level);
// extern void evm_destroy(EvmHandle handle);
//
// // Configuration
// extern bool evm_set_bytecode(EvmHandle handle, const uint8_t* bytecode, size_t bytecode_len);
// extern bool evm_set_execution_context(
//     EvmHandle handle,
//     int64_t gas,
//     const uint8_t* caller_bytes,
//     const uint8_t* address_bytes,
//     const uint8_t* value_bytes,
//     const uint8_t* calldata,
//     size_t calldata_len
// );
// extern void evm_set_blockchain_context(
//     EvmHandle handle,
//     const uint8_t* chain_id_bytes,
//     uint64_t block_number,
//     uint64_t block_timestamp,
//     const uint8_t* block_difficulty_bytes,
//     const uint8_t* block_prevrandao_bytes,
//     const uint8_t* block_coinbase_bytes,
//     uint64_t block_gas_limit,
//     const uint8_t* block_base_fee_bytes,
//     const uint8_t* blob_base_fee_bytes
// );
//
// // Access lists
// extern bool evm_set_access_list_addresses(EvmHandle handle, const uint8_t* addresses, size_t count);
// extern bool evm_set_access_list_storage_keys(EvmHandle handle, const uint8_t* addresses, const uint8_t* slots, size_t count);
// extern bool evm_set_blob_hashes(EvmHandle handle, const uint8_t* hashes, size_t count);
//
// // State management
// extern bool evm_set_storage(EvmHandle handle, const uint8_t* address_bytes, const uint8_t* slot_bytes, const uint8_t* value_bytes);
// extern bool evm_get_storage(EvmHandle handle, const uint8_t* address_bytes, const uint8_t* slot_bytes, uint8_t* value_bytes);
// extern bool evm_set_balance(EvmHandle handle, const uint8_t* address_bytes, const uint8_t* balance_bytes);
// extern bool evm_set_code(EvmHandle handle, const uint8_t* address_bytes, const uint8_t* code, size_t code_len);
//
// // Synchronous execution
// extern bool evm_execute(EvmHandle handle);
//
// // Results
// extern bool evm_is_success(EvmHandle handle);
// extern int64_t evm_get_gas_remaining(EvmHandle handle);
// extern int64_t evm_get_gas_used(EvmHandle handle);
// extern size_t evm_get_output_len(EvmHandle handle);
// extern size_t evm_get_output(EvmHandle handle, uint8_t* buffer, size_t buffer_len);
//
// // Async protocol
// extern bool evm_enable_storage_injector(EvmHandle handle);
// extern bool evm_call_ffi(EvmHandle handle, AsyncRequest* request_out);
// extern bool evm_continue_ffi(EvmHandle handle, uint8_t continue_type, const uint8_t* data_ptr, size_t data_len, AsyncRequest* request_out);
// extern size_t evm_get_state_changes(EvmHandle handle, uint8_t* buffer, size_t buffer_len);
import "C"
import (
	"unsafe"
)

// evmHandle wraps the opaque C pointer
type evmHandle C.EvmHandle

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

// Low-level C bindings

func evmCreate(hardfork string, logLevel LogLevel) evmHandle {
	var hardforkPtr *C.uint8_t
	var hardforkLen C.size_t

	if hardfork != "" {
		hardforkBytes := []byte(hardfork)
		hardforkPtr = (*C.uint8_t)(unsafe.Pointer(&hardforkBytes[0]))
		hardforkLen = C.size_t(len(hardforkBytes))
	}

	return evmHandle(C.evm_create(hardforkPtr, hardforkLen, C.uint8_t(logLevel)))
}

func evmDestroy(handle evmHandle) {
	C.evm_destroy(C.EvmHandle(handle))
}

func evmSetBytecode(handle evmHandle, bytecode []byte) bool {
	if len(bytecode) == 0 {
		return false
	}
	return bool(C.evm_set_bytecode(
		C.EvmHandle(handle),
		(*C.uint8_t)(unsafe.Pointer(&bytecode[0])),
		C.size_t(len(bytecode)),
	))
}

func evmSetExecutionContext(handle evmHandle, gas int64, caller [20]byte, address [20]byte, value [32]byte, calldata []byte) bool {
	var calldataPtr *C.uint8_t
	var calldataLen C.size_t

	if len(calldata) > 0 {
		calldataPtr = (*C.uint8_t)(unsafe.Pointer(&calldata[0]))
		calldataLen = C.size_t(len(calldata))
	}

	return bool(C.evm_set_execution_context(
		C.EvmHandle(handle),
		C.int64_t(gas),
		(*C.uint8_t)(unsafe.Pointer(&caller[0])),
		(*C.uint8_t)(unsafe.Pointer(&address[0])),
		(*C.uint8_t)(unsafe.Pointer(&value[0])),
		calldataPtr,
		calldataLen,
	))
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
	C.evm_set_blockchain_context(
		C.EvmHandle(handle),
		(*C.uint8_t)(unsafe.Pointer(&chainID[0])),
		C.uint64_t(blockNumber),
		C.uint64_t(blockTimestamp),
		(*C.uint8_t)(unsafe.Pointer(&blockDifficulty[0])),
		(*C.uint8_t)(unsafe.Pointer(&blockPrevrandao[0])),
		(*C.uint8_t)(unsafe.Pointer(&blockCoinbase[0])),
		C.uint64_t(blockGasLimit),
		(*C.uint8_t)(unsafe.Pointer(&blockBaseFee[0])),
		(*C.uint8_t)(unsafe.Pointer(&blobBaseFee[0])),
	)
}

func evmSetAccessListAddresses(handle evmHandle, addresses []byte) bool {
	if len(addresses) == 0 {
		return bool(C.evm_set_access_list_addresses(C.EvmHandle(handle), nil, 0))
	}
	count := len(addresses) / 20
	return bool(C.evm_set_access_list_addresses(
		C.EvmHandle(handle),
		(*C.uint8_t)(unsafe.Pointer(&addresses[0])),
		C.size_t(count),
	))
}

func evmSetAccessListStorageKeys(handle evmHandle, addresses []byte, slots []byte) bool {
	if len(addresses) == 0 || len(slots) == 0 {
		return bool(C.evm_set_access_list_storage_keys(C.EvmHandle(handle), nil, nil, 0))
	}
	count := len(addresses) / 20
	return bool(C.evm_set_access_list_storage_keys(
		C.EvmHandle(handle),
		(*C.uint8_t)(unsafe.Pointer(&addresses[0])),
		(*C.uint8_t)(unsafe.Pointer(&slots[0])),
		C.size_t(count),
	))
}

func evmSetBlobHashes(handle evmHandle, hashes []byte) bool {
	if len(hashes) == 0 {
		return bool(C.evm_set_blob_hashes(C.EvmHandle(handle), nil, 0))
	}
	count := len(hashes) / 32
	return bool(C.evm_set_blob_hashes(
		C.EvmHandle(handle),
		(*C.uint8_t)(unsafe.Pointer(&hashes[0])),
		C.size_t(count),
	))
}

func evmSetStorage(handle evmHandle, address [20]byte, slot [32]byte, value [32]byte) bool {
	return bool(C.evm_set_storage(
		C.EvmHandle(handle),
		(*C.uint8_t)(unsafe.Pointer(&address[0])),
		(*C.uint8_t)(unsafe.Pointer(&slot[0])),
		(*C.uint8_t)(unsafe.Pointer(&value[0])),
	))
}

func evmGetStorage(handle evmHandle, address [20]byte, slot [32]byte) ([32]byte, bool) {
	var value [32]byte
	success := bool(C.evm_get_storage(
		C.EvmHandle(handle),
		(*C.uint8_t)(unsafe.Pointer(&address[0])),
		(*C.uint8_t)(unsafe.Pointer(&slot[0])),
		(*C.uint8_t)(unsafe.Pointer(&value[0])),
	))
	return value, success
}

func evmSetBalance(handle evmHandle, address [20]byte, balance [32]byte) bool {
	return bool(C.evm_set_balance(
		C.EvmHandle(handle),
		(*C.uint8_t)(unsafe.Pointer(&address[0])),
		(*C.uint8_t)(unsafe.Pointer(&balance[0])),
	))
}

func evmSetCode(handle evmHandle, address [20]byte, code []byte) bool {
	if len(code) == 0 {
		return bool(C.evm_set_code(C.EvmHandle(handle), (*C.uint8_t)(unsafe.Pointer(&address[0])), nil, 0))
	}
	return bool(C.evm_set_code(
		C.EvmHandle(handle),
		(*C.uint8_t)(unsafe.Pointer(&address[0])),
		(*C.uint8_t)(unsafe.Pointer(&code[0])),
		C.size_t(len(code)),
	))
}

func evmExecute(handle evmHandle) bool {
	return bool(C.evm_execute(C.EvmHandle(handle)))
}

func evmIsSuccess(handle evmHandle) bool {
	return bool(C.evm_is_success(C.EvmHandle(handle)))
}

func evmGetGasRemaining(handle evmHandle) int64 {
	return int64(C.evm_get_gas_remaining(C.EvmHandle(handle)))
}

func evmGetGasUsed(handle evmHandle) int64 {
	return int64(C.evm_get_gas_used(C.EvmHandle(handle)))
}

func evmGetOutputLen(handle evmHandle) int {
	return int(C.evm_get_output_len(C.EvmHandle(handle)))
}

func evmGetOutput(handle evmHandle) []byte {
	length := evmGetOutputLen(handle)
	if length == 0 {
		return nil
	}

	buffer := make([]byte, length)
	C.evm_get_output(
		C.EvmHandle(handle),
		(*C.uint8_t)(unsafe.Pointer(&buffer[0])),
		C.size_t(length),
	)
	return buffer
}

func evmEnableStorageInjector(handle evmHandle) bool {
	return bool(C.evm_enable_storage_injector(C.EvmHandle(handle)))
}

func evmCallFFI(handle evmHandle) (*AsyncRequest, bool) {
	var cReq C.AsyncRequest
	success := bool(C.evm_call_ffi(C.EvmHandle(handle), &cReq))
	if !success {
		return nil, false
	}

	req := &AsyncRequest{
		OutputType: AsyncRequestType(cReq.output_type),
		JSONLen:    uint32(cReq.json_len),
	}
	copy(req.Address[:], C.GoBytes(unsafe.Pointer(&cReq.address[0]), 20))
	copy(req.Slot[:], C.GoBytes(unsafe.Pointer(&cReq.slot[0]), 32))
	copy(req.JSONData[:], C.GoBytes(unsafe.Pointer(&cReq.json_data[0]), int(req.JSONLen)))

	return req, true
}

func evmContinueFFI(handle evmHandle, continueType uint8, data []byte) (*AsyncRequest, bool) {
	var cReq C.AsyncRequest
	var dataPtr *C.uint8_t
	var dataLen C.size_t

	if len(data) > 0 {
		dataPtr = (*C.uint8_t)(unsafe.Pointer(&data[0]))
		dataLen = C.size_t(len(data))
	}

	success := bool(C.evm_continue_ffi(
		C.EvmHandle(handle),
		C.uint8_t(continueType),
		dataPtr,
		dataLen,
		&cReq,
	))

	if !success {
		return nil, false
	}

	req := &AsyncRequest{
		OutputType: AsyncRequestType(cReq.output_type),
		JSONLen:    uint32(cReq.json_len),
	}
	copy(req.Address[:], C.GoBytes(unsafe.Pointer(&cReq.address[0]), 20))
	copy(req.Slot[:], C.GoBytes(unsafe.Pointer(&cReq.slot[0]), 32))
	if req.JSONLen > 0 {
		copy(req.JSONData[:], C.GoBytes(unsafe.Pointer(&cReq.json_data[0]), int(req.JSONLen)))
	}

	return req, true
}

func evmGetStateChanges(handle evmHandle) []byte {
	// First try with a reasonable buffer size
	buffer := make([]byte, 16384)
	length := int(C.evm_get_state_changes(
		C.EvmHandle(handle),
		(*C.uint8_t)(unsafe.Pointer(&buffer[0])),
		C.size_t(len(buffer)),
	))

	if length == 0 {
		return nil
	}

	return buffer[:length]
}
