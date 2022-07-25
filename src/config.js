const path = require('path')
const fs = require('pn/fs')

const deepEqual = require('./lib/deepEqual.js')


const CONFIG_FILE = path.join(__dirname, '../config.json')


const loadConfig = async (service, auth) => {

	// Get the channel ID from the URL using the data API
	const normalizeChannel = async channel => {
		try {
			new URL(channel)
		} catch (e) {
			return channel
		}

		const res = await service.search.list({
			auth,
			part: 'id',
			q: channel,
			maxResults: 1,
			order: 'relevance',
			type: 'channel',
		})

		return res.data.items[0].id.channelId
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
	const normalizedConfig = await normalizeConfig(config)

	if (!deepEqual(config, normalizedConfig)) {
		await fs.writeFile(CONFIG_FILE, JSON.stringify(normalizedConfig, null, '\t'))
	}

	return normalizedConfig
}

module.exports = { loadConfig }
