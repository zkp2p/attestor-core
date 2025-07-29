import { utils } from 'ethers'
import { DeclarativeProcessor, OutputSpec } from 'src/types/declarative-processor'
import { canonicalStringify } from 'src/utils/claims'

/**
 * Convert string to Uint8Array
 */
function strToUint8Array(str: string): Uint8Array {
	return new TextEncoder().encode(str)
}

/**
 * Creates a single hash that binds a processor to a specific provider
 * This prevents cross-provider attacks by ensuring processors can only
 * be used with their intended provider types
 *
 * This hash is NOT user-specific, allowing smart contracts to maintain
 * a simple whitelist of approved processor-provider pairs
 *
 * @param providerHash Hash of the provider template/schema
 * @param processor The declarative processor
 * @returns Single hash binding processor to provider
 */
export function createProcessorProviderHash(
	providerHash: string,
	processor: DeclarativeProcessor
): string {
	const processorStr = canonicalStringify(processor)
	const processorHash = utils.keccak256(strToUint8Array(processorStr)).toLowerCase()
	const compositeStr = `${providerHash}\n${processorHash}`

	return utils.keccak256(
		strToUint8Array(compositeStr)
	).toLowerCase()
}

/**
 * Creates the data structure for signing processed claims
 * Includes all necessary fields to prevent tampering
 *
 * @param params Parameters for creating signed data
 * @returns Object ready for canonical stringification and signing
 */
export function createProcessedClaimSignData(params: {
	claimId: string
	processorProviderHash: string
	values: (string | number | boolean)[]
}) {
	return {
		claimId: params.claimId,

		processorProviderHash: params.processorProviderHash,

		values: params.values
	}
}

/**
 * Encodes values with ABI encoding and returns keccak256 hash
 * Encodes values as a single array with processorProviderHash at index 0
 * Uses ABI encoding and keccak256 for efficient on-chain verification
 *
 * @param params Parameters for encoding and hashing
 * @returns Keccak256 hash of ABI-encoded data
 */
export function encodeAndHash(params: {
	processorProviderHash: string
	values: any[]
	outputs: OutputSpec[]
}): string {
	// Extract EVM types from outputs
	const evmTypes = params.outputs.map(output => output.type)

	// Create combined array with processorProviderHash at index 0
	const combinedValues = [params.processorProviderHash, ...params.values]

	// Create combined types array with bytes32 at index 0 for the hash
	const combinedTypes = ['bytes32', ...evmTypes]

	// ABI encode the data as a single array
	const encoded = utils.defaultAbiCoder.encode(
		combinedTypes,
		combinedValues
	)

	// Return keccak256 hash
	return utils.keccak256(encoded)
}

