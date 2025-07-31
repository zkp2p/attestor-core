import { beforeEach, describe, expect, it } from '@jest/globals'
import { utils, Wallet } from 'ethers'
import { ProviderClaimData, ServiceSignatureType } from 'src/proto/api'
import { canonicalStringify, encodeAndHash } from 'src/utils'
import { createProcessorProviderHash } from 'src/utils/processors/utils'
import { SIGNATURES } from 'src/utils/signatures'

describe('Processed Claim Signatures', () => {
	const algorithm = SIGNATURES[ServiceSignatureType.SERVICE_SIGNATURE_TYPE_ETH]

	describe('signature generation and verification', () => {
		it('should sign and verify processed claim data', async() => {
			const wallet = Wallet.createRandom()
			const privateKey = wallet.privateKey

			// Create sample processor
			const processor = {
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

	describe('Contract Simulation - Complete Verification Flow', () => {
		// Mock the server utils to use test wallet
		let testWallet: Wallet
		let testAttestorAddress: string

		beforeEach(() => {
			testWallet = Wallet.createRandom()
			testAttestorAddress = testWallet.address.toLowerCase()
		})

		it('should generate signatures that can be verified on-chain', async() => {
			// Create a mock claim with provider hash in context
			const mockClaim: ProviderClaimData = {
				provider: 'http',
				parameters: JSON.stringify({
					url: 'https://api.example.com/user',
					method: 'GET'
				}),
				owner: '0x742d35Cc6634C0532925a3b844Bc9e7595f62a3C',
				timestampS: 1705314600,
				context: JSON.stringify({
					extractedParameters: {
						userId: '12345',
						amount: '100.50',
						timestamp: '2024-01-15T10:30:00Z'
					},
					// This providerHash would normally come from the provider system
					providerHash: '0x' + 'a'.repeat(64) // Mock provider hash
				}),
				identifier: '0xabc123',
				epoch: 1
			}

			// Create a processor that extracts and transforms data
			const processor = {
				extract: {
					userId: '$.context.extractedParameters.userId',
					amount: '$.context.extractedParameters.amount'
				},
				transform: {
					amountInCents: {
						input: 'amount',
						ops: [{
							type: 'math',
							expression: '* 100' // Convert to cents
						}]
					},
					currency: {
						ops: [{
							type: 'constant',
							value: 'USD'
						}]
					}
				},
				outputs: [
					{ name: 'userId', type: 'uint256' },
					{ name: 'amountInCents', type: 'uint256' },
					{ name: 'currency', type: 'string' }
				]
			}

			// Simulate processing (normally done by Executor)
			const values = ['12345', '10050', 'USD']
			const providerHash = JSON.parse(mockClaim.context).providerHash
			const processorProviderHash = createProcessorProviderHash(
				providerHash,
				{ ...processor, version: '1.0.0' }
			)

			// Create the message hash
			const messageHash = encodeAndHash({
				processorProviderHash,
				values,
				outputs: processor.outputs
			})

			// Sign with test wallet
			const signature = await testWallet.signMessage(Buffer.from(messageHash.slice(2), 'hex'))

			// Verify the recovered address matches the attestor
			const recoveredAddress = utils.verifyMessage(Buffer.from(messageHash.slice(2), 'hex'), signature)
			expect(recoveredAddress.toLowerCase()).toBe(testAttestorAddress)
		})

		it('should verify signatures using the same method as smart contracts', async() => {
			const mockClaim: ProviderClaimData = {
				provider: 'venmo',
				parameters: JSON.stringify({
					profileId: 'alice-venmo'
				}),
				owner: '0x1234567890123456789012345678901234567890',
				timestampS: Math.floor(Date.now() / 1000),
				context: JSON.stringify({
					extractedParameters: {
						payment_id: 'pay_abc123', // eslint-disable-line camelcase
						sender: 'Bob Smith',
						receiver: 'Alice Johnson',
						amount: '25.00',
						currency: 'USD',
						note: 'Lunch money'
					},
					providerHash: '0x' + 'b'.repeat(64)
				}),
				identifier: '0xdef456',
				epoch: 2
			}

			const processor = {
				extract: {
					sender: '$.context.extractedParameters.sender',
					receiver: '$.context.extractedParameters.receiver',
					amount: '$.context.extractedParameters.amount'
				},
				transform: {
					amountInCents: {
						input: 'amount',
						ops: [{
							type: 'math',
							expression: '* 100'
						}]
					}
				},
				outputs: [
					{ name: 'sender', type: 'string' },
					{ name: 'receiver', type: 'string' },
					{ name: 'amountInCents', type: 'uint256' }
				]
			}

			// Simulate processed data
			const values = ['Bob Smith', 'Alice Johnson', '2500']
			const processorProviderHash = createProcessorProviderHash(
				JSON.parse(mockClaim.context).providerHash,
				{ ...processor, version: '1.0.0' }
			)

			// Smart contract verification steps:
			const contractInputs = {
				processorProviderHash,
				values,
				outputs: processor.outputs,
				signature: await testWallet.signMessage(Buffer.from(encodeAndHash({
					processorProviderHash,
					values,
					outputs: processor.outputs
				}).slice(2), 'hex')),
				expectedSigner: testWallet.address.toLowerCase()
			}

			// Contract recreates the message hash
			const recreatedHash = encodeAndHash({
				processorProviderHash: contractInputs.processorProviderHash,
				values: contractInputs.values,
				outputs: contractInputs.outputs
			})

			// Contract recovers signer from signature
			const recoveredSigner = utils.verifyMessage(
				Buffer.from(recreatedHash.slice(2), 'hex'),
				contractInputs.signature
			)

			// Contract verifies signer is authorized
			expect(recoveredSigner.toLowerCase()).toBe(contractInputs.expectedSigner)
		})

		it('should fail verification with tampered values', async() => {
			const processorProviderHash = '0x' + 'c'.repeat(64)
			const originalValues = ['100']
			const outputs = [{ name: 'value', type: 'uint256' }]

			// Create signature for original values
			const originalHash = encodeAndHash({ processorProviderHash, values: originalValues, outputs })
			const signature = await testWallet.signMessage(Buffer.from(originalHash.slice(2), 'hex'))

			// Try to verify with tampered values
			const tamperedValues = ['200'] // Changed from '100' to '200'
			const tamperedHash = encodeAndHash({ processorProviderHash, values: tamperedValues, outputs })

			// Recover signer with tampered hash
			const recoveredAddress = utils.verifyMessage(
				Buffer.from(tamperedHash.slice(2), 'hex'),
				signature
			)

			// The recovered address should NOT match because values were tampered
			expect(recoveredAddress.toLowerCase()).not.toBe(testWallet.address.toLowerCase())
		})

		it('should handle different EVM types correctly in signature', async() => {
			const processorProviderHash = '0x' + 'd'.repeat(64)
			const values = [
				'0x742d35cc6634c0532925a3b844bc9e7595f62a3c', // address (lowercase)
				'true', // bool
				'95', // uint8
				utils.keccak256(utils.toUtf8Bytes('Hello World')) // bytes32
			]
			const outputs = [
				{ name: 'userAddress', type: 'address' },
				{ name: 'isActive', type: 'bool' },
				{ name: 'score', type: 'uint8' },
				{ name: 'hashedData', type: 'bytes32' }
			]

			// Create signature
			const messageHash = encodeAndHash({ processorProviderHash, values, outputs })
			const signature = await testWallet.signMessage(Buffer.from(messageHash.slice(2), 'hex'))

			// Verify signature
			const recoveredAddress = utils.verifyMessage(
				Buffer.from(messageHash.slice(2), 'hex'),
				signature
			)

			expect(recoveredAddress.toLowerCase()).toBe(testWallet.address.toLowerCase())

			// Also verify the ABI encoding is correct by decoding
			const encoded = utils.defaultAbiCoder.encode(
				['bytes32', 'address', 'bool', 'uint8', 'bytes32'],
				[processorProviderHash, ...values]
			)

			const decoded = utils.defaultAbiCoder.decode(
				['bytes32', 'address', 'bool', 'uint8', 'bytes32'],
				encoded
			)

			expect(decoded[0]).toBe(processorProviderHash)
			expect(decoded[1].toLowerCase()).toBe(values[0].toLowerCase())
			expect(decoded[2]).toBe(true) // 'true' string converts to boolean true
			expect(decoded[3]).toBe(95) // '95' string converts to number 95
			expect(decoded[4]).toBe(values[3]) // keccak256 hash
		})

		it('should demonstrate complete contract verification flow', async() => {
			// This test shows the complete flow from claim creation to contract verification
			// mimicking what would happen in a real smart contract

			// 1. User creates a claim with specific data
			const userClaim: ProviderClaimData = {
				provider: 'twitter',
				parameters: JSON.stringify({
					username: 'alice_twitter'
				}),
				owner: '0x0000000000000000000000000000000000000002',
				timestampS: Math.floor(Date.now() / 1000),
				context: JSON.stringify({
					extractedParameters: {
						username: 'alice_twitter',
						followers: '1500',
						verified: 'true',
						created_at: '2020-01-15' // eslint-disable-line camelcase
					},
					providerHash: '0x' + 'e'.repeat(64)
				}),
				identifier: '0xaaa111',
				epoch: 5
			}

			// 2. Smart contract defines expected processor
			const contractProcessor = {
				extract: {
					username: '$.context.extractedParameters.username',
					followers: '$.context.extractedParameters.followers',
					verified: '$.context.extractedParameters.verified'
				},
				transform: {
					hasMinFollowers: {
						input: 'followers',
						ops: [{
							type: 'validate',
							condition: { gte: 1000 },
							message: 'Must have at least 1000 followers'
						}]
					}
				},
				outputs: [
					{ name: 'username', type: 'string' },
					{ name: 'followers', type: 'uint256' },
					{ name: 'verified', type: 'bool' }
				]
			}

			// 3. Attestor processes the claim (simulated)
			const attestationValues = ['alice_twitter', '1500', 'true']
			const processorProviderHash = createProcessorProviderHash(
				JSON.parse(userClaim.context).providerHash,
				{ ...contractProcessor, version: '1.0.0' }
			)

			// 4. User submits to smart contract
			const onChainSubmission = {
				processorProviderHash,
				values: attestationValues,
				outputs: contractProcessor.outputs,
				signature: await testWallet.signMessage(
					Buffer.from(encodeAndHash({
						processorProviderHash,
						values: attestationValues,
						outputs: contractProcessor.outputs
					}).slice(2), 'hex')
				),
				attestor: testWallet.address.toLowerCase()
			}

			// 5. Smart contract verification logic
			const contractMessageHash = encodeAndHash({
				processorProviderHash: onChainSubmission.processorProviderHash,
				values: onChainSubmission.values,
				outputs: onChainSubmission.outputs
			})

			const contractRecoveredSigner = utils.verifyMessage(
				Buffer.from(contractMessageHash.slice(2), 'hex'),
				onChainSubmission.signature
			)

			// Verify signer is whitelisted attestor
			expect(contractRecoveredSigner.toLowerCase()).toBe(onChainSubmission.attestor)

			// Decode and use the values
			const [username, followers, verified] = onChainSubmission.values
			expect(username).toBe('alice_twitter')
			expect(parseInt(followers)).toBeGreaterThanOrEqual(1000)
			expect(verified).toBe('true')
		})
	})
})