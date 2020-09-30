const winston = require('winston')

const config = require('../../config.json')

const { format, transports } = winston


const join = format(info => ({
	...info,
	message: [ info.message, ...(info[Symbol.for('splat')] ?? []) ].join(' '),
}))

const createLogger = ({ label }) => winston.createLogger({
	level: config.logging.level,
	transports: [
		new transports.Console(),
	],
	exitOnError: false,
	format: format.combine(
		join(),
		format.label({ label }),
		format.colorize(),
		format.printf(({ level, label, message }) =>
			`[${level}] [${label}]: ${message}`),
	),
})


module.exports = createLogger
