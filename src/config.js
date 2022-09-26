const process = require('process')
const path = require('path')
const fs = require('pn/fs')

const deepEqual = require('./lib/deepEqual.js')
const configSchema = require('../config.example.json')

const CONFIG_DIR = process.env.CONFIG_DIR ?? path.join(__dirname, '..')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')


// Check that all the keys present in the example config file are also present
// in the supplied config file
// Eventually, we might need something more sophisticated (i.e. optional
// settings), but for now, this is sufficient.
const validateConfig = (received, expected = configSchema, path = []) => {
	if (typeof expected === 'string') {
		return;
	}

	for (const [key, val] of Object.entries(expected)) {
		if (!(key in received)) {
			console.error([
				`Your config file is missing the key '${[...path, key].join('.')}'.`,
				'Please check your config file and the README.md.'
			].join(' '))
			process.exit(1)
		}
		validateConfig(received[key], val, [...path, key])
	}
}


const loadConfig = async (service, auth) => {
	// This has to come here to avoid dependency loop
	const logger = require('./lib/logger')({ label: 'config' })

	// Get the channel ID from the URL using the data API
	const normalizeChannel = async channel => {
		logger.verbose(`Normalizing channel string '${channel}'`)

		// If the string is already just the channel ID
		if (/^[0-9a-zA-Z_-]{24}$/.test(channel)) {
			logger.verbose('String matches ID')
			return channel
		}

		// If the string is the channel URL with the ID built in
		const re = /^https:\/\/www.youtube.com\/channel\/([0-9a-zA-Z_-]{24})\/?$/
		const match = channel.match(re)
		if (match) {
			logger.verbose('String matches URL with ID')
			return match[1]
		}

		// If it's the custom channel URL, try to get the ID from the API
		if (/^https:\/\/www.youtube.com\/c\/.*/.test(channel)) {
			logger.verbose('String matches URL with channel name')
			const res = await service.search.list({
				auth,
				part: 'id',
				q: channel,
				maxResults: 1,
				order: 'relevance',
				type: 'channel',
			})

			const items = res.data.items

			if (!items.length) {
				throw new Error(`Could not find channel ID using the API for '${channel}'. Please open a GitHub issue and show them this message: https://github.com/MarcelRobitaille/bbyen/issues/new`)
			}
			return items[0].id.channelId
		}

		throw new Error(`Exhausted all methods of getting the ID for channel '${channel}'. If this is a mistake, please open a GitHub issue and show them this message: https://github.com/MarcelRobitaille/bbyen/issues/new`)
	}

	// Allow the channel to be the URL, which may not be the channel ID
	const normalizeConfig = async ({
		whitelistedChannelIds,
		blacklistedChannelIds,
		...config
	}) => ({
		...config,
		whitelistedChannelIds: whitelistedChannelIds
			? await Promise.all(whitelistedChannelIds.map(normalizeChannel))
			: undefined,
		blacklistedChannelIds: blacklistedChannelIds
			? await Promise.all(blacklistedChannelIds.map(normalizeChannel))
			: undefined,
	})

	const config = JSON.parse(await fs.readFile(CONFIG_FILE))
	validateConfig(config)
	const normalizedConfig = await normalizeConfig(config)

	if (!deepEqual(config, normalizedConfig)) {
		await fs.writeFile(CONFIG_FILE, JSON.stringify(normalizedConfig, null, '\t'))
	}

	return normalizedConfig
}

module.exports = { loadConfig, CONFIG_DIR, CONFIG_FILE }
