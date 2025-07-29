import { describe, expect, it } from '@jest/globals'
import { ProviderClaimData } from 'src/proto/api'
import { executeProcessorForTest } from 'src/tests/processors/test-helpers'
import { DeclarativeProcessor } from 'src/types/declarative-processor'
import { createProcessorProviderHash } from 'src/utils/processors/processed-claim-utils'
import { validateDeclarativeProcessor } from 'src/utils/processors/processor-validator'

describe('Declarative Processor System', () => {
	const mockClaim: ProviderClaimData = {
		provider: 'http',
		parameters: JSON.stringify({
			url: 'https://api.example.com/payment',
			method: 'GET'
		}),
		owner: '0x1234567890123456789012345678901234567890',
		timestampS: 1705314600,
		context: JSON.stringify({
			contextAddress: '0x742d35cc6634c0532925a3b844bc9e7595f62a3c',
			extractedParameters: {
				amount: '150.50',
				senderId: 'user_123',
				recipientId: 'user_456',
				date: '2024-01-15T10:30:00Z',
				paymentStatus: 'completed'
			}
		}),
		identifier: '0xabc123',
		epoch: 1
	}

	describe('Processor Validation', () => {
		it('should validate a correct processor', () => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				outputs: [
					{ name: 'amount', type: 'uint256' }
				]
			}

			const result = validateDeclarativeProcessor(processor)
			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should reject invalid processor structure', () => {
			const invalidProcessor = {
				version: '2.0.0',
				extract: {},
				outputs: []
			}

			const result = validateDeclarativeProcessor(invalidProcessor)
			expect(result.valid).toBe(false)
			expect(result.errors.length).toBeGreaterThan(0)
		})

		it('should validate transform operations', () => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				transform: {
					scaledAmount: {
						input: 'amount',
						ops: [{ type: 'math', expression: '* 100' }]
					}
				},
				outputs: [
					{ name: 'scaledAmount', type: 'uint256' }
				]
			}

			const result = validateDeclarativeProcessor(processor)
			expect(result.valid).toBe(true)
		})
	})

	describe('Processor Execution', () => {
		it('should extract simple values', async() => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					address: '$.context.contextAddress',
					amount: '$.context.extractedParameters.amount',
					sender: '$.context.extractedParameters.senderId'
				},
				outputs: [
					{ name: 'address', type: 'address' },
					{ name: 'amount', type: 'string' },
					{ name: 'sender', type: 'string' }
				]
			}

			const result = await executeProcessorForTest(processor, mockClaim)

			expect(result.values).toEqual([
				'0x742d35cc6634c0532925a3b844bc9e7595f62a3c',
				'150.50',
				'user_123'
			])
		})

		it('should apply transforms', async() => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					recipientId: '$.context.extractedParameters.recipientId',
					amount: '$.context.extractedParameters.amount'
				},
				transform: {
					hashedRecipient: {
						input: 'recipientId',
						ops: ['keccak256']
					},
					scaledAmount: {
						input: 'amount',
						ops: [{ type: 'math', expression: '* 100' }]
					}
				},
				outputs: [
					{ name: 'hashedRecipient', type: 'bytes32' },
					{ name: 'scaledAmount', type: 'uint256' }
				]
			}

			const result = await executeProcessorForTest(processor, mockClaim)

			expect(result.values).toHaveLength(2)
			expect(result.values[0]).toMatch(/^0x[a-f0-9]{64}$/)
			expect(result.values[1]).toBe('15050')
		})

		it('should handle timestamp parsing', async() => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					date: '$.context.extractedParameters.date'
				},
				transform: {
					timestamp: {
						input: 'date',
						ops: ['parseTimestamp']
					}
				},
				outputs: [
					{ name: 'timestamp', type: 'uint256' }
				]
			}

			const result = await executeProcessorForTest(processor, mockClaim)

			expect(result.values).toHaveLength(1)
			expect(result.values[0]).toBe('1705314600000')
		})

		it('should concatenate amount parts', async() => {
			const claimWithSplitAmount: ProviderClaimData = {
				...mockClaim,
				context: JSON.stringify({
					...JSON.parse(mockClaim.context),
					extractedParameters: {
						amountDollars: '25',
						amountCents: '50'
					}
				})
			}

			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					dollars: '$.context.extractedParameters.amountDollars',
					cents: '$.context.extractedParameters.amountCents'
				},
				transform: {
					fullAmount: {
						inputs: ['dollars', 'cents'],
						ops: ['concat']
					}
				},
				outputs: [
					{ name: 'fullAmount', type: 'uint256' }
				]
			}

			const result = await executeProcessorForTest(processor, claimWithSplitAmount)

			expect(result.values).toEqual(['2550'])
		})

		it('should format amounts using template', async() => {
			const claimWithSplitAmount: ProviderClaimData = {
				...mockClaim,
				context: JSON.stringify({
					...JSON.parse(mockClaim.context),
					extractedParameters: {
						amountDollars: '25',
						amountCents: '50'
					}
				})
			}

			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					dollars: '$.context.extractedParameters.amountDollars',
					cents: '$.context.extractedParameters.amountCents'
				},
				transform: {
					dollarsWithDot: {
						input: 'dollars',
						ops: [{ type: 'template', pattern: '${value}.' }]
					},
					fullAmount: {
						input: 'dollarsWithDot',
						ops: [{ type: 'template', pattern: '${value}50' }]
					}
				},
				outputs: [
					{ name: 'fullAmount', type: 'string' }
				]
			}

			const result = await executeProcessorForTest(processor, claimWithSplitAmount)

			expect(result.values).toEqual(['25.50'])
		})

		it('should handle validation transforms', async() => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount',
					status: '$.context.extractedParameters.paymentStatus'
				},
				transform: {
					validatedAmount: {
						input: 'amount',
						ops: [
							// Simply pass through the amount without regex validation
						]
					},
					validatedStatus: {
						input: 'status',
						ops: [
							{ type: 'assertEquals', expected: 'completed', message: 'Payment must be completed' }
						]
					}
				},
				outputs: [
					{ name: 'validatedAmount', type: 'string' },
					{ name: 'validatedStatus', type: 'string' }
				]
			}

			const result = await executeProcessorForTest(processor, mockClaim)
			expect(result.values).toEqual(['150.50', 'completed'])
		})

		it('should throw on missing values', async() => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					missingField: '$.context.extractedParameters.nonExistent'
				},
				outputs: [
					{ name: 'missingField', type: 'string' }
				]
			}

			await expect(executeProcessorForTest(processor, mockClaim))
				.rejects.toThrow("Output variable 'missingField' is undefined. All output values must be defined.")
		})

	})

	describe('Processor Provider Hashing', () => {
		const mockProviderHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

		it('should generate consistent hashes', () => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				outputs: [
					{ name: 'amount', type: 'uint256' }
				]
			}

			const hash1 = createProcessorProviderHash(mockProviderHash, processor)
			const hash2 = createProcessorProviderHash(mockProviderHash, processor)

			expect(hash1).toBe(hash2)
			expect(hash1).toMatch(/^0x[a-f0-9]{64}$/)
		})

		it('should generate different hashes for different processors', () => {
			const processor1: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				outputs: [
					{ name: 'amount', type: 'uint256' }
				]
			}

			const processor2: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount',
					sender: '$.context.extractedParameters.senderId'
				},
				outputs: [
					{ name: 'amount', type: 'uint256' },
					{ name: 'sender', type: 'string' }
				]
			}

			const hash1 = createProcessorProviderHash(mockProviderHash, processor1)
			const hash2 = createProcessorProviderHash(mockProviderHash, processor2)

			expect(hash1).not.toBe(hash2)
		})

		it('should generate different hashes for same processor with different providers', () => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				outputs: [
					{ name: 'amount', type: 'uint256' }
				]
			}

			const providerHash1 = '0x1111111111111111111111111111111111111111111111111111111111111111'
			const providerHash2 = '0x2222222222222222222222222222222222222222222222222222222222222222'

			const hash1 = createProcessorProviderHash(providerHash1, processor)
			const hash2 = createProcessorProviderHash(providerHash2, processor)

			expect(hash1).not.toBe(hash2)
		})

	})

	describe('New Outputs Format', () => {
		it('should support new consolidated outputs format', async() => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					address: '$.context.contextAddress',
					amount: '$.context.extractedParameters.amount',
					sender: '$.context.extractedParameters.senderId'
				},
				outputs: [
					{ name: 'address', type: 'address' },
					{ name: 'amount', type: 'uint256' },
					{ name: 'sender', type: 'string' }
				]
			}

			const result = await executeProcessorForTest(processor, mockClaim)

			expect(result.values).toEqual([
				'0x742d35cc6634c0532925a3b844bc9e7595f62a3c',
				'150.50',
				'user_123'
			])
		})

		it('should validate new outputs format', () => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				outputs: [
					{ name: 'amount', type: 'uint256' }
				]
			}

			const result = validateDeclarativeProcessor(processor)
			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should handle transforms with new format', async() => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				transform: {
					scaledAmount: {
						input: 'amount',
						ops: [{ type: 'math', expression: '* 100' }]
					}
				},
				outputs: [
					{ name: 'scaledAmount', type: 'uint256' }
				]
			}

			const result = await executeProcessorForTest(processor, mockClaim)
			expect(result.values).toEqual(['15050'])
		})
	})

	describe('EVM Type Conversions', () => {
		it('should extract and transform values without type conversion', async() => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					address: '$.context.contextAddress',
					amount: '$.context.extractedParameters.amount',
					status: '$.context.extractedParameters.paymentStatus',
					senderId: '$.context.extractedParameters.senderId'
				},
				transform: {
					amountWei: {
						input: 'amount',
						ops: [{ type: 'math', expression: '* 1000000' }] // Convert to smaller unit
					},
					isCompleted: {
						input: 'status',
						ops: [{ type: 'assertEquals', expected: 'completed' }, { type: 'replace', pattern: 'completed', replacement: 'true' }]
					},
					senderHash: {
						input: 'senderId',
						ops: ['keccak256']
					}
				},
				outputs: [
					{ name: 'address', type: 'address' },
					{ name: 'amountWei', type: 'uint256' },
					{ name: 'isCompleted', type: 'bool' },
					{ name: 'senderHash', type: 'bytes32' }
				]
			}

			const result = await executeProcessorForTest(processor, mockClaim)

			expect(result.values).toHaveLength(4)
			// Raw address value
			expect(result.values[0]).toBe('0x742d35cc6634c0532925a3b844bc9e7595f62a3c')
			// Amount scaled by 1000000
			expect(result.values[1]).toBe('150500000')
			// String 'true' (not boolean) - ABI encoder will handle conversion
			expect(result.values[2]).toBe('true')
			// Bytes32 hash
			expect(result.values[3]).toMatch(/^0x[a-f0-9]{64}$/)
		})

		it('should pass raw values for ABI encoding', async() => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				transform: {
					scaledAmount: {
						input: 'amount',
						ops: [{ type: 'math', expression: '* 100' }]
					}
				},
				outputs: [
					{ name: 'scaledAmount', type: 'uint256' }
				]
			}

			const result = await executeProcessorForTest(processor, mockClaim)
			// Raw string value - ABI encoder will convert to uint256
			expect(result.values[0]).toBe('15050')
		})

		it('should pass string values without conversion', async() => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					shortString: '$.context.extractedParameters.senderId'
				},
				outputs: [
					{ name: 'shortString', type: 'bytes32' }
				]
			}

			const result = await executeProcessorForTest(processor, mockClaim)
			// Raw string value - ABI encoder will handle bytes32 conversion
			expect(result.values[0]).toBe('user_123')
		})
	})
})