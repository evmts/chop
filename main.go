package main

import (
    "chop/app"
    "chop/config"
    "chop/diff"
    "chop/evm"
    "chop/fork"
    "chop/server"
    "chop/fixtures"
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
    // Load config and seed model defaults (e.g., gas limit)
    appCfg := config.Load()

    model := app.InitialModel()
    if appCfg.GasLimit != 0 && model.Chain != nil {
        model.Chain.SetGasLimit(appCfg.GasLimit)
    }

    p := tea.NewProgram(
        model,
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
    // Load config to seed defaults for model (e.g., gas limit)
    appCfg := config.Load()

    // Create a model with server enabled
    model := app.InitialModel()
    if appCfg.GasLimit != 0 && model.Chain != nil {
        model.Chain.SetGasLimit(appCfg.GasLimit)
    }

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
    srvConfig := &server.Config{
        Port:    c.Int("port"),
        Host:    c.String("host"),
        Verbose: c.Bool("verbose"),
        LogSize: 100,
    }

	// Create server instance
    srv := server.NewServer(model.Chain, model.Accounts, srvConfig)
	model.Server = srv
	model.ServerRunning = true

	// If headless mode, just run the server without TUI
    if c.Bool("headless") {
        fmt.Printf("Starting Chop JSON-RPC server on %s:%d\n", srvConfig.Host, srvConfig.Port)
		fmt.Println("Press Ctrl+C to stop")

		// Start server in goroutine
        go func() {
            if err := srv.Start(srvConfig); err != nil {
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
        if err := srv.Start(srvConfig); err != nil {
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

// runListFixtures lists saved fixture names
func runListFixtures(c *cli.Context) error {
    names, err := fixtures.List()
    if err != nil {
        return fmt.Errorf("list fixtures failed: %w", err)
    }
    if len(names) == 0 {
        fmt.Println("No fixtures found in ~/.chop/fixtures")
        return nil
    }
    for _, n := range names {
        fmt.Println(n)
    }
    return nil
}

// runSaveFixture saves a fixture from flags
func runSaveFixture(c *cli.Context) error {
    name := c.Args().First()
    if name == "" {
        return fmt.Errorf("usage: chop save-fixture <name> [--bytecode 0x.. --calldata 0x.. --caller 0x.. --value 0 --gas 100000]")
    }
    fx := fixtures.Fixture{
        Name:     name,
        Bytecode: c.String("bytecode"),
        Calldata: c.String("calldata"),
        Caller:   c.String("caller"),
        Value:    c.String("value"),
        GasLimit: uint64(c.Int64("gas")),
    }
    path, err := fixtures.Save(fx)
    if err != nil {
        return fmt.Errorf("save fixture failed: %w", err)
    }
    fmt.Println("Saved:", path)
    return nil
}

// runLoadFixture loads and executes a fixture
func runLoadFixture(c *cli.Context) error {
    name := c.Args().First()
    if name == "" {
        return fmt.Errorf("usage: chop load-fixture <name>")
    }
    fx, err := fixtures.Load(name)
    if err != nil {
        return fmt.Errorf("load fixture failed: %w", err)
    }

    // Create EVM instance
    evmInstance, err := evm.NewEVM(c.String("hardfork"), evm.LogLevelNone)
    if err != nil {
        return fmt.Errorf("failed to create EVM: %w", err)
    }
    defer evmInstance.Close()

    // Set bytecode if provided
    if fx.Bytecode != "" {
        bc, err := parseCalldata(fx.Bytecode)
        if err != nil {
            return fmt.Errorf("invalid fixture bytecode: %w", err)
        }
        if err := evmInstance.SetBytecode(bc); err != nil {
            return fmt.Errorf("failed to set bytecode: %w", err)
        }
    }

    // Build execution context
    caller, err := parseAddress(fx.Caller)
    if err != nil {
        return fmt.Errorf("invalid caller address: %w", err)
    }
    // Default contract address when not provided by fixture (arbitrary)
    address, _ := parseAddress("0x0000000000000000000000000000000000000002")
    value, err := parseU256(fx.Value)
    if err != nil {
        return fmt.Errorf("invalid value: %w", err)
    }
    calldata, err := parseCalldata(fx.Calldata)
    if err != nil {
        return fmt.Errorf("invalid calldata: %w", err)
    }
    if err := evmInstance.SetExecutionContext(evm.ExecutionContext{
        Gas:      int64(fx.GasLimit),
        Caller:   caller,
        Address:  address,
        Value:    value,
        Calldata: calldata,
    }); err != nil {
        return fmt.Errorf("failed to set execution context: %w", err)
    }

    // Execute
    result, err := evmInstance.Execute()
    if err != nil {
        return fmt.Errorf("execution failed: %w", err)
    }
    fmt.Println(result.String())
    return nil
}

func main() {
    // Load file+env config to seed CLI defaults (file < env; CLI still overrides)
    appCfg := config.Load()

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
                        Value:   appCfg.Port,
                        EnvVars: []string{"CHOP_PORT"},
                    },
                    &cli.StringFlag{
                        Name:  "host",
                        Usage: "Server host",
                        Value: appCfg.Host,
                        EnvVars: []string{"CHOP_HOST"},
                    },
                    &cli.BoolFlag{
                        Name:    "verbose",
                        Aliases: []string{"v"},
                        Usage:   "Enable verbose JSON-RPC logging",
                        Value:   appCfg.Verbose,
                        EnvVars: []string{"CHOP_VERBOSE"},
                    },
                    &cli.BoolFlag{
                        Name:  "headless",
                        Usage: "Run server without TUI",
                        Value: false,
                        EnvVars: []string{"CHOP_HEADLESS"},
                    },
                    &cli.StringFlag{
                        Name:    "fork",
                        Aliases: []string{"f"},
                        Usage:   "Fork from a remote Ethereum RPC (e.g., https://eth-mainnet.g.alchemy.com/v2/...)",
                        Value:   appCfg.Fork,
                        EnvVars: []string{"CHOP_FORK"},
                    },
                    &cli.Uint64Flag{
                        Name:    "fork-block",
                        Usage:   "Block number to fork from (0 = latest)",
                        Value:   appCfg.ForkBlock,
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
                        EnvVars: []string{"CHOP_BYTECODE"},
                    },
                    &cli.Int64Flag{
                        Name:    "gas",
                        Aliases: []string{"g"},
                        Usage:   "Gas limit for execution",
                        Value:   int64(appCfg.GasLimit),
                        EnvVars: []string{"CHOP_GAS"},
                    },
                    &cli.StringFlag{
                        Name:  "caller",
                        Usage: "Caller address (hex)",
                        Value: "0x0000000000000000000000000000000000000001",
                        EnvVars: []string{"CHOP_CALLER"},
                    },
                    &cli.StringFlag{
                        Name:    "address",
                        Aliases: []string{"a"},
                        Usage:   "Contract address (hex)",
                        Value:   "0x0000000000000000000000000000000000000002",
                        EnvVars: []string{"CHOP_ADDRESS"},
                    },
                    &cli.StringFlag{
                        Name:    "value",
                        Aliases: []string{"v"},
                        Usage:   "Value to send (wei, hex or decimal)",
                        Value:   "0",
                        EnvVars: []string{"CHOP_VALUE"},
                    },
                    &cli.StringFlag{
                        Name:    "calldata",
                        Aliases: []string{"d"},
                        Usage:   "Calldata for the call (hex)",
                        Value:   "0x",
                        EnvVars: []string{"CHOP_CALLDATA"},
                    },

					// EVM configuration
                    &cli.StringFlag{
                        Name:  "hardfork",
                        Usage: "EVM hardfork (e.g., shanghai, cancun)",
                        Value: appCfg.Hardfork,
                        EnvVars: []string{"CHOP_HARDFORK"},
                    },
                    &cli.StringFlag{
                        Name:  "log-level",
                        Usage: "Log level (none, error, warn, info, debug)",
                        Value: "none",
                        EnvVars: []string{"CHOP_LOG_LEVEL"},
                    },

					// Block context (optional)
                    &cli.StringFlag{
                        Name:  "chain-id",
                        Usage: "Chain ID (hex or decimal)",
                        Value: "1",
                        EnvVars: []string{"CHOP_CHAIN_ID"},
                    },
                    &cli.Uint64Flag{
                        Name:  "block-number",
                        Usage: "Block number",
                        Value: 1,
                        EnvVars: []string{"CHOP_BLOCK_NUMBER"},
                    },
                    &cli.Uint64Flag{
                        Name:  "block-timestamp",
                        Usage: "Block timestamp (unix)",
                        Value: 1234567890,
                        EnvVars: []string{"CHOP_BLOCK_TIMESTAMP"},
                    },
                    &cli.StringFlag{
                        Name:  "difficulty",
                        Usage: "Block difficulty (hex or decimal)",
                        Value: "0",
                        EnvVars: []string{"CHOP_DIFFICULTY"},
                    },
                    &cli.StringFlag{
                        Name:  "prevrandao",
                        Usage: "Block prevrandao (hex or decimal)",
                        Value: "0",
                        EnvVars: []string{"CHOP_PREVRANDAO"},
                    },
                    &cli.StringFlag{
                        Name:  "coinbase",
                        Usage: "Block coinbase address (hex)",
                        Value: "0x0000000000000000000000000000000000000000",
                        EnvVars: []string{"CHOP_COINBASE"},
                    },
                    &cli.Uint64Flag{
                        Name:  "block-gas-limit",
                        Usage: "Block gas limit",
                        Value: appCfg.GasLimit,
                        EnvVars: []string{"CHOP_BLOCK_GAS_LIMIT"},
                    },
                    &cli.StringFlag{
                        Name:  "base-fee",
                        Usage: "Block base fee (hex or decimal)",
                        Value: "0",
                        EnvVars: []string{"CHOP_BASE_FEE"},
                    },
                    &cli.StringFlag{
                        Name:  "blob-base-fee",
                        Usage: "Blob base fee (hex or decimal)",
                        Value: "0",
                        EnvVars: []string{"CHOP_BLOB_BASE_FEE"},
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
            {
                Name:  "list-fixtures",
                Usage: "List saved fixtures (~/.chop/fixtures)",
                Action: runListFixtures,
            },
            {
                Name:  "save-fixture",
                Usage: "Save a fixture from flags: chop save-fixture <name>",
                Action: runSaveFixture,
                Flags: []cli.Flag{
                    &cli.StringFlag{Name: "bytecode", Aliases: []string{"b"}, Usage: "Bytecode (hex)", Value: "0x", EnvVars: []string{"CHOP_BYTECODE"}},
                    &cli.StringFlag{Name: "calldata", Aliases: []string{"d"}, Usage: "Calldata (hex)", Value: "0x", EnvVars: []string{"CHOP_CALLDATA"}},
                    &cli.StringFlag{Name: "caller", Usage: "Caller address (hex)", Value: "0x0000000000000000000000000000000000000001", EnvVars: []string{"CHOP_CALLER"}},
                    &cli.StringFlag{Name: "value", Aliases: []string{"v"}, Usage: "Value (wei, hex or decimal)", Value: "0", EnvVars: []string{"CHOP_VALUE"}},
                    &cli.Int64Flag{Name: "gas", Aliases: []string{"g"}, Usage: "Gas limit", Value: int64(appCfg.GasLimit), EnvVars: []string{"CHOP_GAS"}},
                },
            },
            {
                Name:  "load-fixture",
                Usage: "Load and execute a fixture: chop load-fixture <name>",
                Action: runLoadFixture,
                Flags: []cli.Flag{
                    &cli.StringFlag{Name: "hardfork", Usage: "EVM hardfork", Value: appCfg.Hardfork, EnvVars: []string{"CHOP_HARDFORK"}},
                },
            },
            {
                Name:  "diff",
                Usage: "Differential test: compare Chop against Ethereum execution specs",
                Action: func(c *cli.Context) error {
                    return diff.Run(diff.Options{
                        Bytecode:  c.String("bytecode"),
                        Calldata:  c.String("calldata"),
                        Reference: c.String("reference"),
                        Fixture:   c.String("fixture"),
                        Category:  c.String("category"),
                        Verbose:   c.Bool("verbose"),
                        Fork:      c.String("fork"),
                    })
                },
                Flags: []cli.Flag{
                    // Legacy flags (for future revme support)
                    &cli.StringFlag{Name: "bytecode", Aliases: []string{"b"}, Usage: "Bytecode (hex)", Value: "0x", EnvVars: []string{"CHOP_BYTECODE"}},
                    &cli.StringFlag{Name: "calldata", Aliases: []string{"d"}, Usage: "Calldata (hex)", Value: "0x", EnvVars: []string{"CHOP_CALLDATA"}},
                    &cli.StringFlag{Name: "reference", Aliases: []string{"r"}, Usage: "Reference EVM (revme|geth)", Value: "revme"},

                    // Spec fixture flags
                    &cli.StringFlag{Name: "fixture", Aliases: []string{"f"}, Usage: "Path to Ethereum spec fixture JSON"},
                    &cli.StringFlag{Name: "category", Aliases: []string{"c"}, Usage: "Run all fixtures in category (e.g., 'homestead/coverage')"},
                    &cli.StringFlag{Name: "fork", Usage: "Specific fork to test (e.g., 'Cancun', 'Berlin')"},
                    &cli.BoolFlag{Name: "verbose", Aliases: []string{"v"}, Usage: "Verbose output"},
                },
            },
        },
    }

	if err := cliApp.Run(os.Args); err != nil {
		log.Fatal(err)
	}
}
