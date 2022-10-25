import sqlite from 'sqlite'
import truncate from 'truncate'
import { Logger } from 'winston'
import RSSParser from 'rss-parser'
import SQL from 'sql-template-strings'
import { youtube_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { parse as parseDuration, Duration } from 'duration-fns'

import setupLogger from './lib/logger'
import { SendVideoEmail } from './email'
import findNullishValues from './lib/findNullishValues'

const formatDuration = (duration: Duration) => {
	const hours = duration.hours === 0 ? '' : `${duration.hours}:`
	const minutes = String(duration.minutes)
		.padStart(duration.hours > 0 ? 2 : 0, '0') + ':'
	const seconds = String(duration.seconds).padStart(2, '0')

	return [ hours, minutes, seconds ].join('')
}

// Helper to deal with YouTube data API giving back a bunch of options
// Works like Rust Option<T>.map
const mapOption = <Type>(
	fn: (arg: string) => Type,
		value: string | null | undefined,
): Type | null => {
	if (!value) {
		return null
	}
	return fn(value)
}

interface Channel {
	channelId: string,
	channelTitle: string,
	channelThumbnail: string,
}

interface IGetChannelsVideos {
	channel: Channel,
	logger: Logger,
	auth: OAuth2Client,
	service: youtube_v3.Youtube,
	parser: RSSParser,
	sendVideoEmail: SendVideoEmail,
	db: sqlite.Database,
}
const getChannelsVideos = async ({
	channel,
	logger,
	parser,
	service,
	auth,
	sendVideoEmail,
	db,
}: IGetChannelsVideos) => {
	const { channelId, channelTitle, channelThumbnail } = channel

	logger.verbose(`Checking channel ${channelTitle} (${channelId})`)

	const videosSent = new Set((await db.all(SQL`
		SELECT videoId FROM videos WHERE channelId=${channelId};
	`)).map(v => v.videoId))

	const feed = await parser.parseURL([
		'https://www.youtube.com/feeds/videos.xml',
		'?channel_id=', channelId,
	].join(''))

	for (let { videoId } of feed.items) {
		try {

			if (videosSent.has(videoId)) continue

			const details = (await service.videos.list({
				auth,
				part: ['contentDetails,snippet,liveStreamingDetails'],
				id: videoId,
			}))?.data?.items?.[0]

			if (details === undefined) {
				logger.warn(`Video list is unedfined for video '${videoId}'`)
				continue
			}

			const videoDate =
				mapOption(s => new Date(s), details.snippet?.publishedAt)

			const videoTitle =
				mapOption(s => truncate(s, 70), details.snippet?.title)

			const channelTitle = details.snippet?.channelTitle ?? null
			const videoThumbnail = (
				details.snippet?.thumbnails?.maxres?.url ??
				details.snippet?.thumbnails?.standard?.url ??
				details.snippet?.thumbnails?.high?.url
			) ?? null

			const videoDuration =
				mapOption(parseDuration, details.contentDetails?.duration)

			const isLiveStreamOrPremere =
				details && 'liveStreamingDetails' in details

			// Only send the notification once the livestream ended
			// I prefer to watch the VOD later
			// TODO: Consider making this configurable
			if (isLiveStreamOrPremere &&
					!details.liveStreamingDetails?.actualEndTime) {
				continue
			}

			logger.verbose(
				`New video from ${channelTitle} (id: ${videoId}):`,
				videoTitle,
			)

			// Not really a better way to do this in TypeScript
			// https://stackoverflow.com/questions/57928920/typescript-narrowing-of-keys-in-objects-when-passed-to-function
			if (videoDate === null ||
					videoTitle === null ||
					channelTitle === null ||
					videoDuration === null ||
					videoThumbnail === null) {

				const missingKeys = findNullishValues({
					videoDate,
					channelTitle,
					videoThumbnail,
					videoTitle,
					videoDuration,
				})

				logger.warn(
					`Could not find all required fields for video '${videoId}'`,
					{ details, missingKeys },
				)
				continue
			}

			await sendVideoEmail({
				date: videoDate,
				channelId,
				channelTitle,
				channelThumbnail,
				videoId,
				videoThumbnail,
				videoTitle,
				isLiveStreamOrPremere,
				videoDuration: formatDuration(videoDuration),
				videoURL: [
					'https://www.youtube.com/attribution_link?u=/',
					encodeURIComponent(`watch?v=${videoId}`),
				].join(''),
			})

			await db.run(SQL`
				INSERT INTO videos (videoId, channelId)
				VALUES (${videoId}, ${channelId});
			`)

		} catch (err) {

			if ([
				// EMESSAGE
				550,
				// Gmail uses these
				421, 454,
			].includes((err as { responseCode: number }).responseCode)) {
				logger.warn(
					'Email quota has run out.',
					'Abandoning, will retry on next timer trigger.',
				)
				process.exit(1)
			}

			logger.error(err)
		}
	}
}

interface IParseFeedsAndNotify {
	db: sqlite.Database,
	auth: OAuth2Client,
	service: youtube_v3.Youtube,
	sendVideoEmail: SendVideoEmail,
}
export const parseFeedsAndNotify = async (
	{ db, ...rest }: IParseFeedsAndNotify,
) => {
	const logger = await setupLogger({ label: 'videos' })

	try {

		logger.info('Checking for new videos...')

		const parser = new RSSParser({
			customFields: {
				item: [
					[ 'yt:videoId', 'videoId' ],
				],
			},
		})

		const channels: Channel[] = await db.all(SQL`
			SELECT channelId, channelTitle, channelThumbnail FROM subscriptions;
		`)

		for (const channel of channels) {
			await getChannelsVideos({ channel, parser, logger, db, ...rest })
		}

		logger.info('Finished checking for new videos')
	} catch (err) {
		logger.error(err)
	}
}
