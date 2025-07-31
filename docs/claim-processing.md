# Claim Processing

The attestor-core supports processing verified claims to extract and transform values for on-chain submission using a secure, JSON-based processor system. Processing happens server-side, and the extracted values are signed by the attestor's private key.

## Overview

After a claim is successfully verified, the attestor can:
1. Extract specific values from the claim data using JSONPath expressions
2. Transform the values using a predefined set of secure operations (e.g., parse dates, format amounts, validate data)
3. Sign the processed values array
4. Return the processed data with attestor signature

## Processor System

Processors are defined as JSON objects that specify how to extract and transform data. This approach:
- Eliminates security risks from arbitrary code execution
- Provides deterministic, verifiable transformations
- Enables smart contract verification of processing logic
- Simplifies processor creation and maintenance

## Processor Structure

A processor has three main phases:

```typescript
{
  version: "1.0.0",
  description: "Process Venmo payments",
  
  // 1. Extract phase - pull values from claim using JSONPath
  extract: {
    payerName: "$.payerUsername",
    amount: "$.amount",
    date: "$.date",
    status: "$.paymentStatus"
  },
  
  // 2. Transform phase - apply operations to extracted values
  transform: {
    parsedAmount: {
      input: "amount",
      ops: [
        { type: "substring", start: 1 },  // Remove $ prefix
        { type: "replace", pattern: ",", replacement: "", global: true },
        { type: "math", expression: "* 100" }  // Convert to cents
      ]
    },
    timestamp: {
      input: "date",
      ops: ["parseTimestamp"]
    },
    validatedStatus: {
      input: "status",
      ops: [
        { type: "assertEquals", expected: "approved", message: "Payment must be approved" }
      ]
    }
  },
  
  // 3. Output phase - specify variables and their EVM types
  outputs: [
    { name: "parsedAmount", type: "uint256" },
    { name: "timestamp", type: "uint256" },
    { name: "payerName", type: "string" }
  ]
}
```

## Available Transforms

All transforms work with strings as input/output for smart contract compatibility:

### String Operations
- `toLowerCase` - Convert to lowercase
- `toUpperCase` - Convert to uppercase  
- `trim` - Remove whitespace
- `substring` - Extract substring `{ start: 1, end?: 5 }`
- `replace` - Replace text `{ pattern: "old", replacement: "new", global?: true }`

### Math Operations
- `math` - Basic arithmetic on string numbers `{ expression: "* 100" | "+ 10" | "- 5" | "/ 1000" }`

### Crypto Operations
- `keccak256` - Compute Keccak-256 hash (returns 0x-prefixed hex)
- `sha256` - Compute SHA-256 hash (returns 0x-prefixed hex)

### Date Operations
- `parseTimestamp` - Parse various date formats to milliseconds string
  - Supports: ISO 8601, Unix timestamps, `YYYY-MM-DD HH:MM:SS`, `YYYY-MM-DD`
  - Optional format validation: `{ format: "YYYY-MM-DD" }`

### Validation Operations
- `assertEquals` - Assert value equals expected `{ expected: "value", message?: "Error" }`
- `assertOneOf` - Assert value is in list `{ values: ["a", "b"], message?: "Error" }`
- `validate` - Validate with conditions `{ condition: { gt: 50, lt: 100 }, message?: "Error" }`

### String Combination
- `concat` - Concatenate multiple strings (for multiple inputs: `{ inputs: ['amt', 'cents'], ops: ['concat'] }`)
- `template` - String templating `{ pattern: "Prefix: ${value}" }`

### Constants
- `constant` - Return a constant value `{ type: 'constant', value: 'USD' }`

### Conditional Logic
- `conditionalOn` - Apply different operations based on conditions of other fields
  ```typescript
  {
    type: 'conditionalOn',
    checkField: 'currency',      // Required: field to check condition on
    if: { eq: 'JPY' },           // Condition to check on checkField
    then: [],                    // Operations if true (cannot contain another conditionalOn)
    else: [{ type: 'math', expression: '/ 100' }]  // Operations if false (cannot contain another conditionalOn)
  }
  ```
  
  **Note**: 
  - `checkField` is required and must reference an existing extracted or transformed field
  - `conditionalOn` transforms cannot be nested. The `then` and `else` branches cannot contain another `conditionalOn` operation to prevent excessive complexity
  - This transform is specifically for checking conditions on different fields than the one being transformed

## Creating Processors

### Important: Processor Versioning

The `version` field in processors is crucial:
- It's included in the `processorProviderHash` calculation
- Changing the version creates a new hash, requiring re-approval on-chain
- Use semantic versioning (e.g., "1.0.0", "1.1.0") for clarity
- Only update version when logic changes affect output values

### 1. Provider-Specific Processor

Create a processor in the provider's directory:

```typescript
// src/providers/http/processors/venmo-processor.ts
import { Processor } from 'src/types/processor'

export const venmoProcessor: Processor = {
  version: '1.0.0',
  description: 'Process Venmo P2P payments',
  
  extract: {
    payerName: '$.data.payerUsername',
    amount: '$.data.amount',
    date: '$.data.date',
    note: '$.data.note',
    status: '$.data.paymentStatus'
  },
  
  transform: {
    // Remove $ and commas, convert to cents
    amountInCents: {
      input: 'amount',
      ops: [
        { type: 'substring', start: 1 },
        { type: 'replace', pattern: ',', replacement: '', global: true },
        { type: 'math', expression: '* 100' }
      ]
    },
    
    // Parse timestamp from ISO string
    timestamp: {
      input: 'date',
      ops: [
        { type: 'parseTimestamp', format: 'YYYY-MM-DDTHH:MM:SS' }
      ]
    },
    
    // Validate payment was completed
    validatedStatus: {
      input: 'status',
      ops: [
        { type: 'assertEquals', expected: 'complete' }
      ]
    }
  },
  
  outputs: [
    { name: 'amountInCents', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'payerName', type: 'string' },
    { name: 'note', type: 'string' }
  ]
}
```

### 2. Registration

Register the processor with the provider:

```typescript
// In provider configuration
const provider = {
  // ... other config
  processor: venmoProcessor
}
```


## Smart Contract Integration

Processors define output types that match smart contract function parameters:

```solidity
contract VenmoVerifier {
  // Parameters match processor outputs array order and types
  function verifyPayment(
    uint256 amountInCents,   // outputs[0]: { name: "amountInCents", type: "uint256" }
    uint256 timestamp,       // outputs[1]: { name: "timestamp", type: "uint256" }
    string memory payerName, // outputs[2]: { name: "payerName", type: "string" }
    string memory note       // outputs[3]: { name: "note", type: "string" }
  ) public {
    // Verify payment logic
  }
}
```

The attestor automatically converts string values to the specified EVM types during signing.

## Examples

### Revolut Processor (with amount scaling)
```typescript
{
  version: "1.0.0",
  extract: {
    amount: "$.amount",
    currency: "$.currency",
    timestamp: "$.completedDate"
  },
  transform: {
    // Handle negative amounts and scale
    scaledAmount: {
      input: "amount",
      ops: [
        { type: "replace", pattern: "-", replacement: "" },
        { type: "math", expression: "/ 100" }
      ]
    },
    unixTime: {
      input: "timestamp",
      ops: ["parseTimestamp"]
    }
  },
  outputs: [
    { name: "scaledAmount", type: "uint256" },
    { name: "unixTime", type: "uint256" },
    { name: "currency", type: "string" }
  ]
}
```

### Zelle Processor (date-only handling)
```typescript
{
  version: "1.0.0",
  extract: {
    date: "$.data.Date",
    amount: "$.data.Amount"
  },
  transform: {
    // Convert date-only to end of day timestamp
    endOfDayTimestamp: {
      input: "date",
      ops: [
        { type: "template", pattern: "${0}T23:59:59" },
        "parseTimestamp"
      ]
    }
  },
  outputs: [
    { name: "endOfDayTimestamp", type: "uint256" },
    { name: "amount", type: "string" }
  ]
}
```

### MercadoPago Processor (concatenating amount fields)
```typescript
{
  version: "1.0.0",
  extract: {
    amountString: "$.amt",        // "1"
    amountCentsString: "$.cents",  // "00"
    status: "$.status"
  },
  transform: {
    // Concatenate amount parts to get scaled amount
    scaledAmount: {
      inputs: ["amountString", "amountCentsString"],
      ops: ["concat"]  // "1" + "00" = "100" (cents)
    },
    // Validate against hashed constant
    statusHash: {
      input: "status",
      ops: [
        "keccak256",
        { 
          type: "assertEquals", 
          expected: "0x2b2926...ca9a05",  // keccak256("approved")
          message: "Payment must be approved"
        }
      ]
    }
  },
  outputs: [
    { name: "scaledAmount", type: "uint256" },
    { name: "statusHash", type: "bytes32" }
  ]
}
```

### Multi-Currency Processor (with conditionalOn checkField)
```typescript
{
  version: "1.0.0",
  extract: {
    amount: "$.payment.amount",
    currency: "$.payment.currency",
    recipient: "$.payment.recipient"
  },
  transform: {
    // Scale amount based on currency (check currency field)
    scaledAmount: {
      input: "amount",
      ops: [{
        type: "conditionalOn",
        checkField: "currency",      // Check the currency field, not amount
        if: { or: [{ eq: "JPY" }, { eq: "KRW" }] },  // No decimal currencies
        then: [],                    // Keep amount as-is
        else: [{ type: "math", expression: "/ 100" }]  // Scale by 100 for others
      }]
    },
    
    // Hash recipient for privacy
    recipientHash: {
      input: "recipient",
      ops: ["keccak256"]
    }
  },
  outputs: [
    { name: "scaledAmount", type: "uint256" },
    { name: "recipientHash", type: "bytes32" },
    { name: "currency", type: "string" }
  ]
}
```

## Processed Data Structure

The attestor signs and returns:

```typescript
interface ProcessedClaimData {
  // Hash binding the processor to the provider (prevents cross-provider attacks)
  processorProviderHash: string
  
  // Attestor's signature over the message hash
  signature: Uint8Array
  
  // Output specifications defining variable names and EVM types
  outputs: Array<{
    name: string   // Variable name
    type: string   // EVM type (uint256, string, bytes32, etc.)
  }>
  
  // The actual processed values in order of outputs
  values: string[]
}
```

## Smart Contract Verification

The `processorProviderHash` enables secure on-chain verification:

```solidity
contract ProcessedClaimVerifier {
  // Whitelist of approved processor-provider combinations
  mapping(bytes32 => bool) public approvedProcessors;
  
  // Authorized attestor addresses
  mapping(address => bool) public authorizedAttestors;
  
  function verifyProcessedClaim(
    ProcessedClaimData memory data,
    // Values decoded according to outputs[].type
    uint256 amountInCents,
    uint256 timestamp,
    string memory payerName
  ) public view {
    // 1. Verify processor-provider combination is approved
    require(
      approvedProcessors[data.processorProviderHash],
      "Unapproved processor"
    );
    
    // 2. Recreate the message hash
    bytes32 messageHash = keccak256(abi.encode(
      data.processorProviderHash,
      amountInCents,
      timestamp,
      payerName
    ));
    
    // 3. Recover signer from signature
    address signer = recoverSigner(messageHash, data.signature);
    
    // 4. Verify signer is authorized
    require(authorizedAttestors[signer], "Unauthorized attestor");
    
    // Process the verified claim...
  }
}
```

The `processorProviderHash` ensures that:
- Processors can only be used with their intended providers
- Smart contracts can maintain a simple whitelist of approved processor-provider pairs
- The binding is cryptographically secure and cannot be forged