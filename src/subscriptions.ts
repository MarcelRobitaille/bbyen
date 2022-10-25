import sqlite from 'sqlite'
import SQL from 'sql-template-strings'
import { youtube_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

import { Config } from './config'
import setupLogger from './lib/logger'
import { subscriptionIterator } from './google/iterators'
import findNullishValues from './lib/findNullishValues'

interface ChannelDetails {
	title: string,
	thumbnail: string,
}

interface IUpdateSubscriptions {
	db: sqlite.Database,
	service: youtube_v3.Youtube,
	auth: OAuth2Client,
	config: Config,
}
export const updateSubscriptions = async (
	{ db, service, auth, config }: IUpdateSubscriptions
) => {
	const logger = await setupLogger({ label: 'subscriptions' })

	try {

		logger.info('Checking subscriptions...')

		// Read all known subs from the database
		const savedSubscriptions = new Set(
			(await db.all(SQL`SELECT channelId FROM subscriptions;`))
				.map(sub => sub.channelId)
		)

		// Get updated list of subs using Google api
		const updatedSubscriptions: Set<string> = new Set()
		const channelDetails: Map<string, ChannelDetails> = new Map()
		for await (let sub of subscriptionIterator(service, auth)) {

			const title = sub.snippet?.title
			const channelId = sub.snippet?.resourceId?.channelId
			const thumbnail = sub.snippet?.thumbnails?.high?.url

			if (!title || !channelId || !thumbnail) {
				const missingKeys = findNullishValues({ title, channelId, thumbnail })
				logger.warn(
					`Could not find all required fields in subscription`,
					{ sub, missingKeys })
				continue
			}

			if (Array.isArray(config.blacklistedChannelIds) &&
					config.blacklistedChannelIds.includes(channelId)) {
				logger.debug([
					'Ignoring channel in blacklist: ',
					`${title} (${channelId})`,
				].join(''))
				continue
			}

			if (Array.isArray(config.whitelistedChannelIds) &&
					!config.whitelistedChannelIds.includes(channelId)) {
				logger.debug([
					'Ignoring channel not in whitelacklist: ',
					`${title} (${channelId})`,
				].join(''))
				continue
			}

			logger.verbose(title, channelId)
			logger.debug(JSON.stringify(sub.contentDetails, null, '	'))

			updatedSubscriptions.add(channelId)
			channelDetails.set(channelId, {
				title,
				thumbnail,
			})
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
				const res = channelDetails.get(channelId)

				if (!res) {
					logger.warn([
						`Could not find channel ID ${channelId} in channelDetails.`,
						'Skipping.',
					].join(' '))
					continue
				}

				const { title, thumbnail } = res

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
		if ((err as any)?.errors?.[0]?.reason) {
			logger.warn('Quota up. Failed to update subscriptions.')

			return
		}

		logger.error(err)
	}
}
