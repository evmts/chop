package accounts

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

// Seed represents a deterministic seed for account generation.
// It contains both raw bytes and hex-encoded representation for convenience.
type Seed struct {
	Value []byte
	Hex   string
}

// GenerateSeed creates a new cryptographically secure random 32-byte seed.
// The seed can be used for deterministic account generation.
// Returns an error if the system's random number generator fails.
func GenerateSeed() (*Seed, error) {
	// Generate 32 bytes of random data
	seedBytes := make([]byte, 32)
	_, err := rand.Read(seedBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to generate random seed: %w", err)
	}

	return &Seed{
		Value: seedBytes,
		Hex:   hex.EncodeToString(seedBytes),
	}, nil
}

// SeedFromHex creates a seed from a hex-encoded string.
// The hex string must represent exactly 32 bytes and may optionally include a "0x" prefix.
// Returns an error if the hex string is invalid or not exactly 32 bytes.
func SeedFromHex(hexStr string) (*Seed, error) {
	// Remove 0x prefix if present
	if len(hexStr) > 2 && hexStr[:2] == "0x" {
		hexStr = hexStr[2:]
	}

	seedBytes, err := hex.DecodeString(hexStr)
	if err != nil {
		return nil, fmt.Errorf("invalid seed hex: %w", err)
	}

	if len(seedBytes) != 32 {
		return nil, fmt.Errorf("seed must be 32 bytes, got %d", len(seedBytes))
	}

	return &Seed{
		Value: seedBytes,
		Hex:   hex.EncodeToString(seedBytes),
	}, nil
}

// DerivePrivateKey derives a deterministic private key from the seed and account index.
// The same seed and index will always produce the same private key.
// Note: This uses a simplified derivation for testing. Production code should use BIP32/BIP44.
func (s *Seed) DerivePrivateKey(index int) []byte {
	// Simple derivation: hash(seed || index)
	// In production, you'd use BIP32/BIP44, but for a test environment this is sufficient
	hasher := sha256.New()
	hasher.Write(s.Value)
	hasher.Write([]byte(fmt.Sprintf("%d", index)))
	privateKey := hasher.Sum(nil)

	return privateKey
}

// DeriveAddress derives an Ethereum-style address from a private key.
// Returns a 20-byte address in hex format with "0x" prefix.
// Note: This uses simplified address derivation for testing. Production code should use
// Keccak256 hashing and secp256k1 public key derivation.
func DeriveAddress(privateKey []byte) string {
	// Simple address derivation: last 20 bytes of hash(privateKey)
	// Real Ethereum uses Keccak256(publicKey)[12:]
	hasher := sha256.New()
	hasher.Write(privateKey)
	hash := hasher.Sum(nil)

	// Take last 20 bytes and format as hex address
	address := hash[12:]
	return "0x" + hex.EncodeToString(address)
}

// FormatPrivateKey formats a private key as a hex string with "0x" prefix.
// This format is compatible with most Ethereum tools and libraries.
func FormatPrivateKey(privateKey []byte) string {
	return "0x" + hex.EncodeToString(privateKey)
}
