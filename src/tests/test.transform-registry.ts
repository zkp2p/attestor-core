import { describe, expect, it } from '@jest/globals'
import { TransformType } from 'src/types/declarative-processor'
import {
	getTransformNames,
	transformRegistry } from 'src/utils/processors/transform-registry'

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

			// With format validation
			expect(() => transform('2024-01-15', { format: 'YYYY-MM-DDTHH:MM:SS' }))
				.toThrow('does not match format')
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

			// Failing assertions - error messages are now sanitized
			expect(() => transform('pending', { expected: 'approved' }))
				.toThrow('Assertion failed: values do not match')
			expect(() => transform('pending', { expected: 'approved', message: 'Payment must be approved' }))
				.toThrow('Payment must be approved')
		})

		it('should assert one of multiple values', () => {
			const transform = transformRegistry[TransformType.ASSERT_ONE_OF]

			// Passing assertions
			expect(transform('p2p_money_transfer', { values: ['p2p_money_transfer', 'transfer_online'] }))
				.toBe('p2p_money_transfer')
			expect(transform('transfer_online', { values: ['p2p_money_transfer', 'transfer_online'] }))
				.toBe('transfer_online')

			// Failing assertions - error messages are now sanitized
			expect(() => transform('invalid_type', { values: ['p2p_money_transfer', 'transfer_online'] }))
				.toThrow('Assertion failed: value not in allowed list')
			expect(() => transform('invalid', { values: ['valid'], message: 'Invalid payment type' }))
				.toThrow('Invalid payment type')

			// Error cases
			expect(() => transform('test', {})).toThrow('assertOneOf requires "values" array parameter')
		})

		it('should validate with conditions', () => {
			const transform = transformRegistry[TransformType.VALIDATE]

			// Passing validations
			expect(transform(100, { condition: { gt: 50 } })).toBe(100)
			expect(transform('approved', { condition: { eq: 'approved' } })).toBe('approved')
			expect(transform('hello world', { condition: { contains: 'world' } })).toBe('hello world')

			// Failing validations - error messages are now sanitized
			expect(() => transform(10, { condition: { gt: 50 } }))
				.toThrow('Validation failed')
			expect(() => transform(10, { condition: { gt: 50 }, message: 'Amount too low' }))
				.toThrow('Amount too low')

			// Complex conditions
			expect(transform(75, { condition: { and: [{ gt: 50 }, { lt: 100 }] } })).toBe(75)
			expect(() => transform(150, { condition: { and: [{ gt: 50 }, { lt: 100 }] } }))
				.toThrow('Validation failed')

			// Error cases
			expect(() => transform('test', {})).toThrow('validate requires "condition" parameter')
		})
	})

	describe('Conditional Transform', () => {
		it('should apply then branch when condition is true', () => {
			const transform = transformRegistry[TransformType.CONDITIONAL]

			// Test with simple condition
			const ops = transform('USD', {
				if: { eq: 'USD' },
				then: [{ type: 'replace', pattern: 'USD', replacement: 'US Dollar' }],
				else: ['toUpperCase']
			})
			expect(ops).toEqual([{ type: 'replace', pattern: 'USD', replacement: 'US Dollar' }])
		})

		it('should apply else branch when condition is false', () => {
			const transform = transformRegistry[TransformType.CONDITIONAL]

			const ops = transform('EUR', {
				if: { eq: 'USD' },
				then: [{ type: 'replace', pattern: 'USD', replacement: 'US Dollar' }],
				else: ['toUpperCase']
			})
			expect(ops).toEqual(['toUpperCase'])
		})

		it('should handle currency-specific scaling logic', () => {
			const transform = transformRegistry[TransformType.CONDITIONAL]

			// JPY should not be scaled
			const jpy = transform('JPY', {
				if: { eq: 'JPY' },
				then: [], // No operations
				else: [{ type: 'math', expression: '/ 100' }] // Scale by 100 for other currencies
			})
			expect(jpy).toEqual([])

			// USD should be scaled
			const usd = transform('USD', {
				if: { eq: 'JPY' },
				then: [],
				else: [{ type: 'math', expression: '/ 100' }]
			})
			expect(usd).toEqual([{ type: 'math', expression: '/ 100' }])
		})

		it('should handle complex conditions', () => {
			const transform = transformRegistry[TransformType.CONDITIONAL]

			// Test with OR condition
			const ops = transform(100, {
				if: { or: [{ lt: 50 }, { gt: 200 }] },
				then: ['toString', 'keccak256'],
				else: ['toString']
			})
			expect(ops).toEqual(['toString']) // 100 is not < 50 or > 200
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

	describe('Registry Functions', () => {
		it('should list all transform names', () => {
			const names = getTransformNames()
			expect(names).toContain(TransformType.TO_LOWER_CASE)
			expect(names).toContain(TransformType.KECCAK256)
			expect(names).toContain(TransformType.PARSE_TIMESTAMP)
			expect(names).toContain(TransformType.ASSERT_EQUALS)
			expect(names).toContain(TransformType.TEMPLATE)
			// We now have 15 transforms after removing SHA3 and TO_UNIX_SECONDS
			expect(names.length).toBeGreaterThanOrEqual(15)
		})
	})
})