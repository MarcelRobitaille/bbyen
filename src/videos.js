const chalk = require('chalk')
const SQL = require('sql-template-strings')
const RSSParser = require('rss-parser')

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
			SELECT channelId FROM subscriptions;
		`)

		for (let { channelId, channelThumbnail } of channels) {

			console.log(
				chalk.magenta('[videos]'),
				`Checking channel ${channelId}`,
			)

			const videosSent = new Set((await db.all(SQL`
				SELECT videoId FROM videos WHERE channelId=${channelId};
			`)).map(v => v.videoId))

			const feed = await parser.parseURL(`
				https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}
			`.trim())

			for (let { videoId } of feed.items) {
				try {

					if (videosSent.has(videoId)) continue

					const details = (await service.videos.list({
						auth,
						part: 'contentDetails,snippet',
						id: videoId,
					})).data.items[0]

					const { title: videoTitle, channelTitle: channelName } =
						details.snippet.title
					const videoThumbnail = details.snippet.thumbnails.high.url
					const videoDuration = details.contentDetails.duration
						.replace('PT', '')
						.replace('S', '')
						.replace('M', ':')
						.replace('H', ':')

					console.log(
						chalk.magenta('[videos]'),
						`New video (${videoId}): ${videoTitle}`,
					)

					await db.run(SQL`
						INSERT INTO videos (videoId, channelId)
						VALUES (${videoId}, ${channelId});
					`)

					const info = await transporter.sendMail({
						from: config.email.sendingContact,
						to: config.email.destination,
						subject: `${channelName} just uploaded a video`,
						html: emailTemplate({
							channelId,
							channelName,
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

					console.log(info)

					break

				} catch (err) {
					console.error(err)
				}
			}
		}
	} catch (err) {
		console.error(err)
	}
}

module.exports = { parseFeedsAndNotify }
