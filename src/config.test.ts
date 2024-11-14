import { vi, expect, describe, test } from 'vitest'
import winston from 'winston'
import { youtube_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

import  { normalizeChannelFactory } from "./config"

function createMagicStub<T extends object>(): T {
	return new Proxy({} as T, {
		get: (target: T, prop: string) => {
			if (!(prop in target)) {
				// If the method does not exist, create it as a mock function
				(target as any)[prop] = vi.fn()
			}
			return target[prop as keyof T]
		}
	})
}

describe('normalizeChannel', async () => {
	const logger = createMagicStub<winston.Logger>()
	const service = createMagicStub<youtube_v3.Youtube>()
	const auth = createMagicStub<OAuth2Client>()

	const normalizeChannel = normalizeChannelFactory(logger, service, auth)

	test("already a channel id", async () => {
		expect(await normalizeChannel("UCzgA9CBrIXPtkB2yNTTiy1w"))
			.toBe("UCzgA9CBrIXPtkB2yNTTiy1w")
	})
	// /c/ and /channel/ always seem to give 404 now
	test("already a channel id", async () => {
		expect(await normalizeChannel("https://www.youtube.com/@Level2Jeff"))
			.toBe("UCzgA9CBrIXPtkB2yNTTiy1w")
	})
})
