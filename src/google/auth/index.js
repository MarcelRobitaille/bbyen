const fs = require('pn/fs')
const path = require('path')
const http = require('http')
const url = require('url')

const open = require('open')
const { OAuth2Client } = require('google-auth-library')

const readline = require('./readline.js')
const credentials = require('../../../google-credentials.json')

const logger = require('../../lib/logger')({ label: 'google-auth' })
const config = require('../../../config.json')

const SCOPES = [ 'https://www.googleapis.com/auth/youtube.readonly' ]
const TOKEN_FILE = path.join(__dirname, '../../../.google-auth-token.json')


/**
 * Store given token to `TOKEN_FILE`
 *
 * @param {Object} token Auth token to store
 */

const storeToken = token => {
	const file = TOKEN_FILE
	const dir = path.dirname(file)

	return fs.mkdir(dir)
		.catch(err => { if (err.code !== 'EEXIST') throw err })
		.then(() => fs.writeFile(file, JSON.stringify(token)))
}


/**
 * Generate new auth token
 *
 * Authorize by printing a URL and pasting back a code
 *
 * @async
 * @param {OAuth2Client} oauth2Client Client to generate token for
 * @returns {Object} Google auth token
 */

const genAuthToken = async oauth2Client => {

	const authUrl = oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES,
	})

	logger.info(`Opening authorization url: ${authUrl}`)
	open(authUrl)

	const tokens = await new Promise((resolve, reject) => {
		const handler = async (req, res) => {
			if (!req.url.startsWith('/authorization_code')) {
				logger.info(`Ignoring request to ${req.url}`)
				res.writeHead(404)
				return
			}
			if (req.method != 'GET') {
				logger.info(`Ignoring request with unsupported method ${req.method}`)
				res.writeHead(404)
				return
			}

			const code = url.parse(req.url, true).query.code
			logger.info(`Got code: ${code}`)

			try {
				logger.info('Creating tokens from code')
				const { tokens } = await oauth2Client.getToken(code)
				res.end('Authorization successful. You may now close this tab.')
				res.writeHead(200)
				resolve(tokens)
			} catch (err) {
				console.error(err)
				res.end(`Authorization failed. ${err}`)
				res.writeHead(500)
				reject(err)
			}
			server.close()
		}
		const server = http.createServer(handler)
		server.listen(config.port)
	})

	logger.info('Storing tokens')
	await storeToken(tokens)

	return tokens
}


/**
 * Get Google tokens, first trying to read `TOKEN_FILE` and falling back to
 * generating new ones
 *
 * @async
 * @param {OAuth2Client} oauth2Client Google client to get tokens for
 * @returns {Object} Google tokens
 */

const getToken = async oauth2Client => {
	try {

		return await fs.readFile(TOKEN_FILE).then(JSON.parse)

	} catch (err) {

		// If an error occured while reading token, gen new one
		return await genAuthToken(oauth2Client)
	}
}


/**
 * Create Google OAuth2Client first trying to read `TOKEN_FILE` and falling
 * back to generating new tokens
 *
 * @async
 * @returns {OAuth2Client} Google OAuth2Client
 */

const authorize = async () => {
	const oauth2Client = new OAuth2Client(
		credentials.installed.client_id,
		credentials.installed.client_secret,
		`http://localhost:${config.port}/authorization_code`,
	)

	oauth2Client.setCredentials(await getToken(oauth2Client))

	return oauth2Client
}

module.exports = authorize
