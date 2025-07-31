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
  
  // 3. Output phase - specify order of values for smart contract
  output: ["parsedAmount", "timestamp", "payerName"]
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

### Conditional Logic
- `conditional` - Apply different operations based on conditions
  ```typescript
  {
    type: 'conditional',
    if: { eq: 'JPY' },           // Condition to check
    then: [],                    // Operations if true
    else: [{ type: 'math', expression: '/ 100' }]  // Operations if false
  }
  ```

## Creating Processors

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
  
  output: ['amountInCents', 'timestamp', 'payerName', 'note']
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

Processors are designed to produce values that match smart contract expectations:

```solidity
contract VenmoVerifier {
  // Expected order from processor.output
  function verifyPayment(
    uint256 amountInCents,   // output[0]
    uint256 timestamp,       // output[1]
    string memory payerName, // output[2]
    string memory note       // output[3]
  ) public {
    // Verify payment logic
  }
}
```

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
  output: ["scaledAmount", "unixTime", "currency"]
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
  output: ["endOfDayTimestamp", "amount"]
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
  output: ["scaledAmount", "statusHash"]
}
```

## Processed Data Structure

The attestor signs and returns:

```typescript
{
  claimId: string              // The claim identifier
  values: string[]             // Extracted values array (all strings)
  signature: Uint8Array        // Attestor's signature
  attestorAddress: string      // Who signed it
  provider: string             // Provider name
}
```