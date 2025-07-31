import { ProviderClaimData } from 'src/proto/api'

/**
 * Core transform operations available
 */
export const TransformType = {
	TO_LOWER_CASE: 'toLowerCase',
	TO_UPPER_CASE: 'toUpperCase',
	TRIM: 'trim',
	SUBSTRING: 'substring',
	REPLACE: 'replace',

	MATH: 'math',

	KECCAK256: 'keccak256',
	SHA256: 'sha256',

	PARSE_TIMESTAMP: 'parseTimestamp',

	ASSERT_EQUALS: 'assertEquals',
	ASSERT_ONE_OF: 'assertOneOf',
	VALIDATE: 'validate',

	CONCAT: 'concat',

	CONDITIONAL: 'conditional',

	TEMPLATE: 'template',
	
	CONSTANT: 'constant'
} as const

export type TransformType = typeof TransformType[keyof typeof TransformType]

/**
 * Transform operation configuration
 */
export interface TransformOperation {
  type: string
  [key: string]: any
}


/**
 * Transform rule for processing extracted values
 */
export interface TransformRule {
  /**
   * Input field name from extracted parameters
   */
  input?: string

  /**
   * Multiple input field names (for operations like concat)
   */
  inputs?: string[]

  /**
   * Operations to apply in sequence
   */
  ops: (TransformOperation | string)[]
}

/**
 * Conditional expression for logic operations
 */
export interface ConditionalExpression {
  eq?: any // equals
  ne?: any // not equals
  gt?: number // greater than
  lt?: number // less than
  gte?: number // greater than or equal
  lte?: number // less than or equal

  contains?: string
  startsWith?: string
  endsWith?: string

  and?: ConditionalExpression[]
  or?: ConditionalExpression[]
  not?: ConditionalExpression
}

/**
 * Conditional transform configuration
 */
export interface ConditionalTransform {
  type: 'conditional'
  if: ConditionalExpression
  then: (TransformOperation | string)[]
  else?: (TransformOperation | string)[]
}

/**
 * Output specification combining variable name and EVM type
 */
export interface OutputSpec {
  /** Variable name to output */
  name: string
  /** EVM type for smart contract encoding */
  type: string
}

/**
 * Main processor structure
 */
export interface Processor {
  /**
   * Extract phase: pull values from the claim using JSONPath
   * Key is the variable name, value is the JSONPath string
   */
  extract: {
    [variableName: string]: string
  }

  /**
   * Transform phase: process extracted values
   * Key is the output variable name, value is the transform rule
   */
  transform?: {
    [variableName: string]: TransformRule
  }

  /**
   * Output specification combining variable names and their EVM types
   * Order matters - this defines the output array structure
   * Common types: uint256, uint128, uint64, uint32, uint16, uint8, int256, address, bytes32, bool, string
   */
  outputs: OutputSpec[]
}

/**
 * Result of executing a processor
 */
export interface ProcessorResult {
  /**
   * Output values in the order specified by processor.output
   */
  values: string[]

  /**
   * Execution metadata for debugging/monitoring
   */
  metadata?: {
    /**
     * Execution time in milliseconds
     */
    executionTimeMs: number

    /**
     * Variables that were successfully extracted
     */
    extractedVariables: string[]

    /**
     * Variables that used default values
     */
    defaultedVariables: string[]
  }
}

/**
 * Validation result for a processor
 */
export interface ProcessorValidationResult {
  valid: boolean
  errors: Array<{
    path: string
    message: string
  }>
}

/**
 * Transform function signature
 */
export type TransformFunction = (value: any, params?: any) => any;

/**
 * Registry of available transform functions
 */
export interface TransformRegistry {
  [transformType: string]: TransformFunction
}

/**
 * Type guard to check if a value is a processor
 */
export function isProcessor(value: any): value is Processor {
	return (
		typeof value === 'object' &&
    value !== null &&
    typeof value.extract === 'object' &&
    Array.isArray(value.outputs) &&
    value.outputs.every((o: any) => typeof o === 'object' &&
      typeof o.name === 'string' &&
      typeof o.type === 'string'
    )
	)
}

/**
 * Processed value that will be submitted on-chain
 */
export type ProcessedValue = string | number | boolean

/**
 * Processed claim data with attestor signature
 */
export type ProcessedClaimData = {
	/** The original verified claim */
	claim: ProviderClaimData
	/** Signature over the message hash */
	signature: Uint8Array
	/** Output specifications from the processor */
	outputs: OutputSpec[]
	/** The actual processed values in order of outputs */
	values: string[]
	/** Attestor address that signed */
	attestorAddress: string
}

/**
 * Options for processing a claim with a processor
 */
export type ProcessClaimOptions = {
	/** The verified claim to process */
	claim: ProviderClaimData
	/** Processor configuration */
	processor: Processor
}

