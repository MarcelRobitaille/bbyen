const fs = require('pn/fs')
const path = require('path')

const { google } = require('googleapis')
const nodemailer = require('nodemailer')
const Handlebars = require('handlebars')
const SQL = require('sql-template-strings')

const config = require('../config.json')
const database = require('./database')
const authorize = require('./google/auth/')
const { subscriptionIterator, channelVideoIterator } =
	require('./google/iterators')


const main = async () => {
	try {

		const service = google.youtube('v3')
		const auth = await authorize()

		const db = await database.init(config.database)

		const transporter = nodemailer.createTransport(config.email)


		//
		// HTML Template
		//

		const template = Handlebars.compile(await fs.readFile(
			path.join(__dirname, './email/template.hbs'),
			'utf-8',
		))

		for await (let subscription of subscriptionIterator(service, auth)) {
			const { resourceId: { channelId }, title: channelName } =
				subscription.snippet
			const channelThumbnail = subscription.snippet.thumbnails.high.url

			// Skip subscriber if not signed up for notifications
			if (subscription.contentDetails.activityType !== 'all') continue

			const videosSent = await db.all(SQL`
				SELECT * FROM videos WHERE channelId=${channelId};
			`)

			const videoIDsSettled =
				new Set(videosSent.filter(v => v.settled).map(v => v.videoId))

			for await (let video of
					channelVideoIterator(service, auth, channelId)) {

				const { videoId } = video.id
				const videoTitle = video.snippet.title
				const videoThumbnail = video.snippet.thumbnails.high.url
				const videoDuration = video.contentDetails.duration
					.replace('PT', '')
					.replace('S', '')
					.replace('M', ':')
					.replace('H', ':')

				// If we reached the previously settled videos, all videos are
				// settled. Break out and mark all settled.
				if (videoIDsSettled.has(videoId)) break

				// Insert video into databse
				// Mark it not settled. If we reach quota before settling all,
				// we want to go beyond this point next time.
				await db.run(SQL`
					INSERT INTO videos (videoId, channelId, settled)
					VALUES (${videoId}, ${channelId}, false);
				`)

				const info = await transporter.sendMail({
					from: config.email.sendingContact,
					to: config.email.destination,
					subject: `${channelName} just uploaded a video`,
					html: template({
						channelId,
						channelName,
						channelThumbnail,
						videoId,
						videoThumbnail,
						videoTitle,
						videoDuration,
					}),
				})
				console.log(info)

				// If we go through all the videos, make them all settled
				// This could happen on first run, or if the threshold is
				// not long enough to reach the saved videos
			}

			await db.run(SQL`
				UPDATE videos
				SET settled=true WHERE channelId=${channelId} AND settled=false;
			`)
		}

	} catch (err) {
		console.error(err)
	}
}

main()
