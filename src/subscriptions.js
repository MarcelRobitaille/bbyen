const chalk = require('chalk')
const SQL = require('sql-template-strings')

const { subscriptionIterator } = require('./google/iterators')


const updateSubscriptions = async ({ db, service, auth }) => {
	try {

		// Read all known subs from the database
		const savedSubscriptions = new Set(
			(await db.all(SQL`SELECT channelId FROM subscriptions;`))
				.map(sub => sub.channelId)
		)

		// Get updated list of subs using Google api
		const updatedSubscriptions = new Set()
		const channelDetails = new Map()
		for await (let sub of subscriptionIterator(service, auth)) {

			// Skip subscriber if not signed up for notifications
			if (sub.contentDetails.activityType !== 'all') continue

			const { resourceId: { channelId }, title }
				= sub.snippet

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

				console.log(
					chalk.magenta('[subscriptions]'),
					`New subscription: ${title}`,
				)

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
				await stmt.run(channelId)
			}
			await stmt.finalize()
		}

	} catch (err) {

		// Avoid printing huge error object for quota issues
		if (err?.errors?.[0]?.reason) {
			console.log(
				chalk.red('[update-subscriptions]'),
				'Quota up. Failed to update subscriptions.',
			)

			return
		}

		console.error(err)
	}
}

module.exports = { updateSubscriptions }
