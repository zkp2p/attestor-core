/**
 * Example: EVM-optimized Declarative Processor
 * 
 * This shows how to create a processor that produces values
 * ready for smart contract verification
 */

import { DeclarativeProcessor } from '../src/types/declarative-processor'

// Example processor for a payment verification system
const paymentProcessor: DeclarativeProcessor = {
	version: '1.0.0',
	description: 'Process payment data for on-chain verification',
	
	// Extract raw values from the claim
	extract: {
		recipient: '$.context.extractedParameters.recipientAddress',
		amount: '$.context.extractedParameters.amountInDollars',
		currency: '$.context.extractedParameters.currency',
		paymentId: '$.context.extractedParameters.transactionId',
		timestamp: '$.context.extractedParameters.date'
	},
	
	// Transform values as needed
	transform: {
		// Convert amount to cents (for uint256)
		amountCents: {
			input: 'amount',
			ops: [{ type: 'math', expression: '* 100' }]
		},
		// Hash the payment ID for bytes32
		paymentHash: {
			input: 'paymentId', 
			ops: ['keccak256']
		},
		// Convert timestamp to unix seconds
		timestampUnix: {
			input: 'timestamp',
			ops: ['parseTimestamp', { type: 'math', expression: '/ 1000' }]
		}
	},
	
	// Specify output values in order
	output: [
		'recipient',      // Will be encoded as address
		'amountCents',    // Will be encoded as uint256  
		'currency',       // Will be encoded as string
		'paymentHash',    // Will be encoded as bytes32
		'timestampUnix'   // Will be encoded as uint256
	],
	
	// Specify EVM types for ABI encoding
	evmTypes: [
		'address',
		'uint256',
		'string',
		'bytes32', 
		'uint256'
	]
}

/**
 * The attestor will:
 * 1. Extract values using JSONPath
 * 2. Transform them as specified
 * 3. Create hash: keccak256(encode([processorProviderHash, ...values]))
 * 4. Sign the hash directly (no personal message prefix)
 * 
 * Smart contract can verify by:
 * 1. Recreating the same hash from the values
 * 2. Using ecrecover to get signer address
 * 3. Checking signer is authorized attestor
 */

// Example output values (what gets signed):
// [
//   '0x742d35cc6634c0532925a3b844bc9e7595f62a3c',  // recipient address
//   '15050',                                        // $150.50 as cents
//   'USD',                                          // currency string
//   '0x1234...abcd',                                // payment ID hash
//   '1705314600'                                    // unix timestamp
// ]

export default paymentProcessor