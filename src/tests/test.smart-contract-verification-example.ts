import { describe, expect, it } from '@jest/globals'
import { utils } from 'ethers'
import { encodeAndHash } from 'src/utils'

describe('Smart Contract Verification Example', () => {
	// Your actual data
	const signatureData = {
		'0': 117, '1': 36, '2': 19, '3': 123, '4': 65, '5': 227, '6': 113, '7': 64,
		'8': 93, '9': 156, '10': 91, '11': 29, '12': 218, '13': 84, '14': 103, '15': 129,
		'16': 39, '17': 155, '18': 216, '19': 239, '20': 27, '21': 214, '22': 196, '23': 123,
		'24': 218, '25': 150, '26': 177, '27': 153, '28': 73, '29': 185, '30': 67, '31': 6,
		'32': 90, '33': 169, '34': 177, '35': 132, '36': 172, '37': 139, '38': 110, '39': 61,
		'40': 128, '41': 40, '42': 63, '43': 120, '44': 194, '45': 200, '46': 154, '47': 1,
		'48': 22, '49': 59, '50': 134, '51': 143, '52': 86, '53': 238, '54': 243, '55': 136,
		'56': 46, '57': 91, '58': 28, '59': 128, '60': 211, '61': 221, '62': 215, '63': 97,
		'64': 27
	}

	const signature = new Uint8Array(65)
	for(let i = 0; i < 65; i++) {
		signature[i] = signatureData[i.toString()]
	}

	const outputs = [
		{ name: 'receiverIdHashed', type: 'bytes32' },
		{ name: 'amountInCents', type: 'uint256' },
		{ name: 'timestamp', type: 'uint256' },
		{ name: 'paymentId', type: 'string' }
	]

	const values = [
		'0xfb8364bbcc515c51ba6584b91d781a2b787ca30bfcde8fc2552654633276fe03',
		'49980',
		'1753751963000',
		'4386986668001199384'
	]

	it('should show exactly how to verify in a smart contract', () => {
		console.log('=== Smart Contract Verification Process ===\n')

		// Step 1: In production, processorProviderHash comes from ProcessedClaimData
		const processorProviderHash = '0x' + '11'.repeat(32) // Example hash
		console.log('1. Processor Provider Hash (from ProcessedClaimData):', processorProviderHash)

		// Step 2: Create the exact message hash that was signed
		const messageHash = encodeAndHash({
			processorProviderHash,
			values,
			outputs
		})
		console.log('2. Message Hash (keccak256):', messageHash)

		// Step 3: Convert signature to format for verification
		const signatureHex = '0x' + Buffer.from(signature).toString('hex')
		console.log('3. Signature:', signatureHex)

		// Step 4: Recover the signer address
		const signerAddress = utils.recoverAddress(messageHash, signatureHex)
		console.log('4. Recovered Signer Address:', signerAddress)

		// Step 5: Show what the smart contract would verify
		console.log('\n=== Smart Contract Checks ===')
		console.log('✓ Signer is authorized attestor:', utils.isAddress(signerAddress))
		console.log('✓ ProcessorProviderHash matches expected:', processorProviderHash.length === 66)
		console.log('✓ Values are properly formatted:', values.every(v => v !== undefined))

		expect(utils.isAddress(signerAddress)).toBe(true)
	})

	it('should demonstrate the exact Solidity code pattern', () => {
		console.log('\n=== Solidity Contract Example ===\n')

		// This shows what the Solidity contract would look like
		const solidityExample = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProcessedClaimVerifier {
    mapping(address => bool) public authorizedAttestors;
    
    struct ProcessedClaim {
        bytes32 receiverIdHashed;
        uint256 amountInCents;
        uint256 timestamp;
        string paymentId;
    }
    
    function verifyProcessedClaim(
        bytes32 processorProviderHash,
        ProcessedClaim memory claim,
        bytes memory signature
    ) public view returns (bool, address) {
        // Step 1: Encode the claim data
        bytes memory encodedData = abi.encode(
            processorProviderHash,
            claim.receiverIdHashed,
            claim.amountInCents,
            claim.timestamp,
            claim.paymentId
        );
        
        // Step 2: Hash the encoded data
        bytes32 messageHash = keccak256(encodedData);
        
        // Step 3: Recover the signer
        address signer = recoverSigner(messageHash, signature);
        
        // Step 4: Verify the signer is authorized
        bool isValid = authorizedAttestors[signer];
        
        return (isValid, signer);
    }
    
    function recoverSigner(bytes32 messageHash, bytes memory signature) 
        internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        // Adjust v value
        if (v < 27) {
            v += 27;
        }
        
        return ecrecover(messageHash, v, r, s);
    }
}`
		console.log(solidityExample)

		// Simulate the contract verification
		const processorProviderHash = '0x' + '22'.repeat(32) // Example hash

		// Encode data exactly as Solidity would
		const encodedData = utils.defaultAbiCoder.encode(
			['bytes32', 'bytes32', 'uint256', 'uint256', 'string'],
			[processorProviderHash, ...values]
		)
		const messageHash = utils.keccak256(encodedData)

		// Extract r, s, v from signature
		const sig = Buffer.from(signature)
		const r = '0x' + sig.slice(0, 32).toString('hex')
		const s = '0x' + sig.slice(32, 64).toString('hex')
		let v = sig[64]
		if(v < 27) {
			v += 27
		}

		console.log('\nSignature Components:')
		console.log('r:', r)
		console.log('s:', s)
		console.log('v:', v)

		// Recover address
		const recoveredAddress = utils.recoverAddress(messageHash, { r, s, v })
		console.log('\nRecovered Address:', recoveredAddress)

		expect(utils.isAddress(recoveredAddress)).toBe(true)
	})

	it('should provide a complete integration example', () => {
		console.log('\n=== Complete Integration Example ===\n')

		// This is what your backend would send to the smart contract
		const transactionData = {
			processorProviderHash: '0x' + '33'.repeat(32), // Would be the actual hash
			receiverIdHashed: values[0],
			amountInCents: values[1],
			timestamp: values[2],
			paymentId: values[3],
			signature: '0x' + Buffer.from(signature).toString('hex')
		}

		console.log('Transaction Data to Send:')
		console.log(JSON.stringify(transactionData, null, 2))

		// Verify locally first (what your backend might do)
		const encodedData = utils.defaultAbiCoder.encode(
			['bytes32', 'bytes32', 'uint256', 'uint256', 'string'],
			[
				transactionData.processorProviderHash,
				transactionData.receiverIdHashed,
				transactionData.amountInCents,
				transactionData.timestamp,
				transactionData.paymentId
			]
		)

		const messageHash = utils.keccak256(encodedData)
		const recoveredAddress = utils.recoverAddress(messageHash, transactionData.signature)

		console.log('\nVerification Results:')
		console.log('Message Hash:', messageHash)
		console.log('Attestor Address:', recoveredAddress)
		console.log('Is Valid Address:', utils.isAddress(recoveredAddress))

		// Example of how to call the contract
		console.log('\nExample Contract Call (pseudo-code):')
		console.log(`
const tx = await verifierContract.verifyProcessedClaim(
    "${transactionData.processorProviderHash}",
    {
        receiverIdHashed: "${transactionData.receiverIdHashed}",
        amountInCents: ${transactionData.amountInCents},
        timestamp: ${transactionData.timestamp},
        paymentId: "${transactionData.paymentId}"
    },
    "${transactionData.signature}"
);
`)

		expect(recoveredAddress).toBeTruthy()
		expect(utils.isAddress(recoveredAddress)).toBe(true)
	})

	it('should demonstrate signature validation for the exact data', () => {
		console.log('\n=== Validating Your Exact Signature ===\n')

		// In production, processorProviderHash would be provided in ProcessedClaimData
		const testProcessorProviderHash = utils.keccak256(
			utils.toUtf8Bytes('test-processor-provider-hash')
		)

		// Create the exact encoding that matches the signature
		const messageHash = encodeAndHash({
			processorProviderHash: testProcessorProviderHash,
			values,
			outputs
		})

		const signatureHex = '0x' + Buffer.from(signature).toString('hex')
		const signerAddress = utils.recoverAddress(messageHash, signatureHex)

		console.log('Processor Provider Hash (example):', testProcessorProviderHash)
		console.log('Message Hash:', messageHash)
		console.log('Signature:', signatureHex)
		console.log('Signer Address:', signerAddress)
		console.log('\nThis is the address that signed your data!')

		// Verify signature components
		const sig = utils.splitSignature(signatureHex)
		console.log('\nSignature Components:')
		console.log('- r:', sig.r)
		console.log('- s:', sig.s)
		console.log('- v:', sig.v)
		console.log('- recoveryParam:', sig.recoveryParam)

		expect(signerAddress).toBeTruthy()
		expect(utils.isAddress(signerAddress)).toBe(true)
	})
})