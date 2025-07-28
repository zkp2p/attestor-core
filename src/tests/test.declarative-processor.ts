import { describe, expect, it } from '@jest/globals'
import { ProviderClaimData } from 'src/proto/api'
import { DeclarativeExecutor } from 'src/server/processors/declarative-executor'
import { validateDeclarativeProcessor } from 'src/server/processors/declarative-validator'
import { DeclarativeProcessor } from 'src/types/declarative-processor'
import { logger } from 'src/utils'
import { hashDeclarativeProcessor } from 'src/utils/processors/processed-claim-utils'

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
			contextAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f62a3C',
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
				output: ['amount']
			}

			const result = validateDeclarativeProcessor(processor)
			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should reject invalid processor structure', () => {
			const invalidProcessor = {
				version: '2.0.0',
				extract: {},
				output: []
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
				output: ['scaledAmount']
			}

			const result = validateDeclarativeProcessor(processor)
			expect(result.valid).toBe(true)
		})
	})

	describe('Processor Execution', () => {
		const executor = new DeclarativeExecutor(logger)

		it('should extract simple values', async() => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					address: '$.context.contextAddress',
					amount: '$.context.extractedParameters.amount',
					sender: '$.context.extractedParameters.senderId'
				},
				output: ['address', 'amount', 'sender']
			}

			const result = await executor.execute(processor, mockClaim)

			expect(result.values).toEqual([
				'0x742d35Cc6634C0532925a3b844Bc9e7595f62a3C',
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
				output: ['hashedRecipient', 'scaledAmount']
			}

			const result = await executor.execute(processor, mockClaim)

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
				output: ['timestamp']
			}

			const result = await executor.execute(processor, mockClaim)

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
				output: ['fullAmount']
			}

			const result = await executor.execute(processor, claimWithSplitAmount)

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
				output: ['fullAmount']
			}

			const result = await executor.execute(processor, claimWithSplitAmount)

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
							{ type: 'validate', condition: { matches: '^[0-9]+\\.?[0-9]*$' }, message: 'Invalid amount format' }
						]
					},
					validatedStatus: {
						input: 'status',
						ops: [
							{ type: 'assertEquals', expected: 'completed', message: 'Payment must be completed' }
						]
					}
				},
				output: ['validatedAmount', 'validatedStatus']
			}

			const result = await executor.execute(processor, mockClaim)
			expect(result.values).toEqual(['150.50', 'completed'])
		})

		it('should use default values', async() => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					missingField: {
						path: '$.context.extractedParameters.nonExistent',
						default: 'defaultValue'
					}
				},
				output: ['missingField']
			}

			const result = await executor.execute(processor, mockClaim)
			expect(result.values).toEqual(['defaultValue'])
		})

		it('should handle regex extraction', async() => {
			const claimWithHtml: ProviderClaimData = {
				...mockClaim,
				context: JSON.stringify({
					...JSON.parse(mockClaim.context),
					extractedParameters: {
						htmlContent: 'The amount is $42.50 USD'
					}
				})
			}

			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: {
						path: '$.context.extractedParameters.htmlContent',
						regex: '\\$([0-9]+\\.[0-9]+)',
						regexGroup: 1
					}
				},
				output: ['amount']
			}

			const result = await executor.execute(processor, claimWithHtml)
			expect(result.values).toEqual(['42.50'])
		})
	})

	describe('Processor Hashing', () => {
		it('should generate consistent hashes', () => {
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				output: ['amount']
			}

			const hash1 = hashDeclarativeProcessor(processor)
			const hash2 = hashDeclarativeProcessor(processor)

			expect(hash1).toBe(hash2)
			expect(hash1).toMatch(/^0x[a-f0-9]{64}$/)
		})

		it('should generate different hashes for different processors', () => {
			const processor1: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount'
				},
				output: ['amount']
			}

			const processor2: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount',
					sender: '$.context.extractedParameters.senderId'
				},
				output: ['amount', 'sender']
			}

			const hash1 = hashDeclarativeProcessor(processor1)
			const hash2 = hashDeclarativeProcessor(processor2)

			expect(hash1).not.toBe(hash2)
		})
	})
})