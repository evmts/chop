package accounts

import (
	"encoding/hex"
	"testing"
)

// TestGenerateSeed verifies that GenerateSeed creates a valid 32-byte seed
func TestGenerateSeed(t *testing.T) {
	t.Parallel()

	seed, err := GenerateSeed()
	if err != nil {
		t.Fatalf("GenerateSeed() failed: %v", err)
	}

	// Verify seed is not nil
	if seed == nil {
		t.Fatal("GenerateSeed() returned nil seed")
	}

	// Verify seed value is 32 bytes
	if len(seed.Value) != 32 {
		t.Errorf("Expected 32-byte seed, got %d bytes", len(seed.Value))
	}

	// Verify hex encoding is correct length (64 hex characters for 32 bytes)
	if len(seed.Hex) != 64 {
		t.Errorf("Expected 64 character hex string, got %d characters", len(seed.Hex))
	}

	// Verify hex string matches the value
	expectedHex := hex.EncodeToString(seed.Value)
	if seed.Hex != expectedHex {
		t.Errorf("Hex encoding mismatch: expected %s, got %s", expectedHex, seed.Hex)
	}

	// Verify that two generated seeds are different (randomness check)
	seed2, err := GenerateSeed()
	if err != nil {
		t.Fatalf("Second GenerateSeed() failed: %v", err)
	}

	if seed.Hex == seed2.Hex {
		t.Error("Two generated seeds should be different (very unlikely to be identical)")
	}
}

// TestSeedFromHexValid tests creating a seed from valid hex strings
func TestSeedFromHexValid(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		hexStr  string
		wantHex string // Expected normalized hex (without 0x)
	}{
		{
			name:    "without 0x prefix",
			hexStr:  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			wantHex: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		},
		{
			name:    "with 0x prefix",
			hexStr:  "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			wantHex: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		},
		{
			name:    "uppercase hex",
			hexStr:  "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
			wantHex: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
		},
		{
			name:    "mixed case hex",
			hexStr:  "AaBbCcDdEeFf00112233445566778899AaBbCcDdEeFf00112233445566778899",
			wantHex: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			seed, err := SeedFromHex(tt.hexStr)
			if err != nil {
				t.Fatalf("SeedFromHex() failed: %v", err)
			}

			if seed.Hex != tt.wantHex {
				t.Errorf("Expected hex %s, got %s", tt.wantHex, seed.Hex)
			}

			if len(seed.Value) != 32 {
				t.Errorf("Expected 32-byte seed value, got %d bytes", len(seed.Value))
			}

			// Verify Value and Hex are consistent
			expectedHex := hex.EncodeToString(seed.Value)
			if seed.Hex != expectedHex {
				t.Errorf("Value and Hex inconsistent: hex=%s, value->hex=%s",
					seed.Hex, expectedHex)
			}
		})
	}
}

// TestSeedFromHexInvalid tests error handling for invalid hex strings
func TestSeedFromHexInvalid(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		hexStr string
	}{
		{
			name:   "invalid hex characters",
			hexStr: "xyz123",
		},
		{
			name:   "too short - 16 bytes",
			hexStr: "0123456789abcdef0123456789abcdef",
		},
		{
			name:   "too short - 1 byte",
			hexStr: "01",
		},
		{
			name:   "too long - 33 bytes",
			hexStr: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef00",
		},
		{
			name:   "empty string",
			hexStr: "",
		},
		{
			name:   "odd number of hex digits",
			hexStr: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde",
		},
		{
			name:   "special characters",
			hexStr: "0123456789abcdef0123456789abcdef!@#$%^&*()0123456789abcdef01234567",
		},
		{
			name:   "spaces in hex",
			hexStr: "0123 4567 89ab cdef 0123 4567 89ab cdef 0123 4567 89ab cdef 0123 4567 89ab cdef",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			seed, err := SeedFromHex(tt.hexStr)
			if err == nil {
				t.Errorf("SeedFromHex() should have failed for %q, got seed: %v", tt.hexStr, seed)
			}
		})
	}
}

// TestDerivePrivateKey tests deterministic private key derivation
func TestDerivePrivateKey(t *testing.T) {
	t.Parallel()

	seedHex := "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	seed, err := SeedFromHex(seedHex)
	if err != nil {
		t.Fatalf("SeedFromHex() failed: %v", err)
	}

	// Test that same seed + index produces same private key
	pk1 := seed.DerivePrivateKey(0)
	pk2 := seed.DerivePrivateKey(0)

	if len(pk1) != 32 {
		t.Errorf("Expected 32-byte private key, got %d bytes", len(pk1))
	}

	if !bytesEqual(pk1, pk2) {
		t.Error("Same seed and index should produce identical private keys")
	}

	// Test that different indexes produce different keys
	pk0 := seed.DerivePrivateKey(0)
	pk1Different := seed.DerivePrivateKey(1)
	pk2Different := seed.DerivePrivateKey(2)

	if bytesEqual(pk0, pk1Different) {
		t.Error("Different indexes should produce different private keys (0 vs 1)")
	}
	if bytesEqual(pk0, pk2Different) {
		t.Error("Different indexes should produce different private keys (0 vs 2)")
	}
	if bytesEqual(pk1Different, pk2Different) {
		t.Error("Different indexes should produce different private keys (1 vs 2)")
	}

	// Test multiple indexes
	indexes := []int{0, 1, 5, 9}
	keys := make(map[int][]byte)

	for _, idx := range indexes {
		pk := seed.DerivePrivateKey(idx)
		keys[idx] = pk

		// Verify each key is 32 bytes
		if len(pk) != 32 {
			t.Errorf("Private key for index %d is not 32 bytes: %d", idx, len(pk))
		}

		// Verify determinism - derive again and compare
		pkAgain := seed.DerivePrivateKey(idx)
		if !bytesEqual(pk, pkAgain) {
			t.Errorf("Private key for index %d is not deterministic", idx)
		}
	}

	// Verify all keys are unique
	for i := 0; i < len(indexes); i++ {
		for j := i + 1; j < len(indexes); j++ {
			if bytesEqual(keys[indexes[i]], keys[indexes[j]]) {
				t.Errorf("Keys for indexes %d and %d are identical",
					indexes[i], indexes[j])
			}
		}
	}

	// Test that different seeds produce different keys
	differentSeedHex := "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"
	differentSeed, _ := SeedFromHex(differentSeedHex)

	pkFromDifferentSeed := differentSeed.DerivePrivateKey(0)
	if bytesEqual(pk0, pkFromDifferentSeed) {
		t.Error("Different seeds should produce different private keys")
	}
}

// TestDeriveAddress tests address derivation from private keys
func TestDeriveAddress(t *testing.T) {
	t.Parallel()

	seedHex := "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd"
	seed, err := SeedFromHex(seedHex)
	if err != nil {
		t.Fatalf("SeedFromHex() failed: %v", err)
	}

	// Test that same private key produces same address
	pk := seed.DerivePrivateKey(0)
	addr1 := DeriveAddress(pk)
	addr2 := DeriveAddress(pk)

	if addr1 != addr2 {
		t.Error("Same private key should produce identical addresses")
	}

	// Test address format
	if len(addr1) != 42 {
		t.Errorf("Expected 42 character address (0x + 40 hex chars), got %d", len(addr1))
	}

	if addr1[:2] != "0x" {
		t.Errorf("Address should start with 0x, got %s", addr1[:2])
	}

	// Verify the rest is valid hex
	_, err = hex.DecodeString(addr1[2:])
	if err != nil {
		t.Errorf("Address contains invalid hex: %v", err)
	}

	// Test that different private keys produce different addresses
	pk0 := seed.DerivePrivateKey(0)
	pk1 := seed.DerivePrivateKey(1)
	pk2 := seed.DerivePrivateKey(2)

	addr0 := DeriveAddress(pk0)
	addr1Different := DeriveAddress(pk1)
	addr2Different := DeriveAddress(pk2)

	if addr0 == addr1Different {
		t.Error("Different private keys should produce different addresses (0 vs 1)")
	}
	if addr0 == addr2Different {
		t.Error("Different private keys should produce different addresses (0 vs 2)")
	}
	if addr1Different == addr2Different {
		t.Error("Different private keys should produce different addresses (1 vs 2)")
	}

	// Test with edge case private keys
	zeroPK := make([]byte, 32)
	zeroAddr := DeriveAddress(zeroPK)
	if len(zeroAddr) != 42 || zeroAddr[:2] != "0x" {
		t.Error("Zero private key should still produce valid address format")
	}

	maxPK := make([]byte, 32)
	for i := range maxPK {
		maxPK[i] = 0xff
	}
	maxAddr := DeriveAddress(maxPK)
	if len(maxAddr) != 42 || maxAddr[:2] != "0x" {
		t.Error("Max private key should still produce valid address format")
	}

	if zeroAddr == maxAddr {
		t.Error("Zero and max private keys should produce different addresses")
	}
}

// TestFormatPrivateKey tests private key hex formatting
func TestFormatPrivateKey(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		privateKey []byte
		wantPrefix string
		wantLength int
	}{
		{
			name:       "32 byte key",
			privateKey: make([]byte, 32),
			wantPrefix: "0x",
			wantLength: 66, // 0x + 64 hex chars
		},
		{
			name:       "key with values",
			privateKey: []byte{0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef},
			wantPrefix: "0x",
			wantLength: 66,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			formatted := FormatPrivateKey(tt.privateKey)

			// Check prefix
			if formatted[:2] != tt.wantPrefix {
				t.Errorf("Expected prefix %s, got %s", tt.wantPrefix, formatted[:2])
			}

			// Check length
			if len(formatted) != tt.wantLength {
				t.Errorf("Expected length %d, got %d", tt.wantLength, len(formatted))
			}

			// Verify it's valid hex (after 0x prefix)
			_, err := hex.DecodeString(formatted[2:])
			if err != nil {
				t.Errorf("Formatted key is not valid hex: %v", err)
			}

			// Verify round-trip
			decoded, _ := hex.DecodeString(formatted[2:])
			if !bytesEqual(decoded, tt.privateKey) {
				t.Error("Round-trip encoding/decoding failed")
			}
		})
	}

	// Test with actual derived key
	seedHex := "1111111111111111111111111111111111111111111111111111111111111111"
	seed, _ := SeedFromHex(seedHex)
	pk := seed.DerivePrivateKey(0)

	formatted := FormatPrivateKey(pk)
	if len(formatted) != 66 {
		t.Errorf("Formatted private key wrong length: %d", len(formatted))
	}
	if formatted[:2] != "0x" {
		t.Error("Formatted private key missing 0x prefix")
	}
}

// TestFullDerivationChain tests the complete seed -> key -> address chain
func TestFullDerivationChain(t *testing.T) {
	t.Parallel()

	seedHex := "9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba"

	// Create seed
	seed1, err := SeedFromHex(seedHex)
	if err != nil {
		t.Fatalf("SeedFromHex() failed: %v", err)
	}

	// Derive 10 private keys
	keys := make([][]byte, 10)
	for i := 0; i < 10; i++ {
		keys[i] = seed1.DerivePrivateKey(i)
	}

	// Derive 10 addresses
	addresses := make([]string, 10)
	for i := 0; i < 10; i++ {
		addresses[i] = DeriveAddress(keys[i])
	}

	// Verify all addresses are unique
	addrMap := make(map[string]bool)
	for i, addr := range addresses {
		if addrMap[addr] {
			t.Errorf("Duplicate address found at index %d: %s", i, addr)
		}
		addrMap[addr] = true

		// Verify format
		if len(addr) != 42 || addr[:2] != "0x" {
			t.Errorf("Address %d has invalid format: %s", i, addr)
		}
	}

	// Repeat with same seed and verify identical results
	seed2, err := SeedFromHex(seedHex)
	if err != nil {
		t.Fatalf("Second SeedFromHex() failed: %v", err)
	}

	for i := 0; i < 10; i++ {
		pk := seed2.DerivePrivateKey(i)
		if !bytesEqual(pk, keys[i]) {
			t.Errorf("Private key %d differs on second derivation", i)
		}

		addr := DeriveAddress(pk)
		if addr != addresses[i] {
			t.Errorf("Address %d differs on second derivation: %s vs %s",
				i, addr, addresses[i])
		}
	}

	// Test with different seed produces different results
	differentSeedHex := "0000000000000000000000000000000000000000000000000000000000000001"
	seed3, err := SeedFromHex(differentSeedHex)
	if err != nil {
		t.Fatalf("Third SeedFromHex() failed: %v", err)
	}

	for i := 0; i < 10; i++ {
		pk := seed3.DerivePrivateKey(i)
		if bytesEqual(pk, keys[i]) {
			t.Errorf("Different seed produced same private key at index %d", i)
		}

		addr := DeriveAddress(pk)
		if addr == addresses[i] {
			t.Errorf("Different seed produced same address at index %d: %s", i, addr)
		}
	}
}

// TestSeedFromHexRoundTrip tests that generating and parsing seeds works correctly
func TestSeedFromHexRoundTrip(t *testing.T) {
	t.Parallel()

	// Generate a seed
	seed1, err := GenerateSeed()
	if err != nil {
		t.Fatalf("GenerateSeed() failed: %v", err)
	}

	// Convert to hex and back
	hexStr := seed1.Hex
	seed2, err := SeedFromHex(hexStr)
	if err != nil {
		t.Fatalf("SeedFromHex() failed on round-trip: %v", err)
	}

	// Verify they're identical
	if !bytesEqual(seed1.Value, seed2.Value) {
		t.Error("Round-trip seed values don't match")
	}

	if seed1.Hex != seed2.Hex {
		t.Errorf("Round-trip seed hex doesn't match: %s vs %s", seed1.Hex, seed2.Hex)
	}

	// Verify derived keys are identical
	for i := 0; i < 5; i++ {
		pk1 := seed1.DerivePrivateKey(i)
		pk2 := seed2.DerivePrivateKey(i)

		if !bytesEqual(pk1, pk2) {
			t.Errorf("Round-trip private keys differ at index %d", i)
		}

		addr1 := DeriveAddress(pk1)
		addr2 := DeriveAddress(pk2)

		if addr1 != addr2 {
			t.Errorf("Round-trip addresses differ at index %d: %s vs %s", i, addr1, addr2)
		}
	}
}

// TestDerivePrivateKeyNegativeIndex tests behavior with negative indexes
func TestDerivePrivateKeyNegativeIndex(t *testing.T) {
	t.Parallel()

	seedHex := "1111111111111111111111111111111111111111111111111111111111111111"
	seed, err := SeedFromHex(seedHex)
	if err != nil {
		t.Fatalf("SeedFromHex() failed: %v", err)
	}

	// Test with negative index (implementation may vary)
	pkNegative := seed.DerivePrivateKey(-1)

	// Should still produce a valid 32-byte key
	if len(pkNegative) != 32 {
		t.Errorf("Negative index should still produce 32-byte key, got %d", len(pkNegative))
	}

	// Should be different from positive indexes
	pk0 := seed.DerivePrivateKey(0)
	pk1 := seed.DerivePrivateKey(1)

	if bytesEqual(pkNegative, pk0) {
		t.Error("Negative index produced same key as index 0")
	}
	if bytesEqual(pkNegative, pk1) {
		t.Error("Negative index produced same key as index 1")
	}

	// Should be deterministic
	pkNegativeAgain := seed.DerivePrivateKey(-1)
	if !bytesEqual(pkNegative, pkNegativeAgain) {
		t.Error("Negative index is not deterministic")
	}
}

// TestDerivePrivateKeyLargeIndex tests behavior with large indexes
func TestDerivePrivateKeyLargeIndex(t *testing.T) {
	t.Parallel()

	seedHex := "2222222222222222222222222222222222222222222222222222222222222222"
	seed, err := SeedFromHex(seedHex)
	if err != nil {
		t.Fatalf("SeedFromHex() failed: %v", err)
	}

	largeIndexes := []int{100, 1000, 10000, 1000000}

	keys := make(map[int][]byte)
	for _, idx := range largeIndexes {
		pk := seed.DerivePrivateKey(idx)

		// Verify 32-byte key
		if len(pk) != 32 {
			t.Errorf("Large index %d produced wrong size key: %d", idx, len(pk))
		}

		keys[idx] = pk

		// Verify determinism
		pkAgain := seed.DerivePrivateKey(idx)
		if !bytesEqual(pk, pkAgain) {
			t.Errorf("Large index %d is not deterministic", idx)
		}

		// Verify produces valid address
		addr := DeriveAddress(pk)
		if len(addr) != 42 || addr[:2] != "0x" {
			t.Errorf("Large index %d produced invalid address: %s", idx, addr)
		}
	}

	// Verify all large index keys are unique
	for i := 0; i < len(largeIndexes); i++ {
		for j := i + 1; j < len(largeIndexes); j++ {
			if bytesEqual(keys[largeIndexes[i]], keys[largeIndexes[j]]) {
				t.Errorf("Large indexes %d and %d produced identical keys",
					largeIndexes[i], largeIndexes[j])
			}
		}
	}
}

// Helper function to compare byte slices
func bytesEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
