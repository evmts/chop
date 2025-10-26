package types

// AppConfig defines Chop application configuration that can be persisted to disk
// and overridden by environment variables and CLI flags.
type AppConfig struct {
    Port      int    `json:"port"`
    Host      string `json:"host"`
    Verbose   bool   `json:"verbose"`
    Fork      string `json:"fork"`
    ForkBlock uint64 `json:"forkBlock"`

    // Execution defaults
    GasLimit uint64 `json:"gasLimit"`
    Hardfork string `json:"hardfork"`

    Accounts struct {
        Count   int    `json:"count"`
        Balance string `json:"balance"`
    } `json:"accounts"`
}

// DefaultAppConfig returns the built-in defaults.
func DefaultAppConfig() AppConfig {
    cfg := AppConfig{
        Port:      8545,
        Host:      "127.0.0.1",
        Verbose:   false,
        Fork:      "",
        ForkBlock: 0,
        GasLimit:  30_000_000,
        Hardfork:  "cancun",
    }
    cfg.Accounts.Count = 10
    // 100 ETH in wei
    cfg.Accounts.Balance = "100000000000000000000"
    return cfg
}

