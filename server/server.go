package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"chop/core/accounts"
	"chop/core/blockchain"
)

// Server represents the JSON-RPC HTTP server
type Server struct {
	chain      *blockchain.Chain
	accounts   *accounts.Manager
	logger     *Logger
	httpServer *http.Server
	verbose    bool
	mu         sync.RWMutex
}

// Config represents the server configuration
type Config struct {
	Port     int
	Host     string
	Verbose  bool
	LogSize  int // Maximum number of log entries to keep
}

// DefaultConfig returns a default server configuration
func DefaultConfig() *Config {
	return &Config{
		Port:    8545,
		Host:    "127.0.0.1",
		Verbose: false,
		LogSize: 100,
	}
}

// NewServer creates a new JSON-RPC server instance
func NewServer(chain *blockchain.Chain, accounts *accounts.Manager, config *Config) *Server {
	if config == nil {
		config = DefaultConfig()
	}

	return &Server{
		chain:    chain,
		accounts: accounts,
		logger:   NewLogger(config.LogSize),
		verbose:  config.Verbose,
	}
}

// Start starts the HTTP server on the configured address
func (s *Server) Start(config *Config) error {
	if config == nil {
		config = DefaultConfig()
	}

	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)

	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleRequest)
	mux.HandleFunc("/health", s.handleHealth)

	s.httpServer = &http.Server{
		Addr:         addr,
		Handler:      s.corsMiddleware(mux),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	return s.httpServer.ListenAndServe()
}

// Stop gracefully shuts down the server
func (s *Server) Stop(ctx context.Context) error {
	if s.httpServer == nil {
		return nil
	}
	return s.httpServer.Shutdown(ctx)
}

// SetVerbose enables or disables verbose logging
func (s *Server) SetVerbose(verbose bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.verbose = verbose
}

// GetLogger returns the server's logger instance
func (s *Server) GetLogger() *Logger {
	return s.logger
}

// corsMiddleware adds CORS headers to allow cross-origin requests
func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// handleHealth handles health check requests
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// handleRequest handles incoming JSON-RPC requests
func (s *Server) handleRequest(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()

	// Only accept POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.sendError(w, nil, NewRPCError(ParseError, "Failed to read request body", err.Error()), startTime)
		return
	}
	defer r.Body.Close()

	// Parse JSON-RPC request
	var req JSONRPCRequest
	if err := json.Unmarshal(body, &req); err != nil {
		s.sendError(w, nil, NewRPCError(ParseError, "Invalid JSON", err.Error()), startTime)
		return
	}

	// Validate JSON-RPC version
	if req.JSONRPC != "2.0" {
		s.sendError(w, req.ID, NewRPCError(InvalidRequest, "Invalid JSON-RPC version", nil), startTime)
		return
	}

	// Route to appropriate handler
	result, rpcErr := s.routeRequest(&req)

	// Send response
	if rpcErr != nil {
		s.sendError(w, req.ID, rpcErr, startTime)
		return
	}

	s.sendSuccess(w, req.ID, result, startTime, &req)
}

// routeRequest routes a JSON-RPC request to the appropriate handler
func (s *Server) routeRequest(req *JSONRPCRequest) (interface{}, *RPCError) {
	switch req.Method {
	// Account methods
	case "eth_accounts":
		return s.handleEthAccounts(req)
	case "eth_getBalance":
		return s.handleEthGetBalance(req)
	case "eth_getTransactionCount":
		return s.handleEthGetTransactionCount(req)
	case "eth_getCode":
		return s.handleEthGetCode(req)

	// Block methods
	case "eth_blockNumber":
		return s.handleEthBlockNumber(req)
	case "eth_getBlockByNumber":
		return s.handleEthGetBlockByNumber(req)
	case "eth_getBlockByHash":
		return s.handleEthGetBlockByHash(req)

	// Transaction methods
	case "eth_sendTransaction":
		return s.handleEthSendTransaction(req)
	case "eth_call":
		return s.handleEthCall(req)
	case "eth_getTransactionByHash":
		return s.handleEthGetTransactionByHash(req)
	case "eth_getTransactionReceipt":
		return s.handleEthGetTransactionReceipt(req)
	case "eth_estimateGas":
		return s.handleEthEstimateGas(req)

	// Network methods
	case "eth_chainId":
		return s.handleEthChainId(req)
	case "net_version":
		return s.handleNetVersion(req)
	case "web3_clientVersion":
		return s.handleWeb3ClientVersion(req)

	// Gas methods
	case "eth_gasPrice":
		return s.handleEthGasPrice(req)

	default:
		return nil, NewRPCError(MethodNotFound, fmt.Sprintf("Method %s not found", req.Method), nil)
	}
}

// sendSuccess sends a successful JSON-RPC response
func (s *Server) sendSuccess(w http.ResponseWriter, id interface{}, result interface{}, startTime time.Time, req *JSONRPCRequest) {
	response := JSONRPCResponse{
		JSONRPC: "2.0",
		Result:  result,
		ID:      id,
	}

	// Log the request/response if verbose
	if s.verbose {
		s.logger.Log(LogEntry{
			ID:        fmt.Sprintf("%v", id),
			Request:   req,
			Response:  &response,
			Timestamp: startTime,
			Duration:  time.Since(startTime),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// sendError sends an error JSON-RPC response
func (s *Server) sendError(w http.ResponseWriter, id interface{}, rpcError *RPCError, startTime time.Time) {
	response := JSONRPCResponse{
		JSONRPC: "2.0",
		Error:   rpcError,
		ID:      id,
	}

	// Log the error if verbose
	if s.verbose {
		s.logger.Log(LogEntry{
			ID:        fmt.Sprintf("%v", id),
			Response:  &response,
			Timestamp: startTime,
			Duration:  time.Since(startTime),
			Error:     rpcError,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK) // JSON-RPC errors still return 200 OK
	json.NewEncoder(w).Encode(response)
}
