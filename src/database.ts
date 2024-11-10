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
			channelTitle TEXT NOT NULL,
			deleted INTEGER DEFAULT 0
		);
	`)

	// Migration if db was created before 'deleted' column.
	const subscriptions = await db.all(SQL`PRAGMA table_info(subscriptions)`)
	if (!subscriptions.some(col => col.name === "deleted")) {
		await db.exec(SQL`
			ALTER TABLE subscriptions ADD COLUMN deleted INTEGER DEFAULT 0;
		`)
	}

	return db
}
