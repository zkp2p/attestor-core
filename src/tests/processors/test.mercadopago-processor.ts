import { describe, expect, it } from '@jest/globals'
import { ProviderClaimData } from 'src/proto/api'
import { DeclarativeExecutor } from 'src/server/processors/declarative-executor'
import { DeclarativeProcessor } from 'src/types/declarative-processor'
import { logger } from 'src/utils'

const mercadoPagoProcessor: DeclarativeProcessor = {
	version: '1.0.0',
	description: 'Process MercadoPago QR payments',

	extract: {
		contextAddress: '$.context.contextAddress',
		amt: '$.context.extractedParameters.amt',
		cents: '$.context.extractedParameters.cents',
		curr: '$.context.extractedParameters.curr',
		date: '$.context.extractedParameters.date',
		paymentId: '$.context.extractedParameters.paymentId',
		paymentStatus: '$.context.extractedParameters.paymentStatus',
		paymentType: '$.context.extractedParameters.paymentType',
		recipientId: '$.context.extractedParameters.recipientId',
		providerHash: '$.context.providerHash'
	},

	transform: {
		scaledAmount: {
			inputs: ['amt', 'cents'],
			ops: ['concat']
		},

		timestamp: {
			input: 'date',
			ops: [
				'parseTimestamp',
				'toUnixSeconds'
			]
		},

		hashedRecipient: {
			input: 'recipientId',
			ops: ['keccak256']
		},

		validatedStatus: {
			input: 'paymentStatus',
			ops: [
				{ type: 'assertEquals', expected: 'approved', message: 'Payment must be approved' }
			]
		}
	},

	output: ['contextAddress', 'scaledAmount', 'curr', 'timestamp', 'paymentId', 'paymentStatus', 'paymentType', 'hashedRecipient', 'providerHash']
}

describe('MercadoPago Processor', () => {
	const executor = new DeclarativeExecutor(logger)

	it('should process MercadoPago payment with concatenated amount', async() => {
		const mockClaim: ProviderClaimData = {
			provider: 'http',
			parameters: JSON.stringify({
				url: 'https://www.mercadopago.com.ar/activities/detail/online_transfer_movement-40397c71e99fb3afceeed91664536aa631484ceb?from=mp-home',
				method: 'GET'
			}),
			owner: '0xf9f25d1b846625674901ace47d6313d1ac795265',
			timestampS: 1742588826,
			context: JSON.stringify({
				contextAddress: '0x0',
				contextMessage: '4519540906848171844380991692694776058038564615875128315222420248570560176998',
				extractedParameters: {
					PAYMENT_ID: 'online_transfer_movement-40397c71e99fb3afceeed91664536aa631484ceb',
					URL_PARAMS_FROM: 'mp-home',
					amt: '1',
					cents: '00',
					curr: 'ARS',
					date: '2025-03-21T19:54:05.000Z',
					paymentId: '105936159704',
					paymentStatus: 'approved',
					paymentType: 'transfer_online',
					recipientId: '0xf5b16d9e4edde5a51d378b8126eaffb65d0d06d0ad21f4d037611f945d3837e8'
				},
				providerHash: '0x09ff1db71c6ed6f079954a9cd5539cacf65cd3cf3c76b3c3c33ebfc4e5c0f7ee'
			}),
			identifier: '0x7f0945b665233c542c5988c363df654482ce1ef27e082e434cc2edf8d620279d',
			epoch: 1
		}

		const result = await executor.execute(mercadoPagoProcessor, mockClaim)

		expect(result.values[1]).toBe('100') // "1" + "00" = "100" (representing $1.00)

		expect(result.values[0]).toBe('0x0') // contextAddress
		expect(result.values[2]).toBe('ARS') // currencyCode
		expect(result.values[3]).toBe('1742586845') // Unix timestamp for 2025-03-21T19:54:05.000Z
		expect(result.values[4]).toBe('105936159704') // paymentId
		expect(result.values[5]).toBe('approved') // paymentStatus
		expect(result.values[6]).toBe('transfer_online') // paymentType
		expect(result.values[7]).toMatch(/^0x[a-f0-9]{64}$/) // hashedRecipient
		expect(result.values[8]).toBe('0x09ff1db71c6ed6f079954a9cd5539cacf65cd3cf3c76b3c3c33ebfc4e5c0f7ee') // providerHash
	})

	it('should handle different amount combinations', async() => {
		const testCases = [
			{ amt: '123', cents: '45', expected: '12345' },
			{ amt: '0', cents: '99', expected: '099' },
			{ amt: '1000', cents: '00', expected: '100000' },
			{ amt: '9', cents: '05', expected: '905' },
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
						amt: testCase.amt,
						cents: testCase.cents,
						curr: 'ARS',
						date: '2024-01-01T00:00:00Z',
						paymentId: '123456',
						paymentStatus: 'approved',
						paymentType: 'transfer_online',
						recipientId: '0x123'
					},
					providerHash: '0xabc'
				}),
				identifier: '0xdef',
				epoch: 1
			}

			const result = await executor.execute(mercadoPagoProcessor, mockClaim)
			expect(result.values[1]).toBe(testCase.expected)
		}
	})
})