import { describe, expect, it } from '@jest/globals'
import { createClaimData, executeProcessorForTest } from 'src/tests/processors/test-helpers'
import { DeclarativeProcessor } from 'src/types/declarative-processor'

const zelleBoAExtensionProof = {
	'claim': {
		'provider': 'http',
		'parameters': '{"body":"{\\"filterV1\\":{\\"dateFilter\\":{\\"timeframeForHistory\\":\\"DEFAULTDAYS\\"}},\\"sortCriteriaV1\\":{\\"fieldName\\":\\"DATE\\",\\"order\\":\\"DESCENDING\\"},\\"pageInfo\\":{\\"pageNum\\":1,\\"pageSize\\":\\"\\"}}","headers":{"Accept":"application/json","Accept-Language":"en-US","Content-Type":"application/json","Origin":"https://secure.bankofamerica.com","Referer":"https://secure.bankofamerica.com/pay-transfer-pay-portal/?request_locale=en-us&returnSiteIndicator=GAIMW&target=paymentactivity","Sec-Fetch-Dest":"empty","Sec-Fetch-Mode":"cors","Sec-Fetch-Site":"same-origin","User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36","X-Requested-With":"XMLHttpRequest","sec-ch-ua":"\\"Chromium\\";v=\\"136\\", \\"Google Chrome\\";v=\\"136\\", \\"Not.A/Brand\\";v=\\"99\\"","sec-ch-ua-mobile":"?0","sec-ch-ua-platform":"\\"macOS\\""},"method":"POST","paramValues":{},"responseMatches":[{"type":"regex","value":"\\"confirmationNumber\\":\\"(?<confirmationNumber>[^\\"]+)\\""},{"type":"regex","value":"\\"status\\":\\"(?<status>[^\\"]+)\\""},{"type":"regex","value":"\\"transactionDate\\":\\"(?<transactionDate>[^\\"]+)\\""},{"type":"regex","value":"\\"amount\\":(?<amount>[0-9\\\\.]+)"},{"hash":true,"type":"regex","value":"\\"aliasToken\\":\\"(?<aliasToken>[^\\"]+)\\""}],"responseRedactions":[{"jsonPath":"$.completedTransactions[0].confirmationNumber","xPath":""},{"jsonPath":"$.completedTransactions[0].status","xPath":""},{"jsonPath":"$.completedTransactions[0].transactionDate","xPath":""},{"jsonPath":"$.completedTransactions[0].amount","xPath":""},{"jsonPath":"$.completedTransactions[0].targetAccount.aliasToken","xPath":""}],"url":"https://secure.bankofamerica.com/ogateway/payment-activity/api/v4/activity"}',
		'owner': '0xf9f25d1b846625674901ace47d6313d1ac795265',
		'timestampS': 1747349461,
		'context': '{"contextAddress":"0x0","contextMessage":"8326399457664203853385587893474801619762725624996440086480664263627804731444","extractedParameters":{"aliasToken":"0x3bcb39ffd57dd47e25c484c95ce7f7591305af0cfaaf7f18ab4ab548217fb303","amount":"5.0","confirmationNumber":"osmgnjz2u","status":"COMPLETED","transactionDate":"2025-05-15"},"providerHash":"0x05eecaa422b995a513376f7ae0b3a16fab2bdcb7fb1eff38891475b56869a1bd"}',
		'identifier': '0x747ab3be259d0a33da0d6aeb2d8461454fa211f61ae6ffd1b8cbba54c015ad98',
		'epoch': 1
	}
}

const chaseListDeliveredProof = {
	'claim': {
		'provider': 'http',
		'parameters': '{"body":"pageId=&sortBy=PROCESS_DATE&orderBy=DESC","headers":{"Accept":"*/*","Accept-Language":"en-US,en;q=0.9","Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","Origin":"https://secure.chase.com","Referer":"https://secure.chase.com/web/auth/dashboard","Sec-Fetch-Dest":"empty","Sec-Fetch-Mode":"cors","Sec-Fetch-Site":"same-origin","User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36","sec-ch-ua":"\\"Chromium\\";v=\\"136\\", \\"Google Chrome\\";v=\\"136\\", \\"Not.A/Brand\\";v=\\"99\\"","sec-ch-ua-arch":"\\"arm\\"","sec-ch-ua-bitness":"\\"64\\"","sec-ch-ua-full-version-list":"\\"Chromium\\";v=\\"136.0.7103.48\\", \\"Google Chrome\\";v=\\"136.0.7103.48\\", \\"Not.A/Brand\\";v=\\"99.0.0.0\\"","sec-ch-ua-mobile":"?0","sec-ch-ua-model":"\\"\\"","sec-ch-ua-platform":"\\"macOS\\"","sec-ch-ua-platform-version":"\\"15.4.1\\"","sec-ch-ua-wow64":"?0","x-jpmc-client-request-id":"2e352685-05f7-41ee-aa22-ae732fc29e8c"},"method":"POST","paramValues":{},"responseMatches":[{"type":"regex","value":"\\"id\\":(?<id>[0-9]+)"},{"type":"regex","value":"\\"verboseStatus\\":\\"(?<verboseStatus>[^\\"]+)\\""},{"type":"regex","value":"\\"date\\":\\"(?<date>[^\\"]+)\\""},{"type":"regex","value":"\\"amount\\":(?<amount>[0-9\\\\.]+)"}],"responseRedactions":[{"jsonPath":"$.listItems[0].id","xPath":""},{"jsonPath":"$.listItems[0].verboseStatus","xPath":""},{"jsonPath":"$.listItems[0].date","xPath":""},{"jsonPath":"$.listItems[0].amount","xPath":""}],"url":"https://secure.chase.com/svc/rr/payments/secure/v1/quickpay/payment/activity/list"}',
		'owner': '0xf9f25d1b846625674901ace47d6313d1ac795265',
		'timestampS': 1746403585,
		'context': '{"contextAddress":"0x0","contextMessage":"0x0000000000000000000000000000000000000000000000000000000000000000","extractedParameters":{"amount":"10","date":"20250504","id":"24648754807","verboseStatus":"DELIVERED"},"providerHash":"0xc472a6b6bace68cef2750c5a713a9649b3a89965d2e7a7c81d8301987f281200"}',
		'identifier': '0xe08d79d2e4b6226dc35f3e531835b9d03bf848761c6d6c17205ead880fef08f7',
		'epoch': 1
	}
}

const chaseListCompletedProof = {
	'claim': {
		'provider': 'http',
		'parameters': '{"body":"pageId=&sortBy=PROCESS_DATE&orderBy=DESC","headers":{"Accept":"*/*","Accept-Language":"en-US,en;q=0.9","Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","Origin":"https://secure.chase.com","Referer":"https://secure.chase.com/web/auth/dashboard","Sec-Fetch-Dest":"empty","Sec-Fetch-Mode":"cors","Sec-Fetch-Site":"same-origin","User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36","sec-ch-ua":"\\"Chromium\\";v=\\"136\\", \\"Google Chrome\\";v=\\"136\\", \\"Not.A/Brand\\";v=\\"99\\"","sec-ch-ua-arch":"\\"arm\\"","sec-ch-ua-bitness":"\\"64\\"","sec-ch-ua-full-version-list":"\\"Chromium\\";v=\\"136.0.7103.48\\", \\"Google Chrome\\";v=\\"136.0.7103.48\\", \\"Not.A/Brand\\";v=\\"99.0.0.0\\"","sec-ch-ua-mobile":"?0","sec-ch-ua-model":"\\"\\"","sec-ch-ua-platform":"\\"macOS\\"","sec-ch-ua-platform-version":"\\"15.4.1\\"","sec-ch-ua-wow64":"?0","x-jpmc-client-request-id":"7d9a760f-93f1-4c79-90a9-1f7f5fe3cf4d"},"method":"POST","paramValues":{},"responseMatches":[{"type":"regex","value":"\\"id\\":(?<id>[0-9]+)"},{"type":"regex","value":"\\"verboseStatus\\":\\"(?<verboseStatus>[^\\"]+)\\""},{"type":"regex","value":"\\"date\\":\\"(?<date>[^\\"]+)\\""},{"type":"regex","value":"\\"amount\\":(?<amount>[0-9\\\\.]+)"}],"responseRedactions":[{"jsonPath":"$.listItems[2].id","xPath":""},{"jsonPath":"$.listItems[2].verboseStatus","xPath":""},{"jsonPath":"$.listItems[2].date","xPath":""},{"jsonPath":"$.listItems[2].amount","xPath":""}],"url":"https://secure.chase.com/svc/rr/payments/secure/v1/quickpay/payment/activity/list"}',
		'owner': '0xf9f25d1b846625674901ace47d6313d1ac795265',
		'timestampS': 1746403777,
		'context': '{"contextAddress":"0x0","contextMessage":"0x0000000000000000000000000000000000000000000000000000000000000000","extractedParameters":{"amount":"10","date":"20250428","id":"24569221649","verboseStatus":"COMPLETED"},"providerHash":"0xd7615f705f999e8db7b0c9c2a16849559b88f3b95d6bdeed8a8c106bee870046"}',
		'identifier': '0x4fa32890e7f7ae631445d2d962b75b0b69cc39c3e1e8daee57d2183da4e31877',
		'epoch': 1
	}
}

const zelleCitiExtensionProof = {
	'claim': {
		'provider': 'http',
		'parameters': '{"body":"","headers":{"Accept":"application/json","Accept-language":"en_US","Content-Type":"application/json","Referer":"https://online.citi.com/US/nga/zelle/transfer","Sec-Fetch-Dest":"empty","Sec-Fetch-Mode":"cors","Sec-Fetch-Site":"same-origin","User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36","appVersion":"CBOL-ANG-2025-04-01","businessCode":"GCB","channelId":"CBOL","client_id":"4a51fb19-a1a7-4247-bc7e-18aa56dd1c40","countryCode":"US","sec-ch-ua":"\\"Chromium\\";v=\\"136\\", \\"Google Chrome\\";v=\\"136\\", \\"Not.A/Brand\\";v=\\"99\\"","sec-ch-ua-mobile":"?0","sec-ch-ua-platform":"\\"macOS\\""},"method":"GET","paramValues":{},"responseMatches":[{"type":"regex","value":"\\"paymentID\\":\\"(?<paymentID>[^\\"]+)\\""},{"type":"regex","value":"\\"paymentStatus\\":\\"(?<paymentStatus>[^\\"]+)\\""},{"type":"regex","value":"\\"updatedTimeStamp\\":\\"(?<updatedTimeStamp>[^\\"]+)\\""},{"type":"regex","value":"\\"amount\\":\\"(?<amount>[^\\"]+)\\""},{"hash":true,"type":"regex","value":"\\"partyToken\\":\\"(?<partyToken>[^\\"]+)\\""}],"responseRedactions":[{"jsonPath":"$.content.paymentTransactionsData[2].paymentID","xPath":""},{"jsonPath":"$.content.paymentTransactionsData[2].paymentStatus","xPath":""},{"jsonPath":"$.content.paymentTransactionsData[2].updatedTimeStamp","xPath":""},{"jsonPath":"$.content.paymentTransactionsData[2].amount","xPath":""},{"jsonPath":"$.content.paymentTransactionsData[2].partyToken","xPath":""}],"url":"https://online.citi.com/gcgapi/prod/public/v1/p2ppayments/pastActivityTransactions?transactionCount=20&pageId=0&tab=All"}',
		'owner': '0xf9f25d1b846625674901ace47d6313d1ac795265',
		'timestampS': 1747334657,
		'context': '{"contextAddress":"0x0","contextMessage":"4948915460758196888156147053328476497446483899021706653248173960948416723660","extractedParameters":{"amount":"10.00","partyToken":"0x3bcb39ffd57dd47e25c484c95ce7f7591305af0cfaaf7f18ab4ab548217fb303","paymentID":"CTIwjcKauxso","paymentStatus":"DELIVERED","updatedTimeStamp":"04/28/2025"},"providerHash":"0x2a20d5d1fc3ccfa7f3053949fb067cb56447eb46cb415a10a496c36c5f9992d7"}',
		'identifier': '0x6eee8481892033bb43385634044cc0fb8b8e970790ad9f53d750996447c42064',
		'epoch': 1
	}
}

const wiseExtensionProof = {
	'claim': {
		'provider': 'http',
		'parameters': '{"body":"","method":"GET","paramValues":{"PROFILE_ID":"41246868","TRANSACTION_ID":"1036122853"},"responseMatches":[{"type":"regex","value":"\\"id\\":(?<paymentId>[0-9]+)"},{"type":"regex","value":"\\"state\\":\\"(?<state>[^\\"]+)\\""},{"type":"regex","value":"\\"state\\":\\"OUTGOING_PAYMENT_SENT\\",\\"date\\":(?<timestamp>[0-9]+)"},{"type":"regex","value":"\\"targetAmount\\":(?<targetAmount>[0-9\\\\.]+)"},{"type":"regex","value":"\\"targetCurrency\\":\\"(?<targetCurrency>[^\\"]+)\\""},{"hash":true,"type":"regex","value":"\\"targetRecipientId\\":(?<targetRecipientId>[0-9]+)"}],"responseRedactions":[{"jsonPath":"$.id","xPath":""},{"jsonPath":"$.state","xPath":""},{"jsonPath":"$.stateHistory","xPath":""},{"jsonPath":"$.targetAmount","xPath":""},{"jsonPath":"$.targetCurrency","xPath":""},{"jsonPath":"$.targetRecipientId","xPath":""}],"url":"https://wise.com/gateway/v3/profiles/{{PROFILE_ID}}/transfers/{{TRANSACTION_ID}}","writeRedactionMode":"zk"}',
		'owner': '0xf9f25d1b846625674901ace47d6313d1ac795265',
		'timestampS': 1737300588,
		'context': '{"contextAddress":"0x0","contextMessage":"3255272855445122854259407670991079284015086279635495324568586132056928581139","extractedParameters":{"PROFILE_ID":"41246868","TRANSACTION_ID":"1036122853","paymentId":"1036122853","state":"OUTGOING_PAYMENT_SENT","targetAmount":"0.11","targetCurrency":"EUR","targetRecipientId":"0x267d153c16d2605a4664ed8ede0a04a35cd406ecb879b8f119c2fe997a6921c4","timestamp":"1713200478000"},"providerHash":"0x14f029619c364094675f9b308d389a6edccde6f43c099e30c212a2ec219d9646"}',
		'identifier': '0xc1c633299549ee8779de99e3af3d50174d5b3544232d8d9b745067f82f03d1f9',
		'epoch': 1
	}
}

const venmoExtensionProof = {
	'claim': {
		'provider': 'http',
		'parameters': '{"body":"","method":"GET","paramValues":{"SENDER_ID":"1168869611798528966"},"responseMatches":[{"type":"regex","value":"\\"amount\\":\\"- \\\\$(?<amount>[^\\"]+)\\""},{"type":"regex","value":"\\"date\\":\\"(?<date>[^\\"]+)\\""},{"type":"regex","value":"\\"paymentId\\":\\"(?<paymentId>[^\\"]+)\\""},{"hash":true,"type":"regex","value":"\\"id\\":\\"(?<receiverId>[^\\"]+)\\""},{"type":"regex","value":"\\"subType\\":\\"none\\""}],"responseRedactions":[{"jsonPath":"$.stories[2].amount","xPath":""},{"jsonPath":"$.stories[2].date","xPath":""},{"jsonPath":"$.stories[2].paymentId","xPath":""},{"jsonPath":"$.stories[2].title.receiver.id","xPath":""},{"jsonPath":"$.stories[2].subType","xPath":""}],"url":"https://account.venmo.com/api/stories?feedType=me&externalId={{SENDER_ID}}"}',
		'owner': '0xf9f25d1b846625674901ace47d6313d1ac795265',
		'timestampS': 1741289466,
		'context': '{"contextAddress":"0x0","contextMessage":"1130949156358289030228004429378196774671616229922798947763187449647160396233","extractedParameters":{"SENDER_ID":"1168869611798528966","amount":"1.00","date":"2025-03-06T18:36:45","paymentId":"4282537099205562654","receiverId":"0xc70eb85ded26d9377e4f0b244c638ee8f7e731114911bf547bff27f7d8fc3bfa"},"providerHash":"0x709569cc5850c23c4d8966524137d40b82d3056949fb0912be29a10803784a75"}',
		'identifier': '0x2392a6dbec48a64c9a0234d001837232fcfc80d4f79f2f53b0cf02605eeb7aad',
		'epoch': 1
	}
}

const cashappExtensionProof = {
	'claim': {
		'provider': 'http',
		'parameters': '{"body":"{\\"activity_token\\":{\\"activity_token_type\\":\\"CUSTOMER_TOKEN\\",\\"token\\":\\"{{SENDER_ID}}\\"},\\"activity_scope\\":\\"MY_ACTIVITY_WEB_V2\\",\\"caller_token\\":\\"{{SENDER_ID}}\\",\\"page_size\\":15,\\"request_context\\":{}}","method":"POST","paramValues":{"SENDER_ID":"C_0twqj8ycc"},"responseMatches":[{"type":"regex","value":"\\"amount\\":(?<amount>[0-9]+)"},{"type":"regex","value":"\\"currency_code\\":\\"(?<currency_code>[^\\"]+)\\""},{"type":"regex","value":"\\"display_date\\":(?<date>[0-9]+)"},{"hash":true,"type":"regex","value":"\\"cashtag\\":\\"(?<receiverId>[^\\"]+)\\""},{"type":"regex","value":"\\"token\\":\\"(?<paymentId>[^\\"]+)\\""},{"type":"regex","value":"\\"state\\":\\"(?<state>[^\\"]+)\\""}],"responseRedactions":[{"jsonPath":"$.activity_rows[1].payment_history_inputs_row.payment.amount.amount","xPath":""},{"jsonPath":"$.activity_rows[1].payment_history_inputs_row.payment.amount.currency_code","xPath":""},{"jsonPath":"$.activity_rows[1].payment_history_inputs_row.payment.display_date","xPath":""},{"jsonPath":"$.activity_rows[1].payment_history_inputs_row.recipient.cashtag","xPath":""},{"jsonPath":"$.activity_rows[1].payment_history_inputs_row.payment.token","xPath":""},{"jsonPath":"$.activity_rows[1].payment_history_inputs_row.payment.state","xPath":""}],"url":"https://cash.app/cash-app/activity/v1.0/page"}',
		'owner': '0xf9f25d1b846625674901ace47d6313d1ac795265',
		'timestampS': 1736260362,
		'context': '{"contextAddress":"0x0","contextMessage":"12014506636571874886965000811776567979685927375542718613570391557275994688735","extractedParameters":{"SENDER_ID":"C_0twqj8ycc","amount":"100","currency_code":"USD","date":"1735841166000","paymentId":"7cwz2mgva","receiverId":"0x7dfd873a8a837f59842e5493dcea3a71b6f559dacd5886d3ce65542e51240585","state":"COMPLETE"},"providerHash":"0xb03e3643371b78072eeaa716fd7a4817ee747c89eb4a4bab1596cb70c6b7a4a5"}',
		'identifier': '0xa799a7b7bbdc062955ecca3d6d7dbc1ef7f0047696287812111346568212db98',
		'epoch': 1
	}
}

const mercadoOnlineTransferExtensionProof = {
	'claim': {
		'provider': 'http',
		'parameters': '{"body":"","headers":{"Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7","Accept-Language":"en-US,en;q=0.9","Sec-Fetch-Dest":"document","Sec-Fetch-Mode":"navigate","Sec-Fetch-Site":"none","Upgrade-Insecure-Requests":"1","User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36","device-memory":"8","downlink":"10","dpr":"2","ect":"4g","rtt":"50","sec-ch-ua":"\\"Chromium\\";v=\\"134\\", \\"Not:A-Brand\\";v=\\"24\\", \\"Google Chrome\\";v=\\"134\\"","sec-ch-ua-mobile":"?0","sec-ch-ua-platform":"\\"macOS\\"","viewport-width":"1066"},"method":"GET","paramValues":{"PAYMENT_ID":"online_transfer_movement-40397c71e99fb3afceeed91664536aa631484ceb","URL_PARAMS_FROM":"mp-home"},"responseMatches":[{"hash":true,"type":"regex","value":"v2__detail\\">(.*?)CVU: (?<recipientId>[0-9]+)</li>"},{"type":"regex","value":"<span class=\\"andes-money-amount__fraction\\" aria-hidden=\\"true\\">(?<amt>[0-9.]+)</span><span aria-hidden=\\"true\\">,</span><span class=\\"andes-money-amount__cents\\" aria-hidden=\\"true\\">(?<cents>[0-9]+)</span>"},{"type":"regex","value":"Total\\",\\"amount\\":{\\"currency_id\\":\\"(?<curr>[^\\"]+)\\""},{"type":"regex","value":",\\"date\\":\\"(?<date>[^\\"]+)\\",\\"sections\\""},{"type":"regex","value":"\\"operationId\\":(?<paymentId>[^,]+),\\"activityName\\":\\"(?<paymentType>[^\\"]+)\\",\\"activityStatus\\":\\"(?<paymentStatus>[^\\"]+)\\","}],"responseRedactions":[{"jsonPath":"","regex":"v2__detail\\">(.*?)CVU: (.*?)</li>","xPath":""},{"jsonPath":"","regex":"<span class=\\"andes-money-amount__fraction\\" aria-hidden=\\"true\\">(.*?)</span><span aria-hidden=\\"true\\">,</span><span class=\\"andes-money-amount__cents\\" aria-hidden=\\"true\\">(.*?)</span>","xPath":""},{"jsonPath":"","regex":"\\"Total\\",\\"amount\\":{\\"currency_id\\":\\"(.*?)\\"","xPath":""},{"jsonPath":"","regex":",\\"date\\":\\"(.*)\\",\\"sections\\"","xPath":""},{"jsonPath":"","regex":"\\"operationId\\":(.*?),\\"activityName\\":\\"(.*?)\\",\\"activityStatus\\":\\"(.*?),","xPath":""}],"url":"https://www.mercadopago.com.ar/activities/detail/{{PAYMENT_ID}}?from={{URL_PARAMS_FROM}}"}',
		'owner': '0xf9f25d1b846625674901ace47d6313d1ac795265',
		'timestampS': 1742588826,
		'context': '{"contextAddress":"0x0","contextMessage":"4519540906848171844380991692694776058038564615875128315222420248570560176998","extractedParameters":{"PAYMENT_ID":"online_transfer_movement-40397c71e99fb3afceeed91664536aa631484ceb","URL_PARAMS_FROM":"mp-home","amt":"1","cents":"00","curr":"ARS","date":"2025-03-21T19:54:05.000Z","paymentId":"105936159704","paymentStatus":"approved","paymentType":"transfer_online","recipientId":"0xf5b16d9e4edde5a51d378b8126eaffb65d0d06d0ad21f4d037611f945d3837e8"},"providerHash":"0x09ff1db71c6ed6f079954a9cd5539cacf65cd3cf3c76b3c3c33ebfc4e5c0f7ee"}',
		'identifier': '0x7f0945b665233c542c5988c363df654482ce1ef27e082e434cc2edf8d620279d',
		'epoch': 1
	}
}

describe('Payment Processors', () => {

	describe('Zelle Bank of America Processor', () => {
		const processor: DeclarativeProcessor = {
			version: '1.0.0',
			extract: {
				amount: '$.context.extractedParameters.amount',
				status: '$.context.extractedParameters.status',
				transactionDate: '$.context.extractedParameters.transactionDate',
				confirmationNumber: '$.context.extractedParameters.confirmationNumber',
				recipientId: '$.context.extractedParameters.aliasToken'
			},
			transform: {
				amountInCents: {
					input: 'amount',
					ops: [
						{ type: 'math', expression: '* 100' }
					]
				},
				timestamp: {
					input: 'transactionDate',
					ops: [
						{ type: 'parseTimestamp', format: 'YYYY-MM-DD' }
					]
				},
				validatedStatus: {
					input: 'status',
					ops: [
						{ type: 'assertEquals', expected: 'COMPLETED', message: 'Transaction must be completed' }
					]
				},
				currency: {
					input: 'status',
					ops: [
						{ type: 'template', pattern: 'USD' }
					]
				}
			},
			outputs: [
				{ name: 'recipientId', type: 'address' },
				{ name: 'amountInCents', type: 'uint256' },
				{ name: 'currency', type: 'string' },
				{ name: 'timestamp', type: 'uint256' }
			]
		}

		it('should process Zelle BoA payment correctly', async() => {
			const claimData = createClaimData(zelleBoAExtensionProof)
			const result = await executeProcessorForTest(processor, claimData)

			expect(result.values).toHaveLength(4)
			expect(result.values[0]).toBe('0x3bcb39ffd57dd47e25c484c95ce7f7591305af0cfaaf7f18ab4ab548217fb303') // recipientId
			expect(result.values[1]).toBe('500') // $5.00 -> 500 cents
			expect(result.values[2]).toBe('USD') // currency
			expect(result.values[3]).toBe('1747267200000') // timestamp
		})
	})

	describe('Chase Payment Processor', () => {
		const processor: DeclarativeProcessor = {
			version: '1.0.0',
			extract: {
				amount: '$.context.extractedParameters.amount',
				date: '$.context.extractedParameters.date',
				id: '$.context.extractedParameters.id',
				status: '$.context.extractedParameters.verboseStatus'
			},
			transform: {
				amountInCents: {
					input: 'amount',
					ops: [
						{ type: 'math', expression: '* 100' }
					]
				},
				timestamp: {
					input: 'date',
					ops: [
						{ type: 'replace', pattern: '^(\\d{4})(\\d{2})(\\d{2})$', replacement: '$1-$2-$3' },
						{ type: 'parseTimestamp', format: 'YYYY-MM-DD' }
					]
				},
				validatedStatus: {
					input: 'status',
					ops: [
						{ type: 'assertOneOf', values: ['DELIVERED', 'COMPLETED'], message: 'Payment must be delivered or completed' }
					]
				},
				recipientId: {
					input: 'id',
					ops: [
						'keccak256'
					]
				},
				currency: {
					input: 'status',
					ops: [
						{ type: 'template', pattern: 'USD' }
					]
				}
			},
			outputs: [
				{ name: 'recipientId', type: 'bytes32' },
				{ name: 'amountInCents', type: 'uint256' },
				{ name: 'currency', type: 'string' },
				{ name: 'timestamp', type: 'uint256' }
			]
		}

		it('should process Chase DELIVERED payment', async() => {
			const claimData = createClaimData(chaseListDeliveredProof)
			const result = await executeProcessorForTest(processor, claimData)

			expect(result.values).toHaveLength(4)
			expect(result.values[0]).toMatch(/^0x[a-f0-9]{64}$/) // hashed recipient ID
			expect(result.values[1]).toBe('1000') // $10 -> 1000 cents
			expect(result.values[2]).toBe('USD') // currency
			expect(result.values[3]).toBe('1746316800000') // timestamp
		})

		it('should process Chase COMPLETED payment', async() => {
			const claimData = createClaimData(chaseListCompletedProof)
			const result = await executeProcessorForTest(processor, claimData)

			expect(result.values).toHaveLength(4)
			expect(result.values[0]).toMatch(/^0x[a-f0-9]{64}$/) // hashed recipient ID
			expect(result.values[1]).toBe('1000') // $10 -> 1000 cents
			expect(result.values[2]).toBe('USD') // currency
			expect(result.values[3]).toBe('1745798400000') // timestamp
		})
	})

	describe('Zelle Citi Processor', () => {
		const processor: DeclarativeProcessor = {
			version: '1.0.0',
			extract: {
				amount: '$.context.extractedParameters.amount',
				paymentID: '$.context.extractedParameters.paymentID',
				paymentStatus: '$.context.extractedParameters.paymentStatus',
				updatedTimeStamp: '$.context.extractedParameters.updatedTimeStamp',
				recipientId: '$.context.extractedParameters.partyToken'
			},
			transform: {
				amountInCents: {
					input: 'amount',
					ops: [
						{ type: 'math', expression: '* 100' }
					]
				},
				timestamp: {
					input: 'updatedTimeStamp',
					ops: [
						{ type: 'parseTimestamp' }
					]
				},
				validatedStatus: {
					input: 'paymentStatus',
					ops: [
						{ type: 'assertEquals', expected: 'DELIVERED', message: 'Payment must be delivered' }
					]
				},
				currency: {
					input: 'paymentStatus',
					ops: [
						{ type: 'template', pattern: 'USD' }
					]
				}
			},
			outputs: [
				{ name: 'recipientId', type: 'address' },
				{ name: 'amountInCents', type: 'uint256' },
				{ name: 'currency', type: 'string' },
				{ name: 'timestamp', type: 'uint256' }
			]
		}

		it('should process Zelle Citi payment correctly', async() => {
			const claimData = createClaimData(zelleCitiExtensionProof)
			const result = await executeProcessorForTest(processor, claimData)

			expect(result.values).toHaveLength(4)
			expect(result.values[0]).toBe('0x3bcb39ffd57dd47e25c484c95ce7f7591305af0cfaaf7f18ab4ab548217fb303') // recipientId
			expect(result.values[1]).toBe('1000') // $10.00 -> 1000 cents
			expect(result.values[2]).toBe('USD') // currency
			expect(result.values[3]).toBe('1745798400000') // timestamp
		})
	})

	describe('Wise Processor', () => {
		const processor: DeclarativeProcessor = {
			version: '1.0.0',
			extract: {
				paymentId: '$.context.extractedParameters.paymentId',
				state: '$.context.extractedParameters.state',
				timestamp: '$.context.extractedParameters.timestamp',
				targetAmount: '$.context.extractedParameters.targetAmount',
				targetCurrency: '$.context.extractedParameters.targetCurrency',
				targetRecipientId: '$.context.extractedParameters.targetRecipientId'
			},
			transform: {
				amountInCents: {
					input: 'targetAmount',
					ops: [
						{ type: 'math', expression: '* 100' }
					]
				},
				validatedState: {
					input: 'state',
					ops: [
						{ type: 'assertEquals', expected: 'OUTGOING_PAYMENT_SENT', message: 'Payment must be sent' }
					]
				}
			},
			outputs: [
				{ name: 'targetRecipientId', type: 'address' },
				{ name: 'amountInCents', type: 'uint256' },
				{ name: 'targetCurrency', type: 'string' },
				{ name: 'timestamp', type: 'uint256' }
			]
		}

		it('should process Wise transfer correctly', async() => {
			const claimData = createClaimData(wiseExtensionProof)
			const result = await executeProcessorForTest(processor, claimData)

			expect(result.values).toHaveLength(4)
			expect(result.values[0]).toBe('0x267d153c16d2605a4664ed8ede0a04a35cd406ecb879b8f119c2fe997a6921c4') // recipientId
			expect(result.values[1]).toBe('11') // €0.11 -> 11 cents
			expect(result.values[2]).toBe('EUR') // currency
			expect(result.values[3]).toBe('1713200478000') // timestamp
		})
	})

	describe('Venmo Processor', () => {
		const processor: DeclarativeProcessor = {
			version: '1.0.0',
			extract: {
				amount: '$.context.extractedParameters.amount',
				date: '$.context.extractedParameters.date',
				paymentId: '$.context.extractedParameters.paymentId',
				receiverId: '$.context.extractedParameters.receiverId'
			},
			transform: {
				amountInCents: {
					input: 'amount',
					ops: [
						{ type: 'math', expression: '* 100' }
					]
				},
				timestamp: {
					input: 'date',
					ops: [
						{ type: 'parseTimestamp' }
					]
				},
				currency: {
					input: 'receiverId',
					ops: [
						{ type: 'template', pattern: 'USD' }
					]
				}
			},
			outputs: [
				{ name: 'receiverId', type: 'address' },
				{ name: 'amountInCents', type: 'uint256' },
				{ name: 'currency', type: 'string' },
				{ name: 'timestamp', type: 'uint256' }
			]
		}

		it('should process Venmo payment correctly', async() => {
			const claimData = createClaimData(venmoExtensionProof)
			const result = await executeProcessorForTest(processor, claimData)

			expect(result.values).toHaveLength(4)
			expect(result.values[0]).toBe('0xc70eb85ded26d9377e4f0b244c638ee8f7e731114911bf547bff27f7d8fc3bfa') // recipientId
			expect(result.values[1]).toBe('100') // $1.00 -> 100 cents
			expect(result.values[2]).toBe('USD') // currency
			expect(result.values[3]).toBe('1741286205000') // timestamp
		})
	})

	describe('CashApp Processor', () => {
		const processor: DeclarativeProcessor = {
			version: '1.0.0',
			extract: {
				amount: '$.context.extractedParameters.amount',
				currencyCode: '$.context.extractedParameters.currency_code',
				date: '$.context.extractedParameters.date',
				receiverId: '$.context.extractedParameters.receiverId',
				paymentId: '$.context.extractedParameters.paymentId',
				state: '$.context.extractedParameters.state'
			},
			transform: {
				amountInCents: {
					input: 'amount',
					ops: []
				},
				timestamp: {
					input: 'date',
					ops: []
				},
				validatedState: {
					input: 'state',
					ops: [
						{ type: 'assertEquals', expected: 'COMPLETE', message: 'Payment must be complete' }
					]
				}
			},
			outputs: [
				{ name: 'receiverId', type: 'address' },
				{ name: 'amountInCents', type: 'uint256' },
				{ name: 'currencyCode', type: 'string' },
				{ name: 'timestamp', type: 'uint256' }
			]
		}

		it('should process CashApp payment correctly', async() => {
			const claimData = createClaimData(cashappExtensionProof)
			const result = await executeProcessorForTest(processor, claimData)

			expect(result.values).toHaveLength(4)
			expect(result.values[0]).toBe('0x7dfd873a8a837f59842e5493dcea3a71b6f559dacd5886d3ce65542e51240585') // recipientId
			expect(result.values[1]).toBe('100') // Already in cents
			expect(result.values[2]).toBe('USD') // currency
			expect(result.values[3]).toBe('1735841166000') // timestamp
		})
	})

	describe('MercadoPago Processor', () => {
		const processor: DeclarativeProcessor = {
			version: '1.0.0',
			extract: {
				amt: '$.context.extractedParameters.amt',
				cents: '$.context.extractedParameters.cents',
				curr: '$.context.extractedParameters.curr',
				date: '$.context.extractedParameters.date',
				paymentId: '$.context.extractedParameters.paymentId',
				paymentStatus: '$.context.extractedParameters.paymentStatus',
				recipientId: '$.context.extractedParameters.recipientId'
			},
			transform: {
				amountInCents: {
					inputs: ['amt', 'cents'],
					ops: [
						'concat'
					]
				},
				timestamp: {
					input: 'date',
					ops: [
						{ type: 'parseTimestamp' }
					]
				},
				validatedStatus: {
					input: 'paymentStatus',
					ops: [
						{ type: 'assertEquals', expected: 'approved', message: 'Payment must be approved' }
					]
				}
			},
			outputs: [
				{ name: 'recipientId', type: 'address' },
				{ name: 'amountInCents', type: 'uint256' },
				{ name: 'curr', type: 'string' },
				{ name: 'timestamp', type: 'uint256' }
			]
		}

		it('should process MercadoPago payment correctly', async() => {
			const claimData = createClaimData(mercadoOnlineTransferExtensionProof)
			const result = await executeProcessorForTest(processor, claimData)

			expect(result.values).toHaveLength(4)
			expect(result.values[0]).toBe('0xf5b16d9e4edde5a51d378b8126eaffb65d0d06d0ad21f4d037611f945d3837e8') // recipientId (already hashed)
			expect(result.values[1]).toBe('100') // $1.00 -> 100 cents
			expect(result.values[2]).toBe('ARS') // currency
			expect(result.values[3]).toBe('1742586845000') // 2025-03-21T19:54:05.000Z in ms
		})
	})

})