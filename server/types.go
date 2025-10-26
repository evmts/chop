package server

import (
	"encoding/json"
	"fmt"
)

// JSONRPCRequest represents a JSON-RPC 2.0 request
type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
	ID      interface{}     `json:"id,omitempty"`
}

// JSONRPCResponse represents a JSON-RPC 2.0 response
type JSONRPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
	ID      interface{} `json:"id"`
}

// RPCError represents a JSON-RPC 2.0 error
type RPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// Standard JSON-RPC error codes
const (
	// Standard JSON-RPC 2.0 errors
	ParseError     = -32700
	InvalidRequest = -32600
	MethodNotFound = -32601
	InvalidParams  = -32602
	InternalError  = -32603

	// Ethereum-specific errors
	InvalidInput    = -32000
	ResourceNotFound = -32001
	ResourceUnavailable = -32002
	TransactionRejected = -32003
	MethodNotSupported = -32004
	LimitExceeded = -32005
	RPCVersionNotSupported = -32006
)

// NewRPCError creates a new RPC error with a standard code
func NewRPCError(code int, message string, data interface{}) *RPCError {
	return &RPCError{
		Code:    code,
		Message: message,
		Data:    data,
	}
}

// Error implements the error interface
func (e *RPCError) Error() string {
	if e.Data != nil {
		return fmt.Sprintf("RPC error %d: %s (data: %v)", e.Code, e.Message, e.Data)
	}
	return fmt.Sprintf("RPC error %d: %s", e.Code, e.Message)
}

// Transaction represents an Ethereum transaction for JSON-RPC
type RPCTransaction struct {
	BlockHash        *string `json:"blockHash"`
	BlockNumber      *string `json:"blockNumber"`
	From             string  `json:"from"`
	Gas              string  `json:"gas"`
	GasPrice         string  `json:"gasPrice"`
	Hash             string  `json:"hash"`
	Input            string  `json:"input"`
	Nonce            string  `json:"nonce"`
	To               *string `json:"to"`
	TransactionIndex *string `json:"transactionIndex"`
	Value            string  `json:"value"`
	V                string  `json:"v"`
	R                string  `json:"r"`
	S                string  `json:"s"`
}

// RPCBlock represents an Ethereum block for JSON-RPC
type RPCBlock struct {
	Number           string           `json:"number"`
	Hash             string           `json:"hash"`
	ParentHash       string           `json:"parentHash"`
	Nonce            string           `json:"nonce"`
	Sha3Uncles       string           `json:"sha3Uncles"`
	LogsBloom        string           `json:"logsBloom"`
	TransactionsRoot string           `json:"transactionsRoot"`
	StateRoot        string           `json:"stateRoot"`
	ReceiptsRoot     string           `json:"receiptsRoot"`
	Miner            string           `json:"miner"`
	Difficulty       string           `json:"difficulty"`
	TotalDifficulty  string           `json:"totalDifficulty"`
	ExtraData        string           `json:"extraData"`
	Size             string           `json:"size"`
	GasLimit         string           `json:"gasLimit"`
	GasUsed          string           `json:"gasUsed"`
	Timestamp        string           `json:"timestamp"`
	Transactions     interface{}      `json:"transactions"` // Can be []string or []RPCTransaction
	Uncles           []string         `json:"uncles"`
}

// RPCTransactionReceipt represents a transaction receipt for JSON-RPC
type RPCTransactionReceipt struct {
	TransactionHash   string   `json:"transactionHash"`
	TransactionIndex  string   `json:"transactionIndex"`
	BlockHash         string   `json:"blockHash"`
	BlockNumber       string   `json:"blockNumber"`
	From              string   `json:"from"`
	To                *string  `json:"to"`
	CumulativeGasUsed string   `json:"cumulativeGasUsed"`
	GasUsed           string   `json:"gasUsed"`
	ContractAddress   *string  `json:"contractAddress"`
	Logs              []RPCLog `json:"logs"`
	LogsBloom         string   `json:"logsBloom"`
	Status            string   `json:"status"`
}

// RPCLog represents a log entry for JSON-RPC
type RPCLog struct {
	Removed          bool     `json:"removed"`
	LogIndex         string   `json:"logIndex"`
	TransactionIndex string   `json:"transactionIndex"`
	TransactionHash  string   `json:"transactionHash"`
	BlockHash        string   `json:"blockHash"`
	BlockNumber      string   `json:"blockNumber"`
	Address          string   `json:"address"`
	Data             string   `json:"data"`
	Topics           []string `json:"topics"`
}

// CallParams represents parameters for eth_call
type CallParams struct {
	From     *string `json:"from,omitempty"`
	To       string  `json:"to"`
	Gas      *string `json:"gas,omitempty"`
	GasPrice *string `json:"gasPrice,omitempty"`
	Value    *string `json:"value,omitempty"`
	Data     *string `json:"data,omitempty"`
}
