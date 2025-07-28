import { ProviderClaimData } from 'src/proto/api'

/**
 * Version of the declarative processor format
 */
export type ProcessorVersion = '1.0.0';

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

	TEMPLATE: 'template'
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
 * Extraction rule for a single value
 */
export interface ExtractionRule {
  /**
   * JSONPath or array of paths to try (first non-null wins)
   */
  path?: string
  paths?: string[]

  /**
   * Default value if extraction returns null/undefined
   */
  default?: any

  /**
   * Optional regex to apply after extraction
   */
  regex?: string

  /**
   * Regex group to extract (default: 1)
   */
  regexGroup?: number
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
  matches?: string // regex

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
 * Main declarative processor structure
 */
export interface DeclarativeProcessor {
  /**
   * Version of the processor format
   */
  version: ProcessorVersion

  /**
   * Optional description for documentation
   */
  description?: string

  /**
   * Extract phase: pull values from the claim using JSONPath
   * Key is the variable name, value is the extraction rule
   */
  extract: {
    [variableName: string]: string | ExtractionRule
  }

  /**
   * Transform phase: process extracted values
   * Key is the output variable name, value is the transform rule
   */
  transform?: {
    [variableName: string]: TransformRule
  }

  /**
   * Output phase: specify which variables to include in final array
   * Order matters - this defines the output array structure
   */
  output: string[]

  /**
   * Optional metadata for validation/optimization
   */
  metadata?: {
    /**
     * Expected input schema for validation
     */
    inputSchema?: any

    /**
     * Performance hints
     */
    hints?: {
      /**
       * Maximum expected claim size in bytes
       */
      maxClaimSize?: number

      /**
       * Expected execution time in ms
       */
      expectedTimeMs?: number
    }
  }
}

/**
 * Result of executing a declarative processor
 */
export interface DeclarativeProcessorResult {
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

    /**
     * Any warnings during execution
     */
    warnings?: string[]
  }
}

/**
 * Validation result for a declarative processor
 */
export interface ProcessorValidationResult {
  valid: boolean
  errors: Array<{
    path: string
    message: string
  }>
  warnings: Array<{
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
 * Type guard to check if a value is a declarative processor
 */
export function isDeclarativeProcessor(value: any): value is DeclarativeProcessor {
	return (
		typeof value === 'object' &&
    value !== null &&
    value.version === '1.0.0' &&
    typeof value.extract === 'object' &&
    Array.isArray(value.output)
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
	/** Claim identifier this processing belongs to */
	claimId: string
	/** Processed values array */
	values: ProcessedValue[]
	/** Single hash binding processor to provider (NOT user-specific) */
	processorProviderHash: string
	/** Signature over claimId + processorProviderHash + values */
	signature: Uint8Array
	/** Attestor address that signed */
	attestorAddress: string
	/** Provider name */
	provider: string
	/** Optional metadata */
	metadata?: Record<string, any>
}

/**
 * Options for processing a claim with a declarative processor
 */
export type ProcessClaimOptions = {
	/** The verified claim to process */
	claim: ProviderClaimData
	/** Declarative processor configuration */
	processor: DeclarativeProcessor
}

