package diff

import (
	"chop/types"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// LoadSpecFixture loads a fixture from the official Ethereum execution-spec-tests
func LoadSpecFixture(path string) (map[string]types.SpecFixture, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read fixture file: %w", err)
	}

	var fixtures map[string]types.SpecFixture
	if err := json.Unmarshal(data, &fixtures); err != nil {
		return nil, fmt.Errorf("failed to parse fixture JSON: %w", err)
	}

	return fixtures, nil
}

// GetFixturesDir returns the path to official fixtures
// Priority: 1) CHOP_FIXTURES_DIR env var, 2) guillotine/test/official/fixtures, 3) ~/.chop/fixtures
func GetFixturesDir() (string, error) {
	// Check env var
	if dir := os.Getenv("CHOP_FIXTURES_DIR"); dir != "" {
		if stat, err := os.Stat(dir); err == nil && stat.IsDir() {
			return dir, nil
		}
	}

	// Check guillotine repo (relative to current working directory)
	cwd, err := os.Getwd()
	if err == nil {
		guillotineFixtures := filepath.Join(cwd, "guillotine", "test", "official", "fixtures")
		if stat, err := os.Stat(guillotineFixtures); err == nil && stat.IsDir() {
			return guillotineFixtures, nil
		}
	}

	// Check absolute path to guillotine repo
	guillotineFixtures := "/Users/williamcory/chop/guillotine/test/official/fixtures"
	if stat, err := os.Stat(guillotineFixtures); err == nil && stat.IsDir() {
		return guillotineFixtures, nil
	}

	// Fallback to user fixtures
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("cannot determine fixtures directory: %w", err)
	}

	userFixtures := filepath.Join(home, ".chop", "fixtures")
	if stat, err := os.Stat(userFixtures); err == nil && stat.IsDir() {
		return userFixtures, nil
	}

	return "", fmt.Errorf("fixtures directory not found. Set CHOP_FIXTURES_DIR or ensure guillotine/test/official/fixtures exists")
}

// ListSpecFixtures returns all fixture JSON files in a directory
func ListSpecFixtures(dir string, category string) ([]string, error) {
	// If category is empty, list all JSON files recursively
	if category == "" {
		return listAllFixtures(dir)
	}

	// Check if category is a direct subdirectory
	categoryDir := filepath.Join(dir, category)
	if stat, err := os.Stat(categoryDir); err == nil && stat.IsDir() {
		return listAllFixtures(categoryDir)
	}

	// Check state_tests subdirectory structure
	stateTestsDir := filepath.Join(dir, "state_tests", category)
	if stat, err := os.Stat(stateTestsDir); err == nil && stat.IsDir() {
		return listAllFixtures(stateTestsDir)
	}

	// Try as a pattern
	pattern := filepath.Join(dir, "**", category+"*.json")
	return filepath.Glob(pattern)
}

// listAllFixtures recursively lists all JSON files in a directory
func listAllFixtures(dir string) ([]string, error) {
	var fixtures []string

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !info.IsDir() && strings.HasSuffix(path, ".json") {
			fixtures = append(fixtures, path)
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk directory: %w", err)
	}

	return fixtures, nil
}

// GetFixtureCategories returns a list of available test categories
func GetFixtureCategories(fixturesDir string) ([]string, error) {
	var categories []string

	// Check state_tests directory
	stateTestsDir := filepath.Join(fixturesDir, "state_tests")
	if stat, err := os.Stat(stateTestsDir); err == nil && stat.IsDir() {
		entries, err := os.ReadDir(stateTestsDir)
		if err != nil {
			return nil, fmt.Errorf("failed to read state_tests directory: %w", err)
		}

		for _, entry := range entries {
			if entry.IsDir() {
				categories = append(categories, entry.Name())
			}
		}
	}

	// Check blockchain_tests directory
	blockchainTestsDir := filepath.Join(fixturesDir, "blockchain_tests")
	if stat, err := os.Stat(blockchainTestsDir); err == nil && stat.IsDir() {
		entries, err := os.ReadDir(blockchainTestsDir)
		if err == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					categories = append(categories, "blockchain/"+entry.Name())
				}
			}
		}
	}

	return categories, nil
}
