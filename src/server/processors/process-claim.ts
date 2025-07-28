import { ServiceSignatureType } from 'src/proto/api'
import { getAttestorAddress, signAsAttestor } from 'src/server/utils/generics'
import { ProcessorExecutor } from 'src/server/processors/processor-executor'
import { Logger } from 'src/types'
import { ProcessClaimOptions, ProcessedClaimData } from 'src/types/declarative-processor'
import { canonicalStringify, createProcessedClaimSignData, createProcessorProviderHash } from 'src/utils'

/**
 * Process a verified claim using a declarative processor
 * Executes the processor safely and signs the results
 */
export async function processClaim(
	options: ProcessClaimOptions,
	signatureType: ServiceSignatureType,
	logger: Logger
): Promise<ProcessedClaimData | null> {
	const { claim, processor } = options

	try {
		const processorHash = ProcessorExecutor.hash(processor)

		logger.debug({
			provider: claim.provider,
			processorHash,
			processorVersion: processor.version
		}, 'Processing claim with declarative processor')

		const values = await ProcessorExecutor.execute(
			processor,
			claim,
			logger
		)

		if(!values || values.length === 0) {
			logger.warn({ provider: claim.provider }, 'Processor returned no values')
			return null
		}

		let providerHash: string | undefined
		try {
			const contextData = JSON.parse(claim.context)
			providerHash = contextData.providerHash
		} catch(err) {
			logger.warn({ err }, 'Failed to parse claim context for provider hash')
		}

		if(!providerHash) {
			logger.error('Provider hash not found in claim context')
			throw new Error('Provider hash missing from claim context')
		}

		const processorProviderHash = createProcessorProviderHash(
			providerHash,
			processorHash
		)

		const dataToSign = createProcessedClaimSignData({
			claimId: claim.identifier,
			processorProviderHash,
			values
		})

		const signature = await signAsAttestor(
			canonicalStringify(dataToSign),
			signatureType
		)

		logger.info({
			provider: claim.provider,
			valueCount: values.length,
			processorProviderHash
		}, 'Claim processed and signed')

		return {
			claimId: claim.identifier,
			values,
			processorProviderHash,
			signature,
			attestorAddress: getAttestorAddress(signatureType),
			provider: claim.provider
		}
	} catch(err) {
		logger.error({ err, provider: claim.provider }, 'Error processing claim')
		return null
	}
}