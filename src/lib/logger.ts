import winston from 'winston'

import { CONFIG_FILE } from '../config'
import deepEqual from '../lib/deepEqual'

const config = import(CONFIG_FILE)
const { format, transports } = winston

// const join = format(info => ({
// 	...info,
// 	message: [ info.message, ...(info[Symbol.for('splat')] ?? []) ].join(' '),
// }))

const createLogger = async ({ label }: { label: string }) => {
	Error.stackTraceLimit = (await config).logging.stackTraceLimit

	return winston.createLogger({
		level: (await config).logging.level,
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
				deepEqual(rest, {}) ? '' : JSON.stringify(rest, null, '    '),
				stack ? `\n${stack}` : '',
			].join('')),
		),
	})
}

export default createLogger
