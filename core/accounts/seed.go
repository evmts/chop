package accounts

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

// Seed represents a deterministic seed for account generation
type Seed struct {
	Value []byte
	Hex   string
}

// GenerateSeed creates a new random seed
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

// SeedFromHex creates a seed from a hex string
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

// DerivePrivateKey derives a private key from the seed and account index
func (s *Seed) DerivePrivateKey(index int) []byte {
	// Simple derivation: hash(seed || index)
	// In production, you'd use BIP32/BIP44, but for a test environment this is sufficient
	hasher := sha256.New()
	hasher.Write(s.Value)
	hasher.Write([]byte(fmt.Sprintf("%d", index)))
	privateKey := hasher.Sum(nil)

	return privateKey
}

// DeriveAddress derives an Ethereum address from a private key
// For now, we use a simplified version. In production, you'd use secp256k1
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

// FormatPrivateKey formats a private key as a hex string
func FormatPrivateKey(privateKey []byte) string {
	return "0x" + hex.EncodeToString(privateKey)
}
