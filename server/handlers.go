package server

import (
	"encoding/json"
	"fmt"
	"math/big"
	"strings"

	"chop/types"
)

// Helper function to parse hex string to uint64
func hexToUint64(hex string) (uint64, error) {
	hex = strings.TrimPrefix(hex, "0x")
	if hex == "" {
		return 0, nil
	}

	var value uint64
	_, err := fmt.Sscanf(hex, "%x", &value)
	return value, err
}

// Helper function to convert uint64 to hex string
func uint64ToHex(value uint64) string {
	return fmt.Sprintf("0x%x", value)
}

// Helper function to convert big.Int to hex string
func bigIntToHex(value *big.Int) string {
	if value == nil {
		return "0x0"
	}
	return "0x" + value.Text(16)
}

// Helper function to parse hex string to big.Int
func hexToBigInt(hex string) (*big.Int, error) {
	hex = strings.TrimPrefix(hex, "0x")
	if hex == "" {
		return big.NewInt(0), nil
	}

	value := new(big.Int)
	value.SetString(hex, 16)
	return value, nil
}

// handleEthAccounts returns the list of addresses owned by the client
func (s *Server) handleEthAccounts(req *JSONRPCRequest) (interface{}, *RPCError) {
	accounts := s.accounts.GetAllAccounts()
	addresses := make([]string, len(accounts))

	for i, account := range accounts {
		addresses[i] = account.Address
	}

	return addresses, nil
}

// handleEthGetBalance returns the balance of an account
func (s *Server) handleEthGetBalance(req *JSONRPCRequest) (interface{}, *RPCError) {
	var params []interface{}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return nil, NewRPCError(InvalidParams, "Invalid params", err.Error())
	}

	if len(params) < 1 {
		return nil, NewRPCError(InvalidParams, "Missing address parameter", nil)
	}

	address, ok := params[0].(string)
	if !ok {
		return nil, NewRPCError(InvalidParams, "Address must be a string", nil)
	}

	account, err := s.accounts.GetAccount(address)
	if err != nil {
		return nil, NewRPCError(InternalError, "Failed to get account", err.Error())
	}

	return bigIntToHex(account.Balance), nil
}

// handleEthGetTransactionCount returns the nonce of an account
func (s *Server) handleEthGetTransactionCount(req *JSONRPCRequest) (interface{}, *RPCError) {
	var params []interface{}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return nil, NewRPCError(InvalidParams, "Invalid params", err.Error())
	}

	if len(params) < 1 {
		return nil, NewRPCError(InvalidParams, "Missing address parameter", nil)
	}

	address, ok := params[0].(string)
	if !ok {
		return nil, NewRPCError(InvalidParams, "Address must be a string", nil)
	}

	account, err := s.accounts.GetAccount(address)
	if err != nil {
		return nil, NewRPCError(InternalError, "Failed to get account", err.Error())
	}

	return uint64ToHex(account.Nonce), nil
}

// handleEthGetCode returns the code at a given address
func (s *Server) handleEthGetCode(req *JSONRPCRequest) (interface{}, *RPCError) {
	var params []interface{}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return nil, NewRPCError(InvalidParams, "Invalid params", err.Error())
	}

	if len(params) < 1 {
		return nil, NewRPCError(InvalidParams, "Missing address parameter", nil)
	}

	address, ok := params[0].(string)
	if !ok {
		return nil, NewRPCError(InvalidParams, "Address must be a string", nil)
	}

	account, err := s.accounts.GetAccount(address)
	if err != nil {
		return nil, NewRPCError(InternalError, "Failed to get account", err.Error())
	}

	if len(account.Code) == 0 {
		return "0x", nil
	}

	return "0x" + fmt.Sprintf("%x", account.Code), nil
}

// handleEthBlockNumber returns the current block number
func (s *Server) handleEthBlockNumber(req *JSONRPCRequest) (interface{}, *RPCError) {
	blockHeight := s.chain.GetBlockHeight()
	return uint64ToHex(blockHeight), nil
}

// handleEthGetBlockByNumber returns information about a block by block number
func (s *Server) handleEthGetBlockByNumber(req *JSONRPCRequest) (interface{}, *RPCError) {
	var params []interface{}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return nil, NewRPCError(InvalidParams, "Invalid params", err.Error())
	}

	if len(params) < 1 {
		return nil, NewRPCError(InvalidParams, "Missing block number parameter", nil)
	}

	blockNumStr, ok := params[0].(string)
	if !ok {
		return nil, NewRPCError(InvalidParams, "Block number must be a string", nil)
	}

	// Handle special block tags
	var blockNumber uint64
	switch blockNumStr {
	case "latest", "pending":
		blockNumber = s.chain.GetBlockHeight()
	case "earliest":
		blockNumber = 0
	default:
		var err error
		blockNumber, err = hexToUint64(blockNumStr)
		if err != nil {
			return nil, NewRPCError(InvalidParams, "Invalid block number", err.Error())
		}
	}

	block, err := s.chain.GetBlockByNumber(blockNumber)
	if err != nil {
		return nil, NewRPCError(ResourceNotFound, "Block not found", err.Error())
	}

	// Check if we should include full transaction objects
	fullTxs := false
	if len(params) >= 2 {
		if fullTxs, ok = params[1].(bool); !ok {
			return nil, NewRPCError(InvalidParams, "Second parameter must be boolean", nil)
		}
	}

	return s.blockToRPCBlock(block, fullTxs), nil
}

// handleEthGetBlockByHash returns information about a block by hash
func (s *Server) handleEthGetBlockByHash(req *JSONRPCRequest) (interface{}, *RPCError) {
	var params []interface{}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return nil, NewRPCError(InvalidParams, "Invalid params", err.Error())
	}

	if len(params) < 1 {
		return nil, NewRPCError(InvalidParams, "Missing block hash parameter", nil)
	}

	blockHash, ok := params[0].(string)
	if !ok {
		return nil, NewRPCError(InvalidParams, "Block hash must be a string", nil)
	}

	block, err := s.chain.GetBlockByHash(blockHash)
	if err != nil {
		return nil, NewRPCError(ResourceNotFound, "Block not found", err.Error())
	}

	// Check if we should include full transaction objects
	fullTxs := false
	if len(params) >= 2 {
		if fullTxs, ok = params[1].(bool); !ok {
			return nil, NewRPCError(InvalidParams, "Second parameter must be boolean", nil)
		}
	}

	return s.blockToRPCBlock(block, fullTxs), nil
}

// handleEthSendTransaction sends a transaction (stubbed for now)
func (s *Server) handleEthSendTransaction(req *JSONRPCRequest) (interface{}, *RPCError) {
	// TODO: Implement transaction execution when VM is integrated
	return nil, NewRPCError(MethodNotSupported, "eth_sendTransaction not yet implemented", nil)
}

// handleEthCall executes a new message call immediately (stubbed for now)
func (s *Server) handleEthCall(req *JSONRPCRequest) (interface{}, *RPCError) {
	// TODO: Implement call execution when VM is integrated
	return "0x", nil
}

// handleEthGetTransactionByHash returns information about a transaction by hash
func (s *Server) handleEthGetTransactionByHash(req *JSONRPCRequest) (interface{}, *RPCError) {
	var params []interface{}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return nil, NewRPCError(InvalidParams, "Invalid params", err.Error())
	}

	if len(params) < 1 {
		return nil, NewRPCError(InvalidParams, "Missing transaction hash parameter", nil)
	}

	txHash, ok := params[0].(string)
	if !ok {
		return nil, NewRPCError(InvalidParams, "Transaction hash must be a string", nil)
	}

	tx, err := s.chain.GetTransaction(txHash)
	if err != nil {
		return nil, NewRPCError(ResourceNotFound, "Transaction not found", err.Error())
	}

	return s.transactionToRPCTransaction(tx), nil
}

// handleEthGetTransactionReceipt returns the receipt of a transaction
func (s *Server) handleEthGetTransactionReceipt(req *JSONRPCRequest) (interface{}, *RPCError) {
	var params []interface{}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return nil, NewRPCError(InvalidParams, "Invalid params", err.Error())
	}

	if len(params) < 1 {
		return nil, NewRPCError(InvalidParams, "Missing transaction hash parameter", nil)
	}

	txHash, ok := params[0].(string)
	if !ok {
		return nil, NewRPCError(InvalidParams, "Transaction hash must be a string", nil)
	}

	tx, err := s.chain.GetTransaction(txHash)
	if err != nil {
		return nil, NewRPCError(ResourceNotFound, "Transaction not found", err.Error())
	}

	return s.transactionToRPCReceipt(tx), nil
}

// handleEthEstimateGas generates and returns an estimate of gas (stubbed for now)
func (s *Server) handleEthEstimateGas(req *JSONRPCRequest) (interface{}, *RPCError) {
	// TODO: Implement gas estimation when VM is integrated
	// For now, return a reasonable default
	return "0x5208", nil // 21000 gas (basic transaction)
}

// handleEthChainId returns the chain ID
func (s *Server) handleEthChainId(req *JSONRPCRequest) (interface{}, *RPCError) {
	// Return chain ID 1337 (local development chain)
	return "0x539", nil
}

// handleNetVersion returns the network ID
func (s *Server) handleNetVersion(req *JSONRPCRequest) (interface{}, *RPCError) {
	// Return network ID 1337
	return "1337", nil
}

// handleWeb3ClientVersion returns the client version
func (s *Server) handleWeb3ClientVersion(req *JSONRPCRequest) (interface{}, *RPCError) {
	return "Chop/v0.1.0/go", nil
}

// handleEthGasPrice returns the current gas price
func (s *Server) handleEthGasPrice(req *JSONRPCRequest) (interface{}, *RPCError) {
	// Return 1 Gwei as default gas price
	return "0x3b9aca00", nil // 1 Gwei = 1,000,000,000 wei
}

// Helper: Convert internal block to RPC block
func (s *Server) blockToRPCBlock(block interface{}, fullTxs bool) *RPCBlock {
	// Type assertion to get the actual block
	b, ok := block.(*types.Block)
	if !ok {
		return nil
	}

	rpcBlock := &RPCBlock{
		Number:           uint64ToHex(b.Number),
		Hash:             b.Hash,
		ParentHash:       b.ParentHash,
		Nonce:            "0x0000000000000000",
		Sha3Uncles:       "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
		LogsBloom:        "0x" + strings.Repeat("0", 512),
		TransactionsRoot: b.StateRoot,
		StateRoot:        b.StateRoot,
		ReceiptsRoot:     "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
		Miner:            b.Miner,
		Difficulty:       "0x0",
		TotalDifficulty:  "0x0",
		ExtraData:        "0x",
		Size:             uint64ToHex(b.Size),
		GasLimit:         uint64ToHex(b.GasLimit),
		GasUsed:          uint64ToHex(b.GasUsed),
		Timestamp:        uint64ToHex(uint64(b.Timestamp.Unix())),
		Uncles:           []string{},
	}

	// Add transactions (as hashes or full objects)
	if fullTxs {
		txs := make([]RPCTransaction, 0, len(b.Transactions))
		for _, txHash := range b.Transactions {
			if tx, err := s.chain.GetTransaction(txHash); err == nil {
				txs = append(txs, *s.transactionToRPCTransaction(tx))
			}
		}
		rpcBlock.Transactions = txs
	} else {
		rpcBlock.Transactions = b.Transactions
	}

	return rpcBlock
}

// Helper: Convert internal transaction to RPC transaction
func (s *Server) transactionToRPCTransaction(tx interface{}) *RPCTransaction {
	// Type assertion
	t, ok := tx.(*types.Transaction)
	if !ok {
		return nil
	}

	rpcTx := &RPCTransaction{
		Hash:     t.Hash,
		From:     t.From,
		Gas:      uint64ToHex(t.GasLimit),
		GasPrice: bigIntToHex(t.GasPrice),
		Input:    "0x" + fmt.Sprintf("%x", t.InputData),
		Nonce:    uint64ToHex(t.Nonce),
		Value:    bigIntToHex(t.Value),
		V:        "0x1b",
		R:        "0x0",
		S:        "0x0",
	}

	// Set To (nil for contract creation)
	if t.To != "" {
		to := t.To
		rpcTx.To = &to
	}

	// Set block info if transaction is mined
	if t.BlockNumber > 0 {
		blockHash := t.BlockHash
		blockNum := uint64ToHex(t.BlockNumber)
		txIndex := "0x0" // TODO: Get actual transaction index
		rpcTx.BlockHash = &blockHash
		rpcTx.BlockNumber = &blockNum
		rpcTx.TransactionIndex = &txIndex
	}

	return rpcTx
}

// Helper: Convert internal transaction to RPC receipt
func (s *Server) transactionToRPCReceipt(tx interface{}) *RPCTransactionReceipt {
	// Type assertion
	t, ok := tx.(*types.Transaction)
	if !ok {
		return nil
	}

	receipt := &RPCTransactionReceipt{
		TransactionHash:   t.Hash,
		TransactionIndex:  "0x0", // TODO: Get actual index
		BlockHash:         t.BlockHash,
		BlockNumber:       uint64ToHex(t.BlockNumber),
		From:              t.From,
		CumulativeGasUsed: uint64ToHex(t.GasUsed),
		GasUsed:           uint64ToHex(t.GasUsed),
		LogsBloom:         "0x" + strings.Repeat("0", 512),
		Logs:              make([]RPCLog, 0),
	}

	// Set To (nil for contract creation)
	if t.To != "" {
		to := t.To
		receipt.To = &to
	}

	// Set contract address for CREATE/CREATE2
	if t.DeployedAddr != "" {
		addr := t.DeployedAddr
		receipt.ContractAddress = &addr
	}

	// Set status (0x1 for success, 0x0 for failure)
	if t.Status {
		receipt.Status = "0x1"
	} else {
		receipt.Status = "0x0"
	}

	// Convert logs
	for i, log := range t.Logs {
		rpcLog := RPCLog{
			Removed:          false,
			LogIndex:         uint64ToHex(uint64(i)),
			TransactionIndex: "0x0",
			TransactionHash:  t.Hash,
			BlockHash:        t.BlockHash,
			BlockNumber:      uint64ToHex(t.BlockNumber),
			Address:          log.Address,
			Data:             "0x" + fmt.Sprintf("%x", log.Data),
			Topics:           log.Topics,
		}
		receipt.Logs = append(receipt.Logs, rpcLog)
	}

	return receipt
}
