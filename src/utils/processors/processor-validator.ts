/**
 * Processor Validator
 *
 * Validates declarative processors before execution
 */

import {
	isDeclarativeProcessor,
	OutputSpec,
	ProcessorValidationResult,
	TransformOperation,
	TransformRule } from 'src/types/declarative-processor'
import { hasTransform } from 'src/utils/processors/transform-registry'

/**
 * Validate a declarative processor
 */
export function validateDeclarativeProcessor(
	processor: any
): ProcessorValidationResult {
	const errors: Array<{ path: string, message: string }> = []
	const warnings: Array<{ path: string, message: string }> = []

	if(!isDeclarativeProcessor(processor)) {
		errors.push({
			path: 'root',
			message: 'Invalid processor structure'
		})
		return { valid: false, errors, warnings }
	}

	if(processor.version !== '1.0.0') {
		errors.push({
			path: 'version',
			message: `Unsupported version: ${processor.version}`
		})
	}

	validateExtractRules(processor.extract, errors, warnings)

	if(processor.transform) {
		validateTransformRules(processor.transform, processor.extract, errors, warnings)
	}

	// Validate outputs
	if(!processor.outputs) {
		errors.push({
			path: 'outputs',
			message: 'Processor must have outputs array'
		})
	} else {
		validateOutputs(processor.outputs, processor.extract, processor.transform, errors, warnings)
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings
	}
}

/**
 * Validate extraction rules
 */
function validateExtractRules(
	extractRules: Record<string, string>,
	errors: Array<{ path: string, message: string }>,
	warnings: Array<{ path: string, message: string }>
): void {
	if(!extractRules || typeof extractRules !== 'object') {
		errors.push({
			path: 'extract',
			message: 'Extract rules must be an object'
		})
		return
	}

	if(Object.keys(extractRules).length === 0) {
		errors.push({
			path: 'extract',
			message: 'At least one extraction rule is required'
		})
	}

	for(const [varName, jsonPath] of Object.entries(extractRules)) {
		const path = `extract.${varName}`

		if(!varName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
			errors.push({
				path,
				message: 'Variable name must be valid identifier'
			})
		}

		if(typeof jsonPath !== 'string') {
			errors.push({
				path,
				message: 'JSONPath must be a string'
			})
			continue
		}

		if(!jsonPath.startsWith('$')) {
			warnings.push({
				path,
				message: 'JSONPath should start with $'
			})
		}
	}
}

/**
 * Validate transform rules
 */
function validateTransformRules(
	transformRules: Record<string, TransformRule>,
	extractRules: Record<string, any>,
	errors: Array<{ path: string, message: string }>,
	warnings: Array<{ path: string, message: string }>
): void {
	if(typeof transformRules !== 'object') {
		errors.push({
			path: 'transform',
			message: 'Transform rules must be an object'
		})
		return
	}

	const allVarNames = new Set(Object.keys(extractRules))

	for(const [varName, rule] of Object.entries(transformRules)) {
		const path = `transform.${varName}`

		if(!varName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
			errors.push({
				path,
				message: 'Variable name must be valid identifier'
			})
		}

		if(allVarNames.has(varName)) {
			warnings.push({
				path,
				message: 'Transform output overwrites extracted variable'
			})
		}

		if(!rule.input && !rule.inputs) {
			errors.push({
				path,
				message: 'Transform must have "input" or "inputs"'
			})
		}

		if(rule.input && rule.inputs) {
			errors.push({
				path,
				message: 'Transform cannot have both "input" and "inputs"'
			})
		}

		if(rule.input && !allVarNames.has(rule.input)) {
			errors.push({
				path: `${path}.input`,
				message: `Unknown input variable: ${rule.input}`
			})
		}

		if(rule.inputs) {
			if(!Array.isArray(rule.inputs)) {
				errors.push({
					path: `${path}.inputs`,
					message: 'inputs must be an array'
				})
			} else {
				for(const input of rule.inputs) {
					// eslint-disable-next-line max-depth
					if(!allVarNames.has(input)) {
						errors.push({
							path: `${path}.inputs`,
							message: `Unknown input variable: ${input}`
						})
					}
				}
			}
		}

		if(!Array.isArray(rule.ops)) {
			errors.push({
				path: `${path}.ops`,
				message: 'ops must be an array'
			})
		} else {
			validateOperations(rule.ops, `${path}.ops`, errors)
		}

		allVarNames.add(varName)
	}
}

/**
 * Validate operations
 */
function validateOperations(
	ops: (TransformOperation | string)[],
	path: string,
	errors: Array<{ path: string, message: string }>
): void {
	if(ops.length === 0) {
		errors.push({
			path,
			message: 'At least one operation is required'
		})
	}

	for(const [index, op] of ops.entries()) {
		const opPath = `${path}[${index}]`

		if(typeof op === 'string') {
			if(!hasTransform(op)) {
				errors.push({
					path: opPath,
					message: `Unknown transform: ${op}`
				})
			}
		} else if(typeof op === 'object' && op !== null) {
			if(!op.type) {
				errors.push({
					path: opPath,
					message: 'Operation must have "type"'
				})
			} else if(!hasTransform(op.type)) {
				errors.push({
					path: `${opPath}.type`,
					message: `Unknown transform: ${op.type}`
				})
			}

			validateOperationParams(op, opPath, errors)
		} else {
			errors.push({
				path: opPath,
				message: 'Operation must be string or object'
			})
		}
	}
}

/**
 * Validate operation parameters
 */
function validateOperationParams(
	op: TransformOperation,
	path: string,
	errors: Array<{ path: string, message: string }>
): void {
	switch (op.type) {
	case 'substring':
		if(typeof op.start !== 'number' || op.start < 0) {
			errors.push({
				path: `${path}.start`,
				message: 'start must be non-negative number'
			})
		}

		break

	case 'replace':
		if(!op.pattern) {
			errors.push({
				path: `${path}.pattern`,
				message: 'pattern is required'
			})
		}

		break

	case 'toFixed':
		if(op.decimals !== undefined && (typeof op.decimals !== 'number' || op.decimals < 0)) {
			errors.push({
				path: `${path}.decimals`,
				message: 'decimals must be non-negative number'
			})
		}

		break

	case 'math':
		if(!op.expression) {
			errors.push({
				path: `${path}.expression`,
				message: 'expression is required'
			})
		}

		break

	case 'conditional':
		if(!op.if) {
			errors.push({
				path: `${path}.if`,
				message: 'if condition is required'
			})
		}

		if(!op.then) {
			errors.push({
				path: `${path}.then`,
				message: 'then operations are required'
			})
		}

		break

	case 'template':
		if(!op.pattern) {
			errors.push({
				path: `${path}.pattern`,
				message: 'pattern is required'
			})
		}

		break
	}
}


/**
 * Validate outputs
 */
function validateOutputs(
	outputs: OutputSpec[],
	extractRules: Record<string, any>,
	transformRules: Record<string, any> | undefined,
	errors: Array<{ path: string, message: string }>,
	warnings: Array<{ path: string, message: string }>
): void {
	if(!Array.isArray(outputs)) {
		errors.push({
			path: 'outputs',
			message: 'outputs must be an array'
		})
		return
	}

	if(outputs.length === 0) {
		errors.push({
			path: 'outputs',
			message: 'At least one output is required'
		})
	}

	const allVarNames = new Set([
		...Object.keys(extractRules),
		...(transformRules ? Object.keys(transformRules) : [])
	])

	for(const [index, spec] of outputs.entries()) {
		const path = `outputs[${index}]`

		if(!spec || typeof spec !== 'object') {
			errors.push({
				path,
				message: 'Output must be an object with name and type'
			})
			continue
		}

		if(typeof spec.name !== 'string') {
			errors.push({
				path: `${path}.name`,
				message: 'Output name must be a string'
			})
		} else if(!allVarNames.has(spec.name)) {
			errors.push({
				path: `${path}.name`,
				message: `Unknown variable: ${spec.name}`
			})
		}

		if(typeof spec.type !== 'string') {
			errors.push({
				path: `${path}.type`,
				message: 'Output type must be a string'
			})
		} else if(!isValidEvmType(spec.type)) {
			warnings.push({
				path: `${path}.type`,
				message: `Potentially invalid EVM type: ${spec.type}`
			})
		}
	}

	// Check for duplicate names
	const seen = new Set<string>()
	for(const [index, spec] of outputs.entries()) {
		if(spec.name && seen.has(spec.name)) {
			warnings.push({
				path: `outputs[${index}].name`,
				message: `Duplicate output variable: ${spec.name}`
			})
		}

		if(spec.name) {
			seen.add(spec.name)
		}
	}
}


/**
 * Check if a string is a valid EVM type
 */
function isValidEvmType(type: string): boolean {
	// Common EVM types
	const validTypes = [
		'uint256', 'uint128', 'uint64', 'uint32', 'uint16', 'uint8',
		'int256', 'int128', 'int64', 'int32', 'int16', 'int8',
		'address', 'bool', 'bytes32', 'bytes', 'string'
	]

	// Check exact match
	if(validTypes.includes(type)) {
		return true
	}

	// Check for uint/int with size
	if(/^u?int\d+$/.test(type)) {
		const size = parseInt(type.replace(/^u?int/, ''))
		return size > 0 && size <= 256 && size % 8 === 0
	}

	// Check for fixed bytes
	if(/^bytes\d+$/.test(type)) {
		const size = parseInt(type.replace(/^bytes/, ''))
		return size > 0 && size <= 32
	}

	// Check for arrays
	if(type.endsWith('[]')) {
		return isValidEvmType(type.slice(0, -2))
	}

	return false
}

