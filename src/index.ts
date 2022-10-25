import { google } from 'googleapis'
import parseDuration from 'parse-duration'

import { loadConfig } from './config'
import * as database from './database'
import authorize from './google/auth'
import * as mailer from './email'
import { parseFeedsAndNotify } from './videos'
import { updateSubscriptions } from './subscriptions'
import setIntervalInstant from './lib/setIntervalInstant'
import { ISendErrorEmail } from './email'
import setupLogger from './lib/logger'

const main = async () => {
	const logger = await setupLogger({ label: 'main' })

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
					await sendErrorEmail(err as ISendErrorEmail)
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
		process.exit(1)
	}
}

main()
