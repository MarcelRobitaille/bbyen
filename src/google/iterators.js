const dateFns = require('date-fns')


/**
 * Base iterator for aggregating data through paging. Continues until
 * `nextPageToken === undefined`.
 *
 * @async
 * @param {Function} method YouTube data API method to call
 * @param {Object} params Parameters of API call. Must include auth
 * @yields {Object} Each item from `data.items` across all pages
 */

async function* _genericIterator (method, params) {
	let nextPageToken = null

	while (true) {

		// Call given method with given params
		const res = await method({
			...params,
			pageToken: nextPageToken,
		})

		nextPageToken = res.data.nextPageToken

		// If received `nextPageToken` undefined, there is no more data
		if (nextPageToken === undefined) return

		// Yield all data entries
		yield* res.data.items
	}
}


/**
 * Iterator for authorized account's subscriptions
 *
 * @async
 * @param {Object} service Google APIs service (`google.youtube('v3')`)
 * @param {OAuth2Client} auth Authenticated Google OAuth client
 * @yields {youtube#subscriptionListResponse} Account's subscriptions
 */

const subscriptionIterator = (service, auth) => _genericIterator(
	service.subscriptions.list.bind(service),
	{
		auth,
		part: 'snippet,contentDetails',
		mine: true,
		maxResults: 1,
	},
)


/**
 * Iterator for a given channel's videos
 *
 * Videos published more than `DATE_THRESHOLD` ago are ignored. This prevents
 * blowing quotas going back forever.
 *
 * @async
 * @param {Object} service Google APIs service (`google.youtube('v3')`)
 * @param {OAuth2Client} auth Authenticated Google OAuth client
 * @param {String} channelId ID of channel for which videos should be listed
 * @yields {youtube#searchListResponse} Channel's videos
 */

const DATE_THRESHOLD = { weeks: 1 }
const channelVideoIterator = (service, auth, channelId) => _genericIterator(
	service.search.list.bind(service),
	{
		auth,
		channelId,
		safeSearch: 'none',
		type: 'video',
		part: 'id,snippet,contentDetails',
		maxResults: 1,
		publishedAfter: dateFns.sub(new Date(), DATE_THRESHOLD).toISOString(),
	},
)

module.exports = { subscriptionIterator, channelVideoIterator }
