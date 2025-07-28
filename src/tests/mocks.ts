import { Wallet } from 'ethers'
import type { preparePacketsForReveal } from 'src/utils/prepare-packets'

// Set up a test private key if not already set
if(!process.env.PRIVATE_KEY) {
	const testWallet = Wallet.createRandom()
	process.env.PRIVATE_KEY = testWallet.privateKey
}

/**
 * Spies on the preparePacketsForReveal function
 */
export const SPY_PREPARER = jest.fn<
	ReturnType<typeof preparePacketsForReveal>,
	Parameters<typeof preparePacketsForReveal>
>()

jest.mock('../utils/prepare-packets', () => {
	const actual = jest.requireActual('../utils/prepare-packets')
	SPY_PREPARER.mockImplementation(actual.preparePacketsForReveal)
	return {
		__esModule: true,
		...actual,
		preparePacketsForReveal: SPY_PREPARER
	}
})

jest.mock('../server/utils/apm', () => {
	return {
		__esModule: true,
		getApm: jest.fn()
	}
})
