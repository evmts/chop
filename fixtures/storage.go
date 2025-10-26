package fixtures

import (
    "encoding/json"
    "fmt"
    "os"
    "path/filepath"
    "strings"
)

// Fixture represents a saved executable scenario
type Fixture struct {
    Name           string                   `json:"name"`
    Bytecode       string                   `json:"bytecode"`
    Calldata       string                   `json:"calldata"`
    Caller         string                   `json:"caller"`
    Value          string                   `json:"value"`
    GasLimit       uint64                   `json:"gasLimit"`
    ExpectedResult *FixtureExpectedResult   `json:"expectedResult,omitempty"`
}

type FixtureExpectedResult struct {
    Success bool   `json:"success"`
    GasUsed uint64 `json:"gasUsed"`
}

// Dir returns the fixtures directory path (~/.chop/fixtures)
func Dir() (string, error) {
    home, err := os.UserHomeDir()
    if err != nil {
        return "", err
    }
    return filepath.Join(home, ".chop", "fixtures"), nil
}

func pathFor(name string) (string, error) {
    dir, err := Dir()
    if err != nil {
        return "", err
    }
    if err := os.MkdirAll(dir, 0o755); err != nil {
        return "", err
    }
    safe := strings.TrimSpace(name)
    if safe == "" {
        return "", fmt.Errorf("fixture name cannot be empty")
    }
    return filepath.Join(dir, safe+".json"), nil
}

// Save writes a fixture to disk
func Save(f Fixture) (string, error) {
    p, err := pathFor(f.Name)
    if err != nil {
        return "", err
    }
    b, err := json.MarshalIndent(f, "", "  ")
    if err != nil {
        return "", err
    }
    if err := os.WriteFile(p, b, 0o644); err != nil {
        return "", err
    }
    return p, nil
}

// Load reads a named fixture
func Load(name string) (Fixture, error) {
    p, err := pathFor(name)
    if err != nil {
        return Fixture{}, err
    }
    b, err := os.ReadFile(p)
    if err != nil {
        return Fixture{}, err
    }
    var f Fixture
    if err := json.Unmarshal(b, &f); err != nil {
        return Fixture{}, err
    }
    return f, nil
}

// List returns the list of fixture names
func List() ([]string, error) {
    dir, err := Dir()
    if err != nil {
        return nil, err
    }
    entries, err := os.ReadDir(dir)
    if err != nil {
        if os.IsNotExist(err) {
            return []string{}, nil
        }
        return nil, err
    }
    out := make([]string, 0, len(entries))
    for _, e := range entries {
        if e.IsDir() { continue }
        name := e.Name()
        if strings.HasSuffix(name, ".json") {
            out = append(out, strings.TrimSuffix(name, ".json"))
        }
    }
    return out, nil
}

