const path = require('path')

const sqlite = require('sqlite')
const sqlite3 = require('sqlite3')
const SQL = require('sql-template-strings')


/**
 * Set up database
 *
 * @async
 * @returns sqlite database instance
 */

const init = async ({ filename }) => {
	const db = await sqlite.open({
		filename: path.join(__dirname, '../', filename),
		driver: sqlite3.Database,
	})

	// Create all necessary tables if they don't exist
	await db.exec(SQL`
		CREATE TABLE IF NOT EXISTS videos (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			videoId TEXT NOT NULL UNIQUE,
			channelId TEXT NOT NULL,
			settled BOOLEAN NOT NULL
		);
	`)

	return db
}

module.exports = { init }
