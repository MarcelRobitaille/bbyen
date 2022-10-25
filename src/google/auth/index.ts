import fs from 'fs/promises'
import path from 'path'
import http from 'http'
import { parse as parseURL } from 'url'

import open from 'open'
import { Credentials, OAuth2Client } from 'google-auth-library'

import readline from './readline'

import setupLogger from '../../lib/logger'
import { CONFIG_DIR, CONFIG_FILE } from '../../config'

const SCOPES = [ 'https://www.googleapis.com/auth/youtube.readonly' ]
const TOKEN_FILE = path.join(CONFIG_DIR, '.google-auth-token.json')

const config = import(CONFIG_FILE)
const credentials = import(path.join(CONFIG_DIR, 'google-credentials.json'))

/**
 * Store given token to `TOKEN_FILE`
 */

const storeToken = async (token: Credentials) => {
	const file = TOKEN_FILE
	const dir = path.dirname(file)

	return await fs.mkdir(dir)
		.catch(err => { if (err.code !== 'EEXIST') throw err })
		.then(() => fs.writeFile(file, JSON.stringify(token)))
}


/**
 * Generate new auth token
 *
 * Authorize by printing a URL and pasting back a code
 */

const genAuthToken = async (oauth2Client: OAuth2Client) => {
	const logger = await setupLogger({ label: 'google-auth' })

	const authUrl = oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES,
	})

	logger.debug(`Opening authorization url: ${authUrl}`)
	console.log(`Autneticating. If a browser window is not automatically opened, please open the following link: ${authUrl}`)
	open(authUrl)

	// Set up a webserver to automatically get the code after Google redirects to
	// localhost
	const automatedMethod: Promise<Credentials> =
		new Promise(async (resolve, reject) => {
			const server = http.createServer(async (req, res) => {
				logger.debug(`[${req.method}] ${req.url}`)
				if (!req.url?.startsWith('/authorization_code')) {
					logger.info(`Ignoring request to ${req.url}`)
					res.writeHead(404)
					return
				}
				if (req.method != 'GET') {
					logger.info(`Ignoring request with unsupported method ${req.method}`)
					res.writeHead(404)
					return
				}

				const queryParams = parseURL(req.url, true)
				logger.debug(`Request query params: ${queryParams}`)
				const code = queryParams.query.code as string
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
			})
			server.listen((await config).port)
		})

	// Also support copy/pasting the code if the automatic method does not work
	// or the system is headless
	const manualMethod = readline(
		'Paste the entire URL of the page you are redirected to ' +
		'(even if you receive 404): '
	)
		// Support pasting the full URL, which is more convenient than manually
		// extracting the code
		.then(url => url.includes('&')
			? parseURL(url, true).query.code as string
			: url)
		.then(code => oauth2Client.getToken(code))
		.then(({ tokens }) => tokens)

	const tokens = await Promise.race([automatedMethod, manualMethod])

	logger.info('Storing tokens')
	await storeToken(tokens)

	return tokens
}


/**
 * Get Google tokens, first trying to read `TOKEN_FILE` and falling back to
 * generating new ones
 */

const getToken = async (oauth2Client: OAuth2Client) => {
	try {
		const contents = await fs.readFile(TOKEN_FILE)
		return JSON.parse(contents.toString())

	} catch (err) {

		// If an error occured while reading token, gen new one
		return await genAuthToken(oauth2Client)
	}
}


/**
 * Create Google OAuth2Client first trying to read `TOKEN_FILE` and falling
 * back to generating new tokens
 */

const authorize = async () => {
	const oauth2Client = new OAuth2Client(
		(await credentials).installed.client_id,
		(await credentials).installed.client_secret,
		`http://localhost:${(await config).port}/authorization_code`,
	)

	oauth2Client.setCredentials(await getToken(oauth2Client))

	return oauth2Client
}

export default authorize
