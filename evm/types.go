package evm

import (
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
)

// Address represents a 20-byte Ethereum address
type Address [20]byte

// U256 represents a 256-bit unsigned integer (stored as big-endian bytes)
type U256 [32]byte

// ZeroAddress is the zero address (0x0000...0000)
var ZeroAddress = Address{}

// ZeroU256 is the zero value for U256
var ZeroU256 = U256{}

// AddressFromHex creates an Address from a hex string
func AddressFromHex(s string) (Address, error) {
	s = strings.TrimPrefix(s, "0x")
	if len(s) != 40 {
		return Address{}, fmt.Errorf("invalid address length: expected 40 hex chars, got %d", len(s))
	}

	bytes, err := hex.DecodeString(s)
	if err != nil {
		return Address{}, fmt.Errorf("invalid hex string: %w", err)
	}

	var addr Address
	copy(addr[:], bytes)
	return addr, nil
}

// AddressFromBytes creates an Address from bytes
func AddressFromBytes(b []byte) (Address, error) {
	if len(b) != 20 {
		return Address{}, fmt.Errorf("invalid address length: expected 20 bytes, got %d", len(b))
	}

	var addr Address
	copy(addr[:], b)
	return addr, nil
}

// Hex returns the hex-encoded address with 0x prefix
func (a Address) Hex() string {
	return "0x" + hex.EncodeToString(a[:])
}

// String returns the hex-encoded address with 0x prefix
func (a Address) String() string {
	return a.Hex()
}

// Bytes returns the address as a byte slice
func (a Address) Bytes() []byte {
	return a[:]
}

// IsZero checks if the address is the zero address
func (a Address) IsZero() bool {
	return a == ZeroAddress
}

// U256FromBig creates a U256 from a big.Int (big-endian)
func U256FromBig(b *big.Int) U256 {
	var u U256
	if b == nil {
		return u
	}

	// Get bytes in big-endian
	bytes := b.Bytes()

	// Copy to the end of the array (right-aligned for big-endian)
	if len(bytes) <= 32 {
		copy(u[32-len(bytes):], bytes)
	} else {
		// Truncate if too large
		copy(u[:], bytes[len(bytes)-32:])
	}

	return u
}

// U256FromUint64 creates a U256 from a uint64
func U256FromUint64(n uint64) U256 {
	return U256FromBig(new(big.Int).SetUint64(n))
}

// U256FromHex creates a U256 from a hex string (big-endian)
func U256FromHex(s string) (U256, error) {
	s = strings.TrimPrefix(s, "0x")

	// Pad to 64 hex chars (32 bytes)
	if len(s) < 64 {
		s = strings.Repeat("0", 64-len(s)) + s
	} else if len(s) > 64 {
		return U256{}, fmt.Errorf("hex string too long: expected max 64 hex chars, got %d", len(s))
	}

	bytes, err := hex.DecodeString(s)
	if err != nil {
		return U256{}, fmt.Errorf("invalid hex string: %w", err)
	}

	var u U256
	copy(u[:], bytes)
	return u, nil
}

// U256FromBytes creates a U256 from bytes (big-endian)
func U256FromBytes(b []byte) (U256, error) {
	if len(b) > 32 {
		return U256{}, fmt.Errorf("bytes too long: expected max 32 bytes, got %d", len(b))
	}

	var u U256
	// Copy to the end (right-aligned for big-endian)
	copy(u[32-len(b):], b)
	return u, nil
}

// Big returns the U256 as a *big.Int
func (u U256) Big() *big.Int {
	return new(big.Int).SetBytes(u[:])
}

// Uint64 returns the U256 as a uint64 (truncates if too large)
func (u U256) Uint64() uint64 {
	return u.Big().Uint64()
}

// Hex returns the hex-encoded U256 with 0x prefix
func (u U256) Hex() string {
	return "0x" + hex.EncodeToString(u[:])
}

// String returns the decimal representation
func (u U256) String() string {
	return u.Big().String()
}

// Bytes returns the U256 as a byte slice (big-endian)
func (u U256) Bytes() []byte {
	return u[:]
}

// IsZero checks if the U256 is zero
func (u U256) IsZero() bool {
	return u == ZeroU256
}

// Hardfork represents an Ethereum hardfork
type Hardfork string

const (
	HardforkFrontier      Hardfork = "FRONTIER"
	HardforkHomestead     Hardfork = "HOMESTEAD"
	HardforkTangerine     Hardfork = "TANGERINE"
	HardforkSpurious      Hardfork = "SPURIOUS"
	HardforkByzantium     Hardfork = "BYZANTIUM"
	HardforkConstantinople Hardfork = "CONSTANTINOPLE"
	HardforkIstanbul      Hardfork = "ISTANBUL"
	HardforkBerlin        Hardfork = "BERLIN"
	HardforkLondon        Hardfork = "LONDON"
	HardforkMerge         Hardfork = "MERGE"
	HardforkShanghai      Hardfork = "SHANGHAI"
	HardforkCancun        Hardfork = "CANCUN"
	HardforkPrague        Hardfork = "PRAGUE"
	HardforkOsaka         Hardfork = "OSAKA"
)

// String returns the hardfork name
func (h Hardfork) String() string {
	return string(h)
}

// Helper functions for common conversions

// MustAddressFromHex creates an Address from hex or panics
func MustAddressFromHex(s string) Address {
	addr, err := AddressFromHex(s)
	if err != nil {
		panic(err)
	}
	return addr
}

// MustU256FromHex creates a U256 from hex or panics
func MustU256FromHex(s string) U256 {
	u, err := U256FromHex(s)
	if err != nil {
		panic(err)
	}
	return u
}

// MustU256FromBig creates a U256 from big.Int or panics
func MustU256FromBig(b *big.Int) U256 {
	if b == nil {
		panic("nil big.Int")
	}
	return U256FromBig(b)
}

// ParseBytecode parses bytecode from a hex string
func ParseBytecode(s string) ([]byte, error) {
	s = strings.TrimPrefix(s, "0x")
	return hex.DecodeString(s)
}

// MustParseBytecode parses bytecode or panics
func MustParseBytecode(s string) []byte {
	b, err := ParseBytecode(s)
	if err != nil {
		panic(err)
	}
	return b
}
