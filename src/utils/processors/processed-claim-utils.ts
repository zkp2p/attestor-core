import { utils } from 'ethers'
import { DeclarativeProcessor } from 'src/types/declarative-processor'
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
 * @param processorHash Hash of the processor function
 * @returns Single hash binding processor to provider
 */
export function createProcessorProviderHash(
	providerHash: string,
	processorHash: string
): string {
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
 * Creates a deterministic hash of a declarative processor
 * This ensures the same processor always produces the same hash
 *
 * @param processor The declarative processor to hash
 * @returns Hex string hash of the processor
 */
export function hashDeclarativeProcessor(processor: DeclarativeProcessor): string {
	const processorStr = canonicalStringify(processor)
	return utils.keccak256(strToUint8Array(processorStr)).toLowerCase()
}

const processorProviderRegistry = new Map<string, DeclarativeProcessor>()

/**
 * Register a processor for a specific provider
 * @param provider Provider name
 * @param processor Declarative processor
 */
export function setProviderProcessor(provider: string, processor: DeclarativeProcessor): void {
	processorProviderRegistry.set(provider, processor)
}

/**
 * Get processor for a provider
 * @param provider Provider name
 * @returns Processor if registered, undefined otherwise
 */
export function getProviderProcessor(provider: string): DeclarativeProcessor | undefined {
	return processorProviderRegistry.get(provider)
}