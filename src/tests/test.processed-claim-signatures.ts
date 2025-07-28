import { describe, expect, it } from '@jest/globals'
import { utils, Wallet } from 'ethers'
import { ServiceSignatureType } from 'src/proto/api'
import { ProcessedClaimData } from 'src/types/declarative-processor'
import { canonicalStringify } from 'src/utils'
import { SIGNATURES } from 'src/utils/signatures'

describe('Processed Claim Signatures', () => {
	const algorithm = SIGNATURES[ServiceSignatureType.SERVICE_SIGNATURE_TYPE_ETH]

	describe('signature generation and verification', () => {
		it('should sign and verify processed claim data', async() => {
			const wallet = Wallet.createRandom()
			const privateKey = wallet.privateKey

			// Create sample processed claim data
			const processedData: Omit<ProcessedClaimData, 'signature' | 'attestorAddress'> = {
				claimId: 'claim_12345',
				values: ['0x123', 'test-message', '42', 'http', '1234567890'],
				processorProviderHash: '0xabcdef123456789',
				provider: 'http'
			}

			// Create the data structure to sign
			const dataToSign = {
				claimId: processedData.claimId,
				processorProviderHash: processedData.processorProviderHash,
				values: processedData.values
			}

			// Sign the data
			const signData = canonicalStringify(dataToSign)
			const signature = await algorithm.sign(
				Buffer.from(signData, 'utf8'),
				privateKey
			)

			// Get attestor address
			const publicKey = utils.arrayify(wallet.publicKey)
			const attestorAddress = algorithm.getAddress(publicKey)

			// Verify the signature
			const isValid = await algorithm.verify(
				Buffer.from(signData, 'utf8'),
				signature,
				attestorAddress
			)

			expect(isValid).toBe(true)
		})

		it('should fail verification with wrong values', async() => {
			const wallet = Wallet.createRandom()
			const privateKey = wallet.privateKey

			// Original data
			const originalData = {
				claimId: 'claim_123',
				processorProviderHash: '0xhash123',
				values: ['value1', 'value2']
			}

			// Sign original data
			const signature = await algorithm.sign(
				Buffer.from(canonicalStringify(originalData), 'utf8'),
				privateKey
			)

			// Modify data
			const modifiedData = {
				claimId: 'claim_123',
				processorProviderHash: '0xhash123',
				values: ['value1', 'value3'] // Changed value
			}

			// Try to verify with modified data
			const publicKey = utils.arrayify(wallet.publicKey)
			const attestorAddress = algorithm.getAddress(publicKey)

			const isValid = await algorithm.verify(
				Buffer.from(canonicalStringify(modifiedData), 'utf8'),
				signature,
				attestorAddress
			)

			expect(isValid).toBe(false)
		})

		it('should fail verification with different processor-provider hash', async() => {
			const wallet = Wallet.createRandom()
			const privateKey = wallet.privateKey

			// Original data
			const originalData = {
				claimId: 'claim_123',
				processorProviderHash: '0xhash123',
				values: ['value1', 'value2']
			}

			// Sign original data
			const signature = await algorithm.sign(
				Buffer.from(canonicalStringify(originalData), 'utf8'),
				privateKey
			)

			// Modify processor-provider hash
			const modifiedData = {
				claimId: 'claim_123',
				processorProviderHash: '0xhash456', // Changed hash
				values: ['value1', 'value2']
			}

			// Try to verify with modified data
			const publicKey = utils.arrayify(wallet.publicKey)
			const attestorAddress = algorithm.getAddress(publicKey)

			const isValid = await algorithm.verify(
				Buffer.from(canonicalStringify(modifiedData), 'utf8'),
				signature,
				attestorAddress
			)

			expect(isValid).toBe(false)
		})

		it('should ensure canonical ordering of signed data', async() => {
			const wallet = Wallet.createRandom()
			const privateKey = wallet.privateKey

			// Create data with properties in different orders
			const data1 = {
				values: ['a', 'b', 'c'],
				processorProviderHash: '0xhash',
				claimId: 'claim_1'
			}

			const data2 = {
				claimId: 'claim_1',
				processorProviderHash: '0xhash',
				values: ['a', 'b', 'c']
			}

			// Both should produce the same signature
			const sig1 = await algorithm.sign(
				Buffer.from(canonicalStringify(data1), 'utf8'),
				privateKey
			)

			const sig2 = await algorithm.sign(
				Buffer.from(canonicalStringify(data2), 'utf8'),
				privateKey
			)

			expect(sig1).toEqual(sig2)
		})

		it('should handle array of different value types', async() => {
			const wallet = Wallet.createRandom()
			const privateKey = wallet.privateKey

			const dataWithMixedTypes = {
				claimId: 'claim_mixed',
				processorProviderHash: '0xhash',
				values: [
					'string value',
					'123', // number as string
					'true', // boolean as string
					'0xabcdef', // hex string
					'{"nested":"json"}' // JSON string
				]
			}

			// Should be able to sign and verify
			const signature = await algorithm.sign(
				Buffer.from(canonicalStringify(dataWithMixedTypes), 'utf8'),
				privateKey
			)

			const publicKey = utils.arrayify(wallet.publicKey)
			const attestorAddress = algorithm.getAddress(publicKey)

			const isValid = await algorithm.verify(
				Buffer.from(canonicalStringify(dataWithMixedTypes), 'utf8'),
				signature,
				attestorAddress
			)

			expect(isValid).toBe(true)
		})

		it('should produce consistent signatures for same data', async() => {
			const wallet = Wallet.createRandom()
			const privateKey = wallet.privateKey

			const data = {
				claimId: 'claim_consistent',
				processorProviderHash: '0xconsistent',
				values: ['consistent', 'test']
			}

			const signData = Buffer.from(canonicalStringify(data), 'utf8')

			// Sign multiple times
			const sig1 = await algorithm.sign(signData, privateKey)
			const sig2 = await algorithm.sign(signData, privateKey)

			// Signatures should be identical for same data
			expect(sig1).toEqual(sig2)
		})
	})

	describe('attestor address derivation', () => {
		it('should derive correct attestor address from signature', async() => {
			const wallet = Wallet.createRandom()
			const expectedAddress = wallet.address.toLowerCase()

			const publicKey = utils.arrayify(wallet.publicKey)
			const derivedAddress = algorithm.getAddress(publicKey)

			expect(derivedAddress.toLowerCase()).toBe(expectedAddress)
		})
	})
})