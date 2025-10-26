package main

import (
	"chop/app"
	"chop/evm"
	"chop/fork"
	"chop/server"
	"context"
	"encoding/hex"
	"fmt"
	"log"
	"math/big"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/urfave/cli/v2"
)

// Version information - injected by goreleaser at build time
var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
	builtBy = "unknown"
)

func runTUI(c *cli.Context) error {
	p := tea.NewProgram(
		app.InitialModel(),
		tea.WithAltScreen(),
	)
	if _, err := p.Run(); err != nil {
		return fmt.Errorf("error running program: %w", err)
	}
	return nil
}

// parseHexOrDecimal parses a hex string (0x...) or decimal string into a big.Int
func parseHexOrDecimal(s string) (*big.Int, error) {
	if strings.HasPrefix(s, "0x") || strings.HasPrefix(s, "0X") {
		value := new(big.Int)
		_, ok := value.SetString(s[2:], 16)
		if !ok {
			return nil, fmt.Errorf("invalid hex number: %s", s)
		}
		return value, nil
	}
	value := new(big.Int)
	_, ok := value.SetString(s, 10)
	if !ok {
		return nil, fmt.Errorf("invalid decimal number: %s", s)
	}
	return value, nil
}

// parseAddress parses a hex address string into an Address
func parseAddress(s string) (evm.Address, error) {
	var addr evm.Address
	if !strings.HasPrefix(s, "0x") && !strings.HasPrefix(s, "0X") {
		return addr, fmt.Errorf("address must start with 0x")
	}
	bytes, err := hex.DecodeString(s[2:])
	if err != nil {
		return addr, fmt.Errorf("invalid hex address: %w", err)
	}
	if len(bytes) != 20 {
		return addr, fmt.Errorf("address must be 20 bytes, got %d", len(bytes))
	}
	copy(addr[:], bytes)
	return addr, nil
}

// parseU256 parses a hex or decimal string into a U256
func parseU256(s string) (evm.U256, error) {
	var u256 evm.U256
	value, err := parseHexOrDecimal(s)
	if err != nil {
		return u256, err
	}
	bytes := value.Bytes()
	if len(bytes) > 32 {
		return u256, fmt.Errorf("value too large for U256")
	}
	// Copy to the end (big-endian)
	copy(u256[32-len(bytes):], bytes)
	return u256, nil
}

// parseCalldata parses hex calldata string
func parseCalldata(s string) ([]byte, error) {
	if s == "" || s == "0x" {
		return []byte{}, nil
	}
	if !strings.HasPrefix(s, "0x") && !strings.HasPrefix(s, "0X") {
		return nil, fmt.Errorf("calldata must start with 0x")
	}
	return hex.DecodeString(s[2:])
}

func runCall(c *cli.Context) error {
	// Parse bytecode
	bytecodeStr := c.String("bytecode")
	bytecode, err := parseCalldata(bytecodeStr)
	if err != nil {
		return fmt.Errorf("invalid bytecode: %w", err)
	}

	// Parse execution context
	gas := c.Int64("gas")

	caller, err := parseAddress(c.String("caller"))
	if err != nil {
		return fmt.Errorf("invalid caller address: %w", err)
	}

	address, err := parseAddress(c.String("address"))
	if err != nil {
		return fmt.Errorf("invalid contract address: %w", err)
	}

	value, err := parseU256(c.String("value"))
	if err != nil {
		return fmt.Errorf("invalid value: %w", err)
	}

	calldata, err := parseCalldata(c.String("calldata"))
	if err != nil {
		return fmt.Errorf("invalid calldata: %w", err)
	}

	// Parse log level
	logLevelStr := c.String("log-level")
	var logLevel evm.LogLevel
	switch strings.ToLower(logLevelStr) {
	case "none":
		logLevel = evm.LogLevelNone
	case "error":
		logLevel = evm.LogLevelError
	case "warn":
		logLevel = evm.LogLevelWarn
	case "info":
		logLevel = evm.LogLevelInfo
	case "debug":
		logLevel = evm.LogLevelDebug
	default:
		return fmt.Errorf("invalid log level: %s (must be none, error, warn, info, or debug)", logLevelStr)
	}

	// Create EVM instance
	evmInstance, err := evm.NewEVM(c.String("hardfork"), logLevel)
	if err != nil {
		return fmt.Errorf("failed to create EVM: %w", err)
	}
	defer evmInstance.Close()

	// Set bytecode
	if len(bytecode) > 0 {
		if err := evmInstance.SetBytecode(bytecode); err != nil {
			return fmt.Errorf("failed to set bytecode: %w", err)
		}
	}

	// Set execution context
	execCtx := evm.ExecutionContext{
		Gas:      gas,
		Caller:   caller,
		Address:  address,
		Value:    value,
		Calldata: calldata,
	}
	if err := evmInstance.SetExecutionContext(execCtx); err != nil {
		return fmt.Errorf("failed to set execution context: %w", err)
	}

	// Set blockchain context if provided
	if c.IsSet("chain-id") {
		chainID, err := parseU256(c.String("chain-id"))
		if err != nil {
			return fmt.Errorf("invalid chain-id: %w", err)
		}

		difficulty, err := parseU256(c.String("difficulty"))
		if err != nil {
			return fmt.Errorf("invalid difficulty: %w", err)
		}

		prevrandao, err := parseU256(c.String("prevrandao"))
		if err != nil {
			return fmt.Errorf("invalid prevrandao: %w", err)
		}

		coinbase, err := parseAddress(c.String("coinbase"))
		if err != nil {
			return fmt.Errorf("invalid coinbase: %w", err)
		}

		baseFee, err := parseU256(c.String("base-fee"))
		if err != nil {
			return fmt.Errorf("invalid base-fee: %w", err)
		}

		blobBaseFee, err := parseU256(c.String("blob-base-fee"))
		if err != nil {
			return fmt.Errorf("invalid blob-base-fee: %w", err)
		}

		blockCtx := evm.BlockContext{
			ChainID:        chainID,
			BlockNumber:    c.Uint64("block-number"),
			BlockTimestamp: c.Uint64("block-timestamp"),
			Difficulty:     difficulty,
			Prevrandao:     prevrandao,
			Coinbase:       coinbase,
			GasLimit:       c.Uint64("block-gas-limit"),
			BaseFee:        baseFee,
			BlobBaseFee:    blobBaseFee,
		}
		evmInstance.SetBlockchainContext(blockCtx)
	}

	// Execute
	result, err := evmInstance.Execute()
	if err != nil {
		return fmt.Errorf("execution failed: %w", err)
	}

	// Print result
	fmt.Println(result.String())
	return nil
}

func runServe(c *cli.Context) error {
	// Create a model with server enabled
	model := app.InitialModel()

	// Handle forking if --fork is provided
	if c.String("fork") != "" {
		forkConfig := fork.Config{
			URL:         c.String("fork"),
			BlockNumber: c.Uint64("fork-block"),
			CacheSize:   1000,
		}

		forker, err := fork.NewForker(forkConfig)
		if err != nil {
			// Check if it's the "not supported" error
			if err == fork.ErrForkingNotSupported {
				fmt.Printf("⚠️  Warning: %s\n", err)
				fmt.Println("   Continuing without forking support...")
				fmt.Println("   See guillotine-mini PR for forking implementation status")
			} else {
				return fmt.Errorf("failed to initialize forking: %w", err)
			}
		} else {
			// This branch won't be reached until forking is implemented
			model.Forker = forker
			fmt.Printf("✓ Forked from %s at block %d\n", forkConfig.URL, forkConfig.BlockNumber)
		}
	}

	// Configure server
	config := &server.Config{
		Port:    c.Int("port"),
		Host:    c.String("host"),
		Verbose: c.Bool("verbose"),
		LogSize: 100,
	}

	// Create server instance
	srv := server.NewServer(model.Chain, model.Accounts, config)
	model.Server = srv
	model.ServerRunning = true

	// If headless mode, just run the server without TUI
	if c.Bool("headless") {
		fmt.Printf("Starting Chop JSON-RPC server on %s:%d\n", config.Host, config.Port)
		fmt.Println("Press Ctrl+C to stop")

		// Start server in goroutine
		go func() {
			if err := srv.Start(config); err != nil {
				log.Printf("Server error: %v", err)
			}
		}()

		// Wait for interrupt signal
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan

		// Graceful shutdown
		fmt.Println("\nShutting down server...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := srv.Stop(ctx); err != nil {
			return fmt.Errorf("error stopping server: %w", err)
		}

		fmt.Println("Server stopped")
		return nil
	}

	// Otherwise, run TUI with server
	// Start server in background
	go func() {
		if err := srv.Start(config); err != nil {
			log.Printf("Server error: %v", err)
		}
	}()

	p := tea.NewProgram(
		model,
		tea.WithAltScreen(),
	)
	if _, err := p.Run(); err != nil {
		// Try to stop server on TUI error
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Stop(ctx)
		return fmt.Errorf("error running program: %w", err)
	}

	// Stop server after TUI exits
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Stop(ctx); err != nil {
		return fmt.Errorf("error stopping server: %w", err)
	}

	return nil
}

func main() {
	// Build version string with additional information
	versionInfo := version
	if commit != "none" {
		versionInfo += fmt.Sprintf(" (commit: %s)", commit)
	}
	if date != "unknown" {
		versionInfo += fmt.Sprintf(" (built: %s)", date)
	}
	if builtBy != "unknown" {
		versionInfo += fmt.Sprintf(" (by: %s)", builtBy)
	}

	cliApp := &cli.App{
		Name:    "chop",
		Usage:   "Guillotine EVM CLI - Interactive EVM execution environment",
		Version: versionInfo,
		Action:  runTUI,
		Commands: []*cli.Command{
			{
				Name:    "serve",
				Aliases: []string{"s"},
				Usage:   "Start JSON-RPC server (with optional TUI)",
				Action:  runServe,
				Flags: []cli.Flag{
					&cli.IntFlag{
						Name:    "port",
						Aliases: []string{"p"},
						Usage:   "Server port",
						Value:   8545,
						EnvVars: []string{"CHOP_PORT"},
					},
					&cli.StringFlag{
						Name:  "host",
						Usage: "Server host",
						Value: "127.0.0.1",
						EnvVars: []string{"CHOP_HOST"},
					},
					&cli.BoolFlag{
						Name:    "verbose",
						Aliases: []string{"v"},
						Usage:   "Enable verbose JSON-RPC logging",
						Value:   false,
						EnvVars: []string{"CHOP_VERBOSE"},
					},
					&cli.BoolFlag{
						Name:  "headless",
						Usage: "Run server without TUI",
						Value: false,
					},
					&cli.StringFlag{
						Name:    "fork",
						Aliases: []string{"f"},
						Usage:   "Fork from a remote Ethereum RPC (e.g., https://eth-mainnet.g.alchemy.com/v2/...)",
						Value:   "",
						EnvVars: []string{"CHOP_FORK"},
					},
					&cli.Uint64Flag{
						Name:    "fork-block",
						Usage:   "Block number to fork from (0 = latest)",
						Value:   0,
						EnvVars: []string{"CHOP_FORK_BLOCK"},
					},
				},
			},
			{
				Name:    "call",
				Aliases: []string{"c"},
				Usage:   "Execute an EVM call",
				Action:  runCall,
				Flags: []cli.Flag{
					// Execution context
					&cli.StringFlag{
						Name:    "bytecode",
						Aliases: []string{"b"},
						Usage:   "Contract bytecode to execute (hex)",
						Value:   "0x6000600055", // Simple PUSH1 0 PUSH1 0 SSTORE
					},
					&cli.Int64Flag{
						Name:    "gas",
						Aliases: []string{"g"},
						Usage:   "Gas limit for execution",
						Value:   30000000,
					},
					&cli.StringFlag{
						Name:  "caller",
						Usage: "Caller address (hex)",
						Value: "0x0000000000000000000000000000000000000001",
					},
					&cli.StringFlag{
						Name:    "address",
						Aliases: []string{"a"},
						Usage:   "Contract address (hex)",
						Value:   "0x0000000000000000000000000000000000000002",
					},
					&cli.StringFlag{
						Name:    "value",
						Aliases: []string{"v"},
						Usage:   "Value to send (wei, hex or decimal)",
						Value:   "0",
					},
					&cli.StringFlag{
						Name:    "calldata",
						Aliases: []string{"d"},
						Usage:   "Calldata for the call (hex)",
						Value:   "0x",
					},

					// EVM configuration
					&cli.StringFlag{
						Name:  "hardfork",
						Usage: "EVM hardfork (e.g., shanghai, cancun)",
						Value: "cancun",
					},
					&cli.StringFlag{
						Name:  "log-level",
						Usage: "Log level (none, error, warn, info, debug)",
						Value: "none",
					},

					// Block context (optional)
					&cli.StringFlag{
						Name:  "chain-id",
						Usage: "Chain ID (hex or decimal)",
						Value: "1",
					},
					&cli.Uint64Flag{
						Name:  "block-number",
						Usage: "Block number",
						Value: 1,
					},
					&cli.Uint64Flag{
						Name:  "block-timestamp",
						Usage: "Block timestamp (unix)",
						Value: 1234567890,
					},
					&cli.StringFlag{
						Name:  "difficulty",
						Usage: "Block difficulty (hex or decimal)",
						Value: "0",
					},
					&cli.StringFlag{
						Name:  "prevrandao",
						Usage: "Block prevrandao (hex or decimal)",
						Value: "0",
					},
					&cli.StringFlag{
						Name:  "coinbase",
						Usage: "Block coinbase address (hex)",
						Value: "0x0000000000000000000000000000000000000000",
					},
					&cli.Uint64Flag{
						Name:  "block-gas-limit",
						Usage: "Block gas limit",
						Value: 30000000,
					},
					&cli.StringFlag{
						Name:  "base-fee",
						Usage: "Block base fee (hex or decimal)",
						Value: "0",
					},
					&cli.StringFlag{
						Name:  "blob-base-fee",
						Usage: "Blob base fee (hex or decimal)",
						Value: "0",
					},
				},
			},
			{
				Name:    "run",
				Aliases: []string{"r"},
				Usage:   "Run the Guillotine EVM (launches TUI)",
				Action:  runTUI,
			},
			{
				Name:    "build",
				Aliases: []string{"b"},
				Usage:   "Build the Guillotine library",
				Action: func(c *cli.Context) error {
					fmt.Println("Building Guillotine library...")
					// TODO: Build guillotine-mini submodule
					return nil
				},
			},
		},
	}

	if err := cliApp.Run(os.Args); err != nil {
		log.Fatal(err)
	}
}
