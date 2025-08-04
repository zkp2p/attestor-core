import { describe, expect, it } from '@jest/globals'
import { TransformType } from 'src/types/processor'
import {
	getTransform,
	getTransformNames,
	hasTransform,
	transformRegistry
} from 'src/utils/processors/transform-registry'

describe('Transform Registry', () => {
	describe('String Transforms', () => {
		it('should convert to lowercase', () => {
			const transform = transformRegistry[TransformType.TO_LOWER_CASE]
			expect(transform('HELLO')).toBe('hello')
			expect(transform('Hello World')).toBe('hello world')
			expect(transform('123ABC')).toBe('123abc')
			expect(transform('')).toBe('')
		})

		it('should convert to uppercase', () => {
			const transform = transformRegistry[TransformType.TO_UPPER_CASE]
			expect(transform('hello')).toBe('HELLO')
			expect(transform('Hello World')).toBe('HELLO WORLD')
			expect(transform('123abc')).toBe('123ABC')
			expect(transform('')).toBe('')
		})

		it('should trim strings', () => {
			const transform = transformRegistry[TransformType.TRIM]
			expect(transform('  hello  ')).toBe('hello')
			expect(transform('\n\ttest\n')).toBe('test')
			expect(transform('   ')).toBe('')
			expect(transform('no-spaces')).toBe('no-spaces')
		})

		it('should perform substring operations', () => {
			const transform = transformRegistry[TransformType.SUBSTRING]
			expect(transform('hello world', { start: 0, end: 5 })).toBe('hello')
			expect(transform('hello world', { start: 6 })).toBe('world')
			expect(transform('test', { start: 1, end: 3 })).toBe('es')
			expect(transform('abc', { start: 10 })).toBe('')
			// Test removing prefix
			expect(transform('-123.45', { start: 1 })).toBe('123.45')
		})

		it('should replace strings', () => {
			const transform = transformRegistry[TransformType.REPLACE]
			expect(transform('hello world', { pattern: 'world', replacement: 'there' }))
				.toBe('hello there')
			expect(transform('a-b-c', { pattern: '-', replacement: '_', global: true }))
				.toBe('a_b_c')
			expect(transform('test123test', { pattern: 'test', replacement: 'X' }))
				.toBe('X123test')
			expect(transform('test123test', { pattern: 'test', replacement: 'X', global: true }))
				.toBe('X123X')
			// Regex patterns
			expect(transform('abc123def', { pattern: '[0-9]+', replacement: 'X' }))
				.toBe('abcXdef')
			expect(transform('hello', { pattern: 'missing' })).toBe('hello')
		})
	})

	describe('Helper Functions Coverage', () => {
		describe('safeToString edge cases', () => {
			it('should handle null and undefined values', () => {
				const transform = transformRegistry[TransformType.TO_LOWER_CASE]
				expect(transform(null)).toBe('')
				expect(transform(undefined)).toBe('')
			})

			it('should handle objects that throw during JSON.stringify', () => {
				const transform = transformRegistry[TransformType.TO_LOWER_CASE]
				const circularObj: any = { a: 1 }
				circularObj.self = circularObj // Creates circular reference

				// Should return '[object]' when JSON.stringify fails
				expect(transform(circularObj)).toBe('[object]')
			})

			it('should handle various object types', () => {
				const transform = transformRegistry[TransformType.TO_UPPER_CASE]
				expect(transform({ key: 'value' })).toBe('{"KEY":"VALUE"}')
				expect(transform([1, 2, 3])).toBe('[1,2,3]')
				expect(transform(true)).toBe('TRUE')
				expect(transform(false)).toBe('FALSE')
				expect(transform(123)).toBe('123')
			})
		})

		describe('toUint8Array edge cases', () => {
			it('should handle Uint8Array input directly', () => {
				const transform = transformRegistry[TransformType.KECCAK256]
				const uint8Input = new Uint8Array([104, 101, 108, 108, 111]) // 'hello'
				const result = transform(uint8Input)
				expect(result).toBe('0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8')
			})

			it('should handle Uint8Array for SHA256', () => {
				const transform = transformRegistry[TransformType.SHA256]
				const uint8Input = new Uint8Array([104, 101, 108, 108, 111]) // 'hello'
				const result = transform(uint8Input)
				expect(result).toBe('0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
			})
		})
	})

	describe('parseTimestampSmart edge cases', () => {
		it('should handle numeric inputs', () => {
			const transform = transformRegistry[TransformType.PARSE_TIMESTAMP]

			// Unix seconds as number
			expect(transform(1705314600)).toBe('1705314600000')

			// Unix milliseconds as number
			expect(transform(1705314600000)).toBe('1705314600000')

			// Small number (interpreted as seconds)
			expect(transform(100)).toBe('100000')
		})

		it('should handle null/undefined/empty', () => {
			const transform = transformRegistry[TransformType.PARSE_TIMESTAMP]

			expect(() => transform(null)).toThrow('Cannot parse timestamp: empty value')
			expect(() => transform(undefined)).toThrow('Cannot parse timestamp: empty value')
			expect(() => transform('')).toThrow('Cannot parse timestamp: empty value')
		})

		it('should handle date patterns', () => {
			const transform = transformRegistry[TransformType.PARSE_TIMESTAMP]

			// MM/DD/YYYY pattern - Using US date format
			const mmddyyyy = transform('12/25/2024')
			expect(typeof mmddyyyy).toBe('string')
			expect(Number(mmddyyyy)).toBeGreaterThan(0)

			// Another valid MM/DD/YYYY date
			const usDate = transform('01/31/2024')
			expect(typeof usDate).toBe('string')
			expect(Number(usDate)).toBeGreaterThan(0)

			// DD.MM.YYYY pattern - This format might not parse correctly with Date constructor
			// Let's test that it matches the pattern but may still throw
			expect(() => transform('31.12.2024')).toThrow('Cannot parse timestamp: invalid format')

			// Test a date that matches pattern but creates invalid date
			const invalidDate = transform('02/30/2024') // Feb 30 doesn't exist
			// Date constructor might still create a date (March 1st)
			expect(typeof invalidDate).toBe('string')
		})

		it('should handle invalid date object creation', () => {
			const transform = transformRegistry[TransformType.PARSE_TIMESTAMP]

			// Pattern that matches but creates invalid date
			expect(() => transform('99/99/9999')).toThrow('Cannot parse timestamp: invalid format')
		})

		it('should handle YYYY-MM-DD format that fails Date.parse', () => {
			const transform = transformRegistry[TransformType.PARSE_TIMESTAMP]

			// Create a mock that will make Date.parse return NaN for the special format
			const originalDateParse = Date.parse
			Date.parse = jest.fn((str) => {
				if(str === '9999-99-99T00:00:00Z') {
					return NaN
				}

				return originalDateParse(str)
			})

			try {
				// This should match the YYYY-MM-DD pattern but fail Date.parse
				expect(() => transform('9999-99-99')).toThrow('Cannot parse timestamp: invalid format')
			} finally {
				Date.parse = originalDateParse
			}
		})

		it('should handle date patterns that parse successfully', () => {
			const transform = transformRegistry[TransformType.PARSE_TIMESTAMP]

			// Valid date that matches DD.MM.YYYY pattern - some locales might parse this
			// Let's mock Date constructor to make it parse successfully
			const OriginalDate = global.Date
			const mockDate = jest.fn((str) => {
				if(str === '15.01.2024') {
					return new OriginalDate('2024-01-15')
				}

				return new OriginalDate(str)
			}) as any
			mockDate.parse = OriginalDate.parse
			mockDate.now = OriginalDate.now
			mockDate.UTC = OriginalDate.UTC
			global.Date = mockDate

			try {
				const result = transform('15.01.2024')
				expect(typeof result).toBe('string')
				expect(Number(result)).toBeGreaterThan(0)
			} finally {
				global.Date = OriginalDate
			}
		})

		it('should handle NaN from parseInt', () => {
			const transform = transformRegistry[TransformType.PARSE_TIMESTAMP]

			// String that looks numeric but isn't
			expect(() => transform('12a34')).toThrow('Cannot parse timestamp: invalid format')
		})

		it('should parse timestamps regardless of format parameter', () => {
			const transform = transformRegistry[TransformType.PARSE_TIMESTAMP]

			// Format parameter is ignored now
			expect(transform('2024-01-15', { format: 'YYYY-MM-DD' })).toBe('1705276800000')
			expect(transform('2024-01-15')).toBe('1705276800000')

			// Different formats are parsed by parseTimestampSmart
			expect(transform('2024/01/15')).toBe('1705276800000')
			expect(transform('01/15/2024')).toBe('1705276800000')
		})

		it('should handle YYYY-MM-DD without format parameter', () => {
			const transform = transformRegistry[TransformType.PARSE_TIMESTAMP]

			// This should hit the specific YYYY-MM-DD parsing logic
			// First, let's make sure the normal Date.parse fails for this format
			const originalDateParse = Date.parse
			let callCount = 0
			Date.parse = jest.fn((str) => {
				callCount++
				// Make the first call (direct parse) return NaN
				if(callCount === 1 && str === '2024-12-25') {
					return NaN
				}

				// But allow the formatted version to work
				return originalDateParse(str)
			})

			try {
				const result = transform('2024-12-25')
				expect(typeof result).toBe('string')
				expect(Number(result)).toBe(1735084800000) // 2024-12-25T00:00:00Z
			} finally {
				Date.parse = originalDateParse
			}
		})
	})

	describe('evaluateCondition - missing branches', () => {
		it('should handle ne (not equal) condition', () => {
			const transform = transformRegistry[TransformType.VALIDATE]

			// Should pass when values are not equal
			expect(transform('pending', {
				condition: { ne: 'approved' },
				message: 'Should not be approved'
			})).toBe('pending')

			// Should fail when values are equal
			expect(() => transform('approved', {
				condition: { ne: 'approved' },
				message: 'Should not be approved'
			})).toThrow('Validation failed')
		})

		it('should handle gte (greater than or equal) condition', () => {
			const transform = transformRegistry[TransformType.VALIDATE]

			expect(transform(100, { condition: { gte: 100 } })).toBe(100)
			expect(transform(101, { condition: { gte: 100 } })).toBe(101)
			expect(() => transform(99, { condition: { gte: 100 } })).toThrow('Validation failed')
		})

		it('should handle lte (less than or equal) condition', () => {
			const transform = transformRegistry[TransformType.VALIDATE]

			expect(transform(100, { condition: { lte: 100 } })).toBe(100)
			expect(transform(99, { condition: { lte: 100 } })).toBe(99)
			expect(() => transform(101, { condition: { lte: 100 } })).toThrow('Validation failed')
		})

		it('should handle startsWith condition', () => {
			const transform = transformRegistry[TransformType.VALIDATE]

			expect(transform('hello world', { condition: { startsWith: 'hello' } })).toBe('hello world')
			expect(() => transform('world hello', { condition: { startsWith: 'hello' } })).toThrow('Validation failed')
		})

		it('should handle endsWith condition', () => {
			const transform = transformRegistry[TransformType.VALIDATE]

			expect(transform('hello world', { condition: { endsWith: 'world' } })).toBe('hello world')
			expect(() => transform('world hello', { condition: { endsWith: 'world' } })).toThrow('Validation failed')
		})

		it('should handle not condition', () => {
			const transform = transformRegistry[TransformType.VALIDATE]

			// Not equal
			expect(transform('pending', {
				condition: { not: { eq: 'approved' } }
			})).toBe('pending')

			expect(() => transform('approved', {
				condition: { not: { eq: 'approved' } }
			})).toThrow('Validation failed')
		})

		it('should return false for empty condition object', () => {
			const transform = transformRegistry[TransformType.VALIDATE]

			// Empty condition object should fail validation
			expect(() => transform('any value', {
				condition: {} as any,
				message: 'Empty condition'
			})).toThrow('Validation failed')
		})
	})

	describe('REPLACE transform - missing cases', () => {
		it('should handle regex pattern with forward slashes', () => {
			const transform = transformRegistry[TransformType.REPLACE]

			// Valid regex with slashes
			expect(transform('abc123def', {
				pattern: '/[0-9]+/',
				replacement: 'X'
			})).toBe('abcXdef')

			// Invalid regex should throw
			expect(() => transform('test', {
				pattern: '/[invalid/',
				replacement: 'X'
			})).toThrow('Invalid regex pattern')
		})

		it('should handle regex pattern starting with special chars', () => {
			const transform = transformRegistry[TransformType.REPLACE]

			// Pattern that looks like regex (starts with special char) - [123] matches any of 1, 2, or 3
			expect(transform('test123test', {
				pattern: '[123]',
				replacement: 'X'
			})).toBe('testXXXtest')

			// Another regex pattern
			expect(transform('hello world', {
				pattern: '^hello',
				replacement: 'Hi'
			})).toBe('Hi world')

			// Invalid regex pattern
			expect(() => transform('test', {
				pattern: '[invalid',
				replacement: 'X'
			})).toThrow('Invalid regex pattern')
		})

		it('should handle empty pattern', () => {
			const transform = transformRegistry[TransformType.REPLACE]

			// Empty pattern should return original string
			expect(transform('hello world', { pattern: '' })).toBe('hello world')
			expect(transform('test', {})).toBe('test')
		})

		it('should throw when result exceeds MAX_STRING_LENGTH', () => {
			const transform = transformRegistry[TransformType.REPLACE]

			// Create a string that will exceed limit when replacements are made
			const input = 'a'.repeat(10000)
			expect(() => transform(input, {
				pattern: 'a',
				replacement: 'a'.repeat(11), // Each 'a' becomes 11 'a's
				global: true
			})).toThrow('Result exceeds maximum string length')
		})
	})

	describe('MATH transform - missing cases', () => {
		it('should throw for unsafe numbers', () => {
			const transform = transformRegistry[TransformType.MATH]

			// Very large number that exceeds MAX_SAFE_INTEGER
			expect(() => transform('9007199254740992', { expression: '* 2' }))
				.toThrow('Math operation resulted in unsafe number')

			// Division resulting in infinity
			expect(() => transform('1', { expression: '/ 0.0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001' }))
				.toThrow('Math operation resulted in unsafe number')
		})

		it('should handle edge case numbers', () => {
			const transform = transformRegistry[TransformType.MATH]

			// Negative numbers
			expect(transform('-10', { expression: '* 2' })).toBe('-20')
			expect(transform('-5', { expression: '+ 10' })).toBe('5')

			// Decimal inputs
			expect(transform('3.14', { expression: '* 2' })).toBe('6.28')
			expect(transform('10.5', { expression: '- 0.5' })).toBe('10')
		})

		it('should return input when no expression provided', () => {
			const transform = transformRegistry[TransformType.MATH]

			expect(transform('123', {})).toBe('123')
			expect(transform('456', { expression: undefined })).toBe('456')
		})

		it('should handle invalid operator in expression', () => {
			const transform = transformRegistry[TransformType.MATH]

			// The regex should prevent this, but if somehow an invalid operator gets through
			expect(() => transform('10', { expression: '& 5' })).toThrow('Invalid math expression')
			expect(() => transform('10', { expression: '^ 5' })).toThrow('Invalid math expression')
		})
	})

	describe('SUBSTRING transform - edge cases', () => {
		it('should handle edge cases gracefully', () => {
			const transform = transformRegistry[TransformType.SUBSTRING]

			// Negative start (JavaScript treats as 0)
			expect(transform('hello', { start: -1 })).toBe('hello')

			// End less than start (JavaScript swaps them)
			expect(transform('hello', { start: 3, end: 1 })).toBe('el')

			// Negative end (JavaScript treats as 0)
			expect(transform('hello', { start: 0, end: -1 })).toBe('')
		})
	})

	describe('CONDITIONAL_ON transform - missing error case', () => {
		it('should throw when if condition is missing', () => {
			const transform = transformRegistry[TransformType.CONDITIONAL_ON]

			expect(() => transform('value', {}))
				.toThrow('conditionalOn requires "if" parameter')

			expect(() => transform('value', { then: ['toLowerCase'] }))
				.toThrow('conditionalOn requires "if" parameter')
		})

		it('should use empty array for else when not provided', () => {
			const transform = transformRegistry[TransformType.CONDITIONAL_ON]

			const context = { status: 'not-matching' }
			const result = transform('ignored-value', {
				checkField: 'status',
				if: { eq: 'matching' },
				then: ['toLowerCase']
				// No else provided
			}, context)

			expect(result).toEqual([])
		})
	})

	describe('CONCAT transform - MAX_STRING_LENGTH', () => {
		it('should throw when concatenated result exceeds MAX_STRING_LENGTH', () => {
			const transform = transformRegistry[TransformType.CONCAT]

			// Create array of strings that will exceed limit when concatenated
			const bigArray = Array(200).fill('a'.repeat(1000))

			expect(() => transform(bigArray))
				.toThrow('Result exceeds maximum string length')
		})

		it('should handle empty array', () => {
			const transform = transformRegistry[TransformType.CONCAT]
			expect(transform([])).toBe('')
		})

		it('should handle non-string array elements', () => {
			const transform = transformRegistry[TransformType.CONCAT]
			expect(transform([1, null, undefined, true, { a: 1 }]))
				.toBe('1true{"a":1}')
		})
	})

	describe('TEMPLATE transform - MAX_STRING_LENGTH', () => {
		it('should throw when template result exceeds MAX_STRING_LENGTH', () => {
			const transform = transformRegistry[TransformType.TEMPLATE]

			// Create a pattern that will exceed limit
			const bigPattern = '${value}'.repeat(20000) + 'x'.repeat(50000)

			expect(() => transform('test', { pattern: bigPattern }))
				.toThrow('Result exceeds maximum string length')
		})

		it('should handle null/undefined values in template', () => {
			const transform = transformRegistry[TransformType.TEMPLATE]

			expect(transform(null, { pattern: 'Value: ${value}' })).toBe('Value: ')
			expect(transform(undefined, { pattern: '${value} test' })).toBe(' test')
		})
	})

	describe('Registry utility functions', () => {
		it('should get transform by name', () => {
			const toLowerCase = getTransform(TransformType.TO_LOWER_CASE)
			expect(toLowerCase).toBeDefined()
			expect(toLowerCase!('HELLO')).toBe('hello')

			const unknown = getTransform('unknown-transform')
			expect(unknown).toBeUndefined()
		})

		it('should check if transform exists', () => {
			expect(hasTransform(TransformType.TO_LOWER_CASE)).toBe(true)
			expect(hasTransform(TransformType.KECCAK256)).toBe(true)
			expect(hasTransform('unknown-transform')).toBe(false)
		})
	})

	describe('Assert transforms - additional edge cases', () => {
		it('should handle assertOneOf with non-array values parameter', () => {
			const transform = transformRegistry[TransformType.ASSERT_ONE_OF]

			expect(() => transform('test', { values: 'not-an-array' as any }))
				.toThrow('assertOneOf requires "values" array parameter')

			expect(() => transform('test', { values: null as any }))
				.toThrow('assertOneOf requires "values" array parameter')
		})

		it('should handle various value types in assertions', () => {
			const transform = transformRegistry[TransformType.ASSERT_ONE_OF]

			// Numbers
			expect(transform(123, { values: [123, 456] })).toBe(123)

			// Booleans
			expect(transform(true, { values: [true, false] })).toBe(true)

			// Null/undefined
			expect(transform(null, { values: [null, 'test'] })).toBe(null)
			expect(transform(undefined, { values: [undefined, 'test'] })).toBe(undefined)
		})
	})

	describe('Math Transforms', () => {
		it('should perform math operations on string numbers', () => {
			const transform = transformRegistry[TransformType.MATH]
			// Basic operations
			expect(transform('10', { expression: '* 2' })).toBe('20')
			expect(transform('10', { expression: '+ 5' })).toBe('15')
			expect(transform('10', { expression: '- 3' })).toBe('7')
			expect(transform('10', { expression: '/ 2' })).toBe('5')

			// Decimal operations
			expect(transform('12345', { expression: '/ 100' })).toBe('123.45')
			expect(transform('123.45', { expression: '* 100' })).toBe('12345')

			// Scale for Revolut-style amounts
			expect(transform('12345', { expression: '/ 100' })).toBe('123.45')
			expect(transform('1000000', { expression: '/ 1000' })).toBe('1000')

			// Edge cases
			expect(transform('0', { expression: '+ 100' })).toBe('100')
			expect(transform('100', { expression: '* 0' })).toBe('0')
			expect(() => transform('10', { expression: 'invalid' }))
				.toThrow('Invalid math expression')
			// Now throws error for non-numeric input
			expect(() => transform('abc', { expression: '+ 10' }))
				.toThrow('Input value is not a valid number')
			// Division by zero protection
			expect(() => transform('10', { expression: '/ 0' }))
				.toThrow('Division by zero')
		})
	})

	describe('Crypto Transforms', () => {
		it('should compute keccak256 hash', () => {
			const transform = transformRegistry[TransformType.KECCAK256]
			const hash = transform('hello')
			expect(hash).toMatch(/^0x[a-f0-9]{64}$/)
			expect(hash).toBe('0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8')
		})

		it('should compute sha256 hash', () => {
			const transform = transformRegistry[TransformType.SHA256]
			const hash = transform('hello')
			expect(hash).toMatch(/^0x[a-f0-9]{64}$/)
			expect(hash).toBe('0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
		})
	})

	describe('Date Transforms', () => {
		it('should parse timestamps and return as string', () => {
			const transform = transformRegistry[TransformType.PARSE_TIMESTAMP]

			// ISO string
			expect(transform('2024-01-15T10:30:00Z')).toBe('1705314600000')

			// Unix seconds (as string)
			expect(transform('1705314600')).toBe('1705314600000')

			// Unix milliseconds (as string)
			expect(transform('1705318200000')).toBe('1705318200000')

			// Space-separated format (like Solidity DateParsing)
			expect(transform('2024-01-15 10:30:00')).toBe('1705314600000')

			// Date-only format (for Zelle)
			expect(transform('2024-01-15')).toBe('1705276800000') // 2024-01-15T00:00:00Z

			// With milliseconds
			expect(transform('2024-01-15T10:30:00.123Z')).toBe('1705314600123')

			// Format parameter is now ignored
			expect(transform('2024-01-15', { format: 'YYYY-MM-DDTHH:MM:SS' })).toBe('1705276800000')
			expect(transform('2024-01-15', { format: 'YYYY-MM-DD' })).toBe('1705276800000')
		})

		it('should handle date parsing edge cases', () => {
			const transform = transformRegistry[TransformType.PARSE_TIMESTAMP]

			// Edge case: Invalid dates
			expect(() => transform('invalid-date')).toThrow('Cannot parse timestamp')
			expect(() => transform('')).toThrow('Cannot parse timestamp: empty value')

			// Edge case: Different timezone formats
			expect(transform('2024-01-15T10:30:00+00:00')).toBe('1705314600000')
			expect(transform('2024-01-15T10:30:00-05:00')).toBe('1705332600000') // EST

			// Edge case: Leap year
			expect(transform('2024-02-29')).toBe('1709164800000') // 2024 is a leap year

			// Edge case: Beginning of epoch
			expect(transform('1970-01-01T00:00:00Z')).toBe('0')

			// Edge case: Multiple spaces - only first space is replaced, additional text causes error
			expect(() => transform('2024-01-15 10:30:00 PST')).toThrow('Cannot parse timestamp')

			// Edge case: Format validation with variations
			expect(transform('2024-01-15T10:30:00', { format: 'YYYY-MM-DDTHH:MM:SS' })).toBe('1705314600000')
			expect(transform('2024-01-15 10:30:00', { format: 'YYYY-MM-DDTHH:MM:SS' })).toBe('1705314600000')
		})
	})

	describe('Validation Transforms', () => {
		it('should assert equals', () => {
			const transform = transformRegistry[TransformType.ASSERT_EQUALS]

			// Passing assertions
			expect(transform('approved', { expected: 'approved' })).toBe('approved')
			expect(transform(123, { expected: 123 })).toBe(123)

			// Failing assertions - custom error messages removed
			expect(() => transform('pending', { expected: 'approved' }))
				.toThrow('Assertion failed: values do not match')
			expect(() => transform('pending', { expected: 'approved', message: 'Payment must be approved' }))
				.toThrow('Assertion failed: values do not match')
		})

		it('should assert one of multiple values', () => {
			const transform = transformRegistry[TransformType.ASSERT_ONE_OF]

			// Passing assertions
			expect(transform('p2p_money_transfer', { values: ['p2p_money_transfer', 'transfer_online'] }))
				.toBe('p2p_money_transfer')
			expect(transform('transfer_online', { values: ['p2p_money_transfer', 'transfer_online'] }))
				.toBe('transfer_online')

			// Failing assertions - custom error messages removed
			expect(() => transform('invalid_type', { values: ['p2p_money_transfer', 'transfer_online'] }))
				.toThrow('Assertion failed: value not in allowed list')
			expect(() => transform('invalid', { values: ['valid'], message: 'Invalid payment type' }))
				.toThrow('Assertion failed: value not in allowed list')

			// Error cases
			expect(() => transform('test', {})).toThrow('assertOneOf requires "values" array parameter')
		})

		it('should validate with conditions', () => {
			const transform = transformRegistry[TransformType.VALIDATE]

			// Passing validations
			expect(transform(100, { condition: { gt: 50 } })).toBe(100)
			expect(transform('approved', { condition: { eq: 'approved' } })).toBe('approved')
			expect(transform('hello world', { condition: { contains: 'world' } })).toBe('hello world')

			// Failing validations - custom error messages removed
			expect(() => transform(10, { condition: { gt: 50 } }))
				.toThrow('Validation failed')
			expect(() => transform(10, { condition: { gt: 50 }, message: 'Amount too low' }))
				.toThrow('Validation failed')

			// Complex conditions
			expect(transform(75, { condition: { and: [{ gt: 50 }, { lt: 100 }] } })).toBe(75)
			expect(() => transform(150, { condition: { and: [{ gt: 50 }, { lt: 100 }] } }))
				.toThrow('Validation failed')

			// Error cases
			expect(() => transform('test', {})).toThrow('validate requires "condition" parameter')
		})
	})

	describe('ConditionalOn Transform', () => {
		it('should apply then branch when condition is true', () => {
			const transform = transformRegistry[TransformType.CONDITIONAL_ON]

			// Test with simple condition
			const context = { currency: 'USD' }
			const ops = transform('ignored-value', {
				checkField: 'currency',
				if: { eq: 'USD' },
				then: [{ type: 'replace', pattern: 'USD', replacement: 'US Dollar' }],
				else: ['toUpperCase']
			}, context)
			expect(ops).toEqual([{ type: 'replace', pattern: 'USD', replacement: 'US Dollar' }])
		})

		it('should apply else branch when condition is false', () => {
			const transform = transformRegistry[TransformType.CONDITIONAL_ON]

			const context = { currency: 'EUR' }
			const ops = transform('ignored-value', {
				checkField: 'currency',
				if: { eq: 'USD' },
				then: [{ type: 'replace', pattern: 'USD', replacement: 'US Dollar' }],
				else: ['toUpperCase']
			}, context)
			expect(ops).toEqual(['toUpperCase'])
		})

		it('should handle currency-specific scaling logic', () => {
			const transform = transformRegistry[TransformType.CONDITIONAL_ON]

			// JPY should not be scaled
			const jpyContext = { currency: 'JPY' }
			const jpy = transform('ignored-value', {
				checkField: 'currency',
				if: { eq: 'JPY' },
				then: [], // No operations
				else: [{ type: 'math', expression: '/ 100' }] // Scale by 100 for other currencies
			}, jpyContext)
			expect(jpy).toEqual([])

			// USD should be scaled
			const usdContext = { currency: 'USD' }
			const usd = transform('ignored-value', {
				checkField: 'currency',
				if: { eq: 'JPY' },
				then: [],
				else: [{ type: 'math', expression: '/ 100' }]
			}, usdContext)
			expect(usd).toEqual([{ type: 'math', expression: '/ 100' }])
		})

		it('should handle complex conditions', () => {
			const transform = transformRegistry[TransformType.CONDITIONAL_ON]

			// Note: CONDITIONAL_ON transform returns an array of operations to be applied,
			// it doesn't execute them. The operations must be valid transform names.

			// Test with OR condition
			const context = { value: 100 }
			const ops = transform('ignored-value', {
				checkField: 'value',
				if: { or: [{ lt: 50 }, { gt: 200 }] },
				then: ['trim', 'keccak256'],
				else: ['trim']
			}, context)
			expect(ops).toEqual(['trim']) // 100 is not < 50 or > 200
		})

		it('should handle checkField to check conditions on different fields', () => {
			const transform = transformRegistry[TransformType.CONDITIONAL_ON]

			// Test checking currency field to determine amount transform
			const context = {
				currency: 'JPY',
				amount: '1000'
			}

			// When currency is JPY, don't scale
			const jpy = transform('1000', {
				checkField: 'currency',
				if: { eq: 'JPY' },
				then: [], // No operations
				else: [{ type: 'math', expression: '/ 100' }]
			}, context)
			expect(jpy).toEqual([])

			// When currency is USD, scale by 100
			context.currency = 'USD'
			const usd = transform('1000', {
				checkField: 'currency',
				if: { eq: 'JPY' },
				then: [],
				else: [{ type: 'math', expression: '/ 100' }]
			}, context)
			expect(usd).toEqual([{ type: 'math', expression: '/ 100' }])
		})

		it('should throw error when checkField is not found in context', () => {
			const transform = transformRegistry[TransformType.CONDITIONAL_ON]

			expect(() => transform('value', {
				checkField: 'nonExistent',
				if: { eq: 'test' },
				then: []
			}, { other: 'field' })).toThrow("Field 'nonExistent' not found in context")

			// Should also throw when context is not provided but checkField is specified
			expect(() => transform('value', {
				checkField: 'field',
				if: { eq: 'test' },
				then: []
			})).toThrow("Field 'field' not found in context")
		})

		it('should require checkField parameter', () => {
			const transform = transformRegistry[TransformType.CONDITIONAL_ON]

			// Without checkField, it should throw an error
			expect(() => transform('USD', {
				if: { eq: 'USD' },
				then: [{ type: 'replace', pattern: 'USD', replacement: 'US Dollar' }],
				else: ['toUpperCase']
			})).toThrow('conditionalOn requires "checkField" parameter')
		})
	})

	describe('String Combination Transforms', () => {
		it('should concatenate strings', () => {
			const transform = transformRegistry[TransformType.CONCAT]
			// Basic concatenation
			expect(transform(['1', '00'])).toBe('100')
			expect(transform(['hello', ' ', 'world'])).toBe('hello world')

			// Amount concatenation (MercadoPago style)
			expect(transform(['123', '45'])).toBe('12345') // $123.45 -> 12345 cents
			expect(transform(['1', '00'])).toBe('100') // $1.00 -> 100 cents
			expect(transform(['999', '99'])).toBe('99999') // $999.99 -> 99999 cents

			// Edge cases
			expect(transform([''])).toBe('')
			expect(transform(['a'])).toBe('a')
			expect(transform('not-array')).toBe('not-array')
		})
	})

	describe('Template Transform', () => {
		it('should handle template substitution', () => {
			const transform = transformRegistry[TransformType.TEMPLATE]

			// Single value replacement
			expect(transform('123', { pattern: '${value}.00' })).toBe('123.00')
			expect(transform('test', { pattern: 'Result: ${value}' })).toBe('Result: test')

			// Appending time to date (Zelle pattern)
			expect(transform('2024-01-15', { pattern: '${value}T23:59:59' })).toBe('2024-01-15T23:59:59')

			// Multiple replacements of same value
			expect(transform('foo', { pattern: '${value}-${value}' })).toBe('foo-foo')

			// Edge cases
			expect(transform('test', {})).toBe('test') // No pattern
			expect(transform('test', { pattern: 'No replacement' })).toBe('No replacement')
			expect(transform('', { pattern: 'Value: ${value}' })).toBe('Value: ')
		})
	})

	describe('Integration scenarios - chained transforms', () => {
		it('should handle complex nested conditions', () => {
			const transform = transformRegistry[TransformType.VALIDATE]

			// Complex AND with nested OR
			expect(transform(75, {
				condition: {
					and: [
						{ gt: 50 },
						{ or: [{ lt: 100 }, { eq: 100 }] }
					]
				}
			})).toBe(75)

			// Nested NOT conditions
			expect(transform('test', {
				condition: {
					not: {
						or: [
							{ eq: 'fail' },
							{ contains: 'error' }
						]
					}
				}
			})).toBe('test')
		})

		it('should handle all condition types with various input types', () => {
			const transform = transformRegistry[TransformType.VALIDATE]

			// String comparisons with numbers
			expect(transform('100', { condition: { gt: 50 } })).toBe('100')
			expect(transform('100', { condition: { lt: 200 } })).toBe('100')

			// Contains with non-string values converted to string
			expect(transform(12345, { condition: { contains: '234' } })).toBe(12345)
			expect(transform({ key: 'value' }, { condition: { contains: 'key' } })).toEqual({ key: 'value' })
		})
	})

	describe('CONSTANT Transform', () => {
		it('should return constant string values', () => {
			const transform = transformRegistry[TransformType.CONSTANT]

			expect(transform(null, { value: 'USD' })).toBe('USD')
			expect(transform('ignored', { value: 'ETH' })).toBe('ETH')
			expect(transform(123, { value: 'CONSTANT_VALUE' })).toBe('CONSTANT_VALUE')
		})

		it('should convert non-string values to strings', () => {
			const transform = transformRegistry[TransformType.CONSTANT]

			expect(transform(null, { value: 42 })).toBe('42')
			expect(transform(null, { value: true })).toBe('true')
			expect(transform(null, { value: false })).toBe('false')
			expect(transform(null, { value: 3.14 })).toBe('3.14')
		})

		it('should handle complex values', () => {
			const transform = transformRegistry[TransformType.CONSTANT]

			// Objects are stringified
			expect(transform(null, { value: { key: 'value' } })).toBe('{"key":"value"}')
			expect(transform(null, { value: [1, 2, 3] })).toBe('[1,2,3]')

			// Ethereum address
			expect(transform(null, { value: '0x742d35Cc6634C0532925a3b844Bc9e7595f62a3C' }))
				.toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f62a3C')
		})

		it('should require value parameter', () => {
			const transform = transformRegistry[TransformType.CONSTANT]

			expect(() => transform(null, {}))
				.toThrow('constant transform requires "value" parameter')
			expect(() => transform(null, { value: undefined }))
				.toThrow('constant transform requires "value" parameter')
		})

		it('should handle null and empty string as valid values', () => {
			const transform = transformRegistry[TransformType.CONSTANT]

			// null value becomes empty string
			expect(transform(null, { value: null })).toBe('')
			// empty string is valid
			expect(transform(null, { value: '' })).toBe('')
		})
	})

	describe('Registry Functions', () => {
		it('should list all transform names', () => {
			const names = getTransformNames()
			expect(names).toContain(TransformType.TO_LOWER_CASE)
			expect(names).toContain(TransformType.KECCAK256)
			expect(names).toContain(TransformType.PARSE_TIMESTAMP)
			expect(names).toContain(TransformType.ASSERT_EQUALS)
			expect(names).toContain(TransformType.TEMPLATE)
			expect(names).toContain(TransformType.CONSTANT)
			// We now have 16 transforms after adding CONSTANT
			expect(names.length).toBeGreaterThanOrEqual(16)
		})
	})
})