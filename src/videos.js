const truncate = require('truncate')
const RSSParser = require('rss-parser')
const SQL = require('sql-template-strings')
const { parse: parseDuration } = require('duration-fns')

const logger = require('./lib/logger')({ label: 'videos' })

const formatDuration = duration => {
	const hours = duration.hours === 0 ? '' : `${duration.hours}:`
	const minutes = String(duration.minutes)
		.padStart(duration.hours > 0 ? 2 : 0, '0') + ':'
	const seconds = (duration.hours + duration.minutes) === 0
		? duration.seconds
		: String(duration.seconds).padStart(2, '0')

	return [ hours, minutes, seconds ].join('')
}

const parseFeedsAndNotify = async ({
	db,
	auth,
	config,
	service,
	transporter,
	emailTemplate,
}) => {
	try {

		logger.info('Checking for new videos...')

		const parser = new RSSParser({
			customFields: {
				item: [
					[ 'yt:videoId', 'videoId' ],
				],
			},
		})

		const channels = await db.all(SQL`
			SELECT channelId, channelTitle, channelThumbnail FROM subscriptions;
		`)

		for (let { channelId, channelTitle, channelThumbnail } of channels) {

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
						part: 'contentDetails,snippet,liveStreamingDetails',
						id: videoId,
					})).data.items[0]

					const videoTitle = truncate(details.snippet.title, 70)
					const { channelTitle } = details.snippet
					const { url: videoThumbnail } =
						details.snippet.thumbnails.maxres ??
						details.snippet.thumbnails.standard ??
						details.snippet.thumbnails.high
					const videoDuration =
						parseDuration(details.contentDetails.duration)

					if (!details?.liveStreamingDetails?.actualEndTime ||
							videoDuration === 0) {
						continue
					}

					logger.verbose(
						`New video from ${channelTitle} (id: ${videoId}):`,
						videoTitle,
					)

					await transporter.sendMail({
						from: config.email.sendingContact,
						to: config.email.destination,
						subject: `${channelTitle} just uploaded a video`,
						html: emailTemplate({
							channelId,
							channelTitle,
							channelThumbnail,
							videoId,
							videoThumbnail,
							videoTitle,
							videoDuration: formatDuration(videoDuration),
							videoWasLivestream: details.liveStreamingDetails,
							videoURL: [
								'https://www.youtube.com/attribution_link?u=/',
								encodeURIComponent(`watch?v=${videoId}`),
							].join(''),
						}),
					})

					await db.run(SQL`
						INSERT INTO videos (videoId, channelId)
						VALUES (${videoId}, ${channelId});
					`)

				} catch (err) {

					if (err.code === 'EMESSAGE' && err.responseCode === 550) {
						logger.warn(
							'Email quota has run out.',
							'Abandoning, will retry on next timer trigger.',
						)
						return
					}

					logger.error(err)
				}
			}
		}


		logger.info('Finished checking for new videos')
	} catch (err) {
		logger.error(err)
	}
}

module.exports = { parseFeedsAndNotify }
