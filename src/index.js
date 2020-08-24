const { google } = require('googleapis')
const parseDuration = require('parse-duration')

const config = require('../config.json')
const database = require('./database')
const authorize = require('./google/auth')
const mailer = require('./email')
const { parseFeedsAndNotify } = require('./videos')
const { updateSubscriptions } = require('./subscriptions')
const setIntervalInstant = require('./lib/setIntervalInstant')


const main = async () => {
	try {

		const service = google.youtube('v3')
		const auth = await authorize()

		const db = await database.init(config.database)

		const { transporter, emailTemplate } = mailer.init(config.email)

		setIntervalInstant(
			updateSubscriptions,
			parseDuration(config.timers.subscriptions),
			config.kickoff.subscriptions,
			{ db, service, auth },
		)

		setIntervalInstant(
			parseFeedsAndNotify,
			parseDuration(config.timers.subscriptions),
			config.kickoff.videos,
			{ db, service, auth, transporter, emailTemplate, config },
		)

	} catch (err) {
		console.error(err)
	}
}

main()
