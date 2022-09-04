const winston = require('winston')

const config = require('../../config.json')

const { format, transports } = winston


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
		format.colorize(),
		format.errors({ stack: true }),
		format.printf(({ level, label, message, stack, ...rest }) =>
			`[${level}] [${label}]: ${message} ${JSON.stringify(rest)}${stack ? '\n' + stack : ''}`),
	),
})


module.exports = createLogger
