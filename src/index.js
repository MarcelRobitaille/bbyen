const { google } = require('googleapis')
const parseDuration = require('parse-duration')

const { loadConfig } = require('./config.js')
const database = require('./database')
const authorize = require('./google/auth')
const mailer = require('./email')
const { parseFeedsAndNotify } = require('./videos')
const { updateSubscriptions } = require('./subscriptions')
const setIntervalInstant = require('./lib/setIntervalInstant')

const logger = require('./lib/logger')({ label: 'main' })


const main = async () => {
	try {

		const service = google.youtube('v3')
		const auth = await authorize()

		const config = loadConfig(service, auth)

		const db = await database.init(config.database)

		const { transporter, emailTemplate } = await mailer.init(config.email)

		setIntervalInstant(
			updateSubscriptions,
			parseDuration(config.timers.subscriptions),
			config.kickoff.subscriptions,
			{ db, service, auth, config },
		)

		setIntervalInstant(
			parseFeedsAndNotify,
			parseDuration(config.timers.videos),
			config.kickoff.videos,
			{ db, service, auth, transporter, emailTemplate, config },
		)

	} catch (err) {
		logger.error(err)
	}
}

main()
