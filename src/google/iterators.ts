import dateFns from 'date-fns'
import { youtube_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { GaxiosResponse, GaxiosPromise, MethodOptions } from 'googleapis-common'

import setupLogger from '../lib/logger'


type SubscriptionsParams = youtube_v3.Params$Resource$Subscriptions$List
type SubscriptionsResult = youtube_v3.Schema$SubscriptionListResponse
type SubscriptionsItem = youtube_v3.Schema$Subscription
type SearchParams = youtube_v3.Params$Resource$Search$List
type SearchResult = youtube_v3.Schema$SearchListResponse
type SearchItem = youtube_v3.Schema$SearchResult


/**
 * Base iterator for aggregating data through paging. Continues until
 * `nextPageToken === undefined`.
 */

function _genericIterator(
	method: (
		params?: SubscriptionsParams,
		options?: MethodOptions,
	) => GaxiosPromise<SubscriptionsResult>,
	params: SubscriptionsParams,
	options?: MethodOptions,
): AsyncIterable<Awaited<SubscriptionsItem>>
function _genericIterator(
	method: (
		params?: SearchParams,
		options?: MethodOptions,
	) => GaxiosPromise<SearchResult>,
	params: SearchParams,
	options?: MethodOptions,
): AsyncIterable<Awaited<SearchItem>>
async function* _genericIterator(
	method: (
		params: SubscriptionsParams | SearchParams,
		options?: MethodOptions,
	) => GaxiosPromise<SubscriptionsResult | SearchResult>,
	params: SubscriptionsParams | SearchParams,
	options?: MethodOptions,
): AsyncIterable<Awaited<SubscriptionsItem | SearchItem>> {
	let nextPageToken = undefined

	const logger = await setupLogger({ label: 'iterator' })
	let itemsSeen = 0

	do {

		// Call given method with given params
		const res: GaxiosResponse<SubscriptionsResult | SearchResult> =
			await method({ ...params, pageToken: nextPageToken }, options)

		itemsSeen += res.data.items?.length ?? 0

		logger.verbose('Got page of data', {
			resultsPerPage: res.data.pageInfo?.resultsPerPage,
			totalResults: res.data.pageInfo?.totalResults,
			itemsSeen,
			currentPageToken: nextPageToken,
			nextPageToken: res.data.nextPageToken,
		})

		logger.debug(JSON.stringify({ options, res, nextPageToken }))

		nextPageToken = res.data.nextPageToken

		// Yield all data entries
		yield* res.data.items ?? []

	} while (nextPageToken)
}

/**
 * Iterator for authorized account's subscriptions
 */

export const subscriptionIterator = (
	service: youtube_v3.Youtube,
	auth: OAuth2Client,
) =>
	_genericIterator(service.subscriptions.list.bind(service), {
		auth,
		part: ['snippet,contentDetails'],
		order: 'alphabetical',
		mine: true,
		maxResults: 50,
	})


/**
 * Iterator for a given channel's videos
 *
 * Videos published more than `DATE_THRESHOLD` ago are ignored. This prevents
 * blowing quotas going back forever.
 */

const DATE_THRESHOLD = { weeks: 1 }
export const channelVideoIterator = (
	service: youtube_v3.Youtube,
	auth: OAuth2Client,
	channelId: string,
) =>
	_genericIterator(service.search.list.bind(service), {
		auth,
		channelId,
		safeSearch: 'none',
		type: ['video'],
		part: ['id,snippet,contentDetails'],
		maxResults: 50,
		publishedAfter: dateFns.sub(new Date(), DATE_THRESHOLD).toISOString(),
	})
