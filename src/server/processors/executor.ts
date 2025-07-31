/**
 * Processor Executor
 *
 * Executes processors safely without eval()
 */

import jsonpath from 'jsonpath'
import { ProviderClaimData, ServiceSignatureType } from 'src/proto/api'
import { signAsAttestor } from 'src/server/utils/generics'
import { Logger } from 'src/types'
import {
	OutputSpec,
	ProcessClaimOptions,
	ProcessedClaimData,
	Processor,
	TransformOperation,
	TransformRule } from 'src/types/processor'
import { createProcessorProviderHash, encodeAndHash } from 'src/utils'
import { getTransform } from 'src/utils/processors/transform-registry'
import { validateProcessor } from 'src/utils/processors/validator'

const PROCESSOR_VERSION = '1.0.0' // Server-controlled processor version
const MAX_EXECUTION_TIME = 5000 // 5 seconds
const MAX_OUTPUT_VALUES = 100 // Maximum number of output values
const MAX_JSONPATH_RESULTS = 1000 // Prevent JSONPath DOS

/**
 * Execute a processor on a claim
 */
export class Executor {
	/**
	 * Process a verified claim using a processor
	 * Executes the processor safely and signs the results
	 */
	static async processClaim(
		options: ProcessClaimOptions,
		signatureType: ServiceSignatureType,
		logger: Logger
	): Promise<ProcessedClaimData> {
		const { claim, processor } = options
		const startTime = Date.now()

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
			const validationResult = validateProcessor(processor)
			if(!validationResult.valid) {
				const errors = validationResult.errors.map(e => `${e.path}: ${e.message}`).join(', ')
				throw new Error(`Invalid processor: ${errors}`)
			}

			logger.debug({
				provider: claim.provider
			}, 'Processing claim with processor')

			// Get outputs from processor
			const outputs = this.getOutputs(processor)

			// Parse and process the claim data
			const claimData = this.parseClaimData(claim)
			const extracted = this.extractValues(processor.extract, claimData, checkTimeout)
			const transformed = processor.transform
				? this.transformValues(processor.transform, extracted, checkTimeout)
				: {}
			const allValues = { ...extracted, ...transformed }
			const values = this.buildOutput(outputs, allValues)

			if(!values || values.length === 0) {
				throw new Error('Processor returned no values')
			}

			// Get provider hash from context
			let providerHash: string | undefined
			try {
				const contextData = JSON.parse(claim.context)
				providerHash = contextData.providerHash
			} catch(err) {
				throw new Error(`Failed to parse claim context for provider hash: ${err.message}`)
			}

			if(!providerHash) {
				throw new Error('Provider hash missing from claim context')
			}

			// Create versioned processor object for hashing
			const versionedProcessor = {
				...processor,
				version: PROCESSOR_VERSION
			}

			const processorProviderHash = createProcessorProviderHash(
				providerHash,
				versionedProcessor
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
				processorVersion: PROCESSOR_VERSION,
				evmTypes: outputs.map(o => o.type),
				executionTimeMs,
			}, 'Claim processed and signed with EVM types')

			return {
				processorProviderHash,
				signature,
				outputs,
				values
			}
		} catch(err) {
			logger.error({ err, provider: claim.provider }, 'Error processing claim')
			throw err
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
		checkTimeout: () => void
	): Record<string, string> {
		const extracted: Record<string, string> = {}

		for(const [varName, jsonPath] of Object.entries(extractRules)) {
			checkTimeout() // Check timeout periodically

			const results = jsonpath.query(data, jsonPath)
			if(results.length > MAX_JSONPATH_RESULTS) {
				throw new Error(`JSONPath returned too many results (${results.length} > ${MAX_JSONPATH_RESULTS})`)
			}

			const value = results.length > 0 ? results[0] : undefined
			if(value === undefined) {
				throw new Error(`Value extraction failed for '${varName}' using JSONPath '${jsonPath}'`)
			}

			extracted[varName] = value
		}

		return extracted
	}

	/**
	 * Transform extracted values
	 */
	private static transformValues(
		transformRules: Record<string, TransformRule>,
		extracted: Record<string, any>,
		checkTimeout: () => void
	): Record<string, string> {
		const transformed: Record<string, string> = {}

		for(const [varName, rule] of Object.entries(transformRules)) {
			checkTimeout() // Check timeout periodically

			let value: any
			if(rule.input) {
				value = transformed[rule.input] ?? extracted[rule.input]
				if(value === undefined) {
					throw new Error(`Transform input '${rule.input}' for variable '${varName}' is undefined`)
				}
			} else if(rule.inputs) {
				value = rule.inputs.map(inputName => {
					const val = transformed[inputName] ?? extracted[inputName]
					if(val === undefined) {
						throw new Error(`Transform input '${inputName}' for variable '${varName}' is undefined`)
					}

					return val
				})
			} else {
				// Check if this is a CONSTANT transform
				const firstOp = rule.ops[0]
				const isConstantOp = typeof firstOp === 'object' && firstOp.type === 'constant'
				if(!isConstantOp) {
					throw new Error(`Transform rule for '${varName}' has no input or inputs specified`)
				}

				value = null // CONSTANT transform doesn't need input
			}

			// Create context with all available values for conditionalOn
			const context = { ...extracted, ...transformed }

			for(const op of rule.ops) {
				value = this.applyOperation(value, op, context)
			}

			transformed[varName] = value
		}

		return transformed
	}

	/**
	 * Apply a single transform operation
	 */
	private static applyOperation(value: any, op: TransformOperation | string, context?: Record<string, any>): any {
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

		if(opName === 'conditionalOn') {
			const operations = transform(value, params, context) as (TransformOperation | string)[]

			// Check that none of the operations are conditionalOn (max depth 1)
			for(const subOp of operations) {
				const subOpName = typeof subOp === 'string' ? subOp : subOp.type
				if(subOpName === 'conditionalOn') {
					throw new Error('Nested conditionalOn transforms are not allowed (maximum depth is 1)')
				}
			}

			let result = value
			for(const subOp of operations) {
				result = this.applyOperation(result, subOp, context)
			}

			return result
		}

		return transform(value, params, context)
	}

	/**
	 * Get outputs from processor
	 */
	private static getOutputs(processor: Processor): OutputSpec[] {
		return processor.outputs
	}

	/**
	 * Build output array from transformed values
	 */
	private static buildOutput(
		outputs: OutputSpec[],
		values: Record<string, any>
	): string[] {
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