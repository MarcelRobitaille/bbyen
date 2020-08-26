const chalk = require('chalk')
const truncate = require('truncate')
const RSSParser = require('rss-parser')
const SQL = require('sql-template-strings')
const { parse: parseDuration } = require('duration-fns')

const formatDuration = ISO8601Duration => {
	const duration = parseDuration(ISO8601Duration)

	const hours = duration.hours === 0 ? '' : `${duration.hours}:`
	const minutes = (duration.hours + duration.minutes) === 0 ? '' :
		`${duration.hours > 0
			?  String(duration.minutes).padStart(2, '0')
			: duration.minutes}:`
	const seconds = (duration.hours + duration.minutes) === 0
		? duration.seconds
		: String(duration.seconds).padStart(2, '0')

	return [ hours, minutes, seconds ].join('')
}

const parseFeedsAndNotify = async ({
	db,
	service,
	auth,
	transporter,
	emailTemplate,
	config,
}) => {
	try {

		console.log(chalk.magenta('[videos]'), 'Checking for new videos...')

		const parser = new RSSParser({
			customFields: {
				item: [
					[ 'yt:videoId', 'videoId' ],
				],
			},
		})

		const channels = await db.all(SQL`
			SELECT channelId, channelThumbnail FROM subscriptions;
		`)

		for (let { channelId, channelThumbnail } of channels) {

			console.log(
				chalk.magenta('[videos]'),
				`Checking channel ${channelId}`,
			)

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
						part: 'contentDetails,snippet',
						id: videoId,
					})).data.items[0]

					const videoTitle = truncate(details.snippet.title, 70)
					const { channelTitle } = details.snippet
					const { url: videoThumbnail } =
						details.snippet.thumbnails.maxres ??
						details.snippet.thumbnails.standard ??
						details.snippet.thumbnails.high
					const videoDuration =
						formatDuration(details.contentDetails.duration)

					console.log(
						chalk.magenta('[videos]'),
						`New video (${videoId}): ${videoTitle}`,
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
							videoDuration,
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
						console.log(
							chalk.red('[videos]'),
							'Email quota has run out.',
							'Abandoning, will retry on next timer trigger.',
						)
						return
					}

					console.error(err)
				}
			}
		}


		console.log(
			chalk.magenta('[videos]'),
			'Finished checking for new videos',
		)
	} catch (err) {
		console.error(err)
	}
}

module.exports = { parseFeedsAndNotify }
