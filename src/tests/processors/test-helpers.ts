import jsonpath from 'jsonpath'
import { ProviderClaimData } from 'src/proto/api'
import { DeclarativeProcessor, TransformOperation } from 'src/types/declarative-processor'
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
 * This replicates the internal logic of DeclarativeExecutor for testing
 */
export async function executeProcessorForTest(
	processor: DeclarativeProcessor,
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
		extracted[varName] = results.length > 0 ? results[0] : undefined
	}

	// Apply transforms
	const transformed: Record<string, any> = {}
	if(processor.transform) {
		for(const [varName, rule] of Object.entries(processor.transform)) {
			let value: any
			if(rule.input) {
				value = transformed[rule.input] ?? extracted[rule.input]
			} else if(rule.inputs) {
				value = rule.inputs.map(inputName => transformed[inputName] ?? extracted[inputName] ?? '')
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