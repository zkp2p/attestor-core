/**
 * Transform Registry
 *
 * Registry of transformation functions available for declarative processors.
 * All transforms must be deterministic and side-effect free.
 */

import { createHash } from 'crypto'
import { utils } from 'ethers'
import { makeRegex } from 'src/providers/http/utils'
import {
	ConditionalExpression,
	TransformFunction,
	TransformRegistry,
	TransformType } from 'src/types/declarative-processor'

const MAX_STRING_LENGTH = 100_000 // 100KB max string length

/**
 * Validate and sanitize input value
 */
function safeToString(value: any): string {
	if(value === null || value === undefined) {
		return ''
	}

	if(typeof value === 'object') {
		try {
			return JSON.stringify(value)
		} catch{
			return '[object]'
		}
	}

	return String(value)
}

/**
 * Convert value to Uint8Array for hashing
 */
function toUint8Array(value: any): Uint8Array {
	if(value instanceof Uint8Array) {
		return value
	}

	return new TextEncoder().encode(safeToString(value))
}

/**
 * Smart timestamp parser that handles various formats
 */
function parseTimestampSmart(value: any): number {
	if(value === null || value === undefined || value === '') {
		throw new Error('Cannot parse timestamp: empty value')
	}

	if(typeof value === 'number') {
		return value > 10000000000 ? value : value * 1000
	}

	const strValue = safeToString(value)

	if(/^\d+$/.test(strValue)) {
		const numValue = parseInt(strValue, 10)
		if(!isNaN(numValue)) {
			return numValue > 10000000000 ? numValue : numValue * 1000
		}
	}

	const normalizedValue = strValue.replace(' ', 'T')

	const parsed = Date.parse(normalizedValue)
	if(!isNaN(parsed)) {
		return parsed
	}

	if(/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
		const dateWithTime = `${strValue}T00:00:00Z`
		const parsed2 = Date.parse(dateWithTime)
		if(!isNaN(parsed2)) {
			return parsed2
		}
	}

	const patterns = [
		/(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
		/(\d{2})\.(\d{2})\.(\d{4})/, // DD.MM.YYYY
	]

	for(const pattern of patterns) {
		if(!strValue.match(pattern)) {
			continue
		}

		try {
			const date = new Date(strValue)
			if(!isNaN(date.getTime())) {
				return date.getTime()
			}
		} catch{}
	}

	throw new Error('Cannot parse timestamp: invalid format')
}

/**
 * Evaluate conditional expression
 */
function evaluateCondition(value: any, condition: ConditionalExpression): boolean {
	if(condition.eq !== undefined) {
		return value === condition.eq
	}

	if(condition.ne !== undefined) {
		return value !== condition.ne
	}

	if(condition.gt !== undefined) {
		return Number(value) > condition.gt
	}

	if(condition.lt !== undefined) {
		return Number(value) < condition.lt
	}

	if(condition.gte !== undefined) {
		return Number(value) >= condition.gte
	}

	if(condition.lte !== undefined) {
		return Number(value) <= condition.lte
	}

	if(condition.contains !== undefined) {
		return safeToString(value).includes(condition.contains)
	}

	if(condition.startsWith !== undefined) {
		return safeToString(value).startsWith(condition.startsWith)
	}

	if(condition.endsWith !== undefined) {
		return safeToString(value).endsWith(condition.endsWith)
	}

	if(condition.matches !== undefined) {
		try {
			const regex = makeRegex(condition.matches)
			return regex.test(safeToString(value))
		} catch(err) {
			throw new Error(`Invalid regex pattern: ${condition.matches}`)
		}
	}

	if(condition.and) {
		return condition.and.every(c => evaluateCondition(value, c))
	}

	if(condition.or) {
		return condition.or.some(c => evaluateCondition(value, c))
	}

	if(condition.not) {
		return !evaluateCondition(value, condition.not)
	}

	return false
}

/**
 * Core transform registry
 */
export const transformRegistry: TransformRegistry = {
	[TransformType.TO_LOWER_CASE]: (value) => safeToString(value).toLowerCase(),

	[TransformType.TO_UPPER_CASE]: (value) => safeToString(value).toUpperCase(),

	[TransformType.TRIM]: (value) => safeToString(value).trim(),

	[TransformType.SUBSTRING]: (value, params) => {
		const str = safeToString(value)
		const { start = 0, end } = params || {}

		if(start < 0 || (end !== undefined && end < start)) {
			throw new Error('Invalid substring indices')
		}

		return str.substring(start, end)
	},

	[TransformType.REPLACE]: (value, params) => {
		const str = safeToString(value)
		const { pattern, replacement = '', global = false } = params || {}
		if(!pattern) {
			return str
		}

		const checkLength = (result: string) => {
			if(result.length > MAX_STRING_LENGTH) {
				throw new Error(`Result exceeds maximum string length of ${MAX_STRING_LENGTH}`)
			}

			return result
		}

		if(pattern.startsWith('/') && pattern.endsWith('/')) {
			const lastSlash = pattern.lastIndexOf('/')
			const regexPattern = pattern.slice(1, lastSlash)
			try {
				const regex = makeRegex(regexPattern)
				return checkLength(str.replace(regex, replacement))
			} catch(err) {
				throw new Error(`Invalid regex pattern: ${regexPattern}`)
			}
		} else if(pattern.match(/^[[\\\^$.|?*+()]/)) {
			try {
				const regex = makeRegex(pattern)
				return checkLength(str.replace(regex, replacement))
			} catch(err) {
				throw new Error(`Invalid regex pattern: ${pattern}`)
			}
		} else {
			return checkLength(global ? str.replaceAll(pattern, replacement) : str.replace(pattern, replacement))
		}
	},

	[TransformType.MATH]: (value, params) => {
		const { expression } = params || {}
		if(!expression) {
			return value
		}

		const val = Number(safeToString(value))

		if(isNaN(val)) {
			throw new Error('Input value is not a valid number')
		}

		const match = expression.match(/^([+\-*/])\s*(\d+(?:\.\d+)?)$/)
		if(!match) {
			throw new Error(`Invalid math expression: ${expression}. Only simple operations like "* 100", "+ 10" are allowed`)
		}

		const [, op, num] = match
		const operand = parseFloat(num)

		let result: number
		switch (op) {
		case '+': result = val + operand; break
		case '-': result = val - operand; break
		case '*': result = val * operand; break
		case '/':
			if(operand === 0) {
				throw new Error('Division by zero')
			}

			result = val / operand
			break
		default: throw new Error(`Unknown operator: ${op}`)
		}

		if(!isFinite(result) || Math.abs(result) > Number.MAX_SAFE_INTEGER) {
			throw new Error('Math operation resulted in unsafe number')
		}

		return String(result)
	},

	[TransformType.KECCAK256]: (value) => {
		return utils.keccak256(toUint8Array(value)).toLowerCase()
	},

	[TransformType.SHA256]: (value) => {
		return '0x' + createHash('sha256').update(toUint8Array(value)).digest('hex')
	},

	[TransformType.PARSE_TIMESTAMP]: (value, params) => {
		const { format } = params || {}

		if(format) {
			if(format === 'YYYY-MM-DDTHH:MM:SS' && !value.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/)) {
				throw new Error(`Date "${value}" does not match format ${format}`)
			}

			if(format === 'YYYY-MM-DD' && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
				throw new Error(`Date "${value}" does not match format ${format}`)
			}
		}

		return String(parseTimestampSmart(value))
	},

	[TransformType.ASSERT_EQUALS]: (value, params) => {
		const { expected, message } = params || {}
		if(value !== expected) {
			throw new Error(message || 'Assertion failed: values do not match')
		}

		return value
	},

	[TransformType.ASSERT_ONE_OF]: (value, params) => {
		const { values, message } = params || {}
		if(!values || !Array.isArray(values)) {
			throw new Error('assertOneOf requires "values" array parameter')
		}

		if(!values.includes(value)) {
			throw new Error(message || 'Assertion failed: value not in allowed list')
		}

		return value
	},

	[TransformType.VALIDATE]: (value, params) => {
		const { condition, message } = params || {}
		if(!condition) {
			throw new Error('validate requires "condition" parameter')
		}

		if(!evaluateCondition(value, condition)) {
			throw new Error(message || 'Validation failed')
		}

		return value
	},

	[TransformType.CONCAT]: (value) => {
		let result: string
		if(Array.isArray(value)) {
			result = value.map(v => safeToString(v)).join('')
		} else {
			result = safeToString(value)
		}

		if(result.length > MAX_STRING_LENGTH) {
			throw new Error(`Result exceeds maximum string length of ${MAX_STRING_LENGTH}`)
		}

		return result
	},

	[TransformType.CONDITIONAL]: (value, params) => {
		const { if: condition, then: thenOps, else: elseOps = [] } = params || {}
		if(!condition) {
			throw new Error('conditional requires "if" parameter')
		}

		return evaluateCondition(value, condition) ? thenOps : elseOps
	},

	[TransformType.TEMPLATE]: (value, params) => {
		const { pattern } = params || {}
		if(!pattern) {
			return safeToString(value)
		}

		const result = pattern.replace(/\$\{value\}/g, safeToString(value))

		if(result.length > MAX_STRING_LENGTH) {
			throw new Error(`Result exceeds maximum string length of ${MAX_STRING_LENGTH}`)
		}

		return result
	}
}

/**
 * Get a transform function by name
 */
export function getTransform(name: string): TransformFunction | undefined {
	return transformRegistry[name]
}

/**
 * Check if a transform exists
 */
export function hasTransform(name: string): boolean {
	return name in transformRegistry
}

/**
 * Get all registered transform names
 */
export function getTransformNames(): string[] {
	return Object.keys(transformRegistry)
}