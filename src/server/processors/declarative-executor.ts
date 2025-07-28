/**
 * Declarative Processor Executor
 *
 * Executes declarative processors safely without eval()
 */

import jsonpath from 'jsonpath'
import { ProviderClaimData } from 'src/proto/api'
import { Logger } from 'src/types'
import {
	DeclarativeProcessor,
	DeclarativeProcessorResult,
	ExtractionRule,
	TransformOperation,
	TransformRule } from 'src/types/declarative-processor'
import { getTransform } from 'src/utils/processors/transform-registry'

const MAX_EXECUTION_TIME = 5000 // 5 seconds
const MAX_OUTPUT_VALUES = 100 // Maximum number of output values
const MAX_JSONPATH_RESULTS = 1000 // Prevent JSONPath DOS

let RE2: any
try {
	RE2 = require('re2')
	if(!Object.keys(RE2).length) {
		RE2 = undefined
	}
} catch{
}

/**
 * Execute a declarative processor on a claim
 */
export class DeclarativeExecutor {
	private logger: Logger

	constructor(logger: Logger) {
		this.logger = logger
	}

	/**
   * Execute the processor and return the result
   */
	async execute(
		processor: DeclarativeProcessor,
		claim: ProviderClaimData
	): Promise<DeclarativeProcessorResult> {
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
			const claimData = this.parseClaimData(claim)

			const extracted = this.extractValues(processor.extract, claimData, warnings, checkTimeout)

			const transformed = processor.transform
				? this.transformValues(processor.transform, extracted, warnings, checkTimeout)
				: {}

			const allValues = { ...extracted, ...transformed }

			const output = this.buildOutput(processor.output, allValues, warnings)

			const executionTimeMs = Date.now() - startTime

			if(timeoutId) {
				clearTimeout(timeoutId)
			}

			return {
				values: output,
				metadata: {
					executionTimeMs,
					extractedVariables: Object.keys(extracted),
					defaultedVariables: warnings
						.filter(w => w.includes('Using default'))
						.map(w => w.split("'")[1]),
					warnings: warnings.length > 0 ? warnings : undefined
				}
			}
		} catch(error) {
			// Clear timeout on error
			if(timeoutId) {
				clearTimeout(timeoutId)
			}

			this.logger.error({ error, processor }, 'Failed to execute declarative processor')
			throw error
		}
	}

	/**
   * Parse claim data into a queryable object
   */
	private parseClaimData(claim: ProviderClaimData): any {
		const result: any = {
			...claim,
			timestampS: claim.timestampS
		}

		try {
			result.context = JSON.parse(claim.context)
		} catch(err) {
			this.logger.warn({ err }, 'Failed to parse claim context as JSON')
			result.context = claim.context
		}

		try {
			result.parameters = JSON.parse(claim.parameters)
		} catch(err) {
			this.logger.warn({ err }, 'Failed to parse claim parameters as JSON')
			result.parameters = claim.parameters
		}

		return result
	}

	/**
   * Extract values using JSONPath
   */
	private extractValues(
		extractRules: Record<string, string | ExtractionRule>,
		data: any,
		warnings: string[],
		checkTimeout: () => void
	): Record<string, any> {
		const extracted: Record<string, any> = {}

		for(const [varName, rule] of Object.entries(extractRules)) {
			checkTimeout() // Check timeout periodically
			try {
				let value: any

				if(typeof rule === 'string') {
						const results = jsonpath.query(data, rule)
					if(results.length > MAX_JSONPATH_RESULTS) {
						throw new Error(`JSONPath returned too many results (${results.length} > ${MAX_JSONPATH_RESULTS})`)
					}

					value = results.length > 0 ? results[0] : undefined
				} else {
						value = this.extractWithRule(rule, data)
				}

				if(typeof rule === 'object' && rule.regex && typeof value === 'string') {
					value = this.applyRegex(value, rule.regex, rule.regexGroup)
				}

				if(value === undefined && typeof rule === 'object' && 'default' in rule) {
					value = rule.default
					warnings.push(`Using default value for '${varName}'`)
				}

				extracted[varName] = value
			} catch(err) {
				this.logger.warn({ err, varName, rule }, 'Failed to extract value')
				warnings.push(`Failed to extract '${varName}': ${err}`)
			}
		}

		return extracted
	}

	/**
   * Apply regex to a value and extract group
   */
	private applyRegex(value: string, pattern: string, group?: number): string | undefined {
		try {
			const regex = RE2 ? new RE2(pattern) : new RegExp(pattern)
			const match = value.match(regex)
			if(match) {
				const captureGroup = group ?? 1
				return match[captureGroup] ?? match[0]
			}

			return undefined
		} catch(err) {
			throw new Error(`Invalid regex pattern: ${pattern}`)
		}
	}

	/**
   * Extract value using extraction rule
   */
	private extractWithRule(rule: ExtractionRule, data: any): any {
		if(rule.paths) {
			for(const path of rule.paths) {
				const results = jsonpath.query(data, path)
				if(results.length > MAX_JSONPATH_RESULTS) {
					throw new Error(`JSONPath returned too many results (${results.length} > ${MAX_JSONPATH_RESULTS})`)
				}

				if(results.length > 0 && results[0] !== null && results[0] !== undefined) {
					return results[0]
				}
			}

			return undefined
		}

		if(rule.path) {
			const results = jsonpath.query(data, rule.path)
			if(results.length > MAX_JSONPATH_RESULTS) {
				throw new Error(`JSONPath returned too many results (${results.length} > ${MAX_JSONPATH_RESULTS})`)
			}

			return results.length > 0 ? results[0] : undefined
		}

		return undefined
	}

	/**
   * Transform extracted values
   */
	private transformValues(
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
				this.logger.warn({ err, varName, rule }, 'Failed to transform value')
				warnings.push(`Failed to transform '${varName}': ${err}`)
				transformed[varName] = '' // Set to empty string on error
			}
		}

		return transformed
	}

	/**
   * Apply a single transform operation
   */
	private applyOperation(value: any, op: TransformOperation | string): any {
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

		try {
			return transform(value, params)
		} catch(err) {
			this.logger.error({ err, opName, value, params }, 'Transform execution failed')
			throw err
		}
	}

	/**
   * Build output array from transformed values
   */
	private buildOutput(
		outputSpec: string[],
		values: Record<string, any>,
		warnings: string[]
	): string[] {
		if(outputSpec.length > MAX_OUTPUT_VALUES) {
			throw new Error(`Too many output values (${outputSpec.length} > ${MAX_OUTPUT_VALUES})`)
		}

		const output: string[] = []

		for(const varName of outputSpec) {
			const value = values[varName]

			if(value === undefined) {
				warnings.push(`Output variable '${varName}' is undefined`)
				output.push('')
			} else if(value === null) {
				warnings.push(`Output variable '${varName}' is null`)
				output.push('')
			} else {
				output.push(String(value))
			}
		}

		return output
	}

	/**
   * Create a hash of the declarative processor for caching/identification
   */
	static hash(processor: DeclarativeProcessor): string {
		const { utils } = require('ethers')
		const normalized = JSON.stringify(processor, Object.keys(processor).sort())
		return utils.keccak256(
			new TextEncoder().encode(normalized)
		).toLowerCase()
	}
}