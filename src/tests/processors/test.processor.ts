import { describe, expect, it } from '@jest/globals'
import { ProviderClaimData, ServiceSignatureType } from 'src/proto/api'
import { Executor } from 'src/server/processors/executor'
import { executeProcessorForTest } from 'src/tests/processors/test-helpers'
import { Processor } from 'src/types/processor'
import { logger } from 'src/utils'
import { createProcessorProviderHash } from 'src/utils/processors/utils'
import { validateProcessor } from 'src/utils/processors/validator'

describe('Processor System', () => {
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
			},
			providerHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
		}),
		identifier: '0xabc123',
		epoch: 1
	}

	describe('Processor Validation', () => {
		it('should validate a correct processor', () => {
			const processor: Processor = {
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				outputs: [
					{ name: 'amount', type: 'uint256' }
				]
			}

			const result = validateProcessor(processor)
			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should reject invalid processor structure', () => {
			const invalidProcessor = {
				extract: {},
				outputs: []
			}

			const result = validateProcessor(invalidProcessor)
			expect(result.valid).toBe(false)
			expect(result.errors.length).toBeGreaterThan(0)
		})

		it('should validate transform operations', () => {
			const processor: Processor = {
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

			const result = validateProcessor(processor)
			expect(result.valid).toBe(true)
		})

		it('should validate minimal processor structure', () => {
			const processor: any = {
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				outputs: [
					{ name: 'amount', type: 'uint256' }
				]
			}

			const result = validateProcessor(processor)
			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})
	})

	describe('Processor Execution', () => {
		it('should extract simple values', async() => {
			const processor: Processor = {
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
			const processor: Processor = {
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

		it('should handle constants using CONSTANT transform', async() => {
			const processor: Processor = {
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				transform: {
					currency: {
						input: 'amount', // CONSTANT transform ignores input but still needs it specified
						ops: [{ type: 'constant', value: 'USD' }]
					},
					country: {
						input: 'amount', // CONSTANT transform ignores input but still needs it specified
						ops: [{ type: 'constant', value: 'US' }]
					},
					scaledAmount: {
						input: 'amount',
						ops: [{ type: 'math', expression: '* 100' }]
					}
				},
				outputs: [
					{ name: 'scaledAmount', type: 'uint256' },
					{ name: 'currency', type: 'string' },
					{ name: 'country', type: 'string' }
				]
			}

			const result = await executeProcessorForTest(processor, mockClaim)
			expect(result.values).toEqual(['15050', 'USD', 'US'])
		})

		it('should throw on missing values', async() => {
			const processor: Processor = {
				extract: {
					missingField: '$.context.extractedParameters.nonExistent'
				},
				outputs: [
					{ name: 'missingField', type: 'string' }
				]
			}

			await expect(executeProcessorForTest(processor, mockClaim))
				.rejects.toThrow("Value extraction failed for 'missingField' using JSONPath '$.context.extractedParameters.nonExistent'")
		})

	})

	describe('Processor Provider Hashing', () => {
		const mockProviderHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

		it('should generate consistent hashes', () => {
			const processor: Processor = {
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
			const processor1: Processor = {
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				outputs: [
					{ name: 'amount', type: 'uint256' }
				]
			}

			const processor2: Processor = {
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
			const processor: Processor = {
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

		it('should generate different hashes for processors with different versions', () => {
			const processor: Processor = {
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				outputs: [
					{ name: 'amount', type: 'uint256' }
				]
			}

			// Test processor without version
			const hashWithoutVersion = createProcessorProviderHash(mockProviderHash, processor)

			// Test processor with version
			const processorWithVersion = {
				...processor,
				version: '1.0.0'
			}
			const hashWithVersion = createProcessorProviderHash(mockProviderHash, processorWithVersion)

			// Test processor with different version
			const processorWithDifferentVersion = {
				...processor,
				version: '2.0.0'
			}
			const hashWithDifferentVersion = createProcessorProviderHash(mockProviderHash, processorWithDifferentVersion)

			// All hashes should be different
			expect(hashWithoutVersion).not.toBe(hashWithVersion)
			expect(hashWithVersion).not.toBe(hashWithDifferentVersion)
			expect(hashWithoutVersion).not.toBe(hashWithDifferentVersion)
		})

	})

	describe('New Outputs Format', () => {
		it('should support new consolidated outputs format', async() => {
			const processor: Processor = {
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
			const processor: Processor = {
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				outputs: [
					{ name: 'amount', type: 'uint256' }
				]
			}

			const result = validateProcessor(processor)
			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should handle transforms with new format', async() => {
			const processor: Processor = {
				extract: {
					address: '$.context.contextAddress',
					sender: '$.context.extractedParameters.senderId'
				},
				transform: {
					hashedSender: {
						input: 'sender',
						ops: ['keccak256']
					}
				},
				outputs: [
					{ name: 'address', type: 'address' },
					{ name: 'hashedSender', type: 'bytes32' }
				]
			}

			const result = await executeProcessorForTest(processor, mockClaim)
			expect(result.values).toHaveLength(2)
			expect(result.values[0]).toBe('0x742d35cc6634c0532925a3b844bc9e7595f62a3c')
			expect(result.values[1]).toMatch(/^0x[a-f0-9]{64}$/)
		})
	})

	describe('EVM Type Conversions', () => {
		it('should extract and transform values without type conversion', async() => {
			const processor: Processor = {
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


		it('should pass string values without conversion', async() => {
			const processor: Processor = {
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

	describe('Error Handling', () => {
		it('should throw error with specific message when JSONPath extraction fails', async() => {
			const processor: Processor = {
				extract: {
					missingField: '$.nonExistentField'
				},
				outputs: [
					{ name: 'missingField', type: 'string' }
				]
			}

			await expect(
				Executor.processClaim(
					{ claim: mockClaim, processor },
					ServiceSignatureType.SERVICE_SIGNATURE_TYPE_ETH,
					logger
				)
			).rejects.toThrow("Value extraction failed for 'missingField' using JSONPath '$.nonExistentField'")
		})

		it('should throw error when transform input is undefined', async() => {
			const processor: Processor = {
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				transform: {
					doubledAmount: {
						input: 'nonExistentInput', // This doesn't exist
						ops: [{ type: 'math', expression: '* 2' }]
					}
				},
				outputs: [
					{ name: 'doubledAmount', type: 'uint256' }
				]
			}

			await expect(
				Executor.processClaim(
					{ claim: mockClaim, processor },
					ServiceSignatureType.SERVICE_SIGNATURE_TYPE_ETH,
					logger
				)
			).rejects.toThrow('Invalid processor: transform.doubledAmount.input: Unknown input variable: nonExistentInput')
		})

		it('should throw error when processor is invalid', async() => {
			const invalidProcessor = {
				// Missing required fields
				outputs: []
			} as any

			await expect(
				Executor.processClaim(
					{ claim: mockClaim, processor: invalidProcessor },
					ServiceSignatureType.SERVICE_SIGNATURE_TYPE_ETH,
					logger
				)
			).rejects.toThrow(/Invalid processor/)
		})

		it('should throw error when output variable is undefined', async() => {
			const processor: Processor = {
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				outputs: [
					{ name: 'amount', type: 'uint256' },
					{ name: 'missingValue', type: 'string' } // This won't be extracted
				]
			}

			await expect(
				Executor.processClaim(
					{ claim: mockClaim, processor },
					ServiceSignatureType.SERVICE_SIGNATURE_TYPE_ETH,
					logger
				)
			).rejects.toThrow('Invalid processor: outputs[1].name: Unknown variable: missingValue')
		})

		it('should throw error when transform operation fails', async() => {
			const processor: Processor = {
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				transform: {
					validatedAmount: {
						input: 'amount',
						ops: [
							{ type: 'assertEquals', expected: '200.00', message: 'Amount must be 200.00' }
						]
					}
				},
				outputs: [
					{ name: 'validatedAmount', type: 'string' }
				]
			}

			await expect(
				Executor.processClaim(
					{ claim: mockClaim, processor },
					ServiceSignatureType.SERVICE_SIGNATURE_TYPE_ETH,
					logger
				)
			).rejects.toThrow('Amount must be 200.00')
		})

		it('should preserve error details through the full flow', async() => {
			const processor: Processor = {
				extract: {
					status: '$.context.extractedParameters.status'
				},
				transform: {
					validatedStatus: {
						input: 'status',
						ops: [
							{
								type: 'assertOneOf',
								values: ['approved', 'completed'],
								message: 'Payment status must be approved or completed'
							}
						]
					}
				},
				outputs: [
					{ name: 'validatedStatus', type: 'string' }
				]
			}

			// status is undefined in our mock claim
			await expect(
				Executor.processClaim(
					{ claim: mockClaim, processor },
					ServiceSignatureType.SERVICE_SIGNATURE_TYPE_ETH,
					logger
				)
			).rejects.toThrow("Value extraction failed for 'status' using JSONPath '$.context.extractedParameters.status'")
		})
	})

	describe('Nested ConditionalOn Protection', () => {
		it('should prevent nested conditionalOn transforms', async() => {
			// Create a processor with nested conditionalOn (depth > 1)
			const processor: Processor = {
				extract: {
					value: '$.context.extractedParameters.amount',
					currency: '$.context.extractedParameters.currency'
				},
				transform: {
					nestedCondition: {
						input: 'value',
						ops: [{
							type: 'conditionalOn',
							checkField: 'currency',
							if: { ne: '' },
							then: [{
								type: 'conditionalOn', // This nested conditionalOn should fail
								checkField: 'value',
								if: { eq: '150.50' },
								then: ['trim']
							}]
						}]
					}
				},
				outputs: [
					{ name: 'nestedCondition', type: 'string' }
				]
			}

			await expect(
				Executor.processClaim(
					{ claim: {
						...mockClaim,
						context: JSON.stringify({
							...JSON.parse(mockClaim.context),
							extractedParameters: {
								...JSON.parse(mockClaim.context).extractedParameters,
								currency: 'USD'
							}
						})
					}, processor },
					ServiceSignatureType.SERVICE_SIGNATURE_TYPE_ETH,
					logger
				)
			).rejects.toThrow('Nested conditionalOn transforms are not allowed (maximum depth is 1)')
		})

		it('should allow conditionalOn with non-conditionalOn operations', async() => {
			// Create a processor with conditionalOn containing other operations
			const processor: Processor = {
				extract: {
					value: '$.context.extractedParameters.amount',
					currency: '$.context.extractedParameters.currency'
				},
				transform: {
					processedAmount: {
						input: 'value',
						ops: [{
							type: 'conditionalOn',
							checkField: 'currency',
							if: { eq: 'USD' },
							then: [
								{ type: 'replace', pattern: '\\.', replacement: '' }, // Escape the dot
								'trim'
							],
							else: ['trim']
						}]
					}
				},
				outputs: [
					{ name: 'processedAmount', type: 'string' }
				]
			}

			// This should succeed (no nested conditionalOn)
			const result = await executeProcessorForTest(processor, {
				...mockClaim,
				context: JSON.stringify({
					...JSON.parse(mockClaim.context),
					extractedParameters: {
						...JSON.parse(mockClaim.context).extractedParameters,
						currency: 'USD'
					}
				})
			})
			expect(result.values[0]).toBe('15050') // 150.50 -> 15050 (. removed) -> trimmed
		})

		it('should require checkField for conditionalOn transforms', async() => {
			// Create a processor with conditionalOn missing checkField
			const processor = {
				extract: {
					value: '$.context.extractedParameters.amount'
				},
				transform: {
					processedValue: {
						input: 'value',
						ops: [{
							type: 'conditionalOn',
							// checkField is missing - should fail validation
							if: { eq: '150.50' },
							then: ['trim'],
							else: ['toUpperCase']
						}]
					}
				},
				outputs: [
					{ name: 'processedValue', type: 'string' }
				]
			} as any

			await expect(
				Executor.processClaim(
					{ claim: mockClaim, processor },
					ServiceSignatureType.SERVICE_SIGNATURE_TYPE_ETH,
					logger
				)
			).rejects.toThrow(/checkField is required/)
		})
	})
})