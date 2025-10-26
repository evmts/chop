package types

// SpecFixture represents an Ethereum execution-spec-tests fixture
// Based on the official Ethereum test format from execution-spec-tests
type SpecFixture struct {
	Info        *SpecInfo                   `json:"_info,omitempty"`
	Pre         map[string]SpecAccount      `json:"pre"`
	Transaction SpecTransaction             `json:"transaction"`
	Post        map[string][]SpecPostState  `json:"post"` // Fork name -> array of expected results
	Env         SpecEnvironment             `json:"env"`
	Config      *SpecConfig                 `json:"config,omitempty"`
}

// SpecInfo contains metadata about the test case
type SpecInfo struct {
	Hash        string `json:"hash,omitempty"`
	Comment     string `json:"comment,omitempty"`
	Description string `json:"description,omitempty"`
	URL         string `json:"url,omitempty"`
}

// SpecAccount represents an account's state
type SpecAccount struct {
	Balance string            `json:"balance"`
	Code    string            `json:"code"`
	Nonce   string            `json:"nonce"`
	Storage map[string]string `json:"storage"`
}

// SpecTransaction represents a transaction in the fixture
type SpecTransaction struct {
	Data      []string `json:"data"`      // Array of calldata options
	GasLimit  []string `json:"gasLimit"`  // Array of gas limit options
	GasPrice  string   `json:"gasPrice"`
	Nonce     string   `json:"nonce"`
	To        string   `json:"to"`
	Value     []string `json:"value"`     // Array of value options
	Sender    string   `json:"sender,omitempty"`
	SecretKey string   `json:"secretKey,omitempty"`
}

// SpecPostState represents expected state after execution
type SpecPostState struct {
	Hash    string            `json:"hash"`
	Logs    string            `json:"logs"`
	TxBytes string            `json:"txbytes,omitempty"`
	Indexes SpecIndexes       `json:"indexes"`
	State   map[string]SpecAccount `json:"state,omitempty"` // Detailed post-state for validation
}

// SpecIndexes specifies which transaction variant this result is for
type SpecIndexes struct {
	Data  int `json:"data"`
	Gas   int `json:"gas"`
	Value int `json:"value"`
}

// SpecEnvironment represents blockchain environment parameters
type SpecEnvironment struct {
	CurrentCoinbase    string `json:"currentCoinbase"`
	CurrentDifficulty  string `json:"currentDifficulty"`
	CurrentGasLimit    string `json:"currentGasLimit"`
	CurrentNumber      string `json:"currentNumber"`
	CurrentTimestamp   string `json:"currentTimestamp"`
	CurrentBaseFee     string `json:"currentBaseFee,omitempty"`
	CurrentRandom      string `json:"currentRandom,omitempty"`      // Prevrandao
	PreviousHash       string `json:"previousHash,omitempty"`
	CurrentExcessBlobGas string `json:"currentExcessBlobGas,omitempty"`
}

// SpecConfig contains chain configuration
type SpecConfig struct {
	ChainID string `json:"chainid,omitempty"`
}
