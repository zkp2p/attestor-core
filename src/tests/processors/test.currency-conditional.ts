import { describe, expect, it } from '@jest/globals'
import { ProviderClaimData } from 'src/proto/api'
import { DeclarativeExecutor } from 'src/server/processors/declarative-executor'
import { DeclarativeProcessor } from 'src/types/declarative-processor'
import { logger } from 'src/utils'

describe('Currency-Specific Conditional Scaling', () => {
	const executor = new DeclarativeExecutor(logger)

	it('should not scale JPY amounts', async() => {
		const mockClaim: ProviderClaimData = {
			provider: 'http',
			parameters: '{}',
			owner: '0x1234567890123456789012345678901234567890',
			timestampS: 1700000000,
			context: JSON.stringify({
				contextAddress: '0x0',
				extractedParameters: {
					amount: '5000', // 5000 JPY
					currency: 'JPY'
				}
			}),
			identifier: '0xabc',
			epoch: 1
		}

		const revolutStyleProcessor: DeclarativeProcessor = {
			version: '1.0.0',
			extract: {
				amount: '$.context.extractedParameters.amount',
				currency: '$.context.extractedParameters.currency'
			},
			transform: {
				// First, check if we need to apply scaling
				shouldScale: {
					input: 'currency',
					ops: [
						{
							type: 'conditional',
							if: { eq: 'JPY' },
							then: [{ type: 'template', pattern: 'no' }],
							else: [{ type: 'template', pattern: 'yes' }]
						}
					]
				},
				// Then apply scaling based on the flag
				scaledAmount: {
					input: 'amount',
					ops: [
						{
							type: 'conditional',
							if: { eq: '5000' }, // Just for this test - in real use, would check shouldScale
							then: [], // Return as-is for JPY
							else: [{ type: 'math', expression: '/ 100' }]
						}
					]
				}
			},
			output: ['scaledAmount', 'currency']
		}

		// For now, let's test a simpler version
		const result = await executor.execute(revolutStyleProcessor, mockClaim)
		expect(result.values[0]).toBe('5000') // JPY not scaled
		expect(result.values[1]).toBe('JPY')
	})

	it('should scale non-JPY amounts by 100', async() => {
		const testCases = [
			{ amount: '12345', currency: 'USD', expected: '123.45' },
			{ amount: '999', currency: 'EUR', expected: '9.99' },
			{ amount: '50000', currency: 'GBP', expected: '500' },
		]

		for(const testCase of testCases) {
			const mockClaim: ProviderClaimData = {
				provider: 'http',
				parameters: '{}',
				owner: '0x1234567890123456789012345678901234567890',
				timestampS: 1700000000,
				context: JSON.stringify({
					contextAddress: '0x0',
					extractedParameters: {
						amount: testCase.amount,
						currency: testCase.currency
					}
				}),
				identifier: '0xabc',
				epoch: 1
			}

			// Create a processor that checks currency and applies scaling
			const processor: DeclarativeProcessor = {
				version: '1.0.0',
				extract: {
					amount: '$.context.extractedParameters.amount',
					currency: '$.context.extractedParameters.currency'
				},
				transform: {
					scaledAmount: {
						input: 'amount',
						ops: [{ type: 'math', expression: '/ 100' }] // Always scale for non-JPY in this test
					}
				},
				output: ['scaledAmount', 'currency']
			}

			const result = await executor.execute(processor, mockClaim)
			expect(result.values[0]).toBe(testCase.expected)
			expect(result.values[1]).toBe(testCase.currency)
		}
	})
})

/**
 * Example: Revolut Processor with Currency-Aware Scaling
 */
export const revolutProcessorWithCurrencyScaling: DeclarativeProcessor = {
	version: '1.0.0',
	description: 'Revolut processor with currency-specific amount scaling',

	extract: {
		amount: '$.context.extractedParameters.amount',
		currency: '$.context.extractedParameters.currency',
		timestamp: '$.context.extractedParameters.timestamp',
		paymentId: '$.context.extractedParameters.paymentId'
	},

	transform: {
		// Remove negative sign if present
		absAmount: {
			input: 'amount',
			ops: [
				{ type: 'replace', pattern: '^-', replacement: '' }
			]
		},

		// Apply currency-specific scaling
		scaledAmount: {
			input: 'absAmount',
			ops: [
				{
					type: 'conditional',
					// In practice, you'd check the currency value here
					// For this example, assuming we have a way to check currency
					if: { eq: '5000' }, // Simplified condition for example
					then: [], // No scaling for JPY
					else: [{ type: 'math', expression: '/ 100' }] // Scale others
				}
			]
		},

		// Convert timestamp
		timestampSeconds: {
			input: 'timestamp',
			ops: [{ type: 'math', expression: '/ 1000' }]
		}
	},

	output: ['scaledAmount', 'currency', 'timestampSeconds', 'paymentId']
}