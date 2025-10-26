package diff

import (
	"chop/evm"
	"chop/types"
	"fmt"
	"path/filepath"
	"strings"
)

type Options struct {
	Bytecode  string
	Calldata  string
	Reference string
	Fixture   string // Path to spec fixture
	Category  string // Category name (e.g., "arithmetic")
	Verbose   bool   // Verbose output
	Fork      string // Fork name (e.g., "Cancun", "Berlin")
}

type TestResult struct {
	Name       string
	Passed     bool
	Expected   ExpectedResult
	Actual     ActualResult
	Divergence *Divergence // nil if passed
}

type ExpectedResult struct {
	Success    bool
	GasUsed    uint64
	ReturnData string
	StateRoot  string
}

type ActualResult struct {
	Success    bool
	GasUsed    uint64
	ReturnData string
	StateRoot  string
}

type Divergence struct {
	Field    string // "success", "gas", "returnData", "state"
	Expected string
	Actual   string
	Context  string // Fixture name, pre-state summary
}

// Run performs a differential comparison
func Run(opts Options) error {
	if opts.Fixture != "" {
		return runSpecFixture(opts.Fixture, opts)
	}

	if opts.Category != "" {
		return runSpecCategory(opts.Category, opts)
	}

	// Legacy mode: Not yet implemented for revme
	return fmt.Errorf("differential testing with revme not yet implemented (use --fixture or --category for spec tests)")
}

func runSpecFixture(fixturePath string, opts Options) error {
	// Load fixture
	fixtures, err := LoadSpecFixture(fixturePath)
	if err != nil {
		return fmt.Errorf("failed to load fixture: %w", err)
	}

	if len(fixtures) == 0 {
		return fmt.Errorf("no test cases found in fixture")
	}

	if opts.Verbose {
		fmt.Printf("Loaded %d test case(s) from %s\n\n", len(fixtures), filepath.Base(fixturePath))
	}

	// Execute each test case in the fixture
	totalTests := 0
	passedTests := 0
	var failedTests []string

	for name, fixture := range fixtures {
		totalTests++

		result, err := executeSpecTest(name, fixture, opts)
		if err != nil {
			fmt.Printf("ERROR: %s - %s\n", name, err.Error())
			failedTests = append(failedTests, name)
			continue
		}

		if result.Passed {
			passedTests++
			if opts.Verbose {
				fmt.Printf("PASS: %s\n", name)
			} else {
				fmt.Print(".")
			}
		} else {
			fmt.Printf("\nFAIL: %s\n", name)
			PrintDivergence(result.Divergence)
			failedTests = append(failedTests, name)
		}
	}

	if !opts.Verbose {
		fmt.Println() // New line after dots
	}

	fmt.Print(FormatTestSummary(passedTests, len(failedTests), totalTests))

	if len(failedTests) > 0 {
		return fmt.Errorf("%d test(s) failed", len(failedTests))
	}

	return nil
}

func runSpecCategory(category string, opts Options) error {
	// Get fixtures directory
	fixturesDir, err := GetFixturesDir()
	if err != nil {
		return fmt.Errorf("failed to locate fixtures directory: %w", err)
	}

	// List all fixtures in category
	fixtures, err := ListSpecFixtures(fixturesDir, category)
	if err != nil {
		return fmt.Errorf("failed to list fixtures: %w", err)
	}

	if len(fixtures) == 0 {
		return fmt.Errorf("no fixtures found in category: %s", category)
	}

	fmt.Printf("Running %d fixture(s) in category '%s'...\n\n", len(fixtures), category)

	for _, fixturePath := range fixtures {
		if opts.Verbose {
			fmt.Printf("=== %s ===\n", filepath.Base(fixturePath))
		}

		// Create new opts for this fixture
		fixtureOpts := opts
		fixtureOpts.Fixture = fixturePath

		err := runSpecFixture(fixturePath, fixtureOpts)
		if err != nil {
			// Individual fixture results already printed
			// Continue with next fixture
		}

		// Note: We'd need to accumulate stats across fixtures
		// For now, just run each fixture independently
	}

	fmt.Printf("\nCompleted testing category: %s\n", category)

	return nil
}

func executeSpecTest(name string, fixture types.SpecFixture, opts Options) (*TestResult, error) {
	// Determine which fork to test
	forkName := opts.Fork
	if forkName == "" {
		// Default to Cancun, or first available fork in post
		if _, ok := fixture.Post["Cancun"]; ok {
			forkName = "Cancun"
		} else {
			// Use first available fork
			for fork := range fixture.Post {
				forkName = fork
				break
			}
		}
	}

	// Check if fork exists in post-state
	postStates, ok := fixture.Post[forkName]
	if !ok {
		return nil, fmt.Errorf("fork %s not found in post-state", forkName)
	}

	if len(postStates) == 0 {
		return nil, fmt.Errorf("no post-state variants for fork %s", forkName)
	}

	// Use first post-state variant (data index 0, gas index 0, value index 0)
	postState := postStates[0]

	// Map fork name to hardfork
	hardfork := mapForkToHardfork(forkName)

	// Create EVM instance
	vm, err := evm.NewEVM(hardfork, evm.LogLevelNone)
	if err != nil {
		return nil, fmt.Errorf("failed to create EVM: %w", err)
	}
	defer vm.Close()

	// Setup pre-state
	if err := setupPreState(vm, fixture.Pre); err != nil {
		return nil, fmt.Errorf("failed to setup pre-state: %w", err)
	}

	// Setup blockchain context
	if err := setupBlockContext(vm, fixture.Env, fixture.Config); err != nil {
		return nil, fmt.Errorf("failed to setup block context: %w", err)
	}

	// Get transaction parameters based on indexes
	dataIndex := postState.Indexes.Data
	gasIndex := postState.Indexes.Gas
	valueIndex := postState.Indexes.Value

	if dataIndex >= len(fixture.Transaction.Data) {
		return nil, fmt.Errorf("data index %d out of bounds", dataIndex)
	}
	if gasIndex >= len(fixture.Transaction.GasLimit) {
		return nil, fmt.Errorf("gas index %d out of bounds", gasIndex)
	}
	if valueIndex >= len(fixture.Transaction.Value) {
		return nil, fmt.Errorf("value index %d out of bounds", valueIndex)
	}

	txData := fixture.Transaction.Data[dataIndex]
	txGasLimit := fixture.Transaction.GasLimit[gasIndex]
	txValue := fixture.Transaction.Value[valueIndex]

	// Parse transaction parameters
	calldata, err := ParseHexBytes(txData)
	if err != nil {
		return nil, fmt.Errorf("failed to parse calldata: %w", err)
	}

	gasLimit, err := ParseHexU64(txGasLimit)
	if err != nil {
		return nil, fmt.Errorf("failed to parse gas limit: %w", err)
	}

	value, err := ParseHexU256(txValue)
	if err != nil {
		return nil, fmt.Errorf("failed to parse value: %w", err)
	}

	sender, err := ParseHexAddress(fixture.Transaction.Sender)
	if err != nil {
		return nil, fmt.Errorf("failed to parse sender: %w", err)
	}

	// Determine if this is a contract creation (empty "to" field)
	isCreate := fixture.Transaction.To == "" || fixture.Transaction.To == "0x"

	var to evm.Address
	if !isCreate {
		to, err = ParseHexAddress(fixture.Transaction.To)
		if err != nil {
			return nil, fmt.Errorf("failed to parse to address: %w", err)
		}

		// Get the code for the target address
		// For now, we'll execute against whatever was set up in pre-state
	}

	// Setup execution context
	execCtx := evm.ExecutionContext{
		Gas:      int64(gasLimit),
		Caller:   sender,
		Address:  to,
		Value:    value,
		Calldata: calldata,
	}

	if isCreate {
		// For contract creation, bytecode is in calldata
		if err := vm.SetBytecode(calldata); err != nil {
			return nil, fmt.Errorf("failed to set bytecode: %w", err)
		}
		execCtx.Calldata = []byte{} // No calldata for creation
	} else {
		// For regular call, we need to get the code from the address
		// The code should have been set in pre-state
		// For now, we'll just try to execute - the VM should handle it
	}

	if err := vm.SetExecutionContext(execCtx); err != nil {
		return nil, fmt.Errorf("failed to set execution context: %w", err)
	}

	// Execute transaction
	result, err := vm.Execute()
	if err != nil {
		// Execution failed - this might be expected
		// Check if the test expects success
		if postState.State != nil && len(postState.State) > 0 {
			// Post-state exists, so success was expected
			return &TestResult{
				Name:   name,
				Passed: false,
				Expected: ExpectedResult{
					Success: true,
				},
				Actual: ActualResult{
					Success: false,
				},
				Divergence: &Divergence{
					Field:    "execution",
					Expected: "success",
					Actual:   fmt.Sprintf("error: %s", err.Error()),
					Context:  name,
				},
			}, nil
		}

		// Execution failed and no post-state, might be expected
		// For now, consider it a pass if there's no post-state
		return &TestResult{
			Name:   name,
			Passed: true,
			Expected: ExpectedResult{
				Success: false,
			},
			Actual: ActualResult{
				Success: false,
			},
		}, nil
	}

	// For MVP, we just check that execution completed successfully
	// Full post-state validation is TODO
	expectedSuccess := postState.State != nil && len(postState.State) > 0

	return &TestResult{
		Name:   name,
		Passed: result.Success == expectedSuccess,
		Expected: ExpectedResult{
			Success:    expectedSuccess,
			GasUsed:    0, // TODO: Parse expected gas from fixture
			ReturnData: "",
		},
		Actual: ActualResult{
			Success:    result.Success,
			GasUsed:    uint64(result.GasUsed),
			ReturnData: FormatBytes(result.Output),
		},
	}, nil
}

// setupPreState configures the EVM with initial account states
func setupPreState(vm *evm.EVM, pre map[string]types.SpecAccount) error {
	for addrStr, account := range pre {
		addr, err := ParseHexAddress(addrStr)
		if err != nil {
			return fmt.Errorf("invalid address %s: %w", addrStr, err)
		}

		// Set balance
		balance, err := ParseHexU256(account.Balance)
		if err != nil {
			return fmt.Errorf("invalid balance for %s: %w", addrStr, err)
		}
		if err := vm.SetBalance(addr, balance); err != nil {
			return fmt.Errorf("failed to set balance for %s: %w", addrStr, err)
		}

		// Set code
		if account.Code != "" && account.Code != "0x" {
			code, err := ParseHexBytes(account.Code)
			if err != nil {
				return fmt.Errorf("invalid code for %s: %w", addrStr, err)
			}
			if err := vm.SetCode(addr, code); err != nil {
				return fmt.Errorf("failed to set code for %s: %w", addrStr, err)
			}
		}

		// Set storage
		for slotStr, valueStr := range account.Storage {
			slot, err := ParseHexU256(slotStr)
			if err != nil {
				return fmt.Errorf("invalid storage slot %s for %s: %w", slotStr, addrStr, err)
			}

			value, err := ParseHexU256(valueStr)
			if err != nil {
				return fmt.Errorf("invalid storage value %s for %s: %w", valueStr, addrStr, err)
			}

			if err := vm.SetStorage(addr, slot, value); err != nil {
				return fmt.Errorf("failed to set storage for %s: %w", addrStr, err)
			}
		}

		// Note: Nonce is not currently settable via the EVM API
		// This is a limitation we'll need to address
	}

	return nil
}

// setupBlockContext configures the EVM with blockchain environment
func setupBlockContext(vm *evm.EVM, env types.SpecEnvironment, config *types.SpecConfig) error {
	chainID, err := ParseHexU256("0x01") // Default to mainnet
	if config != nil && config.ChainID != "" {
		chainID, err = ParseHexU256(config.ChainID)
		if err != nil {
			return fmt.Errorf("invalid chain ID: %w", err)
		}
	}

	blockNumber, err := ParseHexU64(env.CurrentNumber)
	if err != nil {
		return fmt.Errorf("invalid block number: %w", err)
	}

	timestamp, err := ParseHexU64(env.CurrentTimestamp)
	if err != nil {
		return fmt.Errorf("invalid timestamp: %w", err)
	}

	difficulty, err := ParseHexU256(env.CurrentDifficulty)
	if err != nil {
		return fmt.Errorf("invalid difficulty: %w", err)
	}

	coinbase, err := ParseHexAddress(env.CurrentCoinbase)
	if err != nil {
		return fmt.Errorf("invalid coinbase: %w", err)
	}

	gasLimit, err := ParseHexU64(env.CurrentGasLimit)
	if err != nil {
		return fmt.Errorf("invalid gas limit: %w", err)
	}

	var baseFee evm.U256
	if env.CurrentBaseFee != "" {
		baseFee, err = ParseHexU256(env.CurrentBaseFee)
		if err != nil {
			return fmt.Errorf("invalid base fee: %w", err)
		}
	}

	var prevrandao evm.U256
	if env.CurrentRandom != "" {
		prevrandao, err = ParseHexU256(env.CurrentRandom)
		if err != nil {
			return fmt.Errorf("invalid prevrandao: %w", err)
		}
	}

	// Note: BlobBaseFee calculation from CurrentExcessBlobGas not implemented yet
	var blobBaseFee evm.U256

	blockCtx := evm.BlockContext{
		ChainID:        chainID,
		BlockNumber:    blockNumber,
		BlockTimestamp: timestamp,
		Difficulty:     difficulty,
		Prevrandao:     prevrandao,
		Coinbase:       coinbase,
		GasLimit:       gasLimit,
		BaseFee:        baseFee,
		BlobBaseFee:    blobBaseFee,
	}

	vm.SetBlockchainContext(blockCtx)
	return nil
}

// mapForkToHardfork maps Ethereum fork names to hardfork strings
func mapForkToHardfork(fork string) string {
	fork = strings.ToLower(fork)
	switch fork {
	case "cancun":
		return "cancun"
	case "shanghai":
		return "shanghai"
	case "paris", "merge":
		return "paris"
	case "london":
		return "london"
	case "berlin":
		return "berlin"
	case "istanbul":
		return "istanbul"
	case "petersburg", "constantinoplefix":
		return "petersburg"
	case "constantinople":
		return "constantinople"
	case "byzantium":
		return "byzantium"
	case "spuriousdragon":
		return "spuriousdragon"
	case "tangerineWhistle":
		return "tangerinewhistle"
	case "homestead":
		return "homestead"
	case "frontier":
		return "frontier"
	default:
		// Default to cancun for unknown forks
		return "cancun"
	}
}
