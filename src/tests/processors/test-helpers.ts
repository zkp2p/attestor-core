import jsonpath from 'jsonpath'
import { ProviderClaimData } from 'src/proto/api'
import { Processor, TransformOperation } from 'src/types/processor'
import { getTransform } from 'src/utils/processors/transform-registry'

/**
 * Helper function to create ProviderClaimData from a proof object
 * This reduces duplication across test files
 */
export function createClaimData(proof: any): ProviderClaimData {
	return {
		provider: proof.claim.provider,
		parameters: proof.claim.parameters,
		owner: proof.claim.owner,
		timestampS: proof.claim.timestampS,
		context: proof.claim.context,
		identifier: proof.claim.identifier,
		epoch: proof.claim.epoch
	} as ProviderClaimData
}

/**
 * Test helper to execute a processor and extract values
 * This replicates the internal logic of Executor for testing
 */
export async function executeProcessorForTest(
	processor: Processor,
	claim: ProviderClaimData
): Promise<{ values: any[] }> {
	// Parse claim data
	const claimData = {
		...claim,
		timestampS: claim.timestampS
	}

	try {
		claimData.context = JSON.parse(claim.context)
	} catch(err) {
		// Keep as string if not valid JSON
	}

	try {
		claimData.parameters = JSON.parse(claim.parameters)
	} catch(err) {
		// Keep as string if not valid JSON
	}

	// Extract values
	const extracted: Record<string, any> = {}
	for(const [varName, jsonPath] of Object.entries(processor.extract)) {
		const results = jsonpath.query(claimData, jsonPath)
		const value = results.length > 0 ? results[0] : undefined
		if(value === undefined) {
			throw new Error(`Value extraction failed for '${varName}' using JSONPath '${jsonPath}'`)
		}
		extracted[varName] = value
	}

	// Apply transforms
	const transformed: Record<string, any> = {}
	if(processor.transform) {
		for(const [varName, rule] of Object.entries(processor.transform)) {
			// Handle string constants
			if(typeof rule === 'string') {
				transformed[varName] = rule
				continue
			}

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

			for(const op of rule.ops) {
				value = applyOperation(value, op)
			}

			transformed[varName] = value
		}
	}

	// Build output
	const allValues = { ...extracted, ...transformed }
	const values: any[] = []

	for(const spec of processor.outputs) {
		const value = allValues[spec.name]
		if(value === undefined || value === null) {
			throw new Error(`Output variable '${spec.name}' is ${value}. All output values must be defined.`)
		}

		values.push(value)
	}

	return { values }
}

function applyOperation(value: any, op: TransformOperation | string): any {
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
			result = applyOperation(result, subOp)
		}

		return result
	}

	return transform(value, params)
}