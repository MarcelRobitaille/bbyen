const SQL = require('sql-template-strings')

const { subscriptionIterator } = require('./google/iterators')
const logger = require('./lib/logger')({ label: 'subscriptions' })


const updateSubscriptions = async ({ db, service, auth }) => {
	try {

		logger.info('Checking subscriptions...')

		// Read all known subs from the database
		const savedSubscriptions = new Set(
			(await db.all(SQL`SELECT channelId FROM subscriptions;`))
				.map(sub => sub.channelId)
		)

		// Get updated list of subs using Google api
		const updatedSubscriptions = new Set()
		const channelDetails = new Map()
		for await (let sub of subscriptionIterator(service, auth)) {

			const { resourceId: { channelId }, title }
				= sub.snippet

			logger.verbose(title)
			logger.debug(JSON.stringify(sub.contentDetails, null, '	'))

			updatedSubscriptions.add(channelId)
			channelDetails[channelId] = {
				title,
				thumbnail: sub.snippet.thumbnails.high.url,
			}
		}

		// Compute difference of both sets to determine new / removed subs
		const newSubscriptions = new Set(
			[...updatedSubscriptions]
				.filter(sub => !savedSubscriptions.has(sub))
		)

		const removedSubscriptions = new Set(
			[...savedSubscriptions]
				.filter(sub => !updatedSubscriptions.has(sub))
		)

		// Add any new subscriptions to the database
		{
			const stmt = await db.prepare(SQL`
				INSERT INTO subscriptions (
					channelId,
					channelTitle,
					channelThumbnail
				)
				VALUES (?, ?, ?);
			`)

			for (let channelId of newSubscriptions.values()) {
				const { title, thumbnail } = channelDetails[channelId]

				logger.info(`New subscription: ${title}`)

				await stmt.run(channelId, title, thumbnail)
			}
			await stmt.finalize()
		}

		// Delete any removed subscriptions (unsubscriptions) from the database
		{
			const stmt = await db.prepare(SQL`
				DELETE FROM subscriptions WHERE channelId=?;
			`)

			for (let channelId of removedSubscriptions.values()) {
				const { channelTitle } = await db.get(SQL`
					SELECT channelTitle
					FROM subscriptions
					WHERE channelId=${channelId};
				`)
				await stmt.run(channelId)

				logger.info(`Removed subscription: ${channelTitle}`)
			}
			await stmt.finalize()
		}

		logger.info('Done checking subscriptions...')

	} catch (err) {

		// Avoid printing huge error object for quota issues
		if (err?.errors?.[0]?.reason) {
			logger.warn('Quota up. Failed to update subscriptions.')

			return
		}

		logger.error(err)
	}
}

module.exports = { updateSubscriptions }
