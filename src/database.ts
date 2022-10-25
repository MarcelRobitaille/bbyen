import path from 'path'

import * as sqlite from 'sqlite'
import sqlite3 from 'sqlite3'
import SQL from 'sql-template-strings'


/**
 * Set up database
 */

export const init = async ({ filename }: { filename: string }) => {
	const db = await sqlite.open({
		filename: path.join(__dirname, '../', filename),
		driver: sqlite3.Database,
	})

	// Create all necessary tables if they don't exist
	await db.exec(SQL`
		CREATE TABLE IF NOT EXISTS videos (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			videoId TEXT NOT NULL UNIQUE,
			channelId TEXT NOT NULL
		);
	`)

	await db.exec(SQL`
		CREATE TABLE IF NOT EXISTS subscriptions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			channelId TEXT NOT NULL UNIQUE,
			channelThumbnail TEXT NOT NULL,
			channelTitle TEXT NOT NULL
		);
	`)

	return db
}
