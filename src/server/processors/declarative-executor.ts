/**
 * Declarative Processor Executor
 *
 * Executes declarative processors safely without eval()
 */

import jsonpath from 'jsonpath'
import { ProviderClaimData, ServiceSignatureType } from 'src/proto/api'
import { getAttestorAddress, signAsAttestor } from 'src/server/utils/generics'
import { Logger } from 'src/types'
import {
	DeclarativeProcessor,
	OutputSpec,
	ProcessClaimOptions,
	ProcessedClaimData,
	TransformOperation,
	TransformRule } from 'src/types/declarative-processor'
import { createProcessorProviderHash, encodeAndHash } from 'src/utils'
import { validateDeclarativeProcessor } from 'src/utils/processors/processor-validator'
import { getTransform } from 'src/utils/processors/transform-registry'

const MAX_EXECUTION_TIME = 5000 // 5 seconds
const MAX_OUTPUT_VALUES = 100 // Maximum number of output values
const MAX_JSONPATH_RESULTS = 1000 // Prevent JSONPath DOS

/**
 * Execute a declarative processor on a claim
 */
export class DeclarativeExecutor {
	/**
	 * Process a verified claim using a declarative processor
	 * Executes the processor safely and signs the results
	 */
	static async processClaim(
		options: ProcessClaimOptions,
		signatureType: ServiceSignatureType,
		logger: Logger
	): Promise<ProcessedClaimData | null> {
		const { claim, processor } = options
		const startTime = Date.now()
		const warnings: string[] = []

		let timeoutId: NodeJS.Timeout | undefined
		void new Promise<never>((_, reject) => {
			timeoutId = setTimeout(() => reject(new Error('Execution timeout exceeded')), MAX_EXECUTION_TIME)
		})

		const checkTimeout = () => {
			if(Date.now() - startTime > MAX_EXECUTION_TIME) {
				throw new Error('Execution timeout exceeded')
			}
		}

		try {
			// Validate the processor before execution
			const validationResult = validateDeclarativeProcessor(processor)
			if(!validationResult.valid) {
				const errors = validationResult.errors.map(e => `${e.path}: ${e.message}`).join(', ')
				throw new Error(`Invalid processor: ${errors}`)
			}

			logger.debug({
				provider: claim.provider,
				processorVersion: processor.version
			}, 'Processing claim with declarative processor')

			// Get outputs from processor
			const outputs = this.getOutputs(processor)

			// Parse and process the claim data
			const claimData = this.parseClaimData(claim)
			const extracted = this.extractValues(processor.extract, claimData, warnings, checkTimeout)
			const transformed = processor.transform
				? this.transformValues(processor.transform, extracted, warnings, checkTimeout)
				: {}
			const allValues = { ...extracted, ...transformed }
			const values = this.buildOutput(outputs, allValues)

			if(!values || values.length === 0) {
				logger.warn({ provider: claim.provider }, 'Processor returned no values')
				return null
			}

			// Get provider hash from context
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
				processor
			)

			// Create hash for EVM-compatible signature
			const messageHash = encodeAndHash({
				processorProviderHash,
				values,
				outputs
			})

			// Use regular signing with personal message prefix for safety
			const signature = await signAsAttestor(
				Buffer.from(messageHash.slice(2), 'hex'), // Convert hex hash to buffer
				signatureType
			)

			const executionTimeMs = Date.now() - startTime

			logger.info({
				provider: claim.provider,
				valueCount: values.length,
				processorProviderHash,
				evmTypes: outputs.map(o => o.type),
				executionTimeMs,
				warnings: warnings.length > 0 ? warnings : undefined
			}, 'Claim processed and signed with EVM types')

			return {
				claim,
				signature,
				outputs,
				attestorAddress: getAttestorAddress(signatureType)
			}
		} catch(err) {
			logger.error({ err, provider: claim.provider }, 'Error processing claim')
			return null
		} finally {
			if(timeoutId) {
				clearTimeout(timeoutId)
			}
		}
	}

	/**
	 * Parse claim data into a queryable object
	 */
	private static parseClaimData(claim: ProviderClaimData): any {
		const result: any = {
			...claim,
			timestampS: claim.timestampS
		}

		try {
			result.context = JSON.parse(claim.context)
		} catch(err) {
			// Keep as string if not valid JSON
			result.context = claim.context
		}

		try {
			result.parameters = JSON.parse(claim.parameters)
		} catch(err) {
			// Keep as string if not valid JSON
			result.parameters = claim.parameters
		}

		return result
	}

	/**
	 * Extract values using JSONPath
	 */
	private static extractValues(
		extractRules: Record<string, string>,
		data: any,
		warnings: string[],
		checkTimeout: () => void
	): Record<string, any> {
		const extracted: Record<string, any> = {}

		for(const [varName, jsonPath] of Object.entries(extractRules)) {
			checkTimeout() // Check timeout periodically
			try {
				const results = jsonpath.query(data, jsonPath)
				if(results.length > MAX_JSONPATH_RESULTS) {
					throw new Error(`JSONPath returned too many results (${results.length} > ${MAX_JSONPATH_RESULTS})`)
				}

				const value = results.length > 0 ? results[0] : undefined
				extracted[varName] = value

				if(value === undefined) {
					warnings.push(`No value found for '${varName}' at path '${jsonPath}'`)
				}
			} catch(err) {
				warnings.push(`Failed to extract '${varName}': ${err}`)
			}
		}

		return extracted
	}

	/**
	 * Transform extracted values
	 */
	private static transformValues(
		transformRules: Record<string, TransformRule>,
		extracted: Record<string, any>,
		warnings: string[],
		checkTimeout: () => void
	): Record<string, any> {
		const transformed: Record<string, any> = {}

		for(const [varName, rule] of Object.entries(transformRules)) {
			checkTimeout() // Check timeout periodically
			try {
				let value: any
				if(rule.input) {
					value = transformed[rule.input] ?? extracted[rule.input]
					if(value === undefined) {
						warnings.push(`Transform '${varName}' references undefined input '${rule.input}'`)
						continue
					}
				} else if(rule.inputs) {
					value = rule.inputs.map(inputName => {
						const val = transformed[inputName] ?? extracted[inputName]
						if(val === undefined) {
							warnings.push(`Transform '${varName}' references undefined input '${inputName}'`)
						}

						return val ?? ''
					})
				} else {
					warnings.push(`Transform '${varName}' has no input specified`)
					continue
				}

				for(const op of rule.ops) {
					value = this.applyOperation(value, op)
				}

				transformed[varName] = value
			} catch(err) {
				warnings.push(`Failed to transform '${varName}': ${err}`)
				transformed[varName] = '' // Set to empty string on error
			}
		}

		return transformed
	}

	/**
	 * Apply a single transform operation
	 */
	private static applyOperation(value: any, op: TransformOperation | string): any {
		let opName: string
		let params: any = {}

		if(typeof op === 'string') {
			opName = op
		} else {
			opName = op.type
			params = { ...op }
			delete params.type
		}

		const transform = getTransform(opName)
		if(!transform) {
			throw new Error(`Unknown transform: ${opName}`)
		}

		if(opName === 'conditional') {
			const operations = transform(value, params) as (TransformOperation | string)[]

			let result = value
			for(const subOp of operations) {
				result = this.applyOperation(result, subOp)
			}

			return result
		}

		return transform(value, params)
	}

	/**
	 * Get outputs from processor
	 */
	private static getOutputs(processor: DeclarativeProcessor): OutputSpec[] {
		return processor.outputs
	}

	/**
	 * Build output array from transformed values
	 */
	private static buildOutput(
		outputs: OutputSpec[],
		values: Record<string, any>
	): any[] {
		if(outputs.length > MAX_OUTPUT_VALUES) {
			throw new Error(`Too many output values (${outputs.length} > ${MAX_OUTPUT_VALUES})`)
		}

		const output: any[] = []

		for(const spec of outputs) {
			const value = values[spec.name]

			if(value === undefined || value === null) {
				throw new Error(`Output variable '${spec.name}' is ${value}. All output values must be defined.`)
			}

			output.push(value)
		}

		return output
	}
}