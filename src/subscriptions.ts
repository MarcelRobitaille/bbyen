import sqlite from 'sqlite'
import SQL from 'sql-template-strings'
import { youtube_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import winston from 'winston'

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

// Read all known subs from the database
const getSavedSubscriptions = async (db: sqlite.Database) =>
		new Set<string>(
			(await db.all(SQL`SELECT channelId FROM subscriptions WHERE deleted=0;`))
				.map(sub => sub.channelId)
		)

// Add any new subscriptions to the database
const insertNewSubscriptions = async (
	db: sqlite.Database,
	logger: winston.Logger,
	newSubscriptions: string[],
	channelDetails: Map<string, ChannelDetails>,
) => {
	const stmt = await db.prepare(SQL`
		INSERT INTO subscriptions (
			channelId,
			channelTitle,
			channelThumbnail
		)
		VALUES (?, ?, ?);
	`)

	for (const [i, channelId] of newSubscriptions.entries()) {
		const res = channelDetails.get(channelId)

		if (!res) {
			logger.warn([
				`Could not find channel ID ${channelId} in channelDetails.`,
				'Skipping.',
			].join(' '))
			continue
		}

		const { title, thumbnail } = res

		logger.info(`${i+1}/${newSubscriptions.length} New subscription: ${title}`)

		await stmt.run(channelId, title, thumbnail)
	}
	await stmt.finalize()
}

// Delete any removed subscriptions (unsubscriptions) from the database
const removeDeletedSubscriptions = async (
	db: sqlite.Database,
	logger: winston.Logger,
	removedSubscriptions: Iterable<string>,
) => {
	const stmt = await db.prepare(SQL`
		UPDATE subscriptions
		SET deleted=1
		WHERE channelId=?;
	`)

	for (let channelId of removedSubscriptions) {
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

function* chunks<T>(arr: T[], n: number) {
	for (let i = 0; i < arr.length; i += n) {
		yield arr.slice(i, i + n)
	}
}

export const updateSubscriptionsFromAPI = async (
	{ db, service, auth, config }: IUpdateSubscriptions
) => {
	const logger = await setupLogger({ label: 'subscriptions' })

	logger.info('Checking subscriptions...')

	// Read all known subs from the database
	const savedSubscriptions = await getSavedSubscriptions(db)

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
				'Ignoring channel not in whitelist: ',
				`${title} (${channelId})`,
			].join(''))
			continue
		}

		logger.verbose(`${title} (${channelId})`)
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
	await insertNewSubscriptions(
		db, logger, Array.from(newSubscriptions), channelDetails)

	await removeDeletedSubscriptions(db, logger, removedSubscriptions.values())

	logger.info('Done checking subscriptions...')
}

// Workaround for #19
// If user uses a whitelist, there is no need to use the API to get the
// subscriptions. This works around the issue with the YouTube API that only
// around 1000 results are returned. Unfortunately, it only works for people
// using the whitelist.
export const updateSubscriptionsFromWhitelist = async (
	{ db, auth, service, config }: IUpdateSubscriptions
) => {
	const logger = await setupLogger({ label: 'subscriptions' })

	// Read all known subs from the database
	const savedSubscriptions = await getSavedSubscriptions(db)
	const whitelistedChannelIds = new Set<string>(config.whitelistedChannelIds)

	const newlyWhitelisted = Array.from(whitelistedChannelIds)
		.filter(x => !savedSubscriptions.has(x))
	const channelDetails: Map<string, ChannelDetails> = new Map()

	// Maximum results YT API lets us get at a time
	const MAX_RESULTS = 50

	for (const chunk of chunks(newlyWhitelisted, MAX_RESULTS)) {
		const res = await service.channels.list({
			auth,
			part: ['id,snippet'],
			id: chunk,
			maxResults: MAX_RESULTS,
		})

		for (const channel of res.data.items ?? []) {
			const channelId = channel.id
			const title = channel.snippet?.title
			const thumbnail = channel.snippet?.thumbnails?.high?.url

			if (!title || !channelId || !thumbnail) {
				logger.warn(
					`Could not find all required fields in channel`,
					{ channel })
				continue
			}

			channelDetails.set(channelId, {
				title,
				thumbnail,
			})
		}
	}

	const removedSubscriptions = new Set(
		[...savedSubscriptions]
			.filter(sub => !whitelistedChannelIds.has(sub))
	)

	await insertNewSubscriptions(db, logger, newlyWhitelisted, channelDetails)
	await removeDeletedSubscriptions(db, logger, removedSubscriptions.values())
}

export const updateSubscriptions = async (args: IUpdateSubscriptions) => {
	const logger = await setupLogger({ label: 'subscriptions' })

	try {
		return Array.isArray(args.config.whitelistedChannelIds)
			? await updateSubscriptionsFromWhitelist(args)
			: await updateSubscriptionsFromAPI(args)

	} catch (err) {

		logger.debug(JSON.stringify(err, null, '	'))

		// Avoid printing huge error object for quota issues
		if ((err as any)?.errors?.[0]?.reason) {
			logger.warn('Quota up. Failed to update subscriptions.')

			return
		}

		logger.error(err)
	}
}
