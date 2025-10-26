package config

import (
    "encoding/json"
    "errors"
    "fmt"
    "os"
    "path/filepath"
    "strconv"
    "strings"

    "chop/types"
)

const (
    // File names and locations
    localConfigFilename = "chop.config.json"
    homeDirFolder       = ".chop"
    homeConfigFilename  = "config.json"
)

// Load returns the application config merged from defaults, config file, and environment variables.
// Precedence: defaults < config file < environment variables. CLI flags should be handled in main.
func Load() types.AppConfig {
    // Start with defaults
    cfg := types.DefaultAppConfig()

    // Merge file config if present
    if fileCfg, err := LoadFromFile(); err == nil {
        cfg = mergeConfig(cfg, fileCfg)
    }

    // Merge environment variables
    cfg = mergeEnv(cfg)

    return cfg
}

// LoadFromFile loads configuration from the current directory or the user's home config path.
// If neither exists, returns an error.
func LoadFromFile() (types.AppConfig, error) {
    var cfg types.AppConfig
    // Try local
    if b, err := os.ReadFile(localConfigFilename); err == nil {
        if err := json.Unmarshal(b, &cfg); err != nil {
            return types.AppConfig{}, fmt.Errorf("invalid %s: %w", localConfigFilename, err)
        }
        return cfg, nil
    }

    // Try home
    homePath, err := os.UserHomeDir()
    if err == nil {
        p := filepath.Join(homePath, homeDirFolder, homeConfigFilename)
        if b, err := os.ReadFile(p); err == nil {
            if err := json.Unmarshal(b, &cfg); err != nil {
                return types.AppConfig{}, fmt.Errorf("invalid %s: %w", p, err)
            }
            return cfg, nil
        }
    }

    return types.AppConfig{}, errors.New("no config file found")
}

// Save writes the provided configuration to the preferred location.
// Preference: write to ./chop.config.json if writable, otherwise to ~/.chop/config.json.
func Save(cfg types.AppConfig) (string, error) {
    // Try local first
    if err := writePrettyJSON(localConfigFilename, cfg); err == nil {
        return filepath.Abs(localConfigFilename)
    }

    // Fall back to home dir
    homePath, err := os.UserHomeDir()
    if err != nil {
        return "", fmt.Errorf("cannot resolve home dir for saving config: %w", err)
    }
    dir := filepath.Join(homePath, homeDirFolder)
    if mkErr := os.MkdirAll(dir, 0o755); mkErr != nil {
        return "", fmt.Errorf("cannot create %s: %w", dir, mkErr)
    }

    path := filepath.Join(dir, homeConfigFilename)
    if err := writePrettyJSON(path, cfg); err != nil {
        return "", err
    }
    return path, nil
}

func writePrettyJSON(path string, v any) error {
    b, err := json.MarshalIndent(v, "", "  ")
    if err != nil {
        return err
    }
    return os.WriteFile(path, b, 0o644)
}

// mergeConfig overlays b onto a where b has non-zero values.
func mergeConfig(a, b types.AppConfig) types.AppConfig {
    out := a
    if b.Port != 0 {
        out.Port = b.Port
    }
    if b.Host != "" {
        out.Host = b.Host
    }
    // Verbose merges as-is (bool zero-value is false)
    out.Verbose = out.Verbose || b.Verbose

    if b.Fork != "" {
        out.Fork = b.Fork
    }
    if b.ForkBlock != 0 {
        out.ForkBlock = b.ForkBlock
    }
    if b.GasLimit != 0 {
        out.GasLimit = b.GasLimit
    }
    if b.Hardfork != "" {
        out.Hardfork = b.Hardfork
    }
    if b.Accounts.Count != 0 {
        out.Accounts.Count = b.Accounts.Count
    }
    if b.Accounts.Balance != "" {
        out.Accounts.Balance = b.Accounts.Balance
    }
    return out
}

// mergeEnv overlays environment variable values (CHOP_*) onto the provided config.
func mergeEnv(cfg types.AppConfig) types.AppConfig {
    // Helper to read env var
    getenv := func(k string) (string, bool) {
        v, ok := os.LookupEnv(k)
        return v, ok
    }

    if v, ok := getenv("CHOP_PORT"); ok {
        if n, err := strconv.Atoi(v); err == nil {
            cfg.Port = n
        }
    }
    if v, ok := getenv("CHOP_HOST"); ok && v != "" {
        cfg.Host = v
    }
    if v, ok := getenv("CHOP_VERBOSE"); ok {
        cfg.Verbose = isTruthy(v)
    }
    if v, ok := getenv("CHOP_FORK"); ok {
        cfg.Fork = v
    }
    if v, ok := getenv("CHOP_FORK_BLOCK"); ok {
        if n, err := strconv.ParseUint(v, 10, 64); err == nil {
            cfg.ForkBlock = n
        }
    }
    if v, ok := getenv("CHOP_GAS_LIMIT"); ok {
        if n, err := strconv.ParseUint(v, 10, 64); err == nil {
            cfg.GasLimit = n
        }
    }
    if v, ok := getenv("CHOP_HARDFORK"); ok && v != "" {
        cfg.Hardfork = v
    }
    if v, ok := getenv("CHOP_ACCOUNTS_COUNT"); ok {
        if n, err := strconv.Atoi(v); err == nil {
            cfg.Accounts.Count = n
        }
    }
    if v, ok := getenv("CHOP_ACCOUNTS_BALANCE"); ok && v != "" {
        cfg.Accounts.Balance = v
    }

    return cfg
}

func isTruthy(v string) bool {
    v = strings.TrimSpace(strings.ToLower(v))
    switch v {
    case "1", "true", "t", "yes", "y", "on":
        return true
    default:
        return false
    }
}

