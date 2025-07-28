/**
 * Declarative Processor Validator
 *
 * Validates the structure and content of declarative processors
 * to ensure they are safe to execute.
 */

import {
	DeclarativeProcessor,
	ProcessorValidationResult
} from 'src/types/declarative-processor'
import { getTransform } from 'src/utils/processors/transform-registry'

/**
 * Validate a declarative processor
 */
export function validateDeclarativeProcessor(processor: any): ProcessorValidationResult {
	const errors: Array<{ path: string, message: string }> = []
	const warnings: Array<{ path: string, message: string }> = []

	if(!processor || typeof processor !== 'object') {
		errors.push({ path: '', message: 'Processor must be an object' })
		return { valid: false, errors, warnings }
	}

	if(processor.version !== '1.0.0') {
		errors.push({ path: 'version', message: 'Only version 1.0.0 is supported' })
	}

	if(!processor.extract || typeof processor.extract !== 'object') {
		errors.push({ path: 'extract', message: 'Extract must be an object' })
	}

	if(!Array.isArray(processor.output)) {
		errors.push({ path: 'output', message: 'Output must be an array' })
	} else if(processor.output.length === 0) {
		errors.push({ path: 'output', message: 'Output array cannot be empty' })
	}

	if(processor.transform) {
		validateTransforms(processor.transform, errors)
	}

	if(Array.isArray(processor.output)) {
		for(let i = 0; i < processor.output.length; i++) {
			const varName = processor.output[i]

			const inExtract = processor.extract && varName in processor.extract
			const inTransform = processor.transform && varName in processor.transform

			if(!inExtract && !inTransform) {
				errors.push({
					path: `output[${i}]`,
					message: `Variable '${varName}' not found in extract or transform`
				})
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings
	}
}

/**
 * Type guard to check if value is a valid processor
 */
export function isValidProcessor(value: any): value is DeclarativeProcessor {
	const result = validateDeclarativeProcessor(value)
	return result.valid
}

/**
 * Validate transform rules
 */
function validateTransforms(
	transform: any,
	errors: Array<{ path: string, message: string }>
): void {
	if(typeof transform !== 'object') {
		errors.push({ path: 'transform', message: 'Transform must be an object' })
		return
	}

	for(const [varName, rule] of Object.entries(transform)) {
		validateTransformRule(varName, rule, errors)
	}
}

/**
 * Validate a single transform rule
 */
function validateTransformRule(
	varName: string,
	rule: any,
	errors: Array<{ path: string, message: string }>
): void {
	const rulePath = `transform.${varName}`

	if(!rule || typeof rule !== 'object') {
		errors.push({ path: rulePath, message: 'Transform rule must be an object' })
		return
	}

	if(rule.input && rule.inputs) {
		errors.push({ path: rulePath, message: 'Transform rule cannot have both input and inputs' })
	} else if(!rule.input && !rule.inputs) {
		errors.push({ path: rulePath, message: 'Transform rule must have either input or inputs' })
	} else if(rule.input && typeof rule.input !== 'string') {
		errors.push({ path: `${rulePath}.input`, message: 'input must be a string' })
	} else if(rule.inputs) {
		if(!Array.isArray(rule.inputs)) {
			errors.push({ path: `${rulePath}.inputs`, message: 'inputs must be an array' })
		} else if(rule.inputs.length === 0) {
			errors.push({ path: `${rulePath}.inputs`, message: 'inputs array cannot be empty' })
		} else {
			for(let i = 0; i < rule.inputs.length; i++) {
				if(typeof rule.inputs[i] !== 'string') {
					errors.push({ path: `${rulePath}.inputs[${i}]`, message: 'each input must be a string' })
				}
			}
		}
	}

	if(!Array.isArray(rule.ops)) {
		errors.push({ path: `${rulePath}.ops`, message: 'Transform rule must have ops array' })
		return
	}

	for(let i = 0; i < rule.ops.length; i++) {
		validateOperation(rule.ops[i], `${rulePath}.ops[${i}]`, errors)
	}
}

/**
 * Validate a single operation
 */
function validateOperation(
	op: any,
	opPath: string,
	errors: Array<{ path: string, message: string }>
): void {
	if(typeof op === 'string') {
		if(!getTransform(op)) {
			errors.push({ path: opPath, message: `Unknown transform: ${op}` })
		}
	} else if(typeof op === 'object' && op !== null) {
		if(!op.type || !getTransform(op.type)) {
			errors.push({ path: `${opPath}.type`, message: `Unknown transform: ${op.type}` })
		}
	} else {
		errors.push({ path: opPath, message: 'Operation must be a string or object' })
	}
}