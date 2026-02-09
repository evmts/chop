# voltaire-effect: Comprehensive Research Document

## Overview

**voltaire-effect** is an Effect.ts integration layer for the Voltaire Ethereum primitives library. It bridges Effect's functional programming patterns (typed errors, dependency injection, composable workflows) with Voltaire's high-performance Ethereum utilities.

- **Documentation**: https://voltaire-effect.tevm.sh
- **Core library**: https://github.com/evmts/voltaire (package: `@tevm/voltaire`)
- **NPM**: `@tevm/voltaire` (core), `voltaire-effect` (Effect integration)
- **Requirements**: Effect 3.x, Voltaire 0.x, TypeScript 5.4+
- **License**: MIT
- **Status**: Alpha (APIs may change, not yet recommended for production)

The relationship between Voltaire and voltaire-effect:
- **Voltaire** (`@tevm/voltaire`) is the core library providing Ethereum primitives, cryptography, encoding, and EVM utilities in TypeScript and Zig.
- **voltaire-effect** is a complementary package that wraps Voltaire's primitives in Effect.ts patterns: typed error channels, service-based dependency injection, Schema validation, and composable Effect pipelines.

---

## Architecture: Three Layers

voltaire-effect organizes into three conceptual layers:

### 1. Schema Layer
Effect Schema validation that produces Voltaire branded types. Validates inputs at boundaries and returns strongly-typed branded values.

### 2. Effect Layer
Composable operations with typed error channels. Every operation that can fail returns `Effect.Effect<Success, Error, Requirements>` where errors are union types visible in the type signature.

### 3. Services Layer
Dependency injection for providers, signers, and crypto operations via Effect's `Context.Tag` pattern. Production and test implementations are swappable via `Layer`.

---

## Relationship to the Zig Voltaire Library

Voltaire is a multi-language library with colocated implementations:

```
src/primitives/Address/
  address.zig      # Zig implementation
  Address.js       # TypeScript implementation
  AddressType.ts   # TypeScript type definition
  effect.ts        # Effect.ts integration
  effect-errors.ts # Effect error types
  effect-services.ts # Effect service interfaces
  effect-layers.ts # Effect layer implementations
```

The Zig core provides:
- Native FFI bindings via `.dylib`/`.so` for server-side performance
- WASM compilation (ReleaseSmall for bundle size, ReleaseFast for performance)
- All 19 EVM precompiled contracts (0x01-0x13)
- Assembly-optimized keccak256 (via Rust wrapper) that is 9-13x faster than JavaScript

The TypeScript layer wraps these with:
- Branded types for compile-time safety
- Tree-shakeable namespace exports
- Audited crypto defaults (`@noble/curves`, `@noble/hashes`)
- Optional WASM acceleration

voltaire-effect adds the Effect.ts integration on top of the TypeScript layer.

Build commands reflect this relationship:
```bash
zig build                    # Full build (Zig + TS typecheck + C libs)
zig build build-ts-wasm      # WASM - ReleaseSmall
zig build build-ts-native    # Native FFI (.dylib/.so)
bun run build:dist           # TS bundling (tsup)
```

---

## Primitives System

### Core Branded Types

All primitives use a shared brand symbol for zero-runtime-overhead nominal typing:

```typescript
// brand.ts - Shared unique symbol
export declare const brand: unique symbol;

// AddressType.ts
import type { brand } from '../../brand.js';
export type AddressType = Uint8Array & {
  readonly [brand]: 'Address';
};

// HashType.ts
export type HashType = Uint8Array & {
  readonly [brand]: 'Hash';
};
```

This means `AddressType` and `HashType` are both `Uint8Array` at runtime but are type-incompatible at compile time. Passing an Address where a Hash is expected is a compile error, unlike viem where both `Address` and `Hex` are `0x${string}`.

### Complete Primitive Catalog

**Core Types** (all backed by `Uint8Array` with brand tags):

| Primitive | Size | Brand | Key Methods |
|-----------|------|-------|-------------|
| Address | 20 bytes | `"Address"` | from, toHex, toChecksummed, calculateCreate2Address, equals |
| Hash | 32 bytes | `"Hash"` | from, toHex, equals |
| Hex | Variable | `"Hex"` | fromBytes, toBytes, concat, slice |
| Uint | 32 bytes | `"Uint"` | from, plus, minus, times, dividedBy |
| Signature | 64 bytes | `"Signature"` | from, toCompact, toDER, verify, normalize, getR, getS, getV |
| PrivateKey | 32 bytes | `"PrivateKey"` | from, toPublicKey, toAddress, sign |
| PublicKey | 64 bytes | `"PublicKey"` | from, fromPrivateKey, toAddress, verify |
| Bytecode | Variable | `"Bytecode"` | from, toHex, getDeployedBytecode |
| Blob | 131072 bytes | `"Blob"` | from, toHex, toVersionedHash |
| BloomFilter | 256 bytes | `"BloomFilter"` | from, add, contains |

**Sized Hex Types**: `Hex.Bytes<4>` (selectors), `Hex.Bytes<20>` (addresses), `Hex.Bytes<32>` (hashes)

**Denomination Types** (Uint subtypes): `Ether`, `Gwei`, `Wei`

**Transaction Types**: Legacy, EIP-2930, EIP-1559, EIP-4844, EIP-7702

**ABI Types**: Function, Event, Error, Constructor

**Encoding**: RLP, SSZ, ABI encoding/decoding, Base64

### Namespace Pattern

Voltaire uses a data-first namespace pattern with tree-shakeable imports:

```typescript
// Internal method (toHex.js)
export function toHex(data: AddressType): string { /* ... */ }

// Namespace re-export (index.ts)
export { toHex as _toHex } from './toHex.js';   // Internal API
export function toHex(value: AddrInput): string { // Public wrapper
  return _toHex(from(value));
}

// Usage
import * as Address from '@tevm/voltaire/Address';
Address.toHex('0x123...')       // Public (auto-converts input)
Address._toHex(addr)            // Advanced (no conversion, direct)

// Or tree-shake individual functions
import { toHex } from '@tevm/voltaire/Address';
```

### Package Exports

Each primitive and crypto module is individually importable:

```typescript
import * as Address from '@tevm/voltaire/Address'
import * as Hash from '@tevm/voltaire/Hash'
import * as Hex from '@tevm/voltaire/Hex'
import * as Uint from '@tevm/voltaire/Uint'
import * as Abi from '@tevm/voltaire/Abi'
import * as Rlp from '@tevm/voltaire/Rlp'
import * as Transaction from '@tevm/voltaire/Transaction'
import * as Signature from '@tevm/voltaire/Signature'
import * as Keccak256 from '@tevm/voltaire/Keccak256'
import * as Secp256k1 from '@tevm/voltaire/Secp256k1'
import * as EIP712 from '@tevm/voltaire/EIP712'
import * as HDWallet from '@tevm/voltaire/HDWallet'
import * as Bip39 from '@tevm/voltaire/Bip39'
// ... 30+ individual exports
```

---

## How voltaire-effect Uses Effect

### Effect Types: The Three-Parameter Pattern

Every effectful operation returns `Effect.Effect<Success, Error, Requirements>`:

```typescript
// Pure operation (no requirements, no errors)
AddressSchema.zero(): AddressSchema

// Fallible operation (typed errors, no requirements)
AddressSchema.fromHex(value: string): Effect.Effect<AddressSchema, FromHexErrors>

// Operation requiring services
AddressSchema.fromPrivateKey(value: Uint8Array): Effect.Effect<
  AddressSchema,
  FromPrivateKeyErrors,
  Secp256k1Service | Keccak256Service
>
```

The type signature tells you everything: what you get, what can go wrong, and what dependencies are needed.

### Effect Branded Types (Effect.Brand)

voltaire-effect provides a parallel brand system using Effect's `Brand` module:

```typescript
import * as Brand from 'effect/Brand';

// Refined brand with runtime validation
export type AddressBrand = Uint8Array & Brand.Brand<'Address'>;
export const AddressBrand = Brand.refined<AddressBrand>(
  (bytes): bytes is Uint8Array & Brand.Brand<'Address'> =>
    bytes instanceof Uint8Array && bytes.length === 20,
  (bytes) => Brand.error(
    `Expected 20-byte Uint8Array, got ${bytes instanceof Uint8Array ? `${bytes.length} bytes` : typeof bytes}`
  ),
);

// Nominal brand (validation elsewhere)
export type ChecksumAddressBrand = string & Brand.Brand<'ChecksumAddress'>;
export const ChecksumAddressBrand = Brand.nominal<ChecksumAddressBrand>();
```

Usage:
```typescript
const validBytes = new Uint8Array(20);
const addr = AddressBrand(validBytes);   // Validated at runtime
const invalid = new Uint8Array(19);
AddressBrand(invalid);                    // Throws BrandError
```

### Effect Schema Classes

voltaire-effect uses `Schema.Class` for structured validation:

```typescript
export class AddressSchema extends Schema.Class<AddressSchema>('Address')({
  value: Schema.Uint8ArrayFromSelf.pipe(
    Schema.filter(
      (bytes): bytes is Uint8Array => bytes.length === 20,
      { message: () => 'Invalid address: must be 20 bytes' },
    ),
  ),
}) {
  get address(): BrandedAddress { return this.value as BrandedAddress; }
  get branded(): AddressBrand { return this.value as AddressBrand; }

  static from(value): Effect.Effect<AddressSchema, FromErrors> { /* ... */ }
  static fromHex(value): Effect.Effect<AddressSchema, FromHexErrors> { /* ... */ }
  static fromPrivateKey(value): Effect.Effect<AddressSchema, FromPrivateKeyErrors, Secp256k1Service | Keccak256Service> { /* ... */ }

  toHex(): string { /* safe, synchronous */ }
  toChecksummed(): Effect.Effect<Checksummed, ToChecksummedErrors, Keccak256Service> { /* requires service */ }
  calculateCreateAddress(nonce): Effect.Effect<AddressSchema, CalculateCreateAddressErrors, Keccak256Service | RlpEncoderService> { /* ... */ }
}
```

### Services (Dependency Injection)

Services use Effect's `Context.Tag` for compile-time-checked dependency injection:

```typescript
// Service interface definition
export interface Keccak256Service {
  readonly hash: (data: Uint8Array) => Effect.Effect<Uint8Array, CryptoOperationError>;
}

export const Keccak256Service = Context.GenericTag<Keccak256Service>(
  '@voltaire/Address/Keccak256',
);

export interface Secp256k1Service {
  readonly derivePublicKey: (privateKey: Uint8Array) => Effect.Effect<Uint8Array, CryptoOperationError>;
  readonly getPublicKey: (privateKey: Uint8Array) => Effect.Effect<{ x: bigint; y: bigint }, CryptoOperationError>;
}

export const Secp256k1Service = Context.GenericTag<Secp256k1Service>(
  '@voltaire/Address/Secp256k1',
);

export interface RlpEncoderService {
  readonly encode: (data: unknown) => Effect.Effect<Uint8Array, RlpEncodingError>;
}

export const RlpEncoderService = Context.GenericTag<RlpEncoderService>(
  '@voltaire/Address/RlpEncoder',
);
```

### Layers (Service Implementations)

**Production layers** wrap native Voltaire implementations:

```typescript
export const Keccak256ServiceLive = Layer.succeed(
  Keccak256Service,
  Keccak256Service.of({
    hash: (data) =>
      Effect.try({
        try: () => keccak256Native(data),
        catch: (error) =>
          new CryptoOperationError({
            operation: 'keccak256',
            message: error instanceof Error ? error.message : String(error),
            cause: error,
          }),
      }),
  }),
);

export const Secp256k1ServiceLive = Layer.succeed(
  Secp256k1Service,
  Secp256k1Service.of({
    derivePublicKey: (privateKey) =>
      Effect.try({
        try: () => derivePublicKeyNative(privateKey as PrivateKeyType),
        catch: (error) => new CryptoOperationError({ /* ... */ }),
      }),
    getPublicKey: (privateKey) =>
      Effect.try({
        try: () => { /* coordinate extraction logic */ },
        catch: (error) => new CryptoOperationError({ /* ... */ }),
      }),
  }),
);

// Combined layer providing all services
export const AddressServicesLive = Layer.mergeAll(
  Keccak256ServiceLive,
  Secp256k1ServiceLive,
  RlpEncoderServiceLive,
);
```

**Test layers** with predictable mock outputs:

```typescript
export const AddressServicesTest = Layer.mergeAll(
  Layer.succeed(
    Keccak256Service,
    Keccak256Service.of({
      hash: (data) => Effect.succeed(new Uint8Array(32).fill(0xaa)),
    }),
  ),
  Layer.succeed(
    Secp256k1Service,
    Secp256k1Service.of({
      derivePublicKey: (pk) => Effect.succeed(new Uint8Array(64).fill(0xbb)),
      getPublicKey: (pk) => Effect.succeed({ x: 0xccccccccn, y: 0xdddddddddn }),
    }),
  ),
  Layer.succeed(
    RlpEncoderService,
    RlpEncoderService.of({
      encode: (data) => Effect.succeed(new Uint8Array([0xee, 0xee])),
    }),
  ),
);
```

### Documented Service Architecture (from llms.txt)

The voltaire-effect documentation describes these additional services beyond the Address-level ones found in the source:

| Service | Purpose |
|---------|---------|
| **ProviderService** | Minimal request-only Context.Tag for all provider free functions |
| **SignerService** | EIP-191, EIP-712, EIP-1559, EIP-4844, EIP-7702 with auto transaction type detection |
| **Transport** | HTTP, WebSocket, Browser JSON-RPC transports |
| **Account** | LocalAccount and JsonRpcAccount abstraction; MnemonicAccount for HD wallets |
| **Contract** | Type-safe read/write/simulate/getEvents operations |
| **BlockStream/TransactionStream** | Real-time streaming with backpressure |
| **Multicall** | Batched contract reads |
| **Cache** | Request caching |
| **RateLimit** | Request rate limiting |
| **FeeEstimator** | Gas fee estimation |
| **NonceManager** | Nonce tracking and management |

---

## Error Handling Patterns

### Tagged Errors with Data.TaggedError

Every error type uses Effect's `Data.TaggedError` for discriminated unions:

```typescript
import * as Data from 'effect/Data';

export class InvalidHexFormatError extends Data.TaggedError('InvalidHexFormat')<{
  readonly value: unknown;
  readonly expected?: string;
}> {}

export class InvalidAddressLengthError extends Data.TaggedError('InvalidAddressLength')<{
  readonly value: unknown;
  readonly actualLength: number;
  readonly expectedLength: number;
}> {}

export class CryptoOperationError extends Data.TaggedError('CryptoOperationError')<{
  readonly operation: 'keccak256' | 'secp256k1' | 'rlp_encode';
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class InvalidChecksumError extends Data.TaggedError('InvalidChecksum')<{
  readonly address: string;
  readonly expected: string;
  readonly actual: string;
}> {}
```

### Error Union Types

Each method documents its exact error possibilities:

```typescript
export type FromErrors =
  | InvalidValueError
  | InvalidHexFormatError
  | InvalidHexStringError
  | InvalidAddressLengthError;

export type FromPrivateKeyErrors =
  | InvalidAddressLengthError
  | InvalidPrivateKeyError
  | CryptoOperationError;

export type CalculateCreateAddressErrors =
  | InvalidValueError
  | CryptoOperationError
  | RlpEncodingError;
```

### Error Handling Patterns

**Pattern 1: Effect.either for checking results**
```typescript
const effect = AddressSchema.fromHex('invalid');
const result = await Effect.runPromise(Effect.either(effect));
if (Either.isLeft(result)) {
  // result.left is typed as FromHexErrors
  console.log(result.left._tag); // 'InvalidHexFormat' | 'InvalidHexString' | 'InvalidAddressLength'
}
```

**Pattern 2: Effect.catchTag for specific error recovery**
```typescript
const program = AddressSchema.fromHex(input).pipe(
  Effect.catchTag('InvalidHexFormat', (error) =>
    AddressSchema.fromNumber(0n)  // Fallback to zero address
  ),
);
```

**Pattern 3: Effect.retry with exponential backoff**
```typescript
program.pipe(
  Effect.retry(Schedule.exponential('100 millis').pipe(Schedule.recurs(5))),
  Effect.timeout(Duration.seconds(10)),
  Effect.orElse(() => fallbackProgram),
);
```

**Pattern 4: Mapping errors between domains**
```typescript
const publicKey = yield* secp.derivePublicKey(value).pipe(
  Effect.mapError((e) => {
    if (e._tag === 'CryptoOperationError') {
      return new InvalidPrivateKeyError({
        message: e.message,
        cause: e.cause,
      });
    }
    return e;
  }),
);
```

### Base Voltaire Error Hierarchy (non-Effect)

The base library also has a structured error hierarchy:

```typescript
// Abstract base
AbstractError

// Validation
ValidationError -> InvalidFormatError, InvalidLengthError, InvalidRangeError, InvalidChecksumError

// Serialization
SerializationError -> EncodingError, DecodingError

// Crypto
CryptoError -> InvalidSignatureError, InvalidPublicKeyError, InvalidPrivateKeyError

// Transaction
TransactionError -> InvalidTransactionTypeError, InvalidSignerError
```

---

## Encoding/Decoding

### ABI Encoding

```typescript
import * as Abi from '@tevm/voltaire/Abi';

// Encode function call
const encoded = Abi.encode(abi, 'transfer', [recipientAddress, amount]);

// Decode function result
const decoded = Abi.decode(abi, 'balanceOf', returnData);

// Parse event logs
const logs = Abi.parseLogs(abi, rawLogs);

// Sub-namespaces
Abi.Function.encode(/* ... */);
Abi.Event.decode(/* ... */);
Abi.Error.decode(/* ... */);
Abi.Constructor.encode(/* ... */);

// Get selectors
const selector = Abi.getSelector(abi, 'transfer');
const functionBySelector = Abi.getFunctionBySelector(abi, '0xa9059cbb');
```

### RLP Encoding

```typescript
import * as Rlp from '@tevm/voltaire/Rlp';

// Encode bytes
const encoded = Rlp.encode(new Uint8Array([1, 2, 3]));
// => Uint8Array([0x83, 1, 2, 3])

// Encode list
const list = [new Uint8Array([1, 2]), new Uint8Array([3, 4])];
const encodedList = Rlp.encode(list);

// Encode nested structures
const nested = [new Uint8Array([1]), [new Uint8Array([2]), new Uint8Array([3])]];
const encodedNested = Rlp.encode(nested);

// Decode
const decoded = Rlp.decode(encoded);
```

Internally uses `ox/Rlp` for the actual encoding.

### Transaction Serialization

```typescript
import * as Transaction from '@tevm/voltaire/Transaction';
import * as Address from '@tevm/voltaire/Address';

const to = Address.from('0x1234...');

const tx: Transaction.Legacy = {
  type: Transaction.Type.Legacy,
  nonce: 0n,
  gasPrice: 20000000000n,
  gasLimit: 21000n,
  to,
  value: 1000000000000000000n,
  data: new Uint8Array(),
  v: 27n,
  r: new Uint8Array(32),
  s: new Uint8Array(32),
};

const serialized = Transaction.serialize(tx);
const hash = Transaction.hash(tx);
const sender = Transaction.getSender(tx);
const deserialized = Transaction.deserialize(serialized);
```

Transaction types supported: Legacy, EIP-2930 (access lists), EIP-1559 (fee market), EIP-4844 (blobs), EIP-7702 (EOA delegation).

### Hex Conversion

```typescript
import * as Hex from '@tevm/voltaire/Hex';

const hexString = '0x48656c6c6f20576f726c64';
const bytes = Hex.toBytes(hexString);
const backToHex = Hex.fromBytes(bytes);
```

---

## Cryptographic Functions

### Keccak-256

```typescript
import * as Keccak256 from '@tevm/voltaire/Keccak256';

// Hash bytes
const hash = Keccak256.hash(data);

// Hash hex string
const hashFromHex = Keccak256.hashHex('0x1234567890abcdef');

// Function selector (first 4 bytes of keccak)
const selector = Keccak256.selector('transfer(address,uint256)');

// Event topic (full 32-byte hash)
const topic = Keccak256.topic('Transfer(address,address,uint256)');
```

Default implementation uses `@noble/hashes/sha3` (audited). Optional WASM/native acceleration available:
- `@tevm/voltaire/Keccak256/native` - Native FFI via Zig (9-13x faster)
- `@tevm/voltaire/Keccak256/wasm` - WASM compiled from Zig

### Secp256k1

```typescript
import * as Secp256k1 from '@tevm/voltaire/Secp256k1';

// Sign a hash
const signature = Secp256k1.sign(hash, privateKey);

// Verify a signature
const isValid = Secp256k1.verify(signature, hash, publicKey);

// Recover public key from signature
const recoveredPubKey = Secp256k1.recover(signature, hash);

// Generate a new private key
const newPrivateKey = Secp256k1.generatePrivateKey();

// Derive public key
const publicKey = Secp256k1.derivePublicKey(privateKey);
```

### EIP-712 Typed Data Signing

```typescript
import * as EIP712 from '@tevm/voltaire/EIP712';

const domain = { name: 'My DApp', version: '1', chainId: 1, verifyingContract: '0x...' };
const types = { Person: [{ name: 'name', type: 'string' }, { name: 'age', type: 'uint256' }] };
const message = { name: 'Alice', age: 30n };

const hash = EIP712.hash(domain, types, message);
```

### HD Wallet / BIP-39

```typescript
import * as Bip39 from '@tevm/voltaire/Bip39';
import * as HDWallet from '@tevm/voltaire/HDWallet';

// Generate mnemonic
const mnemonic = Bip39.generateMnemonic(128); // 12 words

// Derive seed
const seed = Bip39.mnemonicToSeed(mnemonic);

// Create master key
const masterKey = HDWallet.fromSeed(seed);

// Derive Ethereum account (m/44'/60'/0'/0/0)
const account = HDWallet.deriveEthereum(masterKey, 0, 0);
```

### Other Cryptographic Functions

| Module | Functions |
|--------|-----------|
| **SHA256** | `hash(data)` |
| **RIPEMD160** | `hash(data)` |
| **Blake2** | `hash(data, size?)` |
| **Ed25519** | `sign(message, secretKey)`, `verify(sig, msg, pubKey)` |
| **P256** | `sign(hash, privateKey)`, `verify(sig, hash, pubKey)`, `ecdh(privKey, pubKey)` |
| **X25519** | `scalarmult(secretKey, publicKey)` for ECDH key exchange |
| **AesGcm** | `encrypt(data, key, nonce)`, `decrypt(ciphertext, key, nonce)` |
| **BN254** | `add(p1, p2)`, `mul(p, scalar)`, `pairing(pairs)` for zkSNARKs |
| **KZG** | `blobToCommitment(blob)`, `computeProof(blob, commitment)`, `verify(blob, commitment, proof)` |

### Crypto Implementation Strategy

Voltaire defaults to audited implementations:
- `@noble/curves` for secp256k1, ed25519, p256
- `@noble/hashes` for keccak256, sha256, blake2, ripemd160
- `blst` (C library) for BLS12-381
- `c-kzg-4844` for KZG commitments
- `arkworks` (Rust) for BN254

Unaudited Zig-native implementations are available via build flags for development/testing.

---

## Effect Integration Patterns in Detail

### Pattern: Effect.gen for Composable Workflows

```typescript
import * as Effect from 'effect/Effect';

const program = Effect.gen(function* () {
  // Create address from hex
  const addr = yield* AddressSchema.fromHex('0x742d35Cc6634C0532925a3b844Bc9e7595f251e3');

  // Compute checksummed form (requires Keccak256Service)
  const checksummed = yield* addr.toChecksummed();

  // Calculate CREATE address (requires Keccak256Service + RlpEncoderService)
  const created = yield* addr.calculateCreateAddress(0n);

  // Calculate CREATE2 address (requires Keccak256Service)
  const created2 = yield* addr.calculateCreate2Address(
    new Uint8Array(32), // salt
    new Uint8Array(0),  // init code
  );

  return { checksummed, created: created.toHex(), created2: created2.toHex() };
}).pipe(Effect.provide(AddressServicesLive));

const result = await Effect.runPromise(program);
```

### Pattern: Service Swapping for Tests

```typescript
// Same business logic, different service layer
const productionProgram = program.pipe(Effect.provide(AddressServicesLive));
const testProgram = program.pipe(Effect.provide(AddressServicesTest));

// Test with predictable outputs
const testResult = await Effect.runPromise(testProgram);
```

### Pattern: Synchronous Execution for Simple Operations

```typescript
// Non-crypto operations can run synchronously
const addr = Effect.runSync(AddressSchema.fromNumber(12345n));
console.log(addr.toU256()); // 12345n
```

### Pattern: Schema Validation

```typescript
import * as Schema from 'effect/Schema';

const validBytes = new Uint8Array(20);
const addr = new AddressSchema({ value: validBytes }); // Schema validates length

// Invalid throws at construction time
try {
  new AddressSchema({ value: new Uint8Array(19) }); // Throws
} catch (e) {
  // Schema validation failed
}
```

### Pattern: Brand Interop Between Voltaire and Effect

```typescript
// Voltaire branded type
const voltaireAddr: AddressType = Address.from('0x...');

// Wrap in Effect Schema
const effectAddr = new AddressSchema({ value: voltaireAddr });

// Access both brands
effectAddr.address   // -> AddressType (Voltaire brand)
effectAddr.branded   // -> AddressBrand (Effect brand)

// Zero-cost conversion from Effect brand
const fromBrand = AddressSchema.fromBranded(AddressBrand(new Uint8Array(20)));
```

### Documented Higher-Level Patterns (from llms.txt)

The documentation describes patterns for the full service architecture:

**Contract Registry Service:**
```typescript
const Contracts = makeContractRegistry({
  USDC: { abi: erc20Abi, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
});
```

**Typed RPC with Provider Service:**
```typescript
const balance = yield* ProviderService.pipe(
  Effect.flatMap(provider => provider.request({
    method: 'eth_getBalance',
    params: ['0x...', 'latest'],
  })),
);
```

**Retry and Timeout:**
```typescript
program.pipe(
  Effect.retry(Schedule.exponential('100 millis').pipe(Schedule.recurs(5))),
  Effect.timeout(Duration.seconds(10)),
  Effect.orElse(() => fallbackProgram),
);
```

**Schema Validation for Primitives:**
```typescript
import * as S from 'effect/Schema';
import * as Address from 'voltaire-effect/primitives/Address';

const addr = S.decodeSync(Address.Hex)('0x742d35Cc...');  // Returns branded AddressType
Address.toHex(addr);   // '0x742d35cc...'
Address.isZero(addr);  // false
```

---

## Package Structure

### Repository Layout

Voltaire is a monorepo at `github.com/evmts/voltaire`:

```
voltaire/
  src/
    brand.ts              # Shared brand symbol
    index.ts              # Main entry point
    primitives/           # 100+ Ethereum data types
      Address/            # Colocated TS + Zig + Effect
        address.zig       # Zig implementation
        Address.js        # TS implementation
        AddressType.ts    # Type definition
        effect.ts         # Effect Schema & class
        effect-errors.ts  # Effect error types
        effect-services.ts # Effect service interfaces
        effect-layers.ts  # Effect layer implementations
        *.test.ts         # Tests
      Hash/
      Hex/
      Uint/
      Abi/
      Rlp/
      Transaction/
      Signature/
      ... (30+ modules)
    crypto/               # Cryptographic operations
      Keccak256/
      Secp256k1/
      EIP712/
      BN254/
      KZG/
      Blake2/
      Ed25519/
      P256/
      X25519/
      AesGcm/
      Bip39/
      HDWallet/
      ... (15+ modules)
    evm/                  # EVM execution primitives
    precompiles/          # All 19 EVM precompiles
    standards/            # ERC-20, ERC-721, ERC-1155, ERC-165
    provider/             # EIP-1193 providers (HTTP, WS, InMemory)
    jsonrpc/              # Type-safe JSON-RPC (eth, debug, engine, wallet, anvil, hardhat, web3, net, txpool)
    wallet/               # Hardware wallet integration (Ledger, Trezor)
    wasm/                 # WASM loader infrastructure
    wasm-loader/          # WASM instantiation
    exex/                 # Execution Extensions (chain indexer)
  lib/                    # C libraries (blst, c-kzg, libwally-core)
  docs/                   # Mintlify documentation site
  examples/               # Usage examples (TS + Zig)
  scripts/                # Build, benchmark, comparison scripts
  build.zig               # Zig build system (builds everything)
  package.json            # NPM package: @tevm/voltaire
  Cargo.toml              # Rust crypto wrappers
```

### NPM Package Structure

Published as `@tevm/voltaire` with these exports:

```json
{
  ".": "dist/index.js",
  "./Address": "dist/primitives/Address/index.js",
  "./Hash": "dist/primitives/Hash/index.js",
  "./Hex": "dist/primitives/Hex/index.js",
  "./Abi": "dist/primitives/Abi/index.js",
  "./Rlp": "dist/primitives/Rlp/index.js",
  "./Transaction": "dist/primitives/Transaction/index.js",
  "./Keccak256": "dist/crypto/Keccak256/index.js",
  "./Keccak256/native": "dist/crypto/Keccak256/Keccak256.native.js",
  "./Secp256k1": "dist/crypto/Secp256k1/index.js",
  "./jsonrpc": "dist/jsonrpc/index.js"
  // ... 30+ more exports
}
```

Platform-specific native bindings:
- `@tevm/voltaire-darwin-arm64` (macOS ARM)
- `@tevm/voltaire-darwin-x64` (macOS Intel)
- `@tevm/voltaire-linux-arm64`
- `@tevm/voltaire-linux-x64`
- `@tevm/voltaire-win32-x64`

### Dependencies

**Runtime:**
- `@adraffy/ens-normalize` - ENS normalization
- `@scure/bip32`, `@scure/bip39` - HD wallet
- `@tevm/chains` - Chain configurations
- `abitype` - ABI type utilities (optional peer dep)
- `@shazow/whatsabi` - ABI detection
- `c-kzg` - KZG commitments

**Optional (Effect integration):**
- `effect` ^3.12.6

**Dev/Comparison:**
- `viem`, `ethers`, `ox`, `@noble/curves`, `@noble/hashes`

---

## Integration with viem and ethers.js

Voltaire is designed as an alternative/complement rather than a wrapper. Key differences:

### vs. viem

1. **Type safety**: Voltaire uses distinct branded `Uint8Array` types (`AddressType`, `HashType`, `Hex`) while viem uses `0x${string}` for both `Address` and `Hex`, meaning you can pass bytecode where an address is expected.

2. **Data representation**: Voltaire primitives are `Uint8Array` internally (matching Zig and the EVM), while viem uses hex strings throughout.

3. **Performance**: Voltaire's WASM keccak256 is 9-13x faster than viem's JS implementation.

4. **Error handling**: With voltaire-effect, errors appear in type signatures. viem throws runtime exceptions.

5. **Shared dependencies**: Both use `abitype` for ABI types and `ox` for some Ethereum utilities.

### vs. ethers.js

1. **Bundle size**: Voltaire is tree-shakeable (import only what you use). ethers.js is a monolithic package.

2. **Modern APIs**: Voltaire uses `Uint8Array` (zero-copy), Effect patterns, and branded types. ethers.js uses its own `BigNumber`, `BytesLike`, etc.

### Interoperability

Since Voltaire types are based on `Uint8Array` and hex strings, they can be used alongside viem/ethers. The `ox` library is shared between Voltaire and viem ecosystems for amortized bundle costs.

The related `evmts` ecosystem provides:
- `evmts/chappe` - Provider and JSON-RPC client
- `evmts/guillotine` - EVM execution
- `evmts/compiler` - Solidity compilation
- `evmts/tevm-monorepo` - Complete unified library

---

## Testing Patterns

### TypeScript Testing (Vitest)

Tests are in separate `*.test.ts` files:

```typescript
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import { describe, expect, it } from 'vitest';
import { AddressServicesLive, AddressServicesTest } from './effect-layers.js';
import { AddressSchema, ChecksumAddress } from './effect.js';

describe('AddressSchema Effect Schema', () => {
  it('creates from hex string', async () => {
    const effect = AddressSchema.fromHex('0x742d35cc6634c0532925a3b844bc9e7595f251e3');
    const addr = await Effect.runPromise(effect);
    expect(addr.toHex()).toBe('0x742d35cc6634c0532925a3b844bc9e7595f251e3');
  });

  it('rejects invalid hex format', async () => {
    const effect = AddressSchema.fromHex('invalid');
    const result = await Effect.runPromise(Effect.either(effect));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(InvalidHexFormatError);
    }
  });

  it('works with test services (mocked crypto)', async () => {
    const program = Effect.gen(function* () {
      const addr = yield* AddressSchema.fromPrivateKey(new Uint8Array(32));
      return addr.isZero();
    }).pipe(Effect.provide(AddressServicesTest)); // Swap to test layer

    const result = await Effect.runPromise(program);
    expect(result).toBe(false); // Predictable test output
  });

  it('chains multiple crypto operations', async () => {
    const program = Effect.gen(function* () {
      const deployer = yield* AddressSchema.fromHex(testAddress);
      const created1 = yield* deployer.calculateCreateAddress(0n);
      const created2 = yield* deployer.calculateCreate2Address(
        new Uint8Array(32), new Uint8Array(0),
      );
      return { created1: created1.toHex(), created2: created2.toHex() };
    }).pipe(Effect.provide(AddressServicesLive));

    const result = await Effect.runPromise(program);
    expect(result.created1).toMatch(/^0x[a-f0-9]{40}$/);
  });
});
```

### Zig Testing

Inline tests in source files:
```zig
test "address from hex" {
    const addr = Address.fromHex("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");
    try std.testing.expectEqual(@as(u8, 0x74), addr[0]);
}
```

### Benchmarking

- Zig: `zbench` framework
- TypeScript: `mitata` framework
- Comparison scripts: `scripts/generate-comparisons.ts` (vs ethers/viem/noble)

### MCP Evaluation Tests

Advent-of-Code style challenges that test Claude's ability to use Voltaire:
```bash
export ETHEREUM_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
bun run test:mcp
```

---

## TypeScript Type Safety Features

### 1. Branded Types Prevent Cross-Type Misuse

```typescript
type AddressType = Uint8Array & { readonly [brand]: 'Address' };
type HashType = Uint8Array & { readonly [brand]: 'Hash' };

// Compile error: AddressType is not assignable to HashType
function expectHash(h: HashType) { /* ... */ }
expectHash(someAddress); // Type error!
```

### 2. Sized Hex Types

```typescript
type Selector = Hex.Bytes<4>;     // Exactly 4 bytes
type StorageKey = Hex.Bytes<32>;  // Exactly 32 bytes
```

### 3. Transaction Type Narrowing

```typescript
const tx = Transaction.deserialize(data);
if (tx.type === Transaction.Type.EIP1559) {
  // tx is narrowed to TransactionEIP1559
  console.log(tx.maxFeePerGas);     // Available
  console.log(tx.maxPriorityFeePerGas); // Available
  // tx.gasPrice would be a type error
}
```

### 4. ABI-Level Type Inference

```typescript
import { Abi } from '@tevm/voltaire/Abi';

const abi = [...] as const;
// Function parameters and return types inferred from ABI
const result = Abi.Function.decode(abi, 'balanceOf', returnData);
// result type is inferred from ABI definition
```

### 5. Effect Type-Level Error Tracking

```typescript
// The type tells you exactly what can go wrong
const result: Effect.Effect<
  AddressSchema,
  InvalidAddressLengthError | InvalidPrivateKeyError | CryptoOperationError,
  Secp256k1Service | Keccak256Service
> = AddressSchema.fromPrivateKey(privateKey);
```

---

## Common Ethereum Operations

### Create an Address

```typescript
// From hex string
const addr = Address('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');

// From private key
const addr = Address.fromPrivateKey(privateKeyBytes);

// From public key coordinates
const addr = Address.fromPublicKey(x, y);

// Zero address
const zero = Address.zero();
```

### Hash Data

```typescript
import * as Keccak256 from '@tevm/voltaire/Keccak256';

const hash = Keccak256.hash(new TextEncoder().encode('test'));
const selector = Keccak256.selector('transfer(address,uint256)');
```

### Encode a Transaction

```typescript
import * as Transaction from '@tevm/voltaire/Transaction';

const tx = {
  type: Transaction.Type.EIP1559,
  chainId: 1n,
  nonce: 0n,
  maxFeePerGas: 30000000000n,
  maxPriorityFeePerGas: 1000000000n,
  gasLimit: 21000n,
  to: Address.from('0x...'),
  value: 1000000000000000000n,
  data: new Uint8Array(),
};

const serialized = Transaction.serialize(tx);
```

### Work with ABI

```typescript
import * as Abi from '@tevm/voltaire/Abi';

const encoded = Abi.Function.encode(abi, 'transfer', [recipient, amount]);
const decoded = Abi.Function.decode(abi, 'balanceOf', returnData);
const logs = Abi.parseLogs(abi, rawLogs);
```

### ERC-20 Operations

```typescript
import * as ERC20 from '@tevm/voltaire/standards';

const transferCalldata = ERC20.encodeTransfer(recipientAddress, amount);
const approveCalldata = ERC20.encodeApprove(spenderAddress, amount);
// Selectors: ERC20.SELECTORS.transfer, ERC20.SELECTORS.balanceOf, etc.
// Event signatures: ERC20.EVENTS.Transfer, ERC20.EVENTS.Approval
```

### JSON-RPC Requests

```typescript
import { Rpc } from '@tevm/voltaire/jsonrpc';

const balanceReq = Rpc.Eth.GetBalanceRequest('0x...', 'latest');
const callReq = Rpc.Eth.CallRequest({ to: '0x...', data: '0x...' }, 'latest');
const blockReq = Rpc.Eth.GetBlockByNumberRequest('0x1', false);
```

### Using a Provider

```typescript
import { HttpProvider } from '@tevm/voltaire/provider';

const provider = new HttpProvider('https://eth.example.com');
const blockNumber = await provider.request({
  method: 'eth_blockNumber',
  params: [],
});

provider.on('chainChanged', (chainId) => {
  console.log('Chain changed:', chainId);
});
```

---

## When to Use voltaire-effect vs Base Voltaire

| Use Case | Recommendation |
|----------|---------------|
| Simple scripts | Base Voltaire |
| Bundle-size critical | Base Voltaire |
| No existing Effect usage | Base Voltaire |
| Complex retry/timeout workflows | voltaire-effect |
| Typed errors in signatures | voltaire-effect |
| Testable dependencies (DI) | voltaire-effect |
| Existing Effect.ts application | voltaire-effect |
| Streaming operations | voltaire-effect |
| Contract registry pattern | voltaire-effect |

---

## Sources

- [Voltaire Documentation](https://voltaire.tevm.sh)
- [voltaire-effect Documentation](https://voltaire-effect.tevm.sh)
- [GitHub Repository](https://github.com/evmts/voltaire)
- [This Week in Effect - 2026-01-30](https://effect.website/blog/this-week-in-effect/2026/01/30/)
- [Effect.ts](https://effect.website/)
- Local source code at `/Users/williamcory/chop/voltaire/`
