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

		const config = await loadConfig(service, auth)

		const db = await database.init(config.database)

		const { sendVideoEmail, sendErrorEmail } =
			await mailer.init(config.email)

		// Now that emailing is set up, we can send messages on error
		// Set up new try/catch to do that
		try {
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
				{ db, service, auth, sendVideoEmail, config },
			)

		} catch (err) {
			try {
				if (config.logging.emailOnError) {
					await sendErrorEmail(err)
				}
			} catch (err) {
				logger.warn(
					'Error encountered when attempting to email about previous error')
				logger.error(err)
			}
			throw err
		}
	} catch (err) {
		logger.error(err)
	}
}

main()
