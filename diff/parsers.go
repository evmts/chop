package diff

import (
	"chop/evm"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
)

// ParseHexBytes parses a hex string (with or without 0x prefix) into bytes
func ParseHexBytes(hexStr string) ([]byte, error) {
	hexStr = strings.TrimSpace(hexStr)

	// Handle empty string or just "0x"
	if hexStr == "" || hexStr == "0x" {
		return []byte{}, nil
	}

	// Remove 0x prefix if present
	if strings.HasPrefix(hexStr, "0x") || strings.HasPrefix(hexStr, "0X") {
		hexStr = hexStr[2:]
	}

	// Decode hex
	bytes, err := hex.DecodeString(hexStr)
	if err != nil {
		return nil, fmt.Errorf("invalid hex string: %w", err)
	}

	return bytes, nil
}

// ParseHexU64 parses a hex string into a uint64
func ParseHexU64(hexStr string) (uint64, error) {
	hexStr = strings.TrimSpace(hexStr)

	// Handle empty string or just "0x"
	if hexStr == "" || hexStr == "0x" {
		return 0, nil
	}

	// Remove 0x prefix if present
	if strings.HasPrefix(hexStr, "0x") || strings.HasPrefix(hexStr, "0X") {
		hexStr = hexStr[2:]
	}

	// Parse as hex
	var result uint64
	_, err := fmt.Sscanf(hexStr, "%x", &result)
	if err != nil {
		return 0, fmt.Errorf("invalid hex uint64: %w", err)
	}

	return result, nil
}

// ParseHexU256 parses a hex string into a U256
func ParseHexU256(hexStr string) (evm.U256, error) {
	var u256 evm.U256
	hexStr = strings.TrimSpace(hexStr)

	// Handle empty string or just "0x"
	if hexStr == "" || hexStr == "0x" {
		return u256, nil
	}

	// Remove 0x prefix if present
	if strings.HasPrefix(hexStr, "0x") || strings.HasPrefix(hexStr, "0X") {
		hexStr = hexStr[2:]
	}

	// Parse as big.Int
	value := new(big.Int)
	_, ok := value.SetString(hexStr, 16)
	if !ok {
		return u256, fmt.Errorf("invalid hex U256: %s", hexStr)
	}

	// Convert to U256
	bytes := value.Bytes()
	if len(bytes) > 32 {
		return u256, fmt.Errorf("value too large for U256: %s", hexStr)
	}

	// Copy to the end (big-endian)
	copy(u256[32-len(bytes):], bytes)

	return u256, nil
}

// ParseHexAddress parses a hex string into an Address
func ParseHexAddress(hexStr string) (evm.Address, error) {
	var addr evm.Address
	hexStr = strings.TrimSpace(hexStr)

	// Handle empty string or just "0x" as zero address
	if hexStr == "" || hexStr == "0x" {
		return addr, nil
	}

	// Remove 0x prefix if present
	if strings.HasPrefix(hexStr, "0x") || strings.HasPrefix(hexStr, "0X") {
		hexStr = hexStr[2:]
	}

	// Pad to 40 characters if needed (20 bytes)
	if len(hexStr) < 40 {
		hexStr = strings.Repeat("0", 40-len(hexStr)) + hexStr
	}

	// Decode hex
	bytes, err := hex.DecodeString(hexStr)
	if err != nil {
		return addr, fmt.Errorf("invalid hex address: %w", err)
	}

	if len(bytes) != 20 {
		return addr, fmt.Errorf("address must be 20 bytes, got %d", len(bytes))
	}

	copy(addr[:], bytes)
	return addr, nil
}

// ParseHexHash32 parses a hex string into a 32-byte hash
func ParseHexHash32(hexStr string) ([32]byte, error) {
	var hash [32]byte
	hexStr = strings.TrimSpace(hexStr)

	// Handle empty string or just "0x" as zero hash
	if hexStr == "" || hexStr == "0x" {
		return hash, nil
	}

	// Remove 0x prefix if present
	if strings.HasPrefix(hexStr, "0x") || strings.HasPrefix(hexStr, "0X") {
		hexStr = hexStr[2:]
	}

	// Pad to 64 characters if needed (32 bytes)
	if len(hexStr) < 64 {
		hexStr = strings.Repeat("0", 64-len(hexStr)) + hexStr
	}

	// Decode hex
	bytes, err := hex.DecodeString(hexStr)
	if err != nil {
		return hash, fmt.Errorf("invalid hex hash: %w", err)
	}

	if len(bytes) != 32 {
		return hash, fmt.Errorf("hash must be 32 bytes, got %d", len(bytes))
	}

	copy(hash[:], bytes)
	return hash, nil
}

// FormatU256 formats a U256 as a hex string
func FormatU256(u256 evm.U256) string {
	// Find the first non-zero byte
	start := 0
	for start < 32 && u256[start] == 0 {
		start++
	}

	// If all zeros, return "0x0"
	if start == 32 {
		return "0x0"
	}

	return "0x" + hex.EncodeToString(u256[start:])
}

// FormatAddress formats an Address as a hex string
func FormatAddress(addr evm.Address) string {
	return "0x" + hex.EncodeToString(addr[:])
}

// FormatBytes formats bytes as a hex string
func FormatBytes(bytes []byte) string {
	if len(bytes) == 0 {
		return "0x"
	}
	return "0x" + hex.EncodeToString(bytes)
}
