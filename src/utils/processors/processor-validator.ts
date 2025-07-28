/**
 * Processor Validator
 *
 * Validates declarative processors before execution
 */

import {
	ExtractionRule,
	isDeclarativeProcessor,
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

	validateOutput(processor.output, processor.extract, processor.transform, errors, warnings)

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
	extractRules: Record<string, string | ExtractionRule>,
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

	for(const [varName, rule] of Object.entries(extractRules)) {
		const path = `extract.${varName}`

		if(!varName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
			errors.push({
				path,
				message: 'Variable name must be valid identifier'
			})
		}

		if(typeof rule === 'string') {
			if(!rule.startsWith('$')) {
				warnings.push({
					path,
					message: 'JSONPath should start with $'
				})
			}
		} else if(typeof rule === 'object' && rule !== null) {
			if(!rule.path && !rule.paths) {
				errors.push({
					path,
					message: 'Extraction rule must have "path" or "paths"'
				})
			}

			if(rule.paths && !Array.isArray(rule.paths)) {
				errors.push({
					path: `${path}.paths`,
					message: 'paths must be an array'
				})
			}

			if(rule.regex) {
				try {
					new RegExp(rule.regex)
				} catch(err) {
					errors.push({
						path: `${path}.regex`,
						message: `Invalid regex: ${err}`
					})
				}
			}
		} else {
			errors.push({
				path,
				message: 'Rule must be string or object'
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
 * Validate output specification
 */
function validateOutput(
	output: string[],
	extractRules: Record<string, any>,
	transformRules: Record<string, any> | undefined,
	errors: Array<{ path: string, message: string }>,
	warnings: Array<{ path: string, message: string }>
): void {
	if(!Array.isArray(output)) {
		errors.push({
			path: 'output',
			message: 'output must be an array'
		})
		return
	}

	if(output.length === 0) {
		errors.push({
			path: 'output',
			message: 'At least one output value is required'
		})
	}

	const allVarNames = new Set([
		...Object.keys(extractRules),
		...(transformRules ? Object.keys(transformRules) : [])
	])

	for(const [index, varName] of output.entries()) {
		if(typeof varName !== 'string') {
			errors.push({
				path: `output[${index}]`,
				message: 'Output value must be string'
			})
		} else if(!allVarNames.has(varName)) {
			errors.push({
				path: `output[${index}]`,
				message: `Unknown variable: ${varName}`
			})
		}
	}

	const seen = new Set<string>()
	for(const [index, varName] of output.entries()) {
		if(seen.has(varName)) {
			warnings.push({
				path: `output[${index}]`,
				message: `Duplicate output variable: ${varName}`
			})
		}

		seen.add(varName)
	}
}