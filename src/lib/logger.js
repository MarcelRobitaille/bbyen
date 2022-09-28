const winston = require('winston')

const { CONFIG_FILE } = require('../config.js')
const config = require(CONFIG_FILE)

const { format, transports } = winston

Error.stackTraceLimit = config.logging.stackTraceLimit

// const join = format(info => ({
// 	...info,
// 	message: [ info.message, ...(info[Symbol.for('splat')] ?? []) ].join(' '),
// }))

const createLogger = ({ label }) => winston.createLogger({
	level: config.logging.level,
	transports: [
		new transports.Console(),
	],
	exitOnError: true,
	format: format.combine(
		// join(),
		format.label({ label }),
		format.timestamp(),
		format.colorize(),
		format.errors({ stack: true }),
		format.printf(({ timestamp, level, label, message, stack, ...rest }) => [
			`${timestamp} [${level}] [${label}]: ${message} `,
			JSON.stringify(rest),
			stack ? `\n${stack}` : '',
		].join('')),
	),
})


module.exports = createLogger
