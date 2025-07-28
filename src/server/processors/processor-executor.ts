/**
 * Processor Executor
 *
 * Executes declarative processors safely without eval()
 */

import { ProviderClaimData } from 'src/proto/api'
import { DeclarativeExecutor } from 'src/server/processors/declarative-executor'
import { Logger } from 'src/types'
import { DeclarativeProcessor, ProcessedValue } from 'src/types/declarative-processor'

/**
 * Execute a declarative processor on a claim
 */
export class ProcessorExecutor {
	/**
	 * Execute a processor and return processed values
	 */
	static async execute(
		processor: DeclarativeProcessor,
		claim: ProviderClaimData,
		logger: Logger
	): Promise<ProcessedValue[]> {
		const executor = new DeclarativeExecutor(logger)
		const result = await executor.execute(processor, claim)
		return result.values as ProcessedValue[]
	}

	/**
	 * Calculate hash of a processor for identification
	 */
	static hash(processor: DeclarativeProcessor): string {
		return DeclarativeExecutor.hash(processor)
	}
}