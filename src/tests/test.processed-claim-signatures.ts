import { describe, expect, it } from '@jest/globals'
import { utils, Wallet } from 'ethers'
import { ServiceSignatureType } from 'src/proto/api'
import { canonicalStringify, encodeAndHash } from 'src/utils'
import { SIGNATURES } from 'src/utils/signatures'

describe('Processed Claim Signatures', () => {
	const algorithm = SIGNATURES[ServiceSignatureType.SERVICE_SIGNATURE_TYPE_ETH]

	describe('signature generation and verification', () => {
		it('should sign and verify processed claim data', async() => {
			const wallet = Wallet.createRandom()
			const privateKey = wallet.privateKey

			// Create sample processor
			const processor = {
				version: '1.0.0' as const,
				extract: {
					address: '$.context.address',
					message: '$.context.message',
					amount: '$.context.amount',
					isActive: '$.context.isActive',
					timestamp: '$.context.timestamp'
				},
				outputs: [
					{ name: 'address', type: 'address' },
					{ name: 'message', type: 'string' },
					{ name: 'amount', type: 'uint256' },
					{ name: 'isActive', type: 'bool' },
					{ name: 'timestamp', type: 'uint256' }
				]
			}

			const values = ['0x742d35cc6634c0532925a3b844bc9e7595f62a3c', 'test-message', '42', true, '1234567890']
			const processorProviderHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

			// Create EVM-compatible hash
			const messageHash = encodeAndHash({
				processorProviderHash,
				values,
				outputs: processor.outputs
			})

			// Sign with personal message prefix for safety
			const signature = await algorithm.sign(
				Buffer.from(messageHash.slice(2), 'hex'),
				privateKey
			)

			// Get attestor address
			const publicKey = utils.arrayify(wallet.publicKey)
			const attestorAddress = algorithm.getAddress(publicKey)

			// Verify the signature
			const isValid = await algorithm.verify(
				Buffer.from(messageHash.slice(2), 'hex'),
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

	describe('smart contract friendly hash signatures', () => {
		it('should create correct ABI-encoded hash', () => {
			const processorProviderHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
			const values = ['value1', '123', 'true']
			const evmTypes = ['string', 'uint256', 'bool']
			const outputs = evmTypes.map((type, i) => ({
				name: `value${i}`,
				type
			}))

			const hash = encodeAndHash({
				processorProviderHash,
				values,
				outputs
			})

			// Should be a valid hex string
			expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/)

			// Should be deterministic
			const hash2 = encodeAndHash({
				processorProviderHash,
				values,
				outputs
			})
			expect(hash).toBe(hash2)
		})

		it('should sign and verify hash without personal message prefix', async() => {
			const wallet = Wallet.createRandom()
			const privateKey = wallet.privateKey

			const processorProviderHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
			const values = ['payment', '1000', 'completed']
			const evmTypes = ['string', 'uint256', 'string']
			const outputs = evmTypes.map((type, i) => ({
				name: `value${i}`,
				type
			}))

			const hash = encodeAndHash({
				processorProviderHash,
				values,
				outputs
			})

			// Sign with personal message prefix
			const signature = await algorithm.sign(Buffer.from(hash.slice(2), 'hex'), privateKey)

			// Get attestor address
			const publicKey = utils.arrayify(wallet.publicKey)
			const attestorAddress = algorithm.getAddress(publicKey)

			// Verify the signature
			const isValid = await algorithm.verify(Buffer.from(hash.slice(2), 'hex'), signature, attestorAddress)

			expect(isValid).toBe(true)
		})

		it('should fail hash verification with tampered values', async() => {
			const wallet = Wallet.createRandom()
			const privateKey = wallet.privateKey

			const processorProviderHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
			const values = ['payment', '1000', 'completed']
			const evmTypes = ['string', 'uint256', 'string']
			const outputs = evmTypes.map((type, i) => ({
				name: `value${i}`,
				type
			}))

			const hash = encodeAndHash({
				processorProviderHash,
				values,
				outputs
			})
			const signature = await algorithm.sign(Buffer.from(hash.slice(2), 'hex'), privateKey)

			// Modify data
			const tamperedValues = ['payment', '2000', 'completed'] // Changed amount

			const tamperedHash = encodeAndHash({
				processorProviderHash,
				values: tamperedValues,
				outputs
			})

			const publicKey = utils.arrayify(wallet.publicKey)
			const attestorAddress = algorithm.getAddress(publicKey)

			// Verify with tampered hash should fail
			const isValid = await algorithm.verify(Buffer.from(tamperedHash.slice(2), 'hex'), signature, attestorAddress)

			expect(isValid).toBe(false)
		})

		it('should be recoverable on-chain', async() => {
			const wallet = Wallet.createRandom()
			const privateKey = wallet.privateKey

			const processorProviderHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
			const values = ['transfer', '500', 'user123']
			const evmTypes = ['string', 'uint256', 'string']
			const outputs = evmTypes.map((type, i) => ({
				name: `value${i}`,
				type
			}))

			const hash = encodeAndHash({
				processorProviderHash,
				values,
				outputs
			})
			const signature = await algorithm.sign(Buffer.from(hash.slice(2), 'hex'), privateKey)

			// Recover address from signature (simulating on-chain recovery)
			// Note: On-chain, you would use ECDSA.recover with toEthSignedMessageHash
			const recoveredAddress = utils.verifyMessage(Buffer.from(hash.slice(2), 'hex'), signature)

			expect(recoveredAddress.toLowerCase()).toBe(wallet.address.toLowerCase())
		})

		it('should handle different value types consistently', () => {
			const data1 = {
				claimId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
				processorProviderHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
				values: ['string', 123, true, false] // Mixed types
			}

			const data2 = {
				claimId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
				processorProviderHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
				values: ['string', '123', 'true', 'false'] // All as strings
			}

			// Convert mixed types to strings for consistent hashing
			const stringOutputs = ['string', 'string', 'string', 'string'].map((type, i) => ({
				name: `value${i}`,
				type
			}))
			const hash1 = encodeAndHash({
				processorProviderHash: data1.processorProviderHash,
				values: data1.values.map(v => String(v)),
				outputs: stringOutputs
			})
			const hash2 = encodeAndHash({
				processorProviderHash: data2.processorProviderHash,
				values: data2.values,
				outputs: stringOutputs
			})

			// Should be the same since values are converted to strings
			expect(hash1).toBe(hash2)
		})

	})

	describe('EVM Smart Contract Signature Verification', () => {
		it('should create signatures verifiable on-chain', async() => {
			const wallet = Wallet.createRandom()
			const privateKey = wallet.privateKey

			// Sample data that would be submitted on-chain
			const processorProviderHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
			const values = [
				'0x742d35cc6634c0532925a3b844bc9e7595f62a3c', // address (as string)
				'150500000000000000000', // uint256 (as string)
				'true', // bool (as string - ABI encoder will convert)
				'0x4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123' // bytes32
			]
			const evmTypes = ['address', 'uint256', 'bool', 'bytes32']

			// Create the hash as the smart contract would
			const outputs = evmTypes.map((type, i) => ({
				name: `value${i}`,
				type
			}))
			const messageHash = encodeAndHash({
				processorProviderHash,
				values,
				outputs
			})

			// Sign with personal message prefix
			const signature = await algorithm.sign(Buffer.from(messageHash.slice(2), 'hex'), privateKey)

			// Verify the signature can be recovered
			const signerAddress = algorithm.getAddress(utils.arrayify(wallet.publicKey))
			const isValid = await algorithm.verify(Buffer.from(messageHash.slice(2), 'hex'), signature, signerAddress)
			expect(isValid).toBe(true)

			// Show how this would be verified on-chain
			// The smart contract would:
			// 1. Recreate the same messageHash from the values
			// 2. Apply toEthSignedMessageHash() to add personal message prefix
			// 3. Use ECDSA.recover() to get the signer address
			// 4. Check the signer is an authorized attestor

			// Example using OpenZeppelin's ECDSA library:
			// bytes32 hash = keccak256(abi.encode(processorProviderHash, values...));
			// bytes32 ethSignedHash = ECDSA.toEthSignedMessageHash(hash);
			// address signer = ECDSA.recover(ethSignedHash, signature);
			// require(authorizedAttestors[signer], "Invalid attestor");

			// Verify we can recover the address like on-chain would
			const recoveredAddress = utils.verifyMessage(Buffer.from(messageHash.slice(2), 'hex'), signature)
			expect(recoveredAddress.toLowerCase()).toBe(signerAddress.toLowerCase())

			console.log('Smart Contract Verification Example:')
			console.log('Message Hash:', messageHash)
			console.log('Signature:', utils.hexlify(signature))
			console.log('Signer:', signerAddress)
		})

		it('should encode array with processorProviderHash at index 0', async() => {
			const processorProviderHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
			const values = ['user123', '1000', '0x742d35cc6634c0532925a3b844bc9e7595f62a3c']
			const evmTypes = ['string', 'uint256', 'address']

			const outputs = evmTypes.map((type, i) => ({
				name: `value${i}`,
				type
			}))
			const messageHash = encodeAndHash({
				processorProviderHash,
				values,
				outputs
			})

			// Verify the encoding matches what we expect
			const expectedEncoding = utils.defaultAbiCoder.encode(
				['bytes32', 'string', 'uint256', 'address'],
				[processorProviderHash, ...values]
			)
			const expectedHash = utils.keccak256(expectedEncoding)

			expect(messageHash).toBe(expectedHash)

			// The combined array for on-chain verification would be:
			// [processorProviderHash, ...values]
			// With types: ['bytes32', ...evmTypes]
		})

		it('should handle different EVM type conversions', async() => {
			const wallet = Wallet.createRandom()
			const processorProviderHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

			// Test various EVM types
			const testCases = [
				{
					values: ['42'],
					evmTypes: ['uint256'],
					description: 'uint256'
				},
				{
					values: ['0x742d35cc6634c0532925a3b844bc9e7595f62a3c'],
					evmTypes: ['address'],
					description: 'address'
				},
				{
					values: [true, false],
					evmTypes: ['bool', 'bool'],
					description: 'booleans'
				},
				{
					values: ['Hello World'],
					evmTypes: ['string'],
					description: 'string'
				},
				{
					values: ['0x48656c6c6f20576f726c64'],
					evmTypes: ['bytes'],
					description: 'dynamic bytes'
				}
			]

			for(const testCase of testCases) {
				const outputs = testCase.evmTypes.map((type, i) => ({
					name: `value${i}`,
					type
				}))
				const messageHash = encodeAndHash({
					processorProviderHash,
					values: testCase.values,
					outputs
				})

				const signature = await algorithm.sign(Buffer.from(messageHash.slice(2), 'hex'), wallet.privateKey)
				const signerAddress = algorithm.getAddress(utils.arrayify(wallet.publicKey))
				const isValid = await algorithm.verify(Buffer.from(messageHash.slice(2), 'hex'), signature, signerAddress)

				expect(isValid).toBe(true)
				console.log(`✓ ${testCase.description}: ${messageHash}`)
			}
		})
	})
})