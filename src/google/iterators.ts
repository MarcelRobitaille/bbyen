import dateFns from 'date-fns'
import { youtube_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'


/**
 * Base iterator for aggregating data through paging. Continues until
 * `nextPageToken === undefined`.
 */

async function* _genericIterator (method: any, params: Object) {
	let nextPageToken = null

	do {

		// Call given method with given params
		const res: any = await method({
			...params,
			pageToken: nextPageToken,
		})

		nextPageToken = res.data.nextPageToken

		// Yield all data entries
		yield* res.data.items

	} while (nextPageToken)
}


/**
 * Iterator for authorized account's subscriptions
 */

export const subscriptionIterator = (
	service: youtube_v3.Youtube,
	auth: OAuth2Client,
) => _genericIterator(
	service.subscriptions.list.bind(service),
	{
		auth,
		part: 'snippet,contentDetails',
		order: 'alphabetical',
		mine: true,
		maxResults: 50,
	},
)


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
) => _genericIterator(
	service.search.list.bind(service),
	{
		auth,
		channelId,
		safeSearch: 'none',
		type: 'video',
		part: 'id,snippet,contentDetails',
		maxResults: 50,
		publishedAfter: dateFns.sub(new Date(), DATE_THRESHOLD).toISOString(),
	},
)
